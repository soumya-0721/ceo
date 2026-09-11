"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderService = exports.ReminderService = void 0;
const database_1 = __importDefault(require("../config/database"));
class ReminderService {
    async getByUser(userId, status) {
        let query = 'SELECT * FROM reminders WHERE user_id=$1';
        const params = [userId];
        if (status && status !== 'all') {
            query += ' AND status=$2';
            params.push(status);
        }
        query += ' ORDER BY reminder_date, reminder_time';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getActiveReminders(userId) {
        const today = new Date().toISOString().split('T')[0];
        const result = await database_1.default.query(`SELECT * FROM reminders WHERE user_id=$1 AND status='active'
             AND reminder_date <= $2 ORDER BY reminder_time`, [userId, today]);
        return result.rows;
    }
    async getById(id) {
        const result = await database_1.default.query('SELECT * FROM reminders WHERE id=$1', [id]);
        return result.rows[0];
    }
    async create(data) {
        const result = await database_1.default.query(`INSERT INTO reminders (user_id, title, description, reminder_date, reminder_time,
             repeat_type, priority, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$1) RETURNING *`, [data.userId, data.title, data.description, data.date, data.time,
            data.repeatType || 'once', data.priority || 'medium']);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const values = [];
        let idx = 1;
        if (data.title) {
            fields.push(`title=$${idx++}`);
            values.push(data.title);
        }
        if (data.description !== undefined) {
            fields.push(`description=$${idx++}`);
            values.push(data.description);
        }
        if (data.date) {
            fields.push(`reminder_date=$${idx++}`);
            values.push(data.date);
        }
        if (data.time) {
            fields.push(`reminder_time=$${idx++}`);
            values.push(data.time);
        }
        if (data.repeatType) {
            fields.push(`repeat_type=$${idx++}`);
            values.push(data.repeatType);
        }
        if (data.priority) {
            fields.push(`priority=$${idx++}`);
            values.push(data.priority);
        }
        if (data.status) {
            fields.push(`status=$${idx++}`);
            values.push(data.status);
        }
        fields.push('updated_at=NOW()');
        values.push(id);
        const result = await database_1.default.query(`UPDATE reminders SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`, values);
        return result.rows[0];
    }
    async getPendingCount(userId) {
        const today = new Date().toISOString().split('T')[0];
        const result = await database_1.default.query(`SELECT COUNT(*) as count FROM reminders WHERE user_id=$1 AND status='active' AND reminder_date <= $2`, [userId, today]);
        return parseInt(result.rows[0].count);
    }
}
exports.ReminderService = ReminderService;
exports.reminderService = new ReminderService();
//# sourceMappingURL=reminderService.js.map