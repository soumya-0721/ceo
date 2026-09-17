import { Router, Request, Response } from 'express';
import { bookingService } from '../services/bookingService';
import { scheduleService } from '../services/scheduleService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

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
