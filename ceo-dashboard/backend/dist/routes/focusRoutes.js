"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const focusService_1 = require("../services/focusService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const focusDate = date || new Date().toISOString().split('T')[0];
        const sessions = await focusService_1.focusService.getByDate(focusDate);
        res.json(sessions);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get focus sessions' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { title, date, startTime, endTime } = req.body;
        if (!date || !startTime || !endTime) {
            res.status(400).json({ error: 'Date, start time and end time required' });
            return;
        }
        const session = await focusService_1.focusService.create({
            userId: req.user.id, title, date, startTime, endTime
        });
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'created', recordType: 'focus_session',
            recordId: session.id, newData: session
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Focus Mode Scheduled', `${req.user.fullName} scheduled focus time from ${startTime} to ${endTime} on ${date}`, 'created', 'focus_session', session.id, null, session);
        res.status(201).json(session);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create focus session' });
    }
});
router.patch('/:id/cancel', async (req, res) => {
    try {
        const session = await focusService_1.focusService.cancel(req.params.id);
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'cancelled', recordType: 'focus_session',
            recordId: req.params.id, newData: session
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Focus Session Cancelled', `${req.user.fullName} cancelled a focus session`, 'cancelled', 'focus_session', req.params.id, null, session);
        res.json(session);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to cancel focus session' });
    }
});
exports.default = router;
//# sourceMappingURL=focusRoutes.js.map