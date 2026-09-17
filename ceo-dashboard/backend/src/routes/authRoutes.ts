import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import pool from '../config/database';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password required' });
            return;
        }
        const result = await authService.login(username, password);
        res.cookie('token', result.token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        res.json(result);
    } catch (error: any) {
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});

router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = await authService.getUserById(req.user!.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

router.get('/users', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const users = await authService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

router.get('/ceo', authenticateToken, async (_req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query("SELECT id, username, full_name, role FROM users WHERE role = 'ceo' LIMIT 1");
        if (result.rows.length === 0) { res.status(404).json({ error: 'CEO not found' }); return; }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get CEO user' });
    }
});

export default router;
