"use strict";
/**
 * READ-ONLY diagnostic for the CEO dashboard scheduling schema.
 *
 * Purpose: report whether the 10 columns / 2 indexes used by the deployed
 * scheduling code (commit c917746) exist in the connected database.
 *
 * This is a schema report only. It does NOT prove a root cause: a missing column
 * would make a query referencing it fail, but the actual PostgreSQL error and the
 * failing endpoint still need to be confirmed before any migration is considered.
 *
 * ---------------------------------------------------------------------------
 * Which environment source is used (documented, never printed):
 *   This script imports ./database. src/config/database.ts calls
 *   `dotenv.config()` (dotenv v16) with NO explicit path, so it loads `.env`
 *   from the current working directory. It does NOT load `.env.local`.
 *   Precedence is: variables already present in the shell/process environment
 *   win over `.env` (dotenv does not override existing variables).
 *
 *   How to point this script at the intended database:
 *     - Run it from ceo-dashboard/backend so `.env` there is found, OR
 *     - Export DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SSL in the shell
 *       before running (shell values take precedence over `.env`).
 *   Then compare the printed "Database" and "DB user" lines with the intended
 *   Neon project/branch shown in the Neon console. In production (Vercel) these
 *   variables come from the Vercel project's environment settings, not a file.
 * ---------------------------------------------------------------------------
 *
 * Safety contract:
 *  - Executes ONLY read-only SELECTs against information_schema.columns and pg_indexes.
 *  - No INSERT/UPDATE/DELETE/DDL, no transaction, no temp objects.
 *  - Never prints connection configuration or credentials (no env, no pool config,
 *    no error.message / connection strings). Only the database name, database user,
 *    column names/types, index names and a summary are printed.
 *  - It connects only when YOU run it. It is never imported by the app or by tests.
 *
 * Run from ceo-dashboard/backend with:   npm run inspect:scheduling
 * (or: npx ts-node src/config/inspect-scheduling-schema.ts)
 *
 * Exit codes: 0 = columns and indexes complete; 1 = columns incomplete;
 *             3 = columns complete but index(es) missing/mismatched; 2 = could not run.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const EXPECTED_COLUMNS = [
    { table: 'bookings', column: 'schedule_id' },
    { table: 'bookings', column: 'approved_by' },
    { table: 'bookings', column: 'approved_at' },
    { table: 'bookings', column: 'handled_at' },
    { table: 'schedules', column: 'is_ceo_appointment' },
    { table: 'schedules', column: 'booking_id' },
    { table: 'schedules', column: 'conflict_override' },
    { table: 'schedules', column: 'override_by' },
    { table: 'schedules', column: 'override_at' },
    { table: 'schedules', column: 'override_reason' }
];
const EXPECTED_INDEXES = [
    { index: 'idx_bookings_schedule', table: 'bookings', column: 'schedule_id' },
    { index: 'idx_schedules_booking', table: 'schedules', column: 'booking_id' }
];
const RULE = '-'.repeat(66);
/**
 * Maps a database error to a safe description. Deliberately avoids error.message
 * because driver messages can embed host/port/database/user (connection config).
 */
function safeError(err) {
    const code = err && err.code ? String(err.code) : '';
    const known = {
        ECONNREFUSED: 'the database refused the connection',
        ETIMEDOUT: 'the connection timed out',
        ENOTFOUND: 'the database host could not be resolved',
        EHOSTUNREACH: 'the database host is unreachable',
        ENETUNREACH: 'the network is unreachable',
        '28P01': 'authentication failed',
        '28000': 'authorization failed',
        '3D000': 'the target database does not exist',
        '42P01': 'a referenced table does not exist',
        '08006': 'the connection was lost',
        '08001': 'the client could not establish a connection'
    };
    const friendly = code && known[code] ? known[code] : 'an unexpected error occurred';
    return code ? `${friendly} [code ${code}]` : friendly;
}
/**
 * Extracts the indexed column names from a pg_indexes.indexdef string, e.g.
 * "CREATE INDEX idx_bookings_schedule ON public.bookings USING btree (schedule_id)"
 * -> ["schedule_id"]. Handles simple column indexes (optionally with ASC/DESC).
 */
