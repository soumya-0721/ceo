/**
 * Pure, side-effect-free validation of security-critical environment settings.
 *
 * Kept separate from ../config/env on purpose:
 *  - it imports nothing (no dotenv, no database pool), so unit tests can exercise
 *    it without loading local configuration or opening connections;
 *  - it never returns or logs the secret value itself - only a classification -
 *    so a failing check can never leak a credential into logs.
 */

/** Minimum acceptable length for a JWT signing secret. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Values that are publicly known and must never be used to sign tokens.
 * `next360-default-secret` is the legacy hardcoded fallback that this module
 * replaces; keeping it listed lets us reject it explicitly even if a future
 * change raises or lowers the length rule.
 */
export const KNOWN_INSECURE_SECRETS: readonly string[] = ['next360-default-secret'];

export type JwtSecretReason = 'missing' | 'too-short' | 'known-insecure';

export interface JwtSecretValidation {
    /** Whether the present configuration is safe enough to start the process. */
    ok: boolean;
    /** True only when a strong, operator-supplied secret is present. */
    configured: boolean;
    reason?: JwtSecretReason;
    /** Human-readable explanation that contains variable names only - never values. */
    message?: string;
}

export function isProductionEnv(nodeEnv: string | undefined): boolean {
    return (nodeEnv ?? '').trim().toLowerCase() === 'production';
}

function reasonText(reason: JwtSecretReason): string {
    switch (reason) {
        case 'missing':
            return 'JWT_SECRET is not set';
        case 'too-short':
            return `JWT_SECRET is too short (minimum ${MIN_JWT_SECRET_LENGTH} characters)`;
        case 'known-insecure':
            return 'JWT_SECRET is set to a publicly known default value';
    }
}

function productionFailure(reason: JwtSecretReason): JwtSecretValidation {
    return {
        ok: false,
        configured: false,
        reason,
        message: `Refusing to start in production: ${reasonText(reason)}. Set a strong, unique JWT_SECRET (>= ${MIN_JWT_SECRET_LENGTH} characters).`
    };
}

/**
 * Decides whether a JWT signing secret may be used.
 *
 * Rules:
 *  - A strong secret (>= MIN_JWT_SECRET_LENGTH characters and not publicly known)
 *    is accepted in every environment.
 *  - In production, a missing / too-short / known-insecure secret fails closed.
 *  - In non-production, an absent or weak secret is tolerated ({ ok: true,
 *    configured: false }) so the caller can generate an ephemeral dev secret
 *    instead of silently falling back to a shared, hardcoded value.
 */
export function validateJwtSecret(rawSecret: string | undefined, nodeEnv: string | undefined): JwtSecretValidation {
    const secret = (rawSecret ?? '').trim();

    if (KNOWN_INSECURE_SECRETS.includes(secret)) {
        if (isProductionEnv(nodeEnv)) return productionFailure('known-insecure');
        return { ok: true, configured: false };
    }

    if (secret.length >= MIN_JWT_SECRET_LENGTH) {
        return { ok: true, configured: true };
    }

    if (isProductionEnv(nodeEnv)) {
        return productionFailure(secret.length === 0 ? 'missing' : 'too-short');
    }

    return { ok: true, configured: false };
}
