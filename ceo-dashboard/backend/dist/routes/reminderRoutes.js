"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reminderService_1 = require("../services/reminderService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const reminders = await reminderService_1.reminderService.getByUser(req.user.id, status);
        res.json(reminders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});
router.get('/active', async (req, res) => {
    try {
        const reminders = await reminderService_1.reminderService.getActiveReminders(req.user.id);
        res.json(reminders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get active reminders' });
    }
});
router.get('/pending-count', async (req, res) => {
    try {
        const count = await reminderService_1.reminderService.getPendingCount(req.user.id);
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const reminder = await reminderService_1.reminderService.getById(req.params.id);
        if (!reminder) {
            res.status(404).json({ error: 'Reminder not found' });
            return;
        }
        res.json(reminder);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get reminder' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { title, description, date, time, repeatType, priority } = req.body;
        if (!title || !date || !time) {
            res.status(400).json({ error: 'Title, date and time required' });
            return;
        }
        const reminder = await reminderService_1.reminderService.create({
            userId: req.user.id, title, description, date, time,
            repeatType, priority
        });
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'created', recordType: 'reminder',
            recordId: reminder.id, newData: reminder
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'New Reminder Created', `${req.user.fullName} created reminder "${title}" for ${date} at ${time}`, 'created', 'reminder', reminder.id, null, reminder);
        res.status(201).json(reminder);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const oldReminder = await reminderService_1.reminderService.getById(req.params.id);
        const updated = await reminderService_1.reminderService.update(req.params.id, req.body);
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'updated', recordType: 'reminder',
            recordId: req.params.id, oldData: oldReminder, newData: updated
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Reminder Updated', `${req.user.fullName} updated reminder "${updated.title}"`, 'updated', 'reminder', req.params.id, oldReminder, updated);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});
router.patch('/:id/complete', async (req, res) => {
    try {
        const oldReminder = await reminderService_1.reminderService.getById(req.params.id);
        const updated = await reminderService_1.reminderService.update(req.params.id, { status: 'completed' });
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'completed', recordType: 'reminder',
            recordId: req.params.id, oldData: oldReminder, newData: updated
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to complete reminder' });
    }
});
exports.default = router;
//# sourceMappingURL=reminderRoutes.js.map