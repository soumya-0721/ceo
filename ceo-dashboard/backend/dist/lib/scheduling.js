"use strict";
/**
 * Pure scheduling helpers with no database or framework dependencies.
 * Kept side-effect free so they can be unit tested without a live database.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIME_RE = exports.DATE_RE = exports.BOOKING_STATUSES = exports.PRIORITIES = void 0;
exports.normalizePriority = normalizePriority;
exports.priorityLabel = priorityLabel;
exports.priorityRank = priorityRank;
exports.toMinutes = toMinutes;
exports.toTime = toTime;
exports.normalizeTime = normalizeTime;
exports.rangesOverlap = rangesOverlap;
exports.findConflicts = findConflicts;
exports.assignColumns = assignColumns;
exports.isConfirmedBookingStatus = isConfirmedBookingStatus;
exports.isPendingBookingStatus = isPendingBookingStatus;
exports.bookingStatusLabel = bookingStatusLabel;
exports.canApproveBooking = canApproveBooking;
exports.isValidDate = isValidDate;
exports.addMinutes = addMinutes;
exports.validateMeetingWindow = validateMeetingWindow;
exports.scheduleAdvisoryKey = scheduleAdvisoryKey;
exports.canManageSchedule = canManageSchedule;
exports.canReadSchedule = canReadSchedule;
exports.canReadBooking = canReadBooking;
exports.resolveScheduleScope = resolveScheduleScope;
exports.overrideDecision = overrideDecision;
exports.buildOverrideFields = buildOverrideFields;
exports.PRIORITIES = ['low', 'medium', 'high', 'urgent'];
/** Human labels used by the UI: Low / Normal / High / Critical map onto the DB enum. */
const PRIORITY_LABELS = {
    low: 'Low',
    medium: 'Normal',
    high: 'High',
    urgent: 'Critical'
};
/** Accepts UI aliases (Critical/Normal) as well as the canonical DB values. */
function normalizePriority(value, fallback = 'medium') {
    if (value === null || value === undefined || value === '')
        return fallback;
    const v = String(value).trim().toLowerCase();
    const aliases = {
        critical: 'urgent',
        urgent: 'urgent',
        high: 'high',
        normal: 'medium',
        medium: 'medium',
        low: 'low'
    };
    return aliases[v] || fallback;
}
function priorityLabel(value) {
    return PRIORITY_LABELS[normalizePriority(value)] || 'Normal';
}
/** Numeric rank so higher-priority meetings can be surfaced first. */
function priorityRank(value) {
    return { low: 1, medium: 2, high: 3, urgent: 4 }[normalizePriority(value)] || 2;
}
function toMinutes(time) {
    const [h, m] = (time || '').split(':').map(Number);
    if (isNaN(h))
        return 0;
    return h * 60 + (m || 0);
}
function toTime(totalMinutes) {
    const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
function normalizeTime(time) {
    return toTime(toMinutes((time || '').substring(0, 5)));
}
/** True when two half-open [start, end) ranges overlap. */
function rangesOverlap(a, b) {
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}
/** Returns the subset of `existing` that overlaps `target` (excludes `target.id`). */
function findConflicts(target, existing) {
    return existing.filter(item => {
        if (target.id && item.id && item.id === target.id)
            return false;
        return rangesOverlap(target, item);
    });
}
/**
 * Interval-graph column assignment so overlapping events can be drawn side by side
 * instead of on top of each other. Events in the same overlap cluster share `columns`.
 */
function assignColumns(events) {
    const sorted = [...events].sort((a, b) => {
        const s = toMinutes(a.start) - toMinutes(b.start);
        return s !== 0 ? s : toMinutes(a.end) - toMinutes(b.end);
    });
    const results = [];
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
        if (cluster.length === 0)
            return;
        const columnEnds = [];
        const placed = [];
        for (const ev of cluster) {
            const start = toMinutes(ev.start);
            let column = columnEnds.findIndex(end => end <= start);
            if (column === -1) {
                column = columnEnds.length;
                columnEnds.push(toMinutes(ev.end));
            }
            else {
                columnEnds[column] = toMinutes(ev.end);
            }
            placed.push({ id: ev.id, column });
        }
        const total = Math.max(1, columnEnds.length);
        for (const p of placed)
            results.push({ id: p.id, column: p.column, columns: total });
        cluster = [];
        clusterEnd = -1;
    };
    for (const ev of sorted) {
        const start = toMinutes(ev.start);
        if (cluster.length > 0 && start >= clusterEnd)
            flush();
        cluster.push(ev);
        clusterEnd = Math.max(clusterEnd, toMinutes(ev.end));
    }
    flush();
    return results;
}
exports.BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'rescheduled', 'cancelled'];
/** Statuses that represent a confirmed CEO meeting (may appear on the calendar). */
function isConfirmedBookingStatus(status) {
    return status === 'accepted' || status === 'rescheduled';
}
/** Booking statuses that represent pending approval. */
function isPendingBookingStatus(status) {
    return status === 'pending';
}
const BOOKING_STATUS_LABELS = {
    pending: 'Pending',
    accepted: 'Approved',
    rejected: 'Rejected',
    rescheduled: 'Rescheduled',
    cancelled: 'Cancelled'
};
function bookingStatusLabel(status) {
    return BOOKING_STATUS_LABELS[status] || status;
}
/**
 * Approval authority: only the coordinator (Soumya) may approve/reject/reschedule
 * external CEO booking requests. Enforced on the server, not just in the UI.
 */
