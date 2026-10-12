// Load the fail-safe guard BEFORE ./database (and therefore before dotenv runs) so
// its snapshot reflects only values that were really set in the process environment.
import { checkMigrationGuard, getProcessEnvSnapshot } from '../lib/migrationGuard';
import pool from './database';

/**
 * Additive, idempotent migration for the meeting-approval + smart-scheduling work.
 *
 * Fail-safe guard (see ../lib/migrationGuard):
 *  - Requires the explicit opt-in ALLOW_SCHEDULING_MIGRATION=true.
 *  - Requires the required connection variables to be present at process level
 *    (not merely inherited from a local .env file).
 *  - Requires MIGRATION_EXPECTED_DB_NAME and MIGRATION_EXPECTED_DB_USER to match
 *    the configured DB_NAME / DB_USER - an explicit identity, not a hostname sniff.
 *  - Requires DB_SSL=true (Neon requires TLS; the code default is ssl:false).
 *  - Fails closed BEFORE any connection is opened; error messages contain only
 *    variable names, never values.
 *
 * SQL guarantees:
 *  - Only ADDs nullable columns / constant defaults and indexes. It never drops,
 *    rewrites, renames or deletes existing columns, rows, tables or constraints.
 *  - Every statement uses IF NOT EXISTS, so re-running is a no-op even when some
 *    columns or indexes already exist.
 *  - All DDL runs inside one transaction. PostgreSQL supports transactional DDL,
 *    so any failure rolls the whole migration back and leaves the schema untouched.
 *
 * Foreign keys on approved_by / override_by intentionally keep the default
 * NO ACTION behaviour, matching the pre-existing created_by / handled_by columns.
 * The application has no user-deletion path, and blocking a delete preserves the
 * audit trail rather than silently nulling it.
 *
 * Run with:  npm run migrate:scheduling   (from ceo-dashboard/backend)
 * with the env contract documented in ../lib/migrationGuard.
 * NOTE: executing this file opens a database connection after the guard passes.
 * It is NOT run automatically and must not be executed without explicit approval.
 */
async function migrateScheduling() {
    const guard = checkMigrationGuard(getProcessEnvSnapshot());
    if (!guard.ok) {
        // Fail closed: no connection is opened when the guard is not satisfied.
        console.error('[migrate:scheduling]', guard.error);
        console.error('[migrate:scheduling] No database connection was opened. Fix the variables named above and re-run.');
        process.exit(2);
    }

    const client = await pool.connect();
    let exitCode = 0;
    try {
        console.log('Running scheduling migration...');
        await client.query('BEGIN');

        const statements: string[] = [
            // Bookings: link the approved booking to the single CEO meeting it creates,
            // and record who approved it and when. approved_by / approved_at are distinct
            // from handled_by / handled_at, which track the last coordinator action
            // (including rejection / cancellation).
            `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL`,
            `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)`,
            `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
            `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handled_at TIMESTAMP`,

            // Schedules: distinguish CEO appointments from coordinator-only entries,
            // link back to a booking, and record explicit conflict overrides.
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_ceo_appointment BOOLEAN DEFAULT false`,
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL`,
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS conflict_override BOOLEAN DEFAULT false`,
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES users(id)`,
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS override_at TIMESTAMP`,
            `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS override_reason TEXT`,

            // Indexes for the booking <-> CEO-meeting lookups. Both are FK columns with
            // ON DELETE SET NULL, so an index also keeps those cascaded updates cheap.
            `CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id)`,
            `CREATE INDEX IF NOT EXISTS idx_schedules_booking ON schedules(booking_id)`
        ];

        for (const sql of statements) {
            await client.query(sql);
            console.log(`OK: ${sql.substring(0, 60)}...`);
        }

        await client.query('COMMIT');
        console.log('Scheduling migration complete!');
    } catch (error: any) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error('Scheduling migration error:', error.message);
        exitCode = 1;
    } finally {
        client.release();
    }

    // Release the pool cleanly, then set the exit code. Never call process.exit()
    // inside try/finally: doing so skips client.release() and leaves the pool open.
    await pool.end().catch(() => undefined);
    process.exit(exitCode);
}

migrateScheduling();
