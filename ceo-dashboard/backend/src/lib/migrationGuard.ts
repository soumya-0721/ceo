/**
 * Fail-safe guard for the scheduling migration.
 *
 * This module is intentionally FREE of any database imports so it can be unit
 * tested without a database connection. It only reads process-level environment
 * variables and compares them against an explicit expected identity.
 *
 * The snapshot is captured when this module is first loaded. The migration script
 * imports this module BEFORE it imports ./database, so the snapshot reflects the
 * environment as it exists BEFORE dotenv merges in a local .env file. That lets us
 * tell "the operator set these in the shell" apart from "these came from a .env
 * file" - an accidental fallback to production credentials therefore fails closed.
 */

export interface MigrationEnvSnapshot {
    ALLOW_SCHEDULING_MIGRATION?: string;
    MIGRATION_EXPECTED_DB_NAME?: string;
    MIGRATION_EXPECTED_DB_USER?: string;
    DB_HOST?: string;
    DB_PORT?: string;
    DB_NAME?: string;
    DB_USER?: string;
    DB_PASSWORD?: string;
    DB_SSL?: string;
}

export type MigrationGuardResult = { ok: true } | { ok: false; error: string };

function captureProcessEnv(): MigrationEnvSnapshot {
    return {
        ALLOW_SCHEDULING_MIGRATION: process.env.ALLOW_SCHEDULING_MIGRATION,
        MIGRATION_EXPECTED_DB_NAME: process.env.MIGRATION_EXPECTED_DB_NAME,
        MIGRATION_EXPECTED_DB_USER: process.env.MIGRATION_EXPECTED_DB_USER,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_SSL: process.env.DB_SSL
    };
}

// Captured at module-load time: the migration script imports { migrationGuard }
// before { database }, so this runs before dotenv merges any local .env file.
const captured = captureProcessEnv();

/** Returns a copy of the process-level env snapshot taken before dotenv ran. */
export function getProcessEnvSnapshot(): MigrationEnvSnapshot {
    return { ...captured };
}

const trim = (value: string | undefined): string => (value === undefined ? '' : String(value).trim());

/**
 * Fail-closed check. Returns { ok: true } only when:
 *  - the ALLOW_SCHEDULING_MIGRATION opt-in flag is "true";
 *  - the required connection variables were present at process level (so a local
 *    .env file could not have silently steered the migration elsewhere);
 *  - DB_SSL is "true" (Neon requires TLS; the code default is ssl:false);
 *  - the explicit expected database identity matches the configured target for
 *    both the database name and the user - not merely a hostname substring check.
 *
 * Error messages only contain variable NAMES, never values, so no secret can be
 * printed by this guard.
 */
export function checkMigrationGuard(env: MigrationEnvSnapshot): MigrationGuardResult {
    if (trim(env.ALLOW_SCHEDULING_MIGRATION).toLowerCase() !== 'true') {
        return { ok: false, error: 'Refusing to run: ALLOW_SCHEDULING_MIGRATION must be set to "true" (this is an explicit opt-in for a database-changing migration).' };
    }

    const requiredKey: (keyof MigrationEnvSnapshot)[] = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
    for (const key of requiredKey) {
        if (trim(env[key]) === '') {
            return { ok: false, error: `Refusing to run: ${key} must be set in the process environment (missing or empty).` };
        }
    }

    const port = String(env.DB_PORT).trim();
    if (!/^\d+$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
        return { ok: false, error: 'Refusing to run: DB_PORT must be a valid numeric port (1-65535).' };
    }

    if (trim(env.DB_SSL).toLowerCase() !== 'true') {
        return { ok: false, error: 'Refusing to run: DB_SSL must be set to "true".' };
    }

    if (trim(env.MIGRATION_EXPECTED_DB_NAME) === '') {
        return { ok: false, error: 'Refusing to run: MIGRATION_EXPECTED_DB_NAME must be set to the exact database name you intend to migrate.' };
    }
    if (trim(env.MIGRATION_EXPECTED_DB_USER) === '') {
        return { ok: false, error: 'Refusing to run: MIGRATION_EXPECTED_DB_USER must be set to the exact database user you intend to use.' };
    }

    if (trim(env.MIGRATION_EXPECTED_DB_NAME) !== trim(env.DB_NAME)) {
        return { ok: false, error: 'Refusing to run: MIGRATION_EXPECTED_DB_NAME does not match the configured DB_NAME (database identity mismatch).' };
    }
    if (trim(env.MIGRATION_EXPECTED_DB_USER) !== trim(env.DB_USER)) {
        return { ok: false, error: 'Refusing to run: MIGRATION_EXPECTED_DB_USER does not match the configured DB_USER (database identity mismatch).' };
    }

    return { ok: true };
}