import { Router, Response } from 'express';
import { focusService } from '../services/focusService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { date } = req.query;
        const focusDate = (date as string) || new Date().toISOString().split('T')[0];
        const sessions = await focusService.getByDate(focusDate);
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get focus sessions' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, date, startTime, endTime } = req.body;
        if (!date || !startTime || !endTime) {
            res.status(400).json({ error: 'Date, start time and end time required' });
            return;
        }
        const session = await focusService.create({
            userId: req.user!.id, title, date, startTime, endTime
        });

        await auditService.log({
            userId: req.user!.id, action: 'created', recordType: 'focus_session',
            recordId: session.id, newData: session
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Focus Mode Scheduled',
            `${req.user!.fullName} scheduled focus time from ${startTime} to ${endTime} on ${date}`,
            'created', 'focus_session', session.id, null, session
        );

        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create focus session' });
    }
});

router.patch('/:id/cancel', async (req: AuthRequest, res: Response) => {
    try {
        const session = await focusService.cancel(req.params.id);

        await auditService.log({
            userId: req.user!.id, action: 'cancelled', recordType: 'focus_session',
            recordId: req.params.id, newData: session
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Focus Session Cancelled',
            `${req.user!.fullName} cancelled a focus session`,
            'cancelled', 'focus_session', req.params.id, null, session
        );

        res.json(session);
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel focus session' });
    }
});

export default router;
