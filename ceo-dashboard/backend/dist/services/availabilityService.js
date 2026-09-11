"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityService = exports.AvailabilityService = void 0;
const database_1 = __importDefault(require("../config/database"));
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
        const existing = await database_1.default.query('SELECT id FROM availability WHERE user_id=$1 AND day_of_week=$2 AND start_time=$3 AND end_time=$4', [userId, dayOfWeek, startTime, endTime]);
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
    async delete(id) {
        await database_1.default.query('DELETE FROM availability WHERE id=$1', [id]);
    }
}
exports.AvailabilityService = AvailabilityService;
exports.availabilityService = new AvailabilityService();
//# sourceMappingURL=availabilityService.js.map