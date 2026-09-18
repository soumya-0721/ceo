"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/clear-all-data', async (req, res) => {
    try {
        if (req.user?.role !== 'ceo') {
            res.status(403).json({ error: 'CEO access required to clear data' });
            return;
        }
        const tables = [
            'audit_logs', 'excel_data', 'notifications',
            'focus_sessions', 'reminders', 'tasks',
            'schedules', 'bookings', 'availability'
        ];
        const results = [];
        for (const table of tables) {
            await database_1.default.query(`DELETE FROM ${table}`);
            results.push(table);
        }
        res.json({ message: 'All data cleared', tables: results });
    }
    catch (error) {
        console.error('Clear data error:', error.message);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map