"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingService_1 = require("../services/bookingService");
const scheduleService_1 = require("../services/scheduleService");
const authService_1 = require("../services/authService");
const slotService_1 = require("../services/slotService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const scheduling_1 = require("../lib/scheduling");
const router = (0, express_1.Router)();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
function normalizeTime(time) {
    return (time || '').substring(0, 5);
}
/**
 * Public: automatically calculated slots for a date.
 * working hours - CEO schedules - coordinator schedules - focus - existing bookings.
 */
router.get('/available-slots', async (req, res) => {
    try {
        const date = String(req.query.date || '');
        const durationMin = parseInt(String(req.query.duration || ''), 10) || 30;
        if (!DATE_RE.test(date)) {
            res.status(400).json({ error: 'A valid date is required (YYYY-MM-DD)' });
            return;
        }
        const [slots, workingHours] = await Promise.all([
            slotService_1.slotService.getAvailableSlots(date, durationMin),
            slotService_1.slotService.getWorkingWindows(date)
        ]);
        res.json({
            slots,
            date,
            duration: durationMin,
            workingHours,
            message: slots.length === 0 ? 'No available time slots for this date.' : undefined
        });
    }
    catch (error) {
        console.error('Available slots error:', error);
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});
/** Final availability check so an occupied slot can never be booked twice. */
async function assertSlotIsFree(date, time, duration, userId) {
    if (!DATE_RE.test(date))
        return 'A valid booking date is required.';
    if (!TIME_RE.test(time))
        return 'A valid booking time is required.';
    const free = await slotService_1.slotService.isSlotAvailable(date, time, duration, userId);
    if (!free)
        return 'That time slot is no longer available. Please select another slot.';
    return null;
}
// Public booking request - always created PENDING; approval is required before it
// becomes a confirmed CEO meeting.
router.post('/public', async (req, res) => {
    try {
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }
        // Advisory lock on the exact slot serialises simultaneous submissions so
        // two visitors cannot both pass the availability check and double-book.
        const booking = await (0, database_1.withTransaction)(async (client) => {
            const conflict = await assertSlotIsFree(date, time, duration);
            if (conflict) {
                throw { httpStatus: 409, body: { error: conflict, message: conflict, hasConflict: true } };
            }
            return bookingService_1.bookingService.create({
                name, email, company, purpose, date, time,
                duration, notes, address, place,
                frequency, what, phone, visitorType: visitorType || 'external',
                userId: null
            }, client);
        }, `booking:${date}:${time}:${duration}`);
        res.status(201).json({ message: 'Booking request submitted for approval', booking });
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to create booking' });
    }
});
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const bookings = await bookingService_1.bookingService.getAll(status);
        res.json(bookings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get bookings' });
    }
});
router.get('/export', async (_req, res) => {
    try {
        const bookings = await bookingService_1.bookingService.getAll();
        res.setHeader('Content-Disposition', 'attachment; filename=bookings.xlsx');
        res.json(bookings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to export bookings' });
    }
});
router.get('/pending-count', async (_req, res) => {
    try {
        const count = await bookingService_1.bookingService.getPendingCount();
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get pending count' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        if (!(0, scheduling_1.canReadBooking)(req.user.role)) {
            res.status(403).json({ error: 'You are not authorized to view this booking' });
            return;
        }
        const booking = await bookingService_1.bookingService.getById(req.params.id);
        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }
        res.json(booking);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get booking' });
    }
});
// Authenticated booking request (still pending until the coordinator approves).
router.post('/', async (req, res) => {
    try {
        const { name, email, company, purpose, date, time, notes, address, place, frequency, what, phone, visitorType } = req.body;
        const duration = parseInt(String(req.body.duration || '30'), 10) || 30;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }
        // Advisory lock on the exact slot prevents two simultaneous submissions
        // from both passing the availability check and double-booking.
        const booking = await (0, database_1.withTransaction)(async (client) => {
            const conflict = await assertSlotIsFree(date, time, duration);
            if (conflict) {
                throw { httpStatus: 409, body: { error: conflict, hasConflict: true } };
            }
            return bookingService_1.bookingService.create({
                name, email, company, purpose, date, time,
                duration, notes, address, place,
                frequency, what, phone, visitorType, userId: req.user.id
            }, client);
        }, `booking:${date}:${time}:${duration}`);
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'booking_created', recordType: 'booking',
            recordId: booking.id, newData: booking
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'New Booking Request', `${req.user.fullName} logged a booking request from ${name} for ${date} at ${time}`, 'created', 'booking', booking.id, null, booking);
        res.status(201).json(booking);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});
function conflictPayload(conflicts) {
    return {
        error: `This time overlaps with ${conflicts.map((c) => `"${c.title}" (${(0, scheduling_1.priorityLabel)(c.priority)})`).join(', ')}`,
        hasConflict: true,
        conflicts: conflicts.map((c) => ({
            id: c.id, title: c.title,
            startTime: normalizeTime(c.start_time), endTime: normalizeTime(c.end_time),
            ownerName: c.owner_name, priority: c.priority, priorityLabel: (0, scheduling_1.priorityLabel)(c.priority)
        })),
        message: 'Confirm to override the conflict, or reschedule to another time.'
    };
}
async function createCeoMeeting(client, booking, slot, ceoId, override, actorId, reason) {
    return scheduleService_1.scheduleService.create({
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
router.patch('/:id/status', auth_1.requireCoordinator, async (req, res) => {
    const status = req.body.status;
    const allowedStatuses = ['accepted', 'rejected', 'rescheduled', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }
    try {
        const outcome = await (0, database_1.withTransaction)(async (client) => {
            const booking = await bookingService_1.bookingService.getByIdForUpdate(req.params.id, client);
            if (status === 'rejected' || status === 'cancelled') {
                if (booking.schedule_id) {
                    await scheduleService_1.scheduleService.update(booking.schedule_id, { status: 'cancelled' }, req.user.id, client);
                }
                const updated = await bookingService_1.bookingService.setApproval(booking.id, {
                    status, handledBy: req.user.id
                }, client);
                return { booking: updated, before: booking, schedule: null, status };
            }
            const date = req.body.date || booking.booking_date;
            const time = normalizeTime(req.body.time || booking.preferred_time);
            const duration = parseInt(String(req.body.duration || booking.duration || 30), 10) || 30;
            const endTime = (0, scheduling_1.addMinutes)(time, duration);
            const windowError = (0, scheduling_1.validateMeetingWindow)(date, time, endTime);
            if (windowError)
                throw { httpStatus: 400, body: { error: windowError } };
            const ceo = await authService_1.authService.getCeo();
            if (!ceo)
                throw { httpStatus: 400, body: { error: 'CEO account not found' } };
            const override = req.body.overrideConflict === true;
            const conflicts = await scheduleService_1.scheduleService.checkConflict(date, time, endTime, booking.schedule_id, ceo.id, client);
            if (conflicts.length > 0 && !override) {
                throw { httpStatus: 409, body: conflictPayload(conflicts) };
            }
            let schedule;
            if (booking.schedule_id) {
                schedule = await scheduleService_1.scheduleService.update(booking.schedule_id, {
                    title: `Booking: ${booking.purpose}`,
                    date,
                    startTime: time,
                    endTime,
                    scheduleType: 'client_meeting',
                    conflictOverride: override,
                    overrideBy: override ? req.user.id : null,
                    overrideAt: override ? new Date().toISOString() : null,
                    overrideReason: override ? (req.body.reason || 'Override confirmed') : null
                }, req.user.id, client);
            }
            if (!schedule) {
                schedule = await createCeoMeeting(client, booking, { date, time, endTime }, ceo.id, override, req.user.id, req.body.reason);
            }
            const updated = await bookingService_1.bookingService.setApproval(booking.id, {
                status,
                scheduleId: schedule.id,
                approvedBy: req.user.id,
                handledBy: req.user.id,
                date, time, duration
            }, client);
            return { booking: updated, before: booking, schedule, status };
        }, `booking:${req.params.id}`);
        const action = outcome.status === 'rescheduled' ? 'booking_rescheduled'
            : outcome.status === 'accepted' ? 'booking_approved'
                : 'booking_rejected';
        await auditService_1.auditService.log({
            userId: req.user.id, action, recordType: 'booking',
            recordId: req.params.id, oldData: outcome.before, newData: outcome.booking
        });
        if (outcome.schedule && outcome.booking.schedule_id) {
            await auditService_1.auditService.log({
                userId: req.user.id, action: 'schedule_linked', recordType: 'schedule',
                recordId: outcome.booking.schedule_id, newData: outcome.schedule
            });
        }
        const verb = outcome.status === 'accepted' ? 'approved'
            : outcome.status === 'rescheduled' ? 'rescheduled' : 'rejected';
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, `Booking ${verb.charAt(0).toUpperCase() + verb.slice(1)}`, `${req.user.fullName} ${verb} the booking from ${outcome.before.booked_by_name} (${outcome.booking.booking_date} ${normalizeTime(outcome.booking.preferred_time)})`, outcome.status, 'booking', req.params.id, outcome.before, outcome.booking);
        res.json({ booking: outcome.booking, schedule: outcome.schedule, conflictOverride: outcome.schedule?.conflict_override === true });
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});
exports.default = router;
//# sourceMappingURL=bookingRoutes.js.map