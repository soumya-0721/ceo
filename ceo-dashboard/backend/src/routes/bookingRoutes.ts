import { Router, Request, Response } from 'express';
import { bookingService } from '../services/bookingService';
import { scheduleService } from '../services/scheduleService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import pool from '../config/database';

const router = Router();

// Public: get available slots for a date (availability minus scheduled)
router.get('/available-slots', async (req: Request, res: Response) => {
    try {
        const { date, duration } = req.query;
        if (!date) { res.status(400).json({ error: 'Date required' }); return; }
        const durationMin = parseInt(duration as string) || 30;
        const dateObj = new Date(date as string);
        const dayOfWeek = dateObj.getDay();

        // 1) CEO availability for this day of week
        const availResult = await pool.query(
            `SELECT start_time, end_time FROM availability
             WHERE day_of_week = $1 AND is_available = true ORDER BY start_time`,
            [dayOfWeek]
        );

        if (availResult.rows.length === 0) {
            res.json({ slots: [], message: 'No availability set for this day' });
            return;
        }

        // 2) Scheduled meetings + focus sessions for this date
        const blockedResult = await pool.query(
            `SELECT start_time, end_time FROM schedules
             WHERE schedule_date = $1 AND status = 'active'
             UNION ALL
             SELECT start_time, end_time FROM focus_sessions
             WHERE focus_date = $1 AND status = 'active'
             ORDER BY start_time`,
            [date]
        );

        // 3) Existing bookings for this date
        const bookingsResult = await pool.query(
            `SELECT preferred_time, duration FROM bookings
             WHERE booking_date = $1 AND status IN ('pending','accepted')`,
            [date]
        );

        // Convert bookings to blocked time ranges
        const bookingBlocks = bookingsResult.rows.map((b: any) => {
            const [h, m] = b.preferred_time.split(':').map(Number);
            const startMin = h * 60 + m;
            const endMin = startMin + (b.duration || 30);
            return {
                start_time: `${Math.floor(startMin / 60).toString().padStart(2, '0')}:${(startMin % 60).toString().padStart(2, '0')}`,
                end_time: `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`
            };
        });

        const allBlocked = [...blockedResult.rows, ...bookingBlocks]
            .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

        // 4) Subtract blocked from available
        const slots: any[] = [];
        for (const avail of availResult.rows) {
            let currentStart = avail.start_time;
            for (const block of allBlocked) {
                if (block.end_time <= currentStart) continue;
                if (block.start_time > currentStart) {
                    const diff = timeDiffMinutes(currentStart, block.start_time);
                    if (diff >= durationMin) {
                        slots.push({ start: currentStart, end: block.start_time, duration: diff });
                    }
                }
                if (block.end_time > currentStart) currentStart = block.end_time;
            }
            if (currentStart < avail.end_time) {
                const diff = timeDiffMinutes(currentStart, avail.end_time);
                if (diff >= durationMin) {
                    slots.push({ start: currentStart, end: avail.end_time, duration: diff });
                }
            }
        }

        res.json({ slots, date, dayOfWeek, duration: durationMin });
    } catch (error: any) {
        console.error('Available slots error:', error);
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});

function timeDiffMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

// Public booking route - no auth required
router.post('/public', async (req: Request, res: Response) => {
    try {
        const { name, email, company, purpose, date, time, duration, notes, address, place, frequency, what, phone, visitorType } = req.body;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }
        const booking = await bookingService.create({
            name, email, company, purpose, date, time,
            duration: duration || 30, notes, address, place,
            frequency, what, phone, visitorType: visitorType || 'external',
            userId: null
        });
        res.status(201).json({ message: 'Booking request submitted successfully', booking });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.query;
        const bookings = await bookingService.getAll(status as string);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get bookings' });
    }
});

router.get('/export', async (_req: AuthRequest, res: Response) => {
    try {
        const bookings = await bookingService.getAll();
        res.setHeader('Content-Disposition', 'attachment; filename=bookings.xlsx');
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export bookings' });
    }
});

router.get('/pending-count', async (_req: AuthRequest, res: Response) => {
    try {
        const count = await bookingService.getPendingCount();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get pending count' });
    }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const booking = await bookingService.getById(req.params.id);
        if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get booking' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, company, purpose, date, time, duration, notes, address, place, frequency, what, phone, visitorType } = req.body;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }
        const booking = await bookingService.create({
            name, email, company, purpose, date, time,
            duration: duration || 30, notes, address, place,
            frequency, what, phone, visitorType, userId: req.user!.id
        });

        await auditService.log({
            userId: req.user!.id, action: 'created', recordType: 'booking',
            recordId: booking.id, newData: booking
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'New Booking Request',
            `${req.user!.fullName} received a booking request from ${name} for ${date} at ${time}`,
            'created', 'booking', booking.id, null, booking
        );

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const oldBooking = await bookingService.getById(req.params.id);
        const updated = await bookingService.updateStatus(req.params.id, req.body.status, req.user!.id);

        if (req.body.status === 'accepted') {
            await scheduleService.create({
                title: `Booking: ${oldBooking.purpose}`,
                description: `Booking from ${oldBooking.booked_by_name} (${oldBooking.company || 'N/A'})`,
                date: oldBooking.booking_date,
                startTime: oldBooking.preferred_time,
                endTime: calculateEndTime(oldBooking.preferred_time, oldBooking.duration),
                scheduleType: 'other',
                location: 'TBD',
                participants: [oldBooking.booked_by_name],
                priority: 'medium',
                reminderMinutes: 15,
                userId: req.user!.id
            });
        }

        await auditService.log({
            userId: req.user!.id, action: req.body.status, recordType: 'booking',
            recordId: req.params.id, oldData: oldBooking, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, `Booking ${req.body.status.charAt(0).toUpperCase() + req.body.status.slice(1)}`,
            `${req.user!.fullName} ${req.body.status} booking from ${oldBooking.booked_by_name}`,
            req.body.status, 'booking', req.params.id, oldBooking, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

function calculateEndTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

export default router;