function canApproveBooking(role) {
    return role === 'coordinator';
}
exports.DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
exports.TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
function isValidDate(date) {
    if (!exports.DATE_RE.test(date || ''))
        return false;
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}
function addMinutes(time, minutes) {
    return toTime(toMinutes(time) + minutes);
}
/** Validate a requested meeting window. Returns an error string or null. */
function validateMeetingWindow(date, startTime, endTime) {
    if (!isValidDate(date))
        return 'A valid date is required';
    if (!exports.TIME_RE.test(startTime || ''))
        return 'A valid start time is required';
    if (!exports.TIME_RE.test(endTime || ''))
        return 'A valid end time is required';
    if (toMinutes(endTime) <= toMinutes(startTime))
        return 'End time must be after start time';
    if (toMinutes(endTime) - toMinutes(startTime) > 480)
        return 'A meeting cannot be longer than 8 hours';
    return null;
}
/**
 * Advisory-lock key for schedule mutations. Same owner + same date serialize on
 * the same key, so two concurrent edits cannot both pass a conflict check and
 * save overlapping records for one person.
 */
function scheduleAdvisoryKey(ownerId, date) {
    return `schedule:${ownerId}:${date}`;
}
/**
 * Who may edit or override a schedule:
 * - the owner of the schedule, or
 * - the coordinator acting on a CEO appointment (she runs the CEO calendar).
 * A CEO cannot reach into the coordinator's private entries, and unknown roles
 * manage nothing.
 */
function canManageSchedule(userId, role, schedule) {
    if (!schedule || !userId)
        return false;
    if (schedule.user_id && schedule.user_id === userId)
        return true;
    return role === 'coordinator' && schedule.is_ceo_appointment === true;
}
/**
 * Read access follows the same ownership policy as writes: the owner, or the
 * coordinator acting on a CEO appointment. A CEO cannot read the coordinator's
 * private entries by guessing an id, and unrelated roles read nothing.
 */
function canReadSchedule(userId, role, schedule) {
    return canManageSchedule(userId, role, schedule);
}
/**
 * Booking requests live on the CEO calendar. Both the CEO and the coordinator
 * (the approver) may read them; any other role may not.
 */
function canReadBooking(role) {
    return role === 'ceo' || role === 'coordinator';
}
/**
 * Derive the permitted schedule scope from the authenticated role. The client
 * may *request* a scope, but only the coordinator is authorized for the shared
 * `all` view; every other role is confined to its own calendar regardless of
 * what it sends. A request that cannot be honored is reported as
 * `allowed: false` so the route can reply 403 instead of silently widening
 * access. Ownership is applied downstream by `user_id` (the appointment owner),
 * never by the record creator.
 */
function resolveScheduleScope(role, requested) {
    const wantsAll = requested === 'all';
    if (wantsAll) {
        return role === 'coordinator' ? { allowed: true, scope: 'all' } : { allowed: false, scope: 'mine' };
    }
    return { allowed: true, scope: 'mine' };
}
/**
 * Override gate used by mutation routes. A conflict requires the explicit
 * `overrideConflict` flag; overriding also requires authority over the schedule.
 */
function overrideDecision(conflictCount, overrideRequested, authorized) {
    if (conflictCount > 0 && !overrideRequested)
        return { ok: false, reason: 'conflict' };
    if (conflictCount > 0 && overrideRequested && !authorized)
        return { ok: false, reason: 'unauthorized' };
    return { ok: true };
}
/**
 * Audit fields stamped when a conflict override is confirmed: who overrode,
 * when, and a reason (defaults to a verifiable actor string).
 */
function buildOverrideFields(actorId, actorName, reason) {
    return {
        conflictOverride: true,
        overrideBy: actorId,
        overrideAt: new Date().toISOString(),
        overrideReason: (reason && String(reason).trim()) || `Override confirmed by ${actorName}`
    };
}
//# sourceMappingURL=scheduling.js.map