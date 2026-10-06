import pool from '../config/database';
import { slotService, toMinutes, todayStr, TimeRange } from './slotService';

export class ScheduleService {
    async getByDate(date: string, userId?: string, scope?: string) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.created_by = u.id
                     WHERE s.schedule_date = $1 AND s.status NOT IN ('archived')`;
        const params: any[] = [date];
        if (userId && scope !== 'all') {
            query += ' AND s.created_by = $2';
            params.push(userId);
        }
        query += ' ORDER BY s.start_time';
        const result = await pool.query(query, params);
        return result.rows;
    }

    async getByDateRange(startDate: string, endDate: string, userId?: string, scope?: string) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.created_by = u.id
                     WHERE s.schedule_date BETWEEN $1 AND $2 AND s.status NOT IN ('archived')`;
        const params: any[] = [startDate, endDate];
        if (userId && scope !== 'all') {
            query += ' AND s.created_by = $3';
            params.push(userId);
        }
        query += ' ORDER BY s.schedule_date, s.start_time';
        const result = await pool.query(query, params);
        return result.rows;
    }

    async getById(id: string) {
        const result = await pool.query(
            `SELECT s.*, u.full_name as creator_name FROM schedules s
             LEFT JOIN users u ON s.created_by = u.id WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Overlap detection across the shared calendar (CEO + Coordinator).
     * Uses proper time-range comparison, never raw string ordering of ranges.
     */
    async checkConflict(date: string, startTime: string, endTime: string, excludeId?: string) {
        let query = `SELECT s.id, s.title, s.start_time, s.end_time, s.user_id, u.full_name as owner_name
                     FROM schedules s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.schedule_date = $1 AND s.status = 'active'
                     AND s.start_time < $3 AND s.end_time > $2`;
        const params: any[] = [date, startTime, endTime];

        if (excludeId) {
            query += ' AND s.id != $4';
            params.push(excludeId);
        }

        const result = await pool.query(query, params);
        return result.rows;
    }

    /** Free windows for a date, from the shared availability engine (includes bookings). */
    async getAvailableSlots(date: string, durationMinutes: number) {
        return slotService.getAvailableSlots(date, durationMinutes);
    }

    private timeDiffMinutes(start: string, end: string): number {
        return toMinutes(end) - toMinutes(start);
    }

    async create(data: any) {
        const result = await pool.query(
            `INSERT INTO schedules (user_id, title, description, schedule_date, start_time, end_time,
             schedule_type, location, participants, priority, reminder_minutes, status, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$12) RETURNING *`,
            [data.userId, data.title, data.description, data.date, data.startTime, data.endTime,
             data.scheduleType, data.location, data.participants, data.priority,
             data.reminderMinutes, data.userId]
        );
        return result.rows[0];
    }

    async update(id: string, data: any, userId: string) {
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.title) { fields.push(`title=$${idx++}`); values.push(data.title); }
        if (data.description !== undefined) { fields.push(`description=$${idx++}`); values.push(data.description); }
        if (data.date) { fields.push(`schedule_date=$${idx++}`); values.push(data.date); }
        if (data.startTime) { fields.push(`start_time=$${idx++}`); values.push(data.startTime); }
        if (data.endTime) { fields.push(`end_time=$${idx++}`); values.push(data.endTime); }
        if (data.scheduleType) { fields.push(`schedule_type=$${idx++}`); values.push(data.scheduleType); }
        if (data.location !== undefined) { fields.push(`location=$${idx++}`); values.push(data.location); }
        if (data.participants) { fields.push(`participants=$${idx++}`); values.push(data.participants); }
        if (data.priority) { fields.push(`priority=$${idx++}`); values.push(data.priority); }
        if (data.reminderMinutes !== undefined) { fields.push(`reminder_minutes=$${idx++}`); values.push(data.reminderMinutes); }
        if (data.status) { fields.push(`status=$${idx++}`); values.push(data.status); }

        fields.push(`updated_by=$${idx++}`);
        values.push(userId);
        fields.push(`updated_at=NOW()`);
        values.push(id);

        const result = await pool.query(
            `UPDATE schedules SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    async getStats(userId: string) {
        const today = todayStr();

        const meetings = await pool.query(
            `SELECT COUNT(*) as count FROM schedules WHERE schedule_date=$1 AND status='active' AND schedule_type != 'personal'`,
            [today]
        );

        const freeWindows = await slotService.getFreeWindows(today);
        const totalFreeMinutes = freeWindows.reduce((acc: number, window: TimeRange) => {
            return acc + (toMinutes(window.end) - toMinutes(window.start));
        }, 0);

        return {
            todayMeetings: parseInt(meetings.rows[0].count),
            freeTimeMinutes: totalFreeMinutes,
            freeTimeFormatted: `${Math.floor(totalFreeMinutes / 60)}h ${totalFreeMinutes % 60}m`
        };
    }
}

export const scheduleService = new ScheduleService();
