import { Router, Response } from 'express';
import { availabilityService } from '../services/availabilityService';
import { notificationService } from '../services/notificationService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = (req.query.userId as string) || req.user!.id;
        const availability = await availabilityService.getByUser(userId);
        res.json(availability);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get availability' });
    }
});

router.get('/today', async (_req: AuthRequest, res: Response) => {
    try {
        const availability = await availabilityService.getTodayAvailability();
        res.json(availability);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get today availability' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { dayOfWeek, startTime, endTime, isAvailable, label } = req.body;
        const userId = (req.query.userId as string) || req.user!.id;
        const result = await availabilityService.upsert(
            userId, dayOfWeek, startTime, endTime, isAvailable !== false, label
        );

        await notificationService.notifyOtherUser(
            req.user!.id, 'Availability Updated',
            `${req.user!.fullName} updated availability for day ${dayOfWeek}`,
            'updated', 'availability', result.id, null, result
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        await availabilityService.delete(req.params.id);
        res.json({ message: 'Availability removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove availability' });
    }
});

export default router;
