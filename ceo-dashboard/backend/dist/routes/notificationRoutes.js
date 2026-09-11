"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationService_1 = require("../services/notificationService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { unread } = req.query;
        const notifications = await notificationService_1.notificationService.getByUser(req.user.id, unread === 'true');
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});
router.get('/unread-count', async (req, res) => {
    try {
        const count = await notificationService_1.notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});
router.patch('/:id/read', async (req, res) => {
    try {
        await notificationService_1.notificationService.markAsRead(req.params.id);
        res.json({ message: 'Marked as read' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});
router.patch('/read-all', async (req, res) => {
    try {
        await notificationService_1.notificationService.markAllAsRead(req.user.id);
        res.json({ message: 'All marked as read' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map