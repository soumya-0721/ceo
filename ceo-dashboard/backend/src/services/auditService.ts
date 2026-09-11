import pool from '../config/database';

export class AuditService {
    async log(data: {
        userId: string;
        action: string;
        recordType: string;
        recordId?: string;
        oldData?: any;
        newData?: any;
        ipAddress?: string;
    }) {
        const result = await pool.query(
            `INSERT INTO audit_logs (user_id, action, record_type, record_id, old_data, new_data, ip_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [data.userId, data.action, data.recordType, data.recordId,
             data.oldData ? JSON.stringify(data.oldData) : null,
             data.newData ? JSON.stringify(data.newData) : null,
             data.ipAddress]
        );
        return result.rows[0];
    }

    async getByRecord(recordType: string, recordId: string) {
        const result = await pool.query(
            `SELECT a.*, u.full_name as user_name FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             WHERE a.record_type = $1 AND a.record_id = $2
             ORDER BY a.created_at DESC`,
            [recordType, recordId]
        );
        return result.rows;
    }

    async getRecent(limit: number = 50) {
        const result = await pool.query(
            `SELECT a.*, u.full_name as user_name FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             ORDER BY a.created_at DESC LIMIT $1`,
            [limit]
        );
        return result.rows;
    }
}

export const auditService = new AuditService();
