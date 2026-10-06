import { Router, Request, Response } from 'express';
import { bookingService } from '../services/bookingService';
import { scheduleService } from '../services/scheduleService';
import { slotService } from '../services/slotService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/**
 * Public: automatically calculated slots for a date.
 * working hours - CEO schedules - coordinator schedules - focus - existing bookings.
 * No manually created slots are ever required.
 */
router.get('/available-slots', async (req: Request, res: Response) => {
    try {
        const date = String(req.query.date || '');
        const durationMin = parseInt(String(req.query.duration || ''), 10) || 30;

        if (!DATE_RE.test(date)) {
            res.status(400).json({ error: 'A valid date is required (YYYY-MM-DD)' });
            return;
        }

        const [slots, workingHours] = await Promise.all([
            slotService.getAvailableSlots(date, durationMin),
            slotService.getWorkingWindows(date)
        ]);

        res.json({
            slots,
            date,
            duration: durationMin,
            workingHours,
            message: slots.length === 0 ? 'No available time slots for this date.' : undefined
        });
    } catch (error: any) {
        console.error('Available slots error:', error);
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});

/**
 * Final availability check shared by every booking entry point so an
 * occupied slot can never be booked twice.
 */
async function assertSlotIsFree(date: string, time: string, duration: number): Promise<string | null> {
    if (!DATE_RE.test(date)) return 'A valid booking date is required.';
    if (!TIME_RE.test(time)) return 'A valid booking time is required.';
    const free = await slotService.isSlotAvailable(date, time, duration);
    if (!free) return 'That time slot is no longer available. Please select another slot.';
    return null;
}

// Public booking route - no auth required
router.post('/public', async (req: Request, res: Response) => {
    try {
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;

        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }

        const conflict = await assertSlotIsFree(date, time, duration);
        if (conflict) {
            res.status(409).json({ error: conflict, message: conflict, hasConflict: true });
            return;
        }

        const booking = await bookingService.create({
            name, email, company, purpose, date, time,
            duration, notes, address, place,
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
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }

        const conflict = await assertSlotIsFree(date, time, duration);
        if (conflict) {
            res.status(409).json({ error: conflict, hasConflict: true });
            return;
        }

        const booking = await bookingService.create({
            name, email, company, purpose, date, time,
            duration, notes, address, place,
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
