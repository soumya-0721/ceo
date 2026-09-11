import { Router, Response } from 'express';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { limit } = req.query;
        const logs = await auditService.getRecent(parseInt(limit as string) || 50);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

router.get('/:recordType/:recordId', async (req: AuthRequest, res: Response) => {
    try {
        const logs = await auditService.getByRecord(req.params.recordType, req.params.recordId);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

export default router;
