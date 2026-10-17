"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduleService_1 = require("../services/scheduleService");
const authService_1 = require("../services/authService");
const slotService_1 = require("../services/slotService");
const notificationService_1 = require("../services/notificationService");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const scheduling_1 = require("../lib/scheduling");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeTime(time) {
    return (time || '').substring(0, 5);
}
function validateScheduleInput(body) {
    if (!body.title || !String(body.title).trim())
        return 'Title is required';
    if (!body.date || !DATE_RE.test(body.date))
        return 'A valid date is required';
    if (!body.startTime || !body.endTime)
        return 'Start time and end time are required';
    return (0, scheduling_1.validateMeetingWindow)(body.date, normalizeTime(body.startTime), normalizeTime(body.endTime));
}
function wantsCeoAppointment(body) {
    return body?.isCeoAppointment === true || body?.appointmentFor === 'ceo' || body?.targetRole === 'ceo';
}
/** The CEO owns CEO appointments; everyone owns their own coordinator entries. */
async function resolveOwner(req, body) {
    if (wantsCeoAppointment(body)) {
        const ceo = await authService_1.authService.getCeo();
        if (!ceo)
            throw { httpStatus: 400, body: { error: 'CEO account not found' } };
        return { ownerId: ceo.id, isCeoAppointment: true, ceoId: ceo.id };
    }
    return { ownerId: req.user.id, isCeoAppointment: false };
}
function conflictPayload(conflicts) {
    return {
        error: `This time overlaps with ${conflicts.map((c) => `"${c.title}" (${(0, scheduling_1.priorityLabel)(c.priority)})${c.owner_name ? ` — ${c.owner_name}` : ''}`).join(', ')}`,
        hasConflict: true,
        conflicts: conflicts.map((c) => ({
            id: c.id,
            title: c.title,
            startTime: normalizeTime(c.start_time),
            endTime: normalizeTime(c.end_time),
            ownerName: c.owner_name,
            priority: c.priority,
            priorityLabel: (0, scheduling_1.priorityLabel)(c.priority)
        })),
        message: 'Confirm to override the conflict, or choose another time.'
    };
}
router.get('/', async (req, res) => {
    try {
        const { date, startDate, endDate, scope } = req.query;
        // Scope is granted by role, never by the client. Only the coordinator
        // may see the shared `all` view; everyone else is confined to their own.
        const { allowed, scope: scopeValue } = (0, scheduling_1.resolveScheduleScope)(req.user.role, scope);
        if (!allowed) {
            res.status(403).json({ error: 'You are not authorized to view all schedules' });
            return;
        }
        const targetUserId = req.user.id;
        if (date) {
            const schedules = await scheduleService_1.scheduleService.getByDate(date, targetUserId, scopeValue);
            res.json(schedules);
        }
        else if (startDate && endDate) {
            const schedules = await scheduleService_1.scheduleService.getByDateRange(startDate, endDate, targetUserId, scopeValue);
            res.json(schedules);
        }
        else {
            const schedules = await scheduleService_1.scheduleService.getByDate((0, slotService_1.todayStr)(), targetUserId, scopeValue);
            res.json(schedules);
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get schedules' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const stats = await scheduleService_1.scheduleService.getStats(req.user.id);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
/** Week data for the schedule dashboards: free/busy windows + totals per day. */
router.get('/week', async (req, res) => {
    try {
        const startDate = String(req.query.startDate || '');
        const endDate = String(req.query.endDate || '');
        if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
            res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
            return;
        }
        const overview = await slotService_1.slotService.getWeekOverview(startDate, endDate, req.user.id);
        res.json(overview);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to get week overview' });
    }
});
/** CSV export of a week (or any date range). */
router.get('/export', async (req, res) => {
    try {
        const startDate = String(req.query.startDate || '');
        const endDate = String(req.query.endDate || '');
        if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
            res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
            return;
        }
        // The coordinator exports the shared view by default; everyone else is
        // confined to their own calendar, and an explicit `scope=all` they are
        // not entitled to is rejected rather than honored.
        const requestedScope = req.query.scope ?? (req.user.role === 'coordinator' ? 'all' : 'mine');
        const { allowed, scope } = (0, scheduling_1.resolveScheduleScope)(req.user.role, requestedScope);
        if (!allowed) {
            res.status(403).json({ error: 'You are not authorized to export all schedules' });
            return;
        }
        const schedules = await scheduleService_1.scheduleService.getByDateRange(startDate, endDate, req.user.id, scope);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const escape = (value) => {
            const text = value === null || value === undefined ? '' : String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const header = ['Date', 'Day', 'Start Time', 'End Time', 'Title', 'Type', 'Notes', 'Priority', 'Status', 'Owner'];
        const rows = schedules.map((s) => {
            const [y, m, d] = String(s.schedule_date).split('-').map(Number);
            const day = dayNames[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
            return [
                s.schedule_date,
                day,
                normalizeTime(s.start_time),
                normalizeTime(s.end_time),
                s.title,
                s.is_ceo_appointment ? 'CEO Appointment' : s.schedule_type,
                s.description || '',
                (0, scheduling_1.priorityLabel)(s.priority),
                s.status,
                s.creator_name || ''
            ].map(escape).join(',');
        });
        const csv = [header.join(','), ...rows].join('\r\n');
        const filename = `schedule_${startDate}_${endDate}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to export schedule' });
    }
});
router.get('/available-slots', async (req, res) => {
    try {
        const { date, duration } = req.query;
        if (!date || !duration) {
            res.status(400).json({ error: 'Date and duration required' });
            return;
        }
        const slots = await scheduleService_1.scheduleService.getAvailableSlots(date, parseInt(duration));
        res.json(slots.map((s) => ({
            ...s,
            start: s.start,
            end: s.end,
            start_time: s.start,
            end_time: s.end
        })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get available slots' });
    }
});
router.get('/conflict-check', async (req, res) => {
    try {
        const { date, startTime, endTime, excludeId } = req.query;
        const conflicts = await scheduleService_1.scheduleService.checkConflict(date, startTime, endTime, excludeId);
        res.json({ hasConflict: conflicts.length > 0, conflicts: conflicts.map((c) => ({
                id: c.id, title: c.title,
                startTime: normalizeTime(c.start_time), endTime: normalizeTime(c.end_time),
                ownerName: c.owner_name, priority: c.priority, priorityLabel: (0, scheduling_1.priorityLabel)(c.priority)
            })) });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check conflicts' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const schedule = await scheduleService_1.scheduleService.getById(req.params.id);
        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        if (!(0, scheduling_1.canReadSchedule)(req.user.id, req.user.role, schedule)) {
            res.status(403).json({ error: 'You are not authorized to view this schedule' });
            return;
        }
        res.json(schedule);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { title, description, date, startTime, endTime, scheduleType, location, participants, priority, reminderMinutes } = req.body;
        const validationError = validateScheduleInput(req.body);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }
        const start = normalizeTime(startTime);
        const end = normalizeTime(endTime);
        const { ownerId, isCeoAppointment } = await resolveOwner(req, req.body);
        const override = req.body.overrideConflict === true;
        const schedule = await (0, database_1.withTransaction)(async (client) => {
            const conflicts = await scheduleService_1.scheduleService.checkConflict(date, start, end, undefined, ownerId, client);
            if (conflicts.length > 0 && !override) {
                throw { httpStatus: 409, body: conflictPayload(conflicts) };
            }
            return scheduleService_1.scheduleService.create({
                title, description, date, startTime: start, endTime: end,
                scheduleType: scheduleType || 'other', location,
                participants: participants || [], priority: priority || 'medium',
                reminderMinutes: reminderMinutes || 15, userId: ownerId,
                isCeoAppointment,
                conflictOverride: override,
                overrideBy: override ? req.user.id : null,
                overrideAt: override ? new Date().toISOString() : null,
                overrideReason: override ? (req.body.overrideReason || null) : null
            }, client);
        }, (0, scheduling_1.scheduleAdvisoryKey)(ownerId, date));
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'created', recordType: 'schedule',
            recordId: schedule.id, newData: schedule
        });
        if (schedule.conflict_override) {
            await auditService_1.auditService.log({
                userId: req.user.id, action: 'conflict_override', recordType: 'schedule',
                recordId: schedule.id, newData: schedule
            });
        }
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'New Schedule Created', `${req.user.fullName} created "${title}" on ${date} at ${start}`, 'created', 'schedule', schedule.id, null, schedule);
        res.status(201).json(schedule);
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const oldSchedule = await scheduleService_1.scheduleService.getById(req.params.id);
        if (!oldSchedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        const authorized = (0, scheduling_1.canManageSchedule)(req.user.id, req.user.role, oldSchedule);
        if (!authorized) {
            res.status(403).json({ error: 'You are not authorized to edit this schedule' });
            return;
        }
        const merged = {
            title: req.body.title ?? oldSchedule.title,
            date: req.body.date ?? oldSchedule.schedule_date,
            startTime: req.body.startTime ?? oldSchedule.start_time,
            endTime: req.body.endTime ?? oldSchedule.end_time
        };
        const validationError = validateScheduleInput(merged);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }
        const start = normalizeTime(merged.startTime);
        const end = normalizeTime(merged.endTime);
        const override = req.body.overrideConflict === true;
        const priorityChanging = req.body.priority !== undefined
            && (0, scheduling_1.normalizePriority)(req.body.priority) !== (0, scheduling_1.normalizePriority)(oldSchedule.priority);
        const updated = await (0, database_1.withTransaction)(async (client) => {
            const conflicts = await scheduleService_1.scheduleService.checkConflict(merged.date, start, end, req.params.id, oldSchedule.user_id, client);
            if (conflicts.length > 0) {
                const decision = (0, scheduling_1.overrideDecision)(conflicts.length, override, authorized);
                if (!decision.ok) {
                    if (decision.reason === 'unauthorized') {
                        throw { httpStatus: 403, body: { error: 'You are not authorized to override this conflict.' } };
                    }
                    throw { httpStatus: 409, body: conflictPayload(conflicts) };
                }
            }
            const payload = { ...req.body };
            if (override) {
                Object.assign(payload, (0, scheduling_1.buildOverrideFields)(req.user.id, req.user.fullName, req.body.overrideReason));
            }
            return scheduleService_1.scheduleService.update(req.params.id, payload, req.user.id, client);
        }, (0, scheduling_1.scheduleAdvisoryKey)(oldSchedule.user_id, merged.date));
        await auditService_1.auditService.log({
            userId: req.user.id, action: 'updated', recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });
        if (override) {
            await auditService_1.auditService.log({
                userId: req.user.id, action: 'conflict_override', recordType: 'schedule',
                recordId: req.params.id, oldData: oldSchedule, newData: updated
            });
        }
        if (priorityChanging) {
            await auditService_1.auditService.log({
                userId: req.user.id, action: 'priority_changed', recordType: 'schedule',
                recordId: req.params.id,
                oldData: { priority: oldSchedule.priority },
                newData: { priority: updated.priority }
            });
        }
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Schedule Updated', `${req.user.fullName} updated "${updated.title}"`, 'updated', 'schedule', req.params.id, oldSchedule, updated);
        res.json(updated);
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const oldSchedule = await scheduleService_1.scheduleService.getById(req.params.id);
        if (!oldSchedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        if (!(0, scheduling_1.canManageSchedule)(req.user.id, req.user.role, oldSchedule)) {
            res.status(403).json({ error: 'You are not authorized to change this schedule' });
            return;
        }
        const newStatus = req.body.status;
        const reactivating = newStatus === 'active' && oldSchedule.status !== 'active';
        const updated = await (0, database_1.withTransaction)(async (client) => {
            if (reactivating) {
                const conflicts = await scheduleService_1.scheduleService.checkConflict(oldSchedule.schedule_date, normalizeTime(oldSchedule.start_time), normalizeTime(oldSchedule.end_time), req.params.id, oldSchedule.user_id, client);
                if (conflicts.length > 0 && req.body.overrideConflict !== true) {
                    throw { httpStatus: 409, body: conflictPayload(conflicts) };
                }
            }
            return scheduleService_1.scheduleService.update(req.params.id, { status: newStatus }, req.user.id, client);
        }, (0, scheduling_1.scheduleAdvisoryKey)(oldSchedule.user_id, oldSchedule.schedule_date));
        await auditService_1.auditService.log({
            userId: req.user.id, action: newStatus, recordType: 'schedule',
            recordId: req.params.id, oldData: oldSchedule, newData: updated
        });
        await notificationService_1.notificationService.notifyOtherUser(req.user.id, 'Schedule Status Changed', `${req.user.fullName} changed "${updated.title}" to ${newStatus}`, newStatus, 'schedule', req.params.id, oldSchedule, updated);
        res.json(updated);
    }
    catch (error) {
        if (error && error.httpStatus) {
            res.status(error.httpStatus).json(error.body);
            return;
        }
        res.status(500).json({ error: 'Failed to update schedule status' });
    }
});
exports.default = router;
//# sourceMappingURL=scheduleRoutes.js.map