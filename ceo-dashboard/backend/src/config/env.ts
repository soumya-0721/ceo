import crypto from 'crypto';
import dotenv from 'dotenv';
import { validateJwtSecret, MIN_JWT_SECRET_LENGTH } from '../lib/envValidation';

dotenv.config();

const nodeEnv = process.env.NODE_ENV;
const jwtValidation = validateJwtSecret(process.env.JWT_SECRET, nodeEnv);

// Fail closed: never fall back to a shared/default signing secret. In production a
// missing or weak JWT_SECRET aborts startup (the process throws before serving).
if (!jwtValidation.ok) {
    throw new Error(jwtValidation.message);
}

const configuredJwtSecret = jwtValidation.configured ? (process.env.JWT_SECRET as string).trim() : undefined;

if (!configuredJwtSecret) {
    // Development / test only. A per-process random secret keeps local sessions
    // working without ever substituting a known value. No secret is logged.
    console.warn(
        `[config] JWT_SECRET is not set to a strong value (>= ${MIN_JWT_SECRET_LENGTH} chars). ` +
        'Using an ephemeral development secret; issued tokens are invalid after restart. ' +
        'Set JWT_SECRET in ceo-dashboard/backend/.env for stable local sessions.'
    );
}

export const config = {
    port: parseInt(process.env.PORT || '3000'),
    jwtSecret: configuredJwtSecret || crypto.randomBytes(48).toString('hex'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'next360_ceo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    }
};
