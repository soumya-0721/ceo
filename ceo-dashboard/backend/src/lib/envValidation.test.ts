import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateJwtSecret,
    isProductionEnv,
    MIN_JWT_SECRET_LENGTH,
    KNOWN_INSECURE_SECRETS
} from './envValidation';

const STRONG = 'a'.repeat(MIN_JWT_SECRET_LENGTH);
const LEGACY_DEFAULT = KNOWN_INSECURE_SECRETS[0];

test('20. a strong, operator-supplied JWT secret is accepted in every environment', () => {
    for (const env of ['production', 'development', 'test', undefined]) {
        const result = validateJwtSecret(STRONG, env);
        assert.equal(result.ok, true, `expected ok in ${env}`);
        assert.equal(result.configured, true, `expected configured in ${env}`);
    }
});

test('21. production fails closed when JWT_SECRET is missing or empty', () => {
    for (const value of [undefined, '', '   \t  ']) {
        const result = validateJwtSecret(value, 'production');
        assert.equal(result.ok, false);
        assert.equal(result.configured, false);
        assert.equal(result.reason, 'missing');
    }
});

test('22. production rejects a secret shorter than the minimum length', () => {
    const result = validateJwtSecret('short-secret', 'production');
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
    assert.equal(result.reason, 'too-short');
});

test('22b. production rejects the exact legacy default value explicitly', () => {
    const result = validateJwtSecret(LEGACY_DEFAULT, 'production');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'known-insecure');
});

test('22c. the legacy default is never treated as configured, even in development', () => {
    const result = validateJwtSecret(LEGACY_DEFAULT, 'development');
    assert.equal(result.ok, true);
    assert.equal(result.configured, false);
});

test('22d. production accepts a secret whose trimmed length meets the minimum', () => {
    const result = validateJwtSecret(`  ${STRONG}  `, 'production');
    assert.equal(result.ok, true);
    assert.equal(result.configured, true);
});

test('23. development tolerates missing/weak secrets but never marks them configured', () => {
    for (const value of [undefined, '', 'short', LEGACY_DEFAULT]) {
        const result = validateJwtSecret(value, 'development');
        assert.equal(result.ok, true, `expected ok for ${String(value)}`);
        assert.equal(result.configured, false, `expected not configured for ${String(value)}`);
    }
});

test('24. failure messages never contain the (rejected) secret value', () => {
    const weak = 'my-super-secret-value-12345';
    const result = validateJwtSecret(weak, 'production');
    assert.equal(result.ok, false);
    assert.ok(result.message && !result.message.includes(weak));
    assert.ok(!JSON.stringify(result).includes(weak));
});

test('25. isProductionEnv only treats the literal "production" as production', () => {
    assert.equal(isProductionEnv('production'), true);
    assert.equal(isProductionEnv('PRODUCTION'), true);
    assert.equal(isProductionEnv(' production '), true);
    assert.equal(isProductionEnv('development'), false);
    assert.equal(isProductionEnv('staging'), false);
    assert.equal(isProductionEnv(undefined), false);
    assert.equal(isProductionEnv(''), false);
});
