"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const availabilityService_1 = require("../services/availabilityService");
const notificationService_1 = require("../services/notificationService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const userId = req.query.userId || req.user.id;
        const availability = await availabilityService_1.availabilityService.getByUser(userId);
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
        const userId = req.query.userId || req.user.id;
        const result = await availabilityService_1.availabilityService.upsert(userId, dayOfWeek, startTime, endTime, isAvailable !== false, label);
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Availability Updated', `${req.user.fullName} updated availability for day ${dayOfWeek}`, 'updated', 'availability', result.id, null, result);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update availability' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await availabilityService_1.availabilityService.delete(req.params.id);
        res.json({ message: 'Availability removed' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to remove availability' });
    }
});
exports.default = router;
//# sourceMappingURL=availabilityRoutes.js.map