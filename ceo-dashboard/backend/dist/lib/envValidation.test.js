"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const envValidation_1 = require("./envValidation");
const STRONG = 'a'.repeat(envValidation_1.MIN_JWT_SECRET_LENGTH);
const LEGACY_DEFAULT = envValidation_1.KNOWN_INSECURE_SECRETS[0];
(0, node_test_1.test)('20. a strong, operator-supplied JWT secret is accepted in every environment', () => {
    for (const env of ['production', 'development', 'test', undefined]) {
        const result = (0, envValidation_1.validateJwtSecret)(STRONG, env);
        strict_1.default.equal(result.ok, true, `expected ok in ${env}`);
        strict_1.default.equal(result.configured, true, `expected configured in ${env}`);
    }
});
(0, node_test_1.test)('21. production fails closed when JWT_SECRET is missing or empty', () => {
    for (const value of [undefined, '', '   \t  ']) {
        const result = (0, envValidation_1.validateJwtSecret)(value, 'production');
        strict_1.default.equal(result.ok, false);
        strict_1.default.equal(result.configured, false);
        strict_1.default.equal(result.reason, 'missing');
    }
});
(0, node_test_1.test)('22. production rejects a secret shorter than the minimum length', () => {
    const result = (0, envValidation_1.validateJwtSecret)('short-secret', 'production');
    strict_1.default.equal(result.ok, false);
    strict_1.default.equal(result.configured, false);
    strict_1.default.equal(result.reason, 'too-short');
});
(0, node_test_1.test)('22b. production rejects the exact legacy default value explicitly', () => {
    const result = (0, envValidation_1.validateJwtSecret)(LEGACY_DEFAULT, 'production');
    strict_1.default.equal(result.ok, false);
    strict_1.default.equal(result.reason, 'known-insecure');
});
(0, node_test_1.test)('22c. the legacy default is never treated as configured, even in development', () => {
    const result = (0, envValidation_1.validateJwtSecret)(LEGACY_DEFAULT, 'development');
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.configured, false);
});
(0, node_test_1.test)('22d. production accepts a secret whose trimmed length meets the minimum', () => {
    const result = (0, envValidation_1.validateJwtSecret)(`  ${STRONG}  `, 'production');
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.configured, true);
});
(0, node_test_1.test)('23. development tolerates missing/weak secrets but never marks them configured', () => {
    for (const value of [undefined, '', 'short', LEGACY_DEFAULT]) {
        const result = (0, envValidation_1.validateJwtSecret)(value, 'development');
        strict_1.default.equal(result.ok, true, `expected ok for ${String(value)}`);
        strict_1.default.equal(result.configured, false, `expected not configured for ${String(value)}`);
    }
});
(0, node_test_1.test)('24. failure messages never contain the (rejected) secret value', () => {
    const weak = 'my-super-secret-value-12345';
    const result = (0, envValidation_1.validateJwtSecret)(weak, 'production');
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.message && !result.message.includes(weak));
    strict_1.default.ok(!JSON.stringify(result).includes(weak));
});
(0, node_test_1.test)('25. isProductionEnv only treats the literal "production" as production', () => {
    strict_1.default.equal((0, envValidation_1.isProductionEnv)('production'), true);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)('PRODUCTION'), true);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)(' production '), true);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)('development'), false);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)('staging'), false);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)(undefined), false);
    strict_1.default.equal((0, envValidation_1.isProductionEnv)(''), false);
});
//# sourceMappingURL=envValidation.test.js.map