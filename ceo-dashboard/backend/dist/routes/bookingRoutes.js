"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingService_1 = require("../services/bookingService");
const scheduleService_1 = require("../services/scheduleService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
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
router.post('/', async (req, res) => {
    try {
        const { name, email, company, purpose, date, time, duration, notes } = req.body;
        if (!name || !email || !purpose || !date || !time) {
            res.status(400).json({ error: 'Required fields missing' });
            return;
        }
        const booking = await bookingService_1.bookingService.create({
            name, email, company, purpose, date, time,
            duration: duration || 30, notes, userId: req.user.id
        });
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'created', recordType: 'booking',
            recordId: booking.id, newData: booking
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'New Booking Request', `${req.user.fullName} received a booking request from ${name} for ${date} at ${time}`, 'created', 'booking', booking.id, null, booking);
        res.status(201).json(booking);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const oldBooking = await bookingService_1.bookingService.getById(req.params.id);
        const updated = await bookingService_1.bookingService.updateStatus(req.params.id, req.body.status, req.user.id);
        if (req.body.status === 'accepted') {
            await scheduleService_1.scheduleService.create({
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
                userId: req.user.id
            });
        }
        await auditService_1.auditService.log({
            userId: req.user.id, action: req.body.status, recordType: 'booking',
            recordId: req.params.id, oldData: oldBooking, newData: updated
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, `Booking ${req.body.status.charAt(0).toUpperCase() + req.body.status.slice(1)}`, `${req.user.fullName} ${req.body.status} booking from ${oldBooking.booked_by_name}`, req.body.status, 'booking', req.params.id, oldBooking, updated);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});
function calculateEndTime(startTime, durationMinutes) {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}
exports.default = router;
//# sourceMappingURL=bookingRoutes.js.map