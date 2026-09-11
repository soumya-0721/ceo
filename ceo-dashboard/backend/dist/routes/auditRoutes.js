"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { limit } = req.query;
        const logs = await auditService_1.auditService.getRecent(parseInt(limit) || 50);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});
router.get('/:recordType/:recordId', async (req, res) => {
    try {
        const logs = await auditService_1.auditService.getByRecord(req.params.recordType, req.params.recordId);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});
exports.default = router;
//# sourceMappingURL=auditRoutes.js.map