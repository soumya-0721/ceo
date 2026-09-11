import pool from '../config/database';

export class FocusService {
    async getByDate(date: string) {
        const result = await pool.query(
            `SELECT f.*, u.full_name as user_name FROM focus_sessions f
             LEFT JOIN users u ON f.user_id = u.id
             WHERE f.focus_date = $1 AND f.status = 'active'
             ORDER BY f.start_time`,
            [date]
        );
        return result.rows;
    }

    async create(data: any) {
        const result = await pool.query(
            `INSERT INTO focus_sessions (user_id, title, focus_date, start_time, end_time, status, created_by)
             VALUES ($1,$2,$3,$4,$5,'active',$1) RETURNING *`,
            [data.userId, data.title || 'Focus Time', data.date, data.startTime, data.endTime]
        );
        return result.rows[0];
    }

    async updateStatus(id: string, status: string) {
        const result = await pool.query(
            'UPDATE focus_sessions SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    }

    async cancel(id: string) {
        return this.updateStatus(id, 'cancelled');
    }
}

export const focusService = new FocusService();
