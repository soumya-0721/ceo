"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleService = exports.ScheduleService = void 0;
const database_1 = __importDefault(require("../config/database"));
class ScheduleService {
    async getByDate(date, userId) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.created_by = u.id
                     WHERE s.schedule_date = $1 AND s.status NOT IN ('archived')`;
        const params = [date];
        if (userId) {
            query += ' AND s.created_by = $2';
            params.push(userId);
        }
        query += ' ORDER BY s.start_time';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getByDateRange(startDate, endDate, userId) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.created_by = u.id
                     WHERE s.schedule_date BETWEEN $1 AND $2 AND s.status NOT IN ('archived')`;
        const params = [startDate, endDate];
        if (userId) {
            query += ' AND s.created_by = $3';
            params.push(userId);
        }
        query += ' ORDER BY s.schedule_date, s.start_time';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getById(id) {
        const result = await database_1.default.query(`SELECT s.*, u.full_name as creator_name FROM schedules s
             LEFT JOIN users u ON s.created_by = u.id WHERE s.id = $1`, [id]);
        return result.rows[0];
    }
    async checkConflict(date, startTime, endTime, excludeId) {
        let query = `SELECT id, title, start_time, end_time FROM schedules
                     WHERE schedule_date = $1 AND status = 'active'
                     AND ((start_time < $3 AND end_time > $2) OR (start_time < $2 AND end_time > $2) OR ($2 < start_time AND $3 > end_time))`;
        const params = [date, startTime, endTime];
        if (excludeId) {
            query += ' AND id != $4';
            params.push(excludeId);
        }
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getAvailableSlots(date, durationMinutes) {
        const schedules = await database_1.default.query(`SELECT start_time, end_time FROM schedules
             WHERE schedule_date = $1 AND status = 'active' ORDER BY start_time`, [date]);
        const focusSessions = await database_1.default.query(`SELECT start_time, end_time FROM focus_sessions
             WHERE focus_date = $1 AND status = 'active' ORDER BY start_time`, [date]);
        const allBlocked = [...schedules.rows, ...focusSessions.rows]
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
        const workStart = '09:00';
        const workEnd = '18:00';
        const slots = [];
        let currentStart = workStart;
        for (const block of allBlocked) {
            if (currentStart < block.start_time) {
                const diffMinutes = this.timeDiffMinutes(currentStart, block.start_time);
                if (diffMinutes >= durationMinutes) {
                    slots.push({ start_time: currentStart, end_time: block.start_time });
                }
            }
            if (block.end_time > currentStart) {
                currentStart = block.end_time;
            }
        }
        if (currentStart < workEnd) {
            const diffMinutes = this.timeDiffMinutes(currentStart, workEnd);
            if (diffMinutes >= durationMinutes) {
                slots.push({ start_time: currentStart, end_time: workEnd });
            }
        }
        return slots;
    }
    timeDiffMinutes(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    }
    async create(data) {
        const result = await database_1.default.query(`INSERT INTO schedules (user_id, title, description, schedule_date, start_time, end_time,
             schedule_type, location, participants, priority, reminder_minutes, status, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$12) RETURNING *`, [data.userId, data.title, data.description, data.date, data.startTime, data.endTime,
            data.scheduleType, data.location, data.participants, data.priority,
            data.reminderMinutes, data.userId]);
        return result.rows[0];
    }
    async update(id, data, userId) {
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
            fields.push(`schedule_date=$${idx++}`);
            values.push(data.date);
        }
        if (data.startTime) {
            fields.push(`start_time=$${idx++}`);
            values.push(data.startTime);
        }
        if (data.endTime) {
            fields.push(`end_time=$${idx++}`);
            values.push(data.endTime);
        }
        if (data.scheduleType) {
            fields.push(`schedule_type=$${idx++}`);
            values.push(data.scheduleType);
        }
        if (data.location !== undefined) {
            fields.push(`location=$${idx++}`);
            values.push(data.location);
        }
        if (data.participants) {
            fields.push(`participants=$${idx++}`);
            values.push(data.participants);
        }
        if (data.priority) {
            fields.push(`priority=$${idx++}`);
            values.push(data.priority);
        }
        if (data.reminderMinutes !== undefined) {
            fields.push(`reminder_minutes=$${idx++}`);
            values.push(data.reminderMinutes);
        }
        if (data.status) {
            fields.push(`status=$${idx++}`);
            values.push(data.status);
        }
        fields.push(`updated_by=$${idx++}`);
        values.push(userId);
        fields.push(`updated_at=NOW()`);
        values.push(id);
        const result = await database_1.default.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`, values);
        return result.rows[0];
    }
    async getStats(userId) {
        const today = new Date().toISOString().split('T')[0];
        const meetings = await database_1.default.query(`SELECT COUNT(*) as count FROM schedules WHERE schedule_date=$1 AND status='active' AND schedule_type != 'personal'`, [today]);
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const freeSlots = await this.getAvailableSlots(today, 30);
        const totalFreeMinutes = freeSlots.reduce((acc, slot) => {
            return acc + this.timeDiffMinutes(slot.start_time, slot.end_time);
        }, 0);
        return {
            todayMeetings: parseInt(meetings.rows[0].count),
            freeTimeMinutes: totalFreeMinutes,
            freeTimeFormatted: `${Math.floor(totalFreeMinutes / 60)}h ${totalFreeMinutes % 60}m`
        };
    }
}
exports.ScheduleService = ScheduleService;
exports.scheduleService = new ScheduleService();
//# sourceMappingURL=scheduleService.js.map