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
export {};
