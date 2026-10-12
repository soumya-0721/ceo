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
export declare const MIN_JWT_SECRET_LENGTH = 32;
/**
 * Values that are publicly known and must never be used to sign tokens.
 * `next360-default-secret` is the legacy hardcoded fallback that this module
 * replaces; keeping it listed lets us reject it explicitly even if a future
 * change raises or lowers the length rule.
 */
export declare const KNOWN_INSECURE_SECRETS: readonly string[];
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
export declare function isProductionEnv(nodeEnv: string | undefined): boolean;
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
export declare function validateJwtSecret(rawSecret: string | undefined, nodeEnv: string | undefined): JwtSecretValidation;
