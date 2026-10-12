"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = void 0;
const database_1 = __importDefault(require("../config/database"));
class BookingService {
    async getAll(status) {
        let query = `SELECT b.*, u.full_name as handled_by_name,
                            su.full_name as schedule_owner_name,
                            s.priority as schedule_priority
                     FROM bookings b
                     LEFT JOIN users u ON b.handled_by = u.id
                     LEFT JOIN schedules s ON b.schedule_id = s.id
                     LEFT JOIN users su ON s.user_id = su.id`;
        const params = [];
        if (status && status !== 'all') {
            query += ' WHERE b.status = $1';
            params.push(status);
        }
        query += ' ORDER BY b.booking_date DESC, b.preferred_time DESC';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getById(id, runner = database_1.default) {
        const result = await runner.query(`SELECT b.*, u.full_name as handled_by_name, s.priority as schedule_priority FROM bookings b
             LEFT JOIN users u ON b.handled_by = u.id
             LEFT JOIN schedules s ON b.schedule_id = s.id WHERE b.id = $1`, [id]);
        return result.rows[0];
    }
    /** Row lock for the duration of an approval transaction. */
    async getByIdForUpdate(id, runner) {
        const result = await runner.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
        return result.rows[0];
    }
    async create(data, runner = database_1.default) {
        const result = await runner.query(`INSERT INTO bookings (booked_by_name, booked_by_email, company, purpose,
             booking_date, preferred_time, duration, status, notes, created_by,
             address, place, frequency, what, phone, visitor_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [data.name, data.email, data.company, data.purpose,
            data.date, data.time, data.duration, data.notes, data.userId,
            data.address, data.place, data.frequency, data.what, data.phone, data.visitorType]);
        return result.rows[0];
    }
    async updateStatus(id, status, handledBy, runner = database_1.default) {
        const result = await runner.query(`UPDATE bookings SET status=$1, handled_by=$2, handled_at=NOW(), updated_at=NOW()
             WHERE id=$3 RETURNING *`, [status, handledBy, id]);
        return result.rows[0];
    }
    /**
     * Records the outcome of an approval / reschedule: links the single CEO meeting,
     * stamps the approver, and (for reschedules) stores the new requested slot.
     */
    async setApproval(id, data, runner = database_1.default) {
        const fields = ['status=$1', 'handled_by=$2', 'handled_at=NOW()', 'updated_at=NOW()'];
        const values = [data.status, data.handledBy || data.approvedBy || null];
        let idx = 3;
        if (data.approvedBy) {
            fields.push(`approved_by=$${idx++}`);
            values.push(data.approvedBy);
            fields.push('approved_at=NOW()');
        }
        if ('scheduleId' in data) {
            fields.push(`schedule_id=$${idx++}`);
            values.push(data.scheduleId || null);
        }
        if (data.date) {
            fields.push(`booking_date=$${idx++}`);
            values.push(data.date);
        }
        if (data.time) {
            fields.push(`preferred_time=$${idx++}`);
            values.push(data.time);
        }
        if (data.duration) {
            fields.push(`duration=$${idx++}`);
            values.push(data.duration);
        }
        values.push(id);
        const result = await runner.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`, values);
        return result.rows[0];
    }
    async getPendingCount() {
        const result = await database_1.default.query(`SELECT COUNT(*) as count FROM bookings WHERE status='pending'`);
        return parseInt(result.rows[0].count);
    }
}
exports.BookingService = BookingService;
exports.bookingService = new BookingService();
//# sourceMappingURL=bookingService.js.map