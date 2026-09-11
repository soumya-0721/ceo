import pool from '../config/database';

export class NotificationService {
    async getByUser(userId: string, unreadOnly: boolean = false) {
        let query = `SELECT n.*, u.full_name as from_user_name FROM notifications n
                     LEFT JOIN users u ON n.from_user_id = u.id
                     WHERE n.user_id = $1`;
        const params: any[] = [userId];

        if (unreadOnly) {
            query += ' AND n.is_read = false';
        }
        query += ' ORDER BY n.created_at DESC LIMIT 50';

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getUnreadCount(userId: string) {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id=$1 AND is_read=false',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }

    async create(data: {
        userId: string;
        fromUserId: string;
        title: string;
        message: string;
        actionType: string;
        recordType?: string;
        recordId?: string;
        oldValue?: any;
        newValue?: any;
    }) {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, from_user_id, title, message, action_type,
             record_type, record_id, old_value, new_value)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [data.userId, data.fromUserId, data.title, data.message, data.actionType,
             data.recordType, data.recordId,
             data.oldValue ? JSON.stringify(data.oldValue) : null,
             data.newValue ? JSON.stringify(data.newValue) : null]
        );
        return result.rows[0];
    }

    async markAsRead(id: string) {
        await pool.query('UPDATE notifications SET is_read=true WHERE id=$1', [id]);
    }

    async markAllAsRead(userId: string) {
        await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false', [userId]);
    }

    async notifyOtherUser(fromUserId: string, title: string, message: string, actionType: string, recordType?: string, recordId?: string, oldValue?: any, newValue?: any) {
        const otherUsers = await pool.query(
            'SELECT id FROM users WHERE id != $1 AND is_active = true',
            [fromUserId]
        );

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

export const notificationService = new NotificationService();
