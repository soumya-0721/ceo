import { Pool, QueryResult } from 'pg';
declare const pool: Pool;
/** Runs a query, retrying once on a transient connection error. */
export declare function queryRetry(text: string, params?: any[], retries?: number): Promise<QueryResult<any>>;
/**
 * Runs `fn` inside a single transaction. Commit on success, rollback on any error.
 * A per-key advisory lock serialises concurrent operations for the same key
 * (e.g. a booking date) so two simultaneous requests cannot both pass a conflict
 * check and create overlapping records.
 */
export declare function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>, advisoryKey?: string): Promise<T>;
export default pool;
