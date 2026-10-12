"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const env_1 = require("../config/env");
const scheduling_1 = require("./scheduling");
/**
 * Database-free authorization tests for the schedule read path. These exercise
 * the existing authentication middleware and role gates with fake request/response
 * objects; no database pool is imported and no query is executed.
 */
(0, node_test_1.default)('16. unauthenticated request is rejected by the auth middleware (401)', () => {
    let nextCalled = false;
    const req = { cookies: {}, headers: {} };
    const res = { statusCode: 0, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    (0, auth_1.authenticateToken)(req, res, () => { nextCalled = true; });
    strict_1.default.equal(nextCalled, false);
    strict_1.default.equal(res.statusCode, 401);
    strict_1.default.match(res.body.error, /No token/i);
    strict_1.default.equal(req.user, undefined);
});
(0, node_test_1.default)('17. malformed/expired token is rejected (403) and never sets req.user', () => {
    let nextCalled = false;
    const req = { cookies: {}, headers: { authorization: 'Bearer not-a-real-token' } };
    const res = { statusCode: 0, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    (0, auth_1.authenticateToken)(req, res, () => { nextCalled = true; });
    strict_1.default.equal(nextCalled, false);
    strict_1.default.equal(res.statusCode, 403);
    strict_1.default.equal(req.user, undefined);
});
(0, node_test_1.default)('18. a valid token yields the authenticated user (id + role) for scope decisions', () => {
    const payload = { id: 'ceo-1', username: 'ceo', role: 'ceo', fullName: 'Samhith' };
    const token = jsonwebtoken_1.default.sign(payload, env_1.config.jwtSecret, { expiresIn: '1h' });
    let nextCalled = false;
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = { statusCode: 0, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    (0, auth_1.authenticateToken)(req, res, () => { nextCalled = true; });
    strict_1.default.equal(nextCalled, true);
    strict_1.default.equal(req.user.id, 'ceo-1');
    strict_1.default.equal(req.user.role, 'ceo');
    // Even authenticated, a CEO cannot widen to the shared view.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)(req.user.role, 'all'), { allowed: false, scope: 'mine' });
});
(0, node_test_1.default)('19. coordinator role gate allows coordination, other roles are forbidden', () => {
    const runGate = (middleware, user) => {
        let nextCalled = false;
        const req = { user };
        const res = { statusCode: 0, body: null };
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (b) => { res.body = b; return res; };
        middleware(req, res, () => { nextCalled = true; });
        return { nextCalled, status: res.statusCode };
    };
    // Coordinator passes the coordinator gate and may use the shared scope.
    strict_1.default.equal(runGate(auth_1.requireCoordinator, { id: 'coord-1', role: 'coordinator' }).nextCalled, true);
    strict_1.default.equal((0, scheduling_1.resolveScheduleScope)('coordinator', 'all').allowed, true);
    // CEO is rejected by the coordinator-only gate.
    strict_1.default.deepEqual(runGate(auth_1.requireCoordinator, { id: 'ceo-1', role: 'ceo' }), { nextCalled: false, status: 403 });
    // Generic role guard: unknown role denied, CEO allowed by requireCEO.
    strict_1.default.equal(runGate((0, auth_1.requireRole)('coordinator'), { id: 'x', role: 'viewer' }).status, 403);
    strict_1.default.equal(runGate(auth_1.requireCEO, { id: 'ceo-1', role: 'ceo' }).nextCalled, true);
    strict_1.default.equal(runGate((0, auth_1.requireRole)('ceo'), { id: 'coord-1', role: 'coordinator' }).status, 403);
    // Missing user is treated as unauthenticated by the role guards.
    strict_1.default.equal(runGate((0, auth_1.requireRole)('ceo'), undefined).status, 401);
});
//# sourceMappingURL=scheduleAuthz.test.js.map