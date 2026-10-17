import { Router, Request, Response } from 'express';
import { bookingService } from '../services/bookingService';
import { scheduleService } from '../services/scheduleService';
import { authService } from '../services/authService';
import { slotService } from '../services/slotService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest, requireCoordinator } from '../middleware/auth';
import { withTransaction } from '../config/database';
import { addMinutes, validateMeetingWindow, priorityLabel, canReadBooking } from '../lib/scheduling';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function normalizeTime(time: string): string {
    return (time || '').substring(0, 5);
}

/**
 * Public: automatically calculated slots for a date.
 * working hours - CEO schedules - coordinator schedules - focus - existing bookings.
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

/** Final availability check so an occupied slot can never be booked twice. */
async function assertSlotIsFree(date: string, time: string, duration: number, userId?: string): Promise<string | null> {
    if (!DATE_RE.test(date)) return 'A valid booking date is required.';
    if (!TIME_RE.test(time)) return 'A valid booking time is required.';
    const free = await slotService.isSlotAvailable(date, time, duration, userId);
    if (!free) return 'That time slot is no longer available. Please select another slot.';
    return null;
}

// Public booking request - always created PENDING; approval is required before it
// becomes a confirmed CEO meeting.
router.post('/public', async (req: Request, res: Response) => {
    try {
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;

        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }

        // Advisory lock on the exact slot serialises simultaneous submissions so
        // two visitors cannot both pass the availability check and double-book.
        const booking = await withTransaction(async (client) => {
            const conflict = await assertSlotIsFree(date, time, duration);
            if (conflict) {
                throw { httpStatus: 409, body: { error: conflict, message: conflict, hasConflict: true } };
            }
            return bookingService.create({
                name, email, company, purpose, date, time,
                duration, notes, address, place,
                frequency, what, phone, visitorType: visitorType || 'external',
                userId: null
            }, client);
        }, `booking:${date}:${time}:${duration}`);
        res.status(201).json({ message: 'Booking request submitted for approval', booking });
    } catch (error: any) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
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
        if (!canReadBooking(req.user!.role)) {
            res.status(403).json({ error: 'You are not authorized to view this booking' });
            return;
        }
        const booking = await bookingService.getById(req.params.id);
        if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get booking' });
    }
});

// Authenticated booking request (still pending until the coordinator approves).
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }

        // Advisory lock on the exact slot prevents two simultaneous submissions
        // from both passing the availability check and double-booking.
        const booking = await withTransaction(async (client) => {
            const conflict = await assertSlotIsFree(date, time, duration);
            if (conflict) {
                throw { httpStatus: 409, body: { error: conflict, hasConflict: true } };
            }
            return bookingService.create({
                name, email, company, purpose, date, time,
                duration, notes, address, place,
                frequency, what, phone, visitorType, userId: req.user!.id
            }, client);
        }, `booking:${date}:${time}:${duration}`);

        await auditService.log({
            userId: req.user!.id, action: 'booking_created', recordType: 'booking',
            recordId: booking.id, newData: booking
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'New Booking Request',
            `${req.user!.fullName} logged a booking request from ${name} for ${date} at ${time}`,
            'created', 'booking', booking.id, null, booking
        );

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

function conflictPayload(conflicts: any[]) {
    return {
        error: `This time overlaps with ${conflicts.map((c: any) => `"${c.title}" (${priorityLabel(c.priority)})`).join(', ')}`,
        hasConflict: true,
        conflicts: conflicts.map((c: any) => ({
            id: c.id, title: c.title,
            startTime: normalizeTime(c.start_time), endTime: normalizeTime(c.end_time),
            ownerName: c.owner_name, priority: c.priority, priorityLabel: priorityLabel(c.priority)
        })),
        message: 'Confirm to override the conflict, or reschedule to another time.'
    };
}

async function createCeoMeeting(client: any, booking: any, slot: { date: string; time: string; endTime: string }, ceoId: string, override: boolean, actorId: string, reason?: string) {
    return scheduleService.create({
        title: `Booking: ${booking.purpose}`,
        description: `Booking from ${booking.booked_by_name}${booking.company ? ` (${booking.company})` : ''}${booking.what ? ` · ${booking.what}` : ''}`,
        date: slot.date,
        startTime: slot.time,
        endTime: slot.endTime,
        scheduleType: 'client_meeting',
        location: booking.place || booking.address || 'TBD',
        participants: [booking.booked_by_name],
        priority: 'high',
        reminderMinutes: 15,
        userId: ceoId,
        isCeoAppointment: true,
        bookingId: booking.id,
        conflictOverride: override,
        overrideBy: override ? actorId : null,
        overrideAt: override ? new Date().toISOString() : null,
        overrideReason: override ? (reason || 'Override confirmed') : null
    }, client);
}

/**
 * Soumya (coordinator) approves / rejects / reschedules a CEO booking request.
 * Role is enforced on the server via requireCoordinator - hiding the button is not enough.
 */
router.patch('/:id/status', requireCoordinator, async (req: AuthRequest, res: Response) => {
    const status = req.body.status;
    const allowedStatuses = ['accepted', 'rejected', 'rescheduled', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }

    try {
        const outcome = await withTransaction(async (client) => {
            const booking = await bookingService.getByIdForUpdate(req.params.id, client);

            if (status === 'rejected' || status === 'cancelled') {
                if (booking.schedule_id) {
                    await scheduleService.update(booking.schedule_id, { status: 'cancelled' }, req.user!.id, client);
                }
                const updated = await bookingService.setApproval(booking.id, {
                    status, handledBy: req.user!.id
                }, client);
                return { booking: updated, before: booking, schedule: null, status };
            }

            const date = req.body.date || booking.booking_date;
            const time = normalizeTime(req.body.time || booking.preferred_time);
            const duration = parseInt(String(req.body.duration || booking.duration || 30), 10) || 30;
            const endTime = addMinutes(time, duration);

            const windowError = validateMeetingWindow(date, time, endTime);
            if (windowError) throw { httpStatus: 400, body: { error: windowError } };

            const ceo = await authService.getCeo();
            if (!ceo) throw { httpStatus: 400, body: { error: 'CEO account not found' } };

            const override = req.body.overrideConflict === true;
            const conflicts = await scheduleService.checkConflict(date, time, endTime, booking.schedule_id, ceo.id, client);
            if (conflicts.length > 0 && !override) {
                throw { httpStatus: 409, body: conflictPayload(conflicts) };
            }

            let schedule;
            if (booking.schedule_id) {
                schedule = await scheduleService.update(booking.schedule_id, {
                    title: `Booking: ${booking.purpose}`,
                    date,
                    startTime: time,
                    endTime,
                    scheduleType: 'client_meeting',
                    conflictOverride: override,
                    overrideBy: override ? req.user!.id : null,
                    overrideAt: override ? new Date().toISOString() : null,
                    overrideReason: override ? (req.body.reason || 'Override confirmed') : null
                }, req.user!.id, client);
            }
            if (!schedule) {
                schedule = await createCeoMeeting(client, booking, { date, time, endTime }, ceo.id, override, req.user!.id, req.body.reason);
            }

            const updated = await bookingService.setApproval(booking.id, {
                status,
                scheduleId: schedule.id,
                approvedBy: req.user!.id,
                handledBy: req.user!.id,
                date, time, duration
            }, client);

            return { booking: updated, before: booking, schedule, status };
        }, `booking:${req.params.id}`);

        const action = outcome.status === 'rescheduled' ? 'booking_rescheduled'
            : outcome.status === 'accepted' ? 'booking_approved'
            : 'booking_rejected';

        await auditService.log({
            userId: req.user!.id, action, recordType: 'booking',
            recordId: req.params.id, oldData: outcome.before, newData: outcome.booking
        });

        if (outcome.schedule && outcome.booking.schedule_id) {
            await auditService.log({
                userId: req.user!.id, action: 'schedule_linked', recordType: 'schedule',
                recordId: outcome.booking.schedule_id, newData: outcome.schedule
            });
        }

        const verb = outcome.status === 'accepted' ? 'approved'
            : outcome.status === 'rescheduled' ? 'rescheduled' : 'rejected';
        await notificationService.notifyOtherUser(
            req.user!.id, `Booking ${verb.charAt(0).toUpperCase() + verb.slice(1)}`,
            `${req.user!.fullName} ${verb} the booking from ${outcome.before.booked_by_name} (${outcome.booking.booking_date} ${normalizeTime(outcome.booking.preferred_time)})`,
            outcome.status, 'booking', req.params.id, outcome.before, outcome.booking
        );

        res.json({ booking: outcome.booking, schedule: outcome.schedule, conflictOverride: outcome.schedule?.conflict_override === true });
    } catch (error: any) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

export default router;
