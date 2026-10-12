import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMigrationGuard, getProcessEnvSnapshot, MigrationEnvSnapshot } from './migrationGuard';

function validEnv(overrides: Partial<MigrationEnvSnapshot> = {}): MigrationEnvSnapshot {
    return {
        ALLOW_SCHEDULING_MIGRATION: 'true',
        MIGRATION_EXPECTED_DB_NAME: 'next360_ceo',
        MIGRATION_EXPECTED_DB_USER: 'next360_app',
        DB_HOST: 'branch-endpoint.neon.tech',
        DB_PORT: '5432',
        DB_NAME: 'next360_ceo',
        DB_USER: 'next360_app',
        DB_PASSWORD: 'a-fake-password',
        DB_SSL: 'true',
        ...overrides
    };
}

test('guard ALLOWS a fully-specified, matching environment', () => {
    assert.deepEqual(checkMigrationGuard(validEnv()), { ok: true });
});

test('guard ALLOWS when the flag and true values use uppercase', () => {
    assert.deepEqual(checkMigrationGuard(validEnv({ ALLOW_SCHEDULING_MIGRATION: 'TRUE', DB_SSL: 'TRUE' })), { ok: true });
});

test('guard DENIES when the explicit opt-in flag is missing', () => {
    const env = validEnv();
    delete env.ALLOW_SCHEDULING_MIGRATION;
    const result = checkMigrationGuard(env);
    assert.equal(result.ok, false);
    assert.match((result as any).error, /ALLOW_SCHEDULING_MIGRATION/);
});

test('guard DENIES when the opt-in flag is not "true"', () => {
    const result = checkMigrationGuard(validEnv({ ALLOW_SCHEDULING_MIGRATION: 'false' }));
    assert.equal(result.ok, false);
});

test('guard DENIES when a required connection variable is missing at process level', () => {
    const env = validEnv();
    delete env.DB_HOST;
    const result = checkMigrationGuard(env);
    assert.equal(result.ok, false);
    assert.match((result as any).error, /DB_HOST/);
});

test('guard DENIES when a required variable is empty', () => {
    const result = checkMigrationGuard(validEnv({ DB_USER: '   ' }));
    assert.equal(result.ok, false);
    assert.match((result as any).error, /DB_USER/);
});

test('guard DENIES when the password is missing (fail closed)', () => {
    const env = validEnv();
    delete env.DB_PASSWORD;
    assert.equal(checkMigrationGuard(env).ok, false);
});

test('guard DENIES a non-numeric or out-of-range port', () => {
    assert.equal(checkMigrationGuard(validEnv({ DB_PORT: 'port' })).ok, false);
    assert.equal(checkMigrationGuard(validEnv({ DB_PORT: '70000' })).ok, false);
});

test('guard DENIES when TLS is not explicitly requested', () => {
    assert.equal(checkMigrationGuard(validEnv({ DB_SSL: 'false' })).ok, false);
    assert.equal(checkMigrationGuard(validEnv({ DB_SSL: undefined })).ok, false);
});

test('guard DENIES when the expected database name is not given', () => {
    const env = validEnv();
    delete env.MIGRATION_EXPECTED_DB_NAME;
    const result = checkMigrationGuard(env);
    assert.equal(result.ok, false);
    assert.match((result as any).error, /MIGRATION_EXPECTED_DB_NAME/);
});

test('guard DENIES when the expected database user is not given', () => {
    const env = validEnv();
    delete env.MIGRATION_EXPECTED_DB_USER;
    const result = checkMigrationGuard(env);
    assert.equal(result.ok, false);
    assert.match((result as any).error, /MIGRATION_EXPECTED_DB_USER/);
});

test('guard DENIES an expected/configured database-name mismatch', () => {
    const result = checkMigrationGuard(validEnv({ DB_NAME: 'production_ceo' }));
    assert.equal(result.ok, false);
    assert.match((result as any).error, /identity mismatch/);
});

test('guard DENIES an expected/configured user mismatch', () => {
    const result = checkMigrationGuard(validEnv({ DB_USER: 'production_user' }));
    assert.equal(result.ok, false);
    assert.match((result as any).error, /identity mismatch/);
});

test('guard error messages never contain values, only variable names', () => {
    const secretish = 's3cr3t-vAlue';
    const failures = [
        checkMigrationGuard(validEnv({ DB_NAME: 'production_ceo', DB_PASSWORD: secretish })),
        checkMigrationGuard(validEnv({ DB_USER: 'admin_user', DB_PASSWORD: secretish })),
        checkMigrationGuard(validEnv({ MIGRATION_EXPECTED_DB_NAME: undefined, DB_PASSWORD: secretish }))
    ];
    for (const failure of failures) {
        assert.equal(failure.ok, false);
        const message = (failure as any).error as string;
        assert.ok(!message.includes(secretish), 'must never echo a password-like value');
        assert.ok(!message.includes('production_ceo'));
        assert.ok(!message.includes('admin_user'));
    }
});

test('process-env snapshot is a copy, not the live process.env', () => {
    const snapshot = getProcessEnvSnapshot();
    const original = { ...snapshot };
    (snapshot as any).DB_PASSWORD = 'mutated';
    const again = getProcessEnvSnapshot();
    assert.deepEqual(again, original);
});