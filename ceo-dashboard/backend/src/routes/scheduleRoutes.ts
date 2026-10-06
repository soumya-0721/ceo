import { Router, Response } from 'express';
import { scheduleService } from '../services/scheduleService';
import { slotService, todayStr, toMinutes } from '../services/slotService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function normalizeTime(time: string): string {
    return (time || '').substring(0, 5);
}

function validateScheduleInput(body: any): string | null {
    if (!body.title || !String(body.title).trim()) return 'Title is required';
    if (!body.date || !DATE_RE.test(body.date)) return 'A valid date is required';
    if (!body.startTime || !body.endTime) return 'Start time and end time are required';
    if (!TIME_RE.test(body.startTime) || !TIME_RE.test(body.endTime)) return 'Start time and end time must be valid times';

    const start = normalizeTime(body.startTime);
    const end = normalizeTime(body.endTime);
    if (toMinutes(end) <= toMinutes(start)) return 'End time must be after start time';
    return null;
}

/** 409 payload used by the frontend conflict alert inside the schedule modal. */
async function conflictResponse(date: string, startTime: string, endTime: string, excludeId: string | undefined, res: Response) {
    const conflicts = await scheduleService.checkConflict(date, startTime, endTime, excludeId);
    if (conflicts.length === 0) return false;

    const duration = Math.max(15, toMinutes(endTime) - toMinutes(startTime));
    const suggestedSlots = await slotService.suggestSlots(date, duration, 5);
    res.status(409).json({
        error: `This time overlaps with ${conflicts.map((c: any) => `"${c.title}"${c.owner_name ? ` (${c.owner_name})` : ''}`).join(', ')}`,
        hasConflict: true,
        conflicts,
        suggestedSlots
    });
    return true;
}

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { date, startDate, endDate, userId, scope } = req.query;
        const targetUserId = userId as string || req.user!.id;
        const scopeValue = (scope as string) || 'mine';
        if (date) {
            const schedules = await scheduleService.getByDate(date as string, targetUserId, scopeValue);
            res.json(schedules);
        } else if (startDate && endDate) {
            const schedules = await scheduleService.getByDateRange(startDate as string, endDate as string, targetUserId, scopeValue);
            res.json(schedules);
        } else {
            const schedules = await scheduleService.getByDate(todayStr(), targetUserId, scopeValue);
            res.json(schedules);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to get schedules' });
    }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
    try {
        const stats = await scheduleService.getStats(req.user!.id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/** Week data for the schedule dashboards: free/busy windows + totals per day. */
router.get('/week', async (req: AuthRequest, res: Response) => {
    try {
        const startDate = String(req.query.startDate || '');
        const endDate = String(req.query.endDate || '');
        if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
            res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
            return;
        }
        const overview = await slotService.getWeekOverview(startDate, endDate);
        res.json(overview);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to get week overview' });
    }
});

/** CSV export of a week (or any date range). */
router.get('/export', async (req: AuthRequest, res: Response) => {
    try {
        const startDate = String(req.query.startDate || '');
        const endDate = String(req.query.endDate || '');
        if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
            res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
            return;
        }

        const scope = String(req.query.scope || 'all');
        const schedules = await scheduleService.getByDateRange(startDate, endDate, req.user!.id, scope);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const escape = (value: any) => {
            const text = value === null || value === undefined ? '' : String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };

        const header = ['Date', 'Day', 'Start Time', 'End Time', 'Title', 'Type', 'Notes', 'Status', 'Created By'];
        const rows = schedules.map((s: any) => {
            const [y, m, d] = String(s.schedule_date).split('-').map(Number);
            const day = dayNames[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
            return [
                s.schedule_date,
                day,
                normalizeTime(s.start_time),
                normalizeTime(s.end_time),
                s.title,
                s.schedule_type,
                s.description || '',
                s.status,
                s.creator_name || ''
            ].map(escape).join(',');
        });

        const csv = [header.join(','), ...rows].join('\r\n');
        const filename = `schedule_${startDate}_${endDate}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export schedule' });
    }
});

router.get('/available-slots', async (req: AuthRequest, res: Response) => {
    try {
        const { date, duration } = req.query;
        if (!date || !duration) {
            res.status(400).json({ error: 'Date and duration required' });
            return;
        }
        const slots = await scheduleService.getAvailableSlots(date as string, parseInt(duration as string));
        // both shapes kept so older callers (start_time/end_time) keep working
        res.json(slots.map((s: any) => ({
            ...s,
            start: s.start,
            end: s.end,
            start_time: s.start,
            end_time: s.end
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});

router.get('/conflict-check', async (req: AuthRequest, res: Response) => {
    try {
        const { date, startTime, endTime, excludeId } = req.query;
        const conflicts = await scheduleService.checkConflict(
            date as string, startTime as string, endTime as string, excludeId as string
        );
        res.json({ hasConflict: conflicts.length > 0, conflicts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check conflicts' });
    }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const schedule = await scheduleService.getById(req.params.id);
        if (!schedule) { res.status(404).json({ error: 'Schedule not found' }); return; }
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, date, startTime, endTime, scheduleType, location, participants, priority, reminderMinutes } = req.body;

        const validationError = validateScheduleInput(req.body);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }

        const start = normalizeTime(startTime);
        const end = normalizeTime(endTime);

        if (await conflictResponse(date, start, end, undefined, res)) return;

        const targetUserId = (req.query.userId as string) || req.user!.id;

        const schedule = await scheduleService.create({
            title, description, date, startTime: start, endTime: end,
            scheduleType: scheduleType || 'other', location,
            participants: participants || [], priority: priority || 'medium',
            reminderMinutes: reminderMinutes || 15, userId: targetUserId
        });

        await auditService.log({
            userId: req.user!.id, action: 'created', recordType: 'schedule',
            recordId: schedule.id, newData: schedule
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'New Schedule Created',
            `${req.user!.fullName} created "${title}" on ${date} at ${start}`,
            'created', 'schedule', schedule.id, null, schedule
        );

        res.status(201).json(schedule);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const oldSchedule = await scheduleService.getById(req.params.id);
        if (!oldSchedule) { res.status(404).json({ error: 'Schedule not found' }); return; }

        const merged = {
            title: req.body.title ?? oldSchedule.title,
            date: req.body.date ?? oldSchedule.schedule_date,
            startTime: req.body.startTime ?? oldSchedule.start_time,
            endTime: req.body.endTime ?? oldSchedule.end_time
        };

        const validationError = validateScheduleInput(merged);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }

        const start = normalizeTime(merged.startTime);
        const end = normalizeTime(merged.endTime);

        if (await conflictResponse(merged.date, start, end, req.params.id, res)) return;

        const updated = await scheduleService.update(req.params.id, req.body, req.user!.id);

        await auditService.log({
            userId: req.user!.id, action: 'updated', recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Schedule Updated',
            `${req.user!.fullName} updated "${updated.title}"`,
            'updated', 'schedule', req.params.id, oldSchedule, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const oldSchedule = await scheduleService.getById(req.params.id);
        const updated = await scheduleService.update(req.params.id, { status: req.body.status }, req.user!.id);

        await auditService.log({
            userId: req.user!.id, action: req.body.status, recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Schedule Status Changed',
            `${req.user!.fullName} changed "${updated.title}" to ${req.body.status}`,
            req.body.status, 'schedule', req.params.id, oldSchedule, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update schedule status' });
    }
});

export default router;