function parseIndexColumns(indexdef) {
    const match = indexdef.match(/\(([^)]*)\)\s*$/);
    if (!match)
        return [];
    return match[1]
        .split(',')
        .map(part => part.trim().split(/\s+/)[0].replace(/["'`]/g, ''))
        .filter(Boolean);
}
async function inspect() {
    // ---- READ-ONLY statement 1/3: identity (metadata only) ----
    const identity = await database_1.default.query(`SELECT current_database() AS database_name,
                current_user      AS database_user,
                inet_server_addr()::text AS server_address`);
    const id = identity.rows[0] || {};
    // ---- READ-ONLY statement 2/3: columns on the two relevant tables ----
    const columnResult = await database_1.default.query(`SELECT table_name, column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('bookings', 'schedules')
          ORDER BY table_name, column_name`);
    // ---- READ-ONLY statement 3/3: indexes that exist under the expected names ----
    const indexResult = await database_1.default.query(`SELECT indexname, tablename, indexdef
           FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN ('idx_bookings_schedule', 'idx_schedules_booking')
          ORDER BY indexname`);
    // ---- Report ----
    console.log(RULE);
    console.log('CEO dashboard scheduling schema - READ-ONLY diagnostic');
    console.log(RULE);
    console.log(`Database : ${id.database_name ?? '(unknown)'}`);
    console.log(`DB user  : ${id.database_user ?? '(unknown)'}`);
    console.log(`Server   : ${id.server_address ?? '(not reported by pooler)'}`);
    console.log('');
    const foundColumns = new Map();
    const foundTables = new Set();
    for (const row of columnResult.rows) {
        foundTables.add(row.table_name);
        foundColumns.set(`${row.table_name}.${row.column_name}`, {
            dataType: row.data_type,
            nullable: row.is_nullable
        });
    }
    console.log('Expected columns');
    const presentColumns = [];
    const missingColumns = [];
    for (const { table, column } of EXPECTED_COLUMNS) {
        const key = `${table}.${column}`;
        const found = foundColumns.get(key);
        if (found) {
            presentColumns.push(key);
            console.log(`  [x] ${key} (${found.dataType}${found.nullable === 'NO' ? ', NOT NULL' : ''})`);
        }
        else {
            missingColumns.push(key);
            console.log(`  [ ] ${key} -- MISSING`);
        }
    }
    console.log('');
    // Map index name -> the table(s) and indexed column(s) it actually belongs to,
    // parsed from indexdef. An index is only counted when it exists on the expected
    // table AND is defined on the intended column.
    const indexInfo = new Map();
    for (const row of indexResult.rows) {
        const entry = indexInfo.get(row.indexname) || { tables: [], columns: new Set() };
        entry.tables.push(row.tablename);
        for (const col of parseIndexColumns(String(row.indexdef || '')))
            entry.columns.add(col);
        indexInfo.set(row.indexname, entry);
    }
    console.log('Expected indexes (name must exist on the correct table AND column)');
    const presentIndexes = [];
    const missingIndexes = [];
    const mismatchedIndexes = [];
    const wrongColumnIndexes = [];
    for (const { index, table, column } of EXPECTED_INDEXES) {
        const info = indexInfo.get(index);
        if (!info) {
            missingIndexes.push(index);
            console.log(`  [ ] ${index} on ${table}(${column}) -- MISSING`);
        }
        else if (!info.tables.includes(table)) {
            mismatchedIndexes.push(index);
            console.log(`  [!] ${index} expected on ${table}(${column}) but found on ${info.tables.join(', ')} -- WRONG TABLE`);
        }
        else if (!info.columns.has(column)) {
            wrongColumnIndexes.push(index);
            console.log(`  [!] ${index} exists on ${table} but indexes (${[...info.columns].join(', ') || 'unknown'}), not (${column}) -- WRONG COLUMN`);
        }
        else {
            presentIndexes.push(index);
            console.log(`  [x] ${index} on ${table}(${column})`);
        }
    }
    console.log('');
    const missingTables = ['bookings', 'schedules'].filter(t => !foundTables.has(t));
    if (missingTables.length > 0) {
        console.log(`WARNING: table(s) not found: ${missingTables.join(', ')}`);
        console.log('');
    }
    const columnsComplete = missingColumns.length === 0 && missingTables.length === 0;
    const indexesComplete = missingIndexes.length === 0 && mismatchedIndexes.length === 0 && wrongColumnIndexes.length === 0;
    console.log(RULE);
    console.log('SUMMARY');
    console.log(`  Columns present (on expected tables) : ${presentColumns.length} / ${EXPECTED_COLUMNS.length}`);
    console.log(`  Indexes present (on expected table+column) : ${presentIndexes.length} / ${EXPECTED_INDEXES.length}`);
    if (missingColumns.length > 0) {
        console.log(`  Missing columns : ${missingColumns.join(', ')}`);
    }
    if (missingTables.length > 0) {
        console.log(`  Missing tables  : ${missingTables.join(', ')}`);
    }
    if (missingIndexes.length > 0) {
        console.log(`  Missing indexes : ${missingIndexes.join(', ')}`);
    }
    if (mismatchedIndexes.length > 0) {
        console.log(`  Indexes on wrong table : ${mismatchedIndexes.join(', ')}`);
    }
    if (wrongColumnIndexes.length > 0) {
        console.log(`  Indexes on wrong column : ${wrongColumnIndexes.join(', ')}`);
    }
    console.log(`  Column status : ${columnsComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`  Index status  : ${indexesComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log('');
    // Columns and indexes are reported separately on purpose. A missing column
    // MAY explain a query failure, but this schema report alone does not prove
    // root cause. A missing index is a performance concern and never produces a
    // PostgreSQL undefined-column error.
    if (!columnsComplete) {
        console.log('  Column status is INCOMPLETE.');
        console.log('  -> Missing required columns may explain the dashboard loading failure.');
        console.log('     Confirm the failing query and PostgreSQL error before migrating.');
    }
    else {
        console.log('  All expected columns are present.');
        console.log('  -> These ten columns are ruled out, but this does NOT rule out every');
        console.log('     other database or backend cause. Confirm the actual API error and logs.');
    }
    if (!indexesComplete) {
        console.log('  Index note: one or more expected indexes are missing, on the wrong table, or on the wrong column.');
        console.log('  -> Indexes affect performance only; on their own they do NOT cause a PostgreSQL undefined-column error.');
        console.log('     The scheduling migration also creates these indexes.');
    }
    console.log(RULE);
    if (!columnsComplete)
        return 1;
    if (!indexesComplete)
        return 3;
    return 0;
}
async function main() {
    try {
        process.exitCode = await inspect();
    }
    catch (err) {
        console.error(`Diagnostic could not run: ${safeError(err)}`);
        process.exitCode = 2;
    }
    finally {
        // Close the pool so the process exits cleanly. Never process.exit() mid-query.
        await database_1.default.end().catch(() => undefined);
    }
}
main();
//# sourceMappingURL=inspect-scheduling-schema.js.map