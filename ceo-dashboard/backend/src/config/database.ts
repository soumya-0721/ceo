import { Pool, types, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// DATE columns (schedule_date, booking_date, ...) are returned as local-midnight
// Date objects which serialise to ISO timestamps (e.g. 2026-10-06T18:30:00.000Z).
// Keep them as plain 'YYYY-MM-DD' strings so every comparison in the app is exact.
types.setTypeParser(1082, (value: string) => value);

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'next360_ceo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    // Cold connections to the hosted database can take several seconds to establish;
    // a 5s limit caused intermittent "timeout exceeded when trying to connect" 500s.
    connectionTimeoutMillis: 15000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

/** Transient connection failures worth one quick retry (cold pool / dropped socket). */
function isTransient(err: any): boolean {
    if (!err) return false;
    const code = err.code || '';
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(code)) return true;
    return /timeout exceeded|Connection ended|Connection terminated|Client has encountered|terminating connection/i.test(err.message || '');
}

/** Runs a query, retrying once on a transient connection error. */
export async function queryRetry(text: string, params?: any[], retries = 1): Promise<QueryResult<any>> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (err: any) {
            if (attempt >= retries || !isTransient(err)) throw err;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }
}

export default pool;
