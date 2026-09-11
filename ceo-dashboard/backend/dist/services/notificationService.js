"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const database_1 = __importDefault(require("../config/database"));
class NotificationService {
    async getByUser(userId, unreadOnly = false) {
        let query = `SELECT n.*, u.full_name as from_user_name FROM notifications n
                     LEFT JOIN users u ON n.from_user_id = u.id
                     WHERE n.user_id = $1`;
        const params = [userId];
        if (unreadOnly) {
            query += ' AND n.is_read = false';
        }
        query += ' ORDER BY n.created_at DESC LIMIT 50';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getUnreadCount(userId) {
        const result = await database_1.default.query('SELECT COUNT(*) as count FROM notifications WHERE user_id=$1 AND is_read=false', [userId]);
        return parseInt(result.rows[0].count);
    }
    async create(data) {
        const result = await database_1.default.query(`INSERT INTO notifications (user_id, from_user_id, title, message, action_type,
             record_type, record_id, old_value, new_value)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [data.userId, data.fromUserId, data.title, data.message, data.actionType,
            data.recordType, data.recordId,
            data.oldValue ? JSON.stringify(data.oldValue) : null,
            data.newValue ? JSON.stringify(data.newValue) : null]);
        return result.rows[0];
    }
    async markAsRead(id) {
        await database_1.default.query('UPDATE notifications SET is_read=true WHERE id=$1', [id]);
    }
    async markAllAsRead(userId) {
        await database_1.default.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false', [userId]);
    }
    async notifyOtherUser(fromUserId, title, message, actionType, recordType, recordId, oldValue, newValue) {
        const otherUsers = await database_1.default.query('SELECT id FROM users WHERE id != $1 AND is_active = true', [fromUserId]);
        for (const user of otherUsers.rows) {
            await this.create({
                userId: user.id,
                fromUserId,
                title,
                message,
                actionType,
                recordType,
                recordId,
                oldValue,
                newValue
            });
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map