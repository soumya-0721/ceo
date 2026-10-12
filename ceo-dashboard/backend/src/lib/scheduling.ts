/**
 * Pure scheduling helpers with no database or framework dependencies.
 * Kept side-effect free so they can be unit tested without a live database.
 */

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** Human labels used by the UI: Low / Normal / High / Critical map onto the DB enum. */
const PRIORITY_LABELS: Record<Priority, string> = {
    low: 'Low',
    medium: 'Normal',
    high: 'High',
    urgent: 'Critical'
};

/** Accepts UI aliases (Critical/Normal) as well as the canonical DB values. */
export function normalizePriority(value: any, fallback: Priority = 'medium'): Priority {
    if (value === null || value === undefined || value === '') return fallback;
    const v = String(value).trim().toLowerCase();
    const aliases: Record<string, Priority> = {
        critical: 'urgent',
        urgent: 'urgent',
        high: 'high',
        normal: 'medium',
        medium: 'medium',
        low: 'low'
    };
    return aliases[v] || fallback;
}

export function priorityLabel(value: any): string {
    return PRIORITY_LABELS[normalizePriority(value)] || 'Normal';
}

/** Numeric rank so higher-priority meetings can be surfaced first. */
export function priorityRank(value: any): number {
    return { low: 1, medium: 2, high: 3, urgent: 4 }[normalizePriority(value)] || 2;
}

export interface TimeRange {
    start: string; // HH:MM
    end: string;   // HH:MM
}

export function toMinutes(time: string): number {
    const [h, m] = (time || '').split(':').map(Number);
    if (isNaN(h)) return 0;
    return h * 60 + (m || 0);
}

export function toTime(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function normalizeTime(time: string): string {
    return toTime(toMinutes((time || '').substring(0, 5)));
}

/** True when two half-open [start, end) ranges overlap. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export interface ConflictCandidate extends TimeRange {
    id?: string;
    title?: string;
    ownerName?: string;
    priority?: string;
}

/** Returns the subset of `existing` that overlaps `target` (excludes `target.id`). */
export function findConflicts(target: ConflictCandidate, existing: ConflictCandidate[]): ConflictCandidate[] {
    return existing.filter(item => {
        if (target.id && item.id && item.id === target.id) return false;
        return rangesOverlap(target, item);
    });
}

export interface LayoutEvent extends TimeRange {
    id: string;
}

export interface LayoutResult {
    id: string;
    column: number;
    columns: number;
}

/**
 * Interval-graph column assignment so overlapping events can be drawn side by side
 * instead of on top of each other. Events in the same overlap cluster share `columns`.
 */
export function assignColumns(events: LayoutEvent[]): LayoutResult[] {
    const sorted = [...events].sort((a, b) => {
        const s = toMinutes(a.start) - toMinutes(b.start);
        return s !== 0 ? s : toMinutes(a.end) - toMinutes(b.end);
    });

    const results: LayoutResult[] = [];
    let cluster: LayoutEvent[] = [];
    let clusterEnd = -1;

    const flush = () => {
        if (cluster.length === 0) return;
        const columnEnds: number[] = [];
        const placed: { id: string; column: number }[] = [];
        for (const ev of cluster) {
            const start = toMinutes(ev.start);
            let column = columnEnds.findIndex(end => end <= start);
            if (column === -1) {
                column = columnEnds.length;
                columnEnds.push(toMinutes(ev.end));
            } else {
                columnEnds[column] = toMinutes(ev.end);
            }
            placed.push({ id: ev.id, column });
        }
        const total = Math.max(1, columnEnds.length);
        for (const p of placed) results.push({ id: p.id, column: p.column, columns: total });
        cluster = [];
        clusterEnd = -1;
    };

    for (const ev of sorted) {
        const start = toMinutes(ev.start);
        if (cluster.length > 0 && start >= clusterEnd) flush();
        cluster.push(ev);
        clusterEnd = Math.max(clusterEnd, toMinutes(ev.end));
    }
    flush();

    return results;
}

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'rescheduled' | 'cancelled';

export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'accepted', 'rejected', 'rescheduled', 'cancelled'];

/** Statuses that represent a confirmed CEO meeting (may appear on the calendar). */
export function isConfirmedBookingStatus(status: string): boolean {
    return status === 'accepted' || status === 'rescheduled';
}

/** Booking statuses that represent pending approval. */
export function isPendingBookingStatus(status: string): boolean {
    return status === 'pending';
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Approved',
    rejected: 'Rejected',
    rescheduled: 'Rescheduled',
    cancelled: 'Cancelled'
};

export function bookingStatusLabel(status: string): string {
    return BOOKING_STATUS_LABELS[status] || status;
}

/**
 * Approval authority: only the coordinator (Soumya) may approve/reject/reschedule
 * external CEO booking requests. Enforced on the server, not just in the UI.
 */
export function canApproveBooking(role: string | undefined): boolean {
    return role === 'coordinator';
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export function isValidDate(date: string): boolean {
    if (!DATE_RE.test(date || '')) return false;
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

export function addMinutes(time: string, minutes: number): string {
    return toTime(toMinutes(time) + minutes);
}

/** Validate a requested meeting window. Returns an error string or null. */
export function validateMeetingWindow(date: string, startTime: string, endTime: string): string | null {
    if (!isValidDate(date)) return 'A valid date is required';
    if (!TIME_RE.test(startTime || '')) return 'A valid start time is required';
    if (!TIME_RE.test(endTime || '')) return 'A valid end time is required';
    if (toMinutes(endTime) <= toMinutes(startTime)) return 'End time must be after start time';
    if (toMinutes(endTime) - toMinutes(startTime) > 480) return 'A meeting cannot be longer than 8 hours';
    return null;
}

/**
 * Advisory-lock key for schedule mutations. Same owner + same date serialize on
 * the same key, so two concurrent edits cannot both pass a conflict check and
 * save overlapping records for one person.
 */
export function scheduleAdvisoryKey(ownerId: string, date: string): string {
    return `schedule:${ownerId}:${date}`;
}

/**
 * Who may edit or override a schedule:
 * - the owner of the schedule, or
 * - the coordinator acting on a CEO appointment (she runs the CEO calendar).
 * A CEO cannot reach into the coordinator's private entries, and unknown roles
 * manage nothing.
 */
export function canManageSchedule(userId: string, role: string | undefined, schedule: { user_id?: string; is_ceo_appointment?: boolean }): boolean {
    if (!schedule || !userId) return false;
    if (schedule.user_id && schedule.user_id === userId) return true;
    return role === 'coordinator' && schedule.is_ceo_appointment === true;
}

/**
 * Read access follows the same ownership policy as writes: the owner, or the
 * coordinator acting on a CEO appointment. A CEO cannot read the coordinator's
 * private entries by guessing an id, and unrelated roles read nothing.
 */
export function canReadSchedule(userId: string, role: string | undefined, schedule: { user_id?: string; is_ceo_appointment?: boolean }): boolean {
    return canManageSchedule(userId, role, schedule);
}

/**
 * Booking requests live on the CEO calendar. Both the CEO and the coordinator
 * (the approver) may read them; any other role may not.
 */
export function canReadBooking(role: string | undefined): boolean {
    return role === 'ceo' || role === 'coordinator';
}

export type ScheduleScope = 'mine' | 'all';

/**
 * Derive the permitted schedule scope from the authenticated role. The client
 * may *request* a scope, but only the coordinator is authorized for the shared
 * `all` view; every other role is confined to its own calendar regardless of
 * what it sends. A request that cannot be honored is reported as
 * `allowed: false` so the route can reply 403 instead of silently widening
 * access. Ownership is applied downstream by `user_id` (the appointment owner),
 * never by the record creator.
 */
export function resolveScheduleScope(role: string | undefined, requested?: unknown): { allowed: boolean; scope: ScheduleScope } {
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
export function overrideDecision(
    conflictCount: number,
    overrideRequested: boolean,
    authorized: boolean
): { ok: true } | { ok: false; reason: 'conflict' | 'unauthorized' } {
    if (conflictCount > 0 && !overrideRequested) return { ok: false, reason: 'conflict' };
    if (conflictCount > 0 && overrideRequested && !authorized) return { ok: false, reason: 'unauthorized' };
    return { ok: true };
}

/**
 * Audit fields stamped when a conflict override is confirmed: who overrode,
 * when, and a reason (defaults to a verifiable actor string).
 */
export function buildOverrideFields(actorId: string, actorName: string, reason?: string) {
    return {
        conflictOverride: true,
        overrideBy: actorId,
        overrideAt: new Date().toISOString(),
        overrideReason: (reason && String(reason).trim()) || `Override confirmed by ${actorName}`
    };
}
