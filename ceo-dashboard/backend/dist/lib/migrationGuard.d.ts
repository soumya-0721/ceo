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
export type MigrationGuardResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
/** Returns a copy of the process-level env snapshot taken before dotenv ran. */
export declare function getProcessEnvSnapshot(): MigrationEnvSnapshot;
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
export declare function checkMigrationGuard(env: MigrationEnvSnapshot): MigrationGuardResult;
