import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireRole, requireCoordinator, requireCEO } from '../middleware/auth';
import { config } from '../config/env';
import { resolveScheduleScope } from './scheduling';

/**
 * Database-free authorization tests for the schedule read path. These exercise
 * the existing authentication middleware and role gates with fake request/response
 * objects; no database pool is imported and no query is executed.
 */

test('16. unauthenticated request is rejected by the auth middleware (401)', () => {
    let nextCalled = false;
    const req: any = { cookies: {}, headers: {} };
    const res: any = { statusCode: 0, body: null };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };

    authenticateToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /No token/i);
    assert.equal(req.user, undefined);
});

test('17. malformed/expired token is rejected (403) and never sets req.user', () => {
    let nextCalled = false;
    const req: any = { cookies: {}, headers: { authorization: 'Bearer not-a-real-token' } };
    const res: any = { statusCode: 0, body: null };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };

    authenticateToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(req.user, undefined);
});

test('18. a valid token yields the authenticated user (id + role) for scope decisions', () => {
    const payload = { id: 'ceo-1', username: 'ceo', role: 'ceo', fullName: 'Samhith' };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
    let nextCalled = false;
    const req: any = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res: any = { statusCode: 0, body: null };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };

    authenticateToken(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 'ceo-1');
    assert.equal(req.user.role, 'ceo');
    // Even authenticated, a CEO cannot widen to the shared view.
    assert.deepEqual(resolveScheduleScope(req.user.role, 'all'), { allowed: false, scope: 'mine' });
});

test('19. coordinator role gate allows coordination, other roles are forbidden', () => {
    const runGate = (middleware: any, user: any) => {
        let nextCalled = false;
        const req: any = { user };
        const res: any = { statusCode: 0, body: null };
        res.status = (c: number) => { res.statusCode = c; return res; };
        res.json = (b: any) => { res.body = b; return res; };
        middleware(req, res, () => { nextCalled = true; });
        return { nextCalled, status: res.statusCode };
    };

    // Coordinator passes the coordinator gate and may use the shared scope.
    assert.equal(runGate(requireCoordinator, { id: 'coord-1', role: 'coordinator' }).nextCalled, true);
    assert.equal(resolveScheduleScope('coordinator', 'all').allowed, true);

    // CEO is rejected by the coordinator-only gate.
    assert.deepEqual(runGate(requireCoordinator, { id: 'ceo-1', role: 'ceo' }), { nextCalled: false, status: 403 });

    // Generic role guard: unknown role denied, CEO allowed by requireCEO.
    assert.equal(runGate(requireRole('coordinator'), { id: 'x', role: 'viewer' }).status, 403);
    assert.equal(runGate(requireCEO, { id: 'ceo-1', role: 'ceo' }).nextCalled, true);
    assert.equal(runGate(requireRole('ceo'), { id: 'coord-1', role: 'coordinator' }).status, 403);

    // Missing user is treated as unauthenticated by the role guards.
    assert.equal(runGate(requireRole('ceo'), undefined).status, 401);
});
