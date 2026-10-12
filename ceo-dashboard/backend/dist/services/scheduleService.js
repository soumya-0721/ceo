"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleService = exports.ScheduleService = void 0;
const database_1 = __importDefault(require("../config/database"));
const slotService_1 = require("./slotService");
const scheduling_1 = require("../lib/scheduling");
class ScheduleService {
    /**
     * Schedules owned by `userId` (the CEO's calendar = user_id = CEO).
     * `scope === 'all'` returns every owner (shared coordination view).
     * Filtering is by owner (user_id), NOT created_by, so an appointment Soumya
     * creates *for* the CEO belongs to the CEO while her own entries stay separate.
     */
    async getByDate(date, userId, scope) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.schedule_date = $1 AND s.status NOT IN ('archived')`;
        const params = [date];
        if (userId && scope !== 'all') {
            query += ' AND s.user_id = $2';
            params.push(userId);
        }
        query += ' ORDER BY s.start_time';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getByDateRange(startDate, endDate, userId, scope) {
        let query = `SELECT s.*, u.full_name as creator_name FROM schedules s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.schedule_date BETWEEN $1 AND $2 AND s.status NOT IN ('archived')`;
        const params = [startDate, endDate];
        if (userId && scope !== 'all') {
            query += ' AND s.user_id = $3';
            params.push(userId);
        }
        query += ' ORDER BY s.schedule_date, s.start_time';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getById(id) {
        const result = await database_1.default.query(`SELECT s.*, u.full_name as creator_name FROM schedules s
             LEFT JOIN users u ON s.user_id = u.id WHERE s.id = $1`, [id]);
        return result.rows[0];
    }
    /**
     * Overlap detection across a person's commitments. Proper minute-based range
     * comparison, never string ordering. `excludeId` drops the record being edited
     * so editing cannot raise a false self-conflict.
     */
    async checkConflict(date, startTime, endTime, excludeId, ownerId, runner = database_1.default) {
        let query = `SELECT s.id, s.title, s.start_time, s.end_time, s.user_id,
                            s.is_ceo_appointment, s.priority, s.conflict_override,
                            u.full_name as owner_name
                     FROM schedules s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.schedule_date = $1 AND s.status = 'active'
                     AND s.start_time < $3 AND s.end_time > $2`;
        const params = [date, startTime, endTime];
        let idx = 4;
        if (excludeId) {
            query += ` AND s.id != $${idx++}`;
            params.push(excludeId);
        }
        if (ownerId) {
            query += ` AND s.user_id = $${idx++}`;
            params.push(ownerId);
        }
        const result = await runner.query(query, params);
        return result.rows;
    }
    /** Free windows for a date, from the shared availability engine (includes bookings). */
    async getAvailableSlots(date, durationMinutes) {
        return slotService_1.slotService.getAvailableSlots(date, durationMinutes);
    }
    async create(data, runner = database_1.default) {
        const result = await runner.query(`INSERT INTO schedules (user_id, title, description, schedule_date, start_time, end_time,
             schedule_type, location, participants, priority, reminder_minutes, status,
             is_ceo_appointment, booking_id, conflict_override, override_by, override_at, override_reason,
             created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13,$14,$15,$16,$17,$18,$18)
             RETURNING *`, [data.userId, data.title, data.description, data.date, data.startTime, data.endTime,
            data.scheduleType, data.location, data.participants,
            (0, scheduling_1.normalizePriority)(data.priority), data.reminderMinutes,
            data.isCeoAppointment === true, data.bookingId || null,
            data.conflictOverride === true, data.overrideBy || null, data.overrideAt || null,
            data.overrideReason || null, data.userId]);
        return result.rows[0];
    }
    async update(id, data, userId, runner = database_1.default) {
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
        if (data.participants !== undefined) {
            fields.push(`participants=$${idx++}`);
            values.push(data.participants);
        }
        if (data.priority) {
            fields.push(`priority=$${idx++}`);
            values.push((0, scheduling_1.normalizePriority)(data.priority));
        }
        if (data.reminderMinutes !== undefined) {
            fields.push(`reminder_minutes=$${idx++}`);
            values.push(data.reminderMinutes);
        }
        if (data.status) {
            fields.push(`status=$${idx++}`);
            values.push(data.status);
        }
        if (data.isCeoAppointment !== undefined) {
            fields.push(`is_ceo_appointment=$${idx++}`);
            values.push(data.isCeoAppointment === true);
        }
        if (data.conflictOverride !== undefined) {
            fields.push(`conflict_override=$${idx++}`);
            values.push(data.conflictOverride === true);
            fields.push(`override_by=$${idx++}`);
            values.push(data.overrideBy || null);
            fields.push(`override_at=$${idx++}`);
            values.push(data.overrideAt || null);
            fields.push(`override_reason=$${idx++}`);
            values.push(data.overrideReason || null);
        }
        fields.push(`updated_by=$${idx++}`);
        values.push(userId);
        fields.push(`updated_at=NOW()`);
        values.push(id);
        const result = await runner.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`, values);
        return result.rows[0];
    }
    async getStats(userId) {
        const today = (0, slotService_1.todayStr)();
        const meetings = await database_1.default.query(`SELECT COUNT(*) as count FROM schedules
             WHERE schedule_date=$1 AND status='active'
             AND schedule_type != 'personal'
             AND (is_ceo_appointment = true OR user_id = $2)`, [today, userId]);
        const freeWindows = await slotService_1.slotService.getFreeWindows(today);
        const totalFreeMinutes = freeWindows.reduce((acc, window) => {
            return acc + ((0, scheduling_1.toMinutes)(window.end) - (0, scheduling_1.toMinutes)(window.start));
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