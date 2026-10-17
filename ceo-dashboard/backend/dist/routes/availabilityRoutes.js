"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const availabilityService_1 = require("../services/availabilityService");
const notificationService_1 = require("../services/notificationService");
const auth_1 = require("../middleware/auth");
const scheduling_1 = require("../lib/scheduling");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Availability always belongs to the authenticated user; a client-supplied userId
// is ignored so nobody can modify another person's records by changing an id.
router.get('/', async (req, res) => {
    try {
        const availability = await availabilityService_1.availabilityService.getByUser(req.user.id);
        res.json(availability);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get availability' });
    }
});
router.get('/today', async (_req, res) => {
    try {
        const availability = await availabilityService_1.availabilityService.getTodayAvailability();
        res.json(availability);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get today availability' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { dayOfWeek, startTime, endTime, isAvailable, label } = req.body;
        const day = parseInt(String(dayOfWeek), 10);
        if (isNaN(day) || day < 0 || day > 6) {
            res.status(400).json({ error: 'dayOfWeek must be between 0 and 6' });
            return;
        }
        const timeError = (0, scheduling_1.validateMeetingWindow)('2000-01-01', startTime, endTime);
        if (timeError) {
            res.status(400).json({ error: timeError });
            return;
        }
        const result = await availabilityService_1.availabilityService.upsert(req.user.id, day, startTime, endTime, isAvailable !== false, label);
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Availability Updated', `${req.user.fullName} updated availability for ${DAY_NAMES[day]}`, 'updated', 'availability', result.id, null, result);
        res.json(result);
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update availability' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await availabilityService_1.availabilityService.delete(req.params.id, req.user.id);
        if (!deleted) {
            res.status(404).json({ error: 'Availability not found' });
            return;
        }
        res.json({ message: 'Availability removed' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to remove availability' });
    }
});
exports.default = router;
//# sourceMappingURL=availabilityRoutes.js.map