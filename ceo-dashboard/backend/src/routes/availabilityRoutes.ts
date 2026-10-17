import { Router, Response } from 'express';
import { availabilityService } from '../services/availabilityService';
import { notificationService } from '../services/notificationService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateMeetingWindow } from '../lib/scheduling';

const router = Router();
router.use(authenticateToken);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Availability always belongs to the authenticated user; a client-supplied userId
// is ignored so nobody can modify another person's records by changing an id.
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const availability = await availabilityService.getByUser(req.user!.id);
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
        const day = parseInt(String(dayOfWeek), 10);
        if (isNaN(day) || day < 0 || day > 6) {
            res.status(400).json({ error: 'dayOfWeek must be between 0 and 6' });
            return;
        }
        const timeError = validateMeetingWindow('2000-01-01', startTime, endTime);
        if (timeError) {
            res.status(400).json({ error: timeError });
            return;
        }

        const result = await availabilityService.upsert(
            req.user!.id, day, startTime, endTime, isAvailable !== false, label
        );

        await notificationService.notifyOtherUser(
            req.user!.id, 'Availability Updated',
            `${req.user!.fullName} updated availability for ${DAY_NAMES[day]}`,
            'updated', 'availability', result.id, null, result
        );

        res.json(result);
    } catch (error: any) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const deleted = await availabilityService.delete(req.params.id, req.user!.id);
        if (!deleted) {
            res.status(404).json({ error: 'Availability not found' });
            return;
        }
        res.json({ message: 'Availability removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove availability' });
    }
});

export default router;
