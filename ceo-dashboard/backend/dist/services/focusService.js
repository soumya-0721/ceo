"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.focusService = exports.FocusService = void 0;
const database_1 = __importDefault(require("../config/database"));
class FocusService {
    async getByDate(date) {
        const result = await database_1.default.query(`SELECT f.*, u.full_name as user_name FROM focus_sessions f
             LEFT JOIN users u ON f.user_id = u.id
             WHERE f.focus_date = $1 AND f.status = 'active'
             ORDER BY f.start_time`, [date]);
        return result.rows;
    }
    async create(data) {
        const result = await database_1.default.query(`INSERT INTO focus_sessions (user_id, title, focus_date, start_time, end_time, status, created_by)
             VALUES ($1,$2,$3,$4,$5,'active',$1) RETURNING *`, [data.userId, data.title || 'Focus Time', data.date, data.startTime, data.endTime]);
        return result.rows[0];
    }
    async updateStatus(id, status) {
        const result = await database_1.default.query('UPDATE focus_sessions SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [status, id]);
        return result.rows[0];
    }
    async cancel(id) {
        return this.updateStatus(id, 'cancelled');
    }
}
exports.FocusService = FocusService;
exports.focusService = new FocusService();
//# sourceMappingURL=focusService.js.map