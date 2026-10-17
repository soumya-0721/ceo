"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityService = exports.AvailabilityService = void 0;
const database_1 = __importDefault(require("../config/database"));
const scheduling_1 = require("../lib/scheduling");
class AvailabilityService {
    async getByUser(userId) {
        const result = await database_1.default.query('SELECT * FROM availability WHERE user_id=$1 ORDER BY day_of_week, start_time', [userId]);
        return result.rows;
    }
    async getTodayAvailability() {
        const today = new Date().getDay();
        const result = await database_1.default.query(`SELECT a.*, u.full_name FROM availability a
             LEFT JOIN users u ON a.user_id = u.id
             WHERE a.day_of_week = $1 AND a.is_available = true
             ORDER BY a.start_time`, [today]);
        return result.rows;
    }
    async upsert(userId, dayOfWeek, startTime, endTime, isAvailable, label) {
        const overlapCheck = await database_1.default.query(`SELECT id, start_time, end_time FROM availability
             WHERE user_id=$1 AND day_of_week=$2 AND is_available IS NOT FALSE`, [userId, dayOfWeek]);
        const newStart = (0, scheduling_1.normalizeTime)(startTime);
        const newEnd = (0, scheduling_1.normalizeTime)(endTime);
        // Check for overlapping slots on the same day
        const hasOverlap = overlapCheck.rows.some((r) => {
            const existingStart = (0, scheduling_1.normalizeTime)(r.start_time);
            const existingEnd = (0, scheduling_1.normalizeTime)(r.end_time);
            return (0, scheduling_1.toMinutes)(newStart) < (0, scheduling_1.toMinutes)(existingEnd) && (0, scheduling_1.toMinutes)(newEnd) > (0, scheduling_1.toMinutes)(existingStart);
        });
        if (hasOverlap) {
            throw { httpStatus: 409, body: { error: 'This time slot overlaps with an existing availability entry' } };
        }
        const existing = await database_1.default.query(`SELECT id FROM availability WHERE user_id=$1 AND day_of_week=$2 AND start_time=$3 AND end_time=$4`, [userId, dayOfWeek, startTime, endTime]);
        if (existing.rows.length > 0) {
            const result = await database_1.default.query(`UPDATE availability SET is_available=$1, label=$2, updated_at=NOW()
                 WHERE id=$3 RETURNING *`, [isAvailable, label || null, existing.rows[0].id]);
            return result.rows[0];
        }
        else {
            const result = await database_1.default.query(`INSERT INTO availability (user_id, day_of_week, start_time, end_time, is_available, label)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [userId, dayOfWeek, startTime, endTime, isAvailable, label || null]);
            return result.rows[0];
        }
    }
    async delete(id, userId) {
        const result = await database_1.default.query('DELETE FROM availability WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId]);
        return result.rows[0];
    }
}
exports.AvailabilityService = AvailabilityService;
exports.availabilityService = new AvailabilityService();
//# sourceMappingURL=availabilityService.js.map