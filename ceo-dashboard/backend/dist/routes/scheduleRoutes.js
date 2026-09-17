"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduleService_1 = require("../services/scheduleService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { date, startDate, endDate, userId } = req.query;
        const targetUserId = userId || req.user.id;
        if (date) {
            const schedules = await scheduleService_1.scheduleService.getByDate(date, targetUserId);
            res.json(schedules);
        }
        else if (startDate && endDate) {
            const schedules = await scheduleService_1.scheduleService.getByDateRange(startDate, endDate, targetUserId);
            res.json(schedules);
        }
        else {
            const today = new Date().toISOString().split('T')[0];
            const schedules = await scheduleService_1.scheduleService.getByDate(today, targetUserId);
            res.json(schedules);
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get schedules' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const stats = await scheduleService_1.scheduleService.getStats(req.user.id);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
router.get('/available-slots', async (req, res) => {
    try {
        const { date, duration } = req.query;
        if (!date || !duration) {
            res.status(400).json({ error: 'Date and duration required' });
            return;
        }
        const slots = await scheduleService_1.scheduleService.getAvailableSlots(date, parseInt(duration));
        res.json(slots);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});
router.get('/conflict-check', async (req, res) => {
    try {
        const { date, startTime, endTime, excludeId } = req.query;
        const conflicts = await scheduleService_1.scheduleService.checkConflict(date, startTime, endTime, excludeId);
        res.json({ hasConflict: conflicts.length > 0, conflicts });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check conflicts' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const schedule = await scheduleService_1.scheduleService.getById(req.params.id);
        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        res.json(schedule);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { title, description, date, startTime, endTime, scheduleType, location, participants, priority, reminderMinutes } = req.body;
        if (!title || !date || !startTime || !endTime) {
            res.status(400).json({ error: 'Title, date, start time and end time required' });
            return;
        }
        const targetUserId = req.query.userId || req.user.id;
        const conflicts = await scheduleService_1.scheduleService.checkConflict(date, startTime, endTime);
        if (conflicts.length > 0) {
            const slots = await scheduleService_1.scheduleService.getAvailableSlots(date, 30);
            res.status(409).json({
                error: 'Time conflict detected',
                conflicts,
                suggestedSlots: slots
            });
            return;
        }
        const schedule = await scheduleService_1.scheduleService.create({
            title, description, date, startTime, endTime,
            scheduleType: scheduleType || 'other', location,
            participants: participants || [], priority: priority || 'medium',
            reminderMinutes: reminderMinutes || 15, userId: targetUserId
        });
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'created', recordType: 'schedule',
            recordId: schedule.id, newData: schedule
        });
        const otherUser = req.user.role === 'ceo' ? 'Soumya' : 'CEO';
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'New Schedule Created', `${req.user.fullName} created "${title}" on ${date} at ${startTime}`, 'created', 'schedule', schedule.id, null, schedule);
        res.status(201).json(schedule);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const oldSchedule = await scheduleService_1.scheduleService.getById(req.params.id);
        if (!oldSchedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        if (req.body.date && req.body.startTime && req.body.endTime) {
            const conflicts = await scheduleService_1.scheduleService.checkConflict(req.body.date, req.body.startTime, req.body.endTime, req.params.id);
            if (conflicts.length > 0) {
                const slots = await scheduleService_1.scheduleService.getAvailableSlots(req.body.date, 30);
                res.status(409).json({ error: 'Time conflict detected', conflicts, suggestedSlots: slots });
                return;
            }
        }
        const updated = await scheduleService_1.scheduleService.update(req.params.id, req.body, req.user.id);
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'updated', recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Schedule Updated', `${req.user.fullName} updated "${updated.title}"`, 'updated', 'schedule', req.params.id, oldSchedule, updated);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const oldSchedule = await scheduleService_1.scheduleService.getById(req.params.id);
        const updated = await scheduleService_1.scheduleService.update(req.params.id, { status: req.body.status }, req.user.id);
        await auditService_1.auditService.log({
            userId: req.user.id, action: req.body.status, recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Schedule Status Changed', `${req.user.fullName} changed "${updated.title}" to ${req.body.status}`, req.body.status, 'schedule', req.params.id, oldSchedule, updated);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update schedule status' });
    }
});
exports.default = router;
//# sourceMappingURL=scheduleRoutes.js.map