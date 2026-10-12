/**
 * Pure scheduling helpers with no database or framework dependencies.
 * Kept side-effect free so they can be unit tested without a live database.
 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export declare const PRIORITIES: Priority[];
/** Accepts UI aliases (Critical/Normal) as well as the canonical DB values. */
export declare function normalizePriority(value: any, fallback?: Priority): Priority;
export declare function priorityLabel(value: any): string;
/** Numeric rank so higher-priority meetings can be surfaced first. */
export declare function priorityRank(value: any): number;
export interface TimeRange {
    start: string;
    end: string;
}
export declare function toMinutes(time: string): number;
export declare function toTime(totalMinutes: number): string;
export declare function normalizeTime(time: string): string;
/** True when two half-open [start, end) ranges overlap. */
export declare function rangesOverlap(a: TimeRange, b: TimeRange): boolean;
export interface ConflictCandidate extends TimeRange {
    id?: string;
    title?: string;
    ownerName?: string;
    priority?: string;
}
/** Returns the subset of `existing` that overlaps `target` (excludes `target.id`). */
export declare function findConflicts(target: ConflictCandidate, existing: ConflictCandidate[]): ConflictCandidate[];
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
export declare function assignColumns(events: LayoutEvent[]): LayoutResult[];
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'rescheduled' | 'cancelled';
export declare const BOOKING_STATUSES: BookingStatus[];
/** Statuses that represent a confirmed CEO meeting (may appear on the calendar). */
export declare function isConfirmedBookingStatus(status: string): boolean;
/** Booking statuses that represent pending approval. */
export declare function isPendingBookingStatus(status: string): boolean;
export declare function bookingStatusLabel(status: string): string;
/**
 * Approval authority: only the coordinator (Soumya) may approve/reject/reschedule
 * external CEO booking requests. Enforced on the server, not just in the UI.
 */
export declare function canApproveBooking(role: string | undefined): boolean;
export declare const DATE_RE: RegExp;
export declare const TIME_RE: RegExp;
export declare function isValidDate(date: string): boolean;
export declare function addMinutes(time: string, minutes: number): string;
/** Validate a requested meeting window. Returns an error string or null. */
export declare function validateMeetingWindow(date: string, startTime: string, endTime: string): string | null;
/**
 * Advisory-lock key for schedule mutations. Same owner + same date serialize on
 * the same key, so two concurrent edits cannot both pass a conflict check and
 * save overlapping records for one person.
 */
export declare function scheduleAdvisoryKey(ownerId: string, date: string): string;
/**
 * Who may edit or override a schedule:
 * - the owner of the schedule, or
 * - the coordinator acting on a CEO appointment (she runs the CEO calendar).
 * A CEO cannot reach into the coordinator's private entries, and unknown roles
 * manage nothing.
 */
export declare function canManageSchedule(userId: string, role: string | undefined, schedule: {
    user_id?: string;
    is_ceo_appointment?: boolean;
}): boolean;
/**
 * Read access follows the same ownership policy as writes: the owner, or the
 * coordinator acting on a CEO appointment. A CEO cannot read the coordinator's
 * private entries by guessing an id, and unrelated roles read nothing.
 */
export declare function canReadSchedule(userId: string, role: string | undefined, schedule: {
    user_id?: string;
    is_ceo_appointment?: boolean;
}): boolean;
/**
 * Booking requests live on the CEO calendar. Both the CEO and the coordinator
 * (the approver) may read them; any other role may not.
 */
export declare function canReadBooking(role: string | undefined): boolean;
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
export declare function resolveScheduleScope(role: string | undefined, requested?: unknown): {
    allowed: boolean;
    scope: ScheduleScope;
};
/**
 * Override gate used by mutation routes. A conflict requires the explicit
 * `overrideConflict` flag; overriding also requires authority over the schedule.
 */
export declare function overrideDecision(conflictCount: number, overrideRequested: boolean, authorized: boolean): {
    ok: true;
} | {
    ok: false;
    reason: 'conflict' | 'unauthorized';
};
/**
 * Audit fields stamped when a conflict override is confirmed: who overrode,
 * when, and a reason (defaults to a verifiable actor string).
 */
export declare function buildOverrideFields(actorId: string, actorName: string, reason?: string): {
    conflictOverride: boolean;
    overrideBy: string;
    overrideAt: string;
    overrideReason: string;
};
