import { Router, Response } from 'express';
import { reminderService } from '../services/reminderService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.query;
        const reminders = await reminderService.getByUser(req.user!.id, status as string);
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

router.get('/active', async (req: AuthRequest, res: Response) => {
    try {
        const reminders = await reminderService.getActiveReminders(req.user!.id);
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get active reminders' });
    }
});

router.get('/pending-count', async (req: AuthRequest, res: Response) => {
    try {
        const count = await reminderService.getPendingCount(req.user!.id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const reminder = await reminderService.getById(req.params.id);
        if (!reminder) { res.status(404).json({ error: 'Reminder not found' }); return; }
        res.json(reminder);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get reminder' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, date, time, repeatType, priority } = req.body;
        if (!title || !date || !time) {
            res.status(400).json({ error: 'Title, date and time required' });
            return;
        }
        const reminder = await reminderService.create({
            userId: req.user!.id, title, description, date, time,
            repeatType, priority
        });

        await auditService.log({
            userId: req.user!.id, action: 'created', recordType: 'reminder',
            recordId: reminder.id, newData: reminder
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'New Reminder Created',
            `${req.user!.fullName} created reminder "${title}" for ${date} at ${time}`,
            'created', 'reminder', reminder.id, null, reminder
        );

        res.status(201).json(reminder);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const oldReminder = await reminderService.getById(req.params.id);
        const updated = await reminderService.update(req.params.id, req.body);

        await auditService.log({
            userId: req.user!.id, action: 'updated', recordType: 'reminder',
            recordId: req.params.id, oldData: oldReminder, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Reminder Updated',
            `${req.user!.fullName} updated reminder "${updated.title}"`,
            'updated', 'reminder', req.params.id, oldReminder, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

router.patch('/:id/complete', async (req: AuthRequest, res: Response) => {
    try {
        const oldReminder = await reminderService.getById(req.params.id);
        const updated = await reminderService.update(req.params.id, { status: 'completed' });

        await auditService.log({
            userId: req.user!.id, action: 'completed', recordType: 'reminder',
            recordId: req.params.id, oldData: oldReminder, newData: updated
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete reminder' });
    }
});

export default router;
