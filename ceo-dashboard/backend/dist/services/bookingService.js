"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = void 0;
const database_1 = __importDefault(require("../config/database"));
class BookingService {
    async getAll(status) {
        let query = `SELECT b.*, u.full_name as handled_by_name FROM bookings b
                     LEFT JOIN users u ON b.handled_by = u.id`;
        const params = [];
        if (status && status !== 'all') {
            query += ' WHERE b.status = $1';
            params.push(status);
        }
        query += ' ORDER BY b.booking_date DESC, b.preferred_time DESC';
        const result = await database_1.default.query(query, params);
        return result.rows;
    }
    async getById(id) {
        const result = await database_1.default.query(`SELECT b.*, u.full_name as handled_by_name FROM bookings b
             LEFT JOIN users u ON b.handled_by = u.id WHERE b.id = $1`, [id]);
        return result.rows[0];
    }
    async create(data) {
        const result = await database_1.default.query(`INSERT INTO bookings (booked_by_name, booked_by_email, company, purpose,
             booking_date, preferred_time, duration, status, notes, created_by,
             address, place, frequency, what, phone, visitor_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [data.name, data.email, data.company, data.purpose,
            data.date, data.time, data.duration, data.notes, data.userId,
            data.address, data.place, data.frequency, data.what, data.phone, data.visitorType]);
        return result.rows[0];
    }
    async updateStatus(id, status, handledBy) {
        const result = await database_1.default.query(`UPDATE bookings SET status=$1, handled_by=$2, updated_at=NOW()
             WHERE id=$3 RETURNING *`, [status, handledBy, id]);
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