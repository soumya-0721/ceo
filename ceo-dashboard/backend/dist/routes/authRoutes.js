"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password required' });
            return;
        }
        const result = await authService_1.authService.login(username, password);
        res.cookie('token', result.token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        res.json(result);
    }
    catch (error) {
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});
router.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await authService_1.authService.getUserById(req.user.id);
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});
router.get('/users', auth_1.authenticateToken, async (_req, res) => {
    try {
        const users = await authService_1.authService.getAllUsers();
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});
router.get('/ceo', auth_1.authenticateToken, async (_req, res) => {
    try {
        const result = await database_1.default.query("SELECT id, username, full_name, role FROM users WHERE role = 'ceo' LIMIT 1");
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'CEO not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get CEO user' });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map