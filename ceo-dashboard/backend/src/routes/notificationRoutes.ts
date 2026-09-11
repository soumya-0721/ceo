import { Router, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { unread } = req.query;
        const notifications = await notificationService.getByUser(req.user!.id, unread === 'true');
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
    try {
        const count = await notificationService.getUnreadCount(req.user!.id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        await notificationService.markAsRead(req.params.id);
        res.json({ message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

router.patch('/read-all', async (req: AuthRequest, res: Response) => {
    try {
        await notificationService.markAllAsRead(req.user!.id);
        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

export default router;
