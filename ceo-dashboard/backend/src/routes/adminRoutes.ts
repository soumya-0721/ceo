import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import pool from '../config/database';

const router = Router();
router.use(authenticateToken);

router.post('/clear-all-data', async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ceo') {
            res.status(403).json({ error: 'CEO access required to clear data' });
            return;
        }

        const tables = [
            'audit_logs', 'excel_data', 'notifications',
            'focus_sessions', 'reminders', 'tasks',
            'schedules', 'bookings', 'availability'
        ];

        const results: string[] = [];
        for (const table of tables) {
            await pool.query(`DELETE FROM ${table}`);
            results.push(table);
        }

        res.json({ message: 'All data cleared', tables: results });
    } catch (error: any) {
        console.error('Clear data error:', error.message);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

export default router;
