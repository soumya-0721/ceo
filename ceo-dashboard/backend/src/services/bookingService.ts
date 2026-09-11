import pool from '../config/database';

export class BookingService {
    async getAll(status?: string) {
        let query = `SELECT b.*, u.full_name as handled_by_name FROM bookings b
                     LEFT JOIN users u ON b.handled_by = u.id`;
        const params: any[] = [];

        if (status && status !== 'all') {
            query += ' WHERE b.status = $1';
            params.push(status);
        }
        query += ' ORDER BY b.booking_date DESC, b.preferred_time DESC';

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getById(id: string) {
        const result = await pool.query(
            `SELECT b.*, u.full_name as handled_by_name FROM bookings b
             LEFT JOIN users u ON b.handled_by = u.id WHERE b.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async create(data: any) {
        const result = await pool.query(
            `INSERT INTO bookings (booked_by_name, booked_by_email, company, purpose,
             booking_date, preferred_time, duration, status, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9) RETURNING *`,
            [data.name, data.email, data.company, data.purpose,
             data.date, data.time, data.duration, data.notes, data.userId]
        );
        return result.rows[0];
    }

    async updateStatus(id: string, status: string, handledBy: string) {
        const result = await pool.query(
            `UPDATE bookings SET status=$1, handled_by=$2, updated_at=NOW()
             WHERE id=$3 RETURNING *`,
            [status, handledBy, id]
        );
        return result.rows[0];
    }

    async getPendingCount() {
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM bookings WHERE status='pending'`
        );
        return parseInt(result.rows[0].count);
    }
}

export const bookingService = new BookingService();
