"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const scheduling_1 = require("./scheduling");
(0, node_test_1.default)('normalizePriority maps UI labels onto the DB enum', () => {
    strict_1.default.equal((0, scheduling_1.normalizePriority)('critical'), 'urgent');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('Critical'), 'urgent');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('normal'), 'medium');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('high'), 'high');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('low'), 'low');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('urgent'), 'urgent');
    strict_1.default.equal((0, scheduling_1.normalizePriority)(undefined), 'medium');
    strict_1.default.equal((0, scheduling_1.normalizePriority)('nonsense'), 'medium');
});
(0, node_test_1.default)('priorityLabel renders Low/Normal/High/Critical', () => {
    strict_1.default.equal((0, scheduling_1.priorityLabel)('low'), 'Low');
    strict_1.default.equal((0, scheduling_1.priorityLabel)('medium'), 'Normal');
    strict_1.default.equal((0, scheduling_1.priorityLabel)('high'), 'High');
    strict_1.default.equal((0, scheduling_1.priorityLabel)('urgent'), 'Critical');
});
(0, node_test_1.default)('priorityRank orders low < normal < high < critical', () => {
    strict_1.default.ok((0, scheduling_1.priorityRank)('low') < (0, scheduling_1.priorityRank)('medium'));
    strict_1.default.ok((0, scheduling_1.priorityRank)('medium') < (0, scheduling_1.priorityRank)('high'));
    strict_1.default.ok((0, scheduling_1.priorityRank)('high') < (0, scheduling_1.priorityRank)('urgent'));
});
(0, node_test_1.default)('rangesOverlap uses minute comparison, not string ordering', () => {
    strict_1.default.equal((0, scheduling_1.rangesOverlap)({ start: '13:00', end: '14:00' }, { start: '13:30', end: '14:30' }), true);
    strict_1.default.equal((0, scheduling_1.rangesOverlap)({ start: '13:00', end: '14:00' }, { start: '14:00', end: '15:00' }), false);
    strict_1.default.equal((0, scheduling_1.rangesOverlap)({ start: '09:00', end: '10:00' }, { start: '09:30', end: '09:45' }), true);
});
(0, node_test_1.default)('findConflicts detects overlaps but excludes the record being edited', () => {
    const existing = [
        { id: 'a', start: '13:00', end: '14:00', title: 'Board meeting' },
        { id: 'b', start: '16:00', end: '17:00', title: 'Call' }
    ];
    const conflicts = (0, scheduling_1.findConflicts)({ id: 'new', start: '13:30', end: '14:30' }, existing);
    strict_1.default.equal(conflicts.length, 1);
    strict_1.default.equal(conflicts[0].id, 'a');
    // editing an appointment must not conflict with itself
    const selfEdit = (0, scheduling_1.findConflicts)({ id: 'a', start: '13:00', end: '14:00' }, existing);
    strict_1.default.equal(selfEdit.length, 0);
});
(0, node_test_1.default)('assignColumns places overlapping events side by side', () => {
    const layout = (0, scheduling_1.assignColumns)([
        { id: 'x', start: '13:00', end: '14:00' },
        { id: 'y', start: '13:00', end: '14:00' },
        { id: 'z', start: '16:00', end: '17:00' }
    ]);
    const x = layout.find(l => l.id === 'x');
    const y = layout.find(l => l.id === 'y');
    const z = layout.find(l => l.id === 'z');
    strict_1.default.equal(x.columns, 2);
    strict_1.default.equal(y.columns, 2);
    strict_1.default.notEqual(x.column, y.column);
    strict_1.default.equal(z.columns, 1);
});
(0, node_test_1.default)('only the coordinator may approve bookings', () => {
    strict_1.default.equal((0, scheduling_1.canApproveBooking)('coordinator'), true);
    strict_1.default.equal((0, scheduling_1.canApproveBooking)('ceo'), false);
    strict_1.default.equal((0, scheduling_1.canApproveBooking)(undefined), false);
});
(0, node_test_1.default)('confirmed vs pending booking statuses', () => {
    strict_1.default.equal((0, scheduling_1.isConfirmedBookingStatus)('accepted'), true);
    strict_1.default.equal((0, scheduling_1.isConfirmedBookingStatus)('rescheduled'), true);
    strict_1.default.equal((0, scheduling_1.isConfirmedBookingStatus)('pending'), false);
    strict_1.default.equal((0, scheduling_1.isConfirmedBookingStatus)('rejected'), false);
    strict_1.default.equal((0, scheduling_1.isPendingBookingStatus)('pending'), true);
    strict_1.default.equal((0, scheduling_1.bookingStatusLabel)('accepted'), 'Approved');
    strict_1.default.equal((0, scheduling_1.bookingStatusLabel)('rescheduled'), 'Rescheduled');
    strict_1.default.equal((0, scheduling_1.bookingStatusLabel)('rejected'), 'Rejected');
});
(0, node_test_1.default)('validateMeetingWindow rejects bad input', () => {
    strict_1.default.equal((0, scheduling_1.validateMeetingWindow)('2026-10-12', '13:00', '14:00'), null);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('not-a-date', '13:00', '14:00') || '', /valid date/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '14:00', '13:00') || '', /after start/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '09:00', '20:00') || '', /8 hours/);
});
(0, node_test_1.default)('time helpers', () => {
    strict_1.default.equal((0, scheduling_1.addMinutes)('13:00', 90), '14:30');
    strict_1.default.equal((0, scheduling_1.normalizeTime)('13:00:00'), '13:00');
});
// ===== Overlap / editing / override scenarios =====
const existing = [
    { id: 'a', start: '09:00', end: '10:00', title: 'Board meeting' },
    { id: 'b', start: '11:00', end: '12:00', title: 'Interview' },
    { id: 'c', start: '14:00', end: '15:00', title: 'Team sync' }
];
(0, node_test_1.default)('1. two meetings with overlapping times both report the conflict', () => {
    // Meeting that starts inside another meeting:
    strict_1.default.equal((0, scheduling_1.rangesOverlap)({ start: '09:30', end: '10:30' }, { start: '09:00', end: '10:00' }), true);
    const conflicts = (0, scheduling_1.findConflicts)({ id: 'x', start: '09:30', end: '10:30', title: 'New' }, [existing[0]]);
    strict_1.default.equal(conflicts.length, 1);
    strict_1.default.equal(conflicts[0].id, 'a');
});
(0, node_test_1.default)('2. one meeting fully contained within another is a conflict', () => {
    for (const contained of [
        { start: '09:00', end: '10:00' },
        { start: '09:15', end: '09:45' },
        { start: '09:00', end: '09:30' },
        { start: '09:30', end: '10:00' }
    ]) {
        strict_1.default.equal((0, scheduling_1.rangesOverlap)(contained, { start: '09:00', end: '10:00' }), true, JSON.stringify(contained));
    }
    const conflicts = (0, scheduling_1.findConflicts)({ id: 'x', start: '09:15', end: '09:45' }, [existing[0]]);
    strict_1.default.equal(conflicts.length, 1);
    strict_1.default.equal(conflicts[0].id, 'a');
});
(0, node_test_1.default)('3. adjacent meetings (one ends exactly when the next starts) do not conflict', () => {
    strict_1.default.equal((0, scheduling_1.rangesOverlap)({ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }), false);
    strict_1.default.equal((0, scheduling_1.findConflicts)({ id: 'x', start: '10:00', end: '11:00' }, [existing[0]]).length, 0);
    strict_1.default.equal((0, scheduling_1.findConflicts)({ id: 'x', start: '08:00', end: '09:00' }, [existing[0]]).length, 0);
});
(0, node_test_1.default)('4. editing a meeting does not conflict with itself', () => {
    const conflicts = (0, scheduling_1.findConflicts)({ id: 'a', start: '09:00', end: '10:00', title: 'Board meeting (unchanged)' }, existing);
    strict_1.default.equal(conflicts.length, 0);
    // Same record moved minutes later still excludes itself:
    const selfMoved = (0, scheduling_1.findConflicts)({ id: 'a', start: '09:45', end: '10:15' }, existing);
    strict_1.default.equal(selfMoved.length, 0);
});
(0, node_test_1.default)('5. editing a meeting into an occupied slot reports that meeting', () => {
    const conflicts = (0, scheduling_1.findConflicts)({ id: 'a', start: '11:15', end: '11:45' }, existing);
    strict_1.default.equal(conflicts.length, 1);
    strict_1.default.equal(conflicts[0].id, 'b');
});
(0, node_test_1.default)('6. saving a conflicting meeting is allowed after an explicit override', () => {
    strict_1.default.deepEqual((0, scheduling_1.overrideDecision)(2, true, true), { ok: true });
    strict_1.default.equal((0, scheduling_1.overrideDecision)(0, false, true).ok, true);
});
(0, node_test_1.default)('7. an override is rejected without the required authorization', () => {
    strict_1.default.deepEqual((0, scheduling_1.overrideDecision)(1, true, false), { ok: false, reason: 'unauthorized' });
    strict_1.default.deepEqual((0, scheduling_1.overrideDecision)(1, false, false), { ok: false, reason: 'conflict' });
    strict_1.default.deepEqual((0, scheduling_1.overrideDecision)(1, false, true), { ok: false, reason: 'conflict' });
});
(0, node_test_1.default)('8. override audit fields preserve who, when, and why', () => {
    const fields = (0, scheduling_1.buildOverrideFields)('user-1', 'Soumya', 'Client insisted');
    strict_1.default.equal(fields.conflictOverride, true);
    strict_1.default.equal(fields.overrideBy, 'user-1');
    strict_1.default.match(fields.overrideAt, /^\d{4}-\d{2}-\d{2}T/);
    strict_1.default.equal(fields.overrideReason, 'Client insisted');
    const defaulted = (0, scheduling_1.buildOverrideFields)('user-2', 'Nikhil');
    strict_1.default.equal(defaulted.overrideReason, 'Override confirmed by Nikhil');
});
(0, node_test_1.default)('9. concurrent edits to the same owner serialize on the same advisory key', () => {
    const key = (0, scheduling_1.scheduleAdvisoryKey)('owner-1', '2026-10-12');
    strict_1.default.equal(key, 'schedule:owner-1:2026-10-12');
    strict_1.default.equal((0, scheduling_1.scheduleAdvisoryKey)('owner-1', '2026-10-12'), key);
    // Different owner or different date -> a different lock, so unrelated edits run in parallel.
    strict_1.default.notEqual((0, scheduling_1.scheduleAdvisoryKey)('owner-2', '2026-10-12'), key);
    strict_1.default.notEqual((0, scheduling_1.scheduleAdvisoryKey)('owner-1', '2026-10-13'), key);
});
(0, node_test_1.default)('10. invalid dates, times and missing fields are rejected', () => {
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-02-30', '09:00', '10:00') || '', /valid date/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('', '09:00', '10:00') || '', /valid date/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '', '10:00') || '', /start time/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '10:00', '') || '', /end time/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', 'bad', '10:00') || '', /start time/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '14:00', '13:00') || '', /after start/);
    strict_1.default.match((0, scheduling_1.validateMeetingWindow)('2026-10-12', '08:00', '17:00') || '', /8 hours/);
    strict_1.default.equal((0, scheduling_1.validateMeetingWindow)('2026-10-12', '10:30', '11:00'), null);
});
(0, node_test_1.default)('12. who may read a schedule (mirrors write ownership, blocks CEO over private entries)', () => {
    const ceoAppt = { user_id: 'ceo', is_ceo_appointment: true };
    const coordinatorPrivate = { user_id: 'coord', is_ceo_appointment: false };
    // Owner reads their own entry.
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('ceo', 'ceo', ceoAppt), true);
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('coord', 'coordinator', coordinatorPrivate), true);
    // Coordinator reads CEO appointments (they run that calendar).
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('coord', 'coordinator', ceoAppt), true);
    // CEO cannot read the coordinator's private entry by guessing an id.
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('ceo', 'ceo', coordinatorPrivate), false);
    // Unrelated roles / missing record / missing user are denied.
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('other', 'ceo', coordinatorPrivate), false);
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('other', 'viewer', ceoAppt), false);
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('', 'ceo', ceoAppt), false);
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('ceo', 'ceo', {}), false);
});
(0, node_test_1.default)('13. who may read a booking (CEO and coordinator only)', () => {
    strict_1.default.equal((0, scheduling_1.canReadBooking)('ceo'), true);
    strict_1.default.equal((0, scheduling_1.canReadBooking)('coordinator'), true);
    strict_1.default.equal((0, scheduling_1.canReadBooking)('viewer'), false);
    strict_1.default.equal((0, scheduling_1.canReadBooking)('employee'), false);
    strict_1.default.equal((0, scheduling_1.canReadBooking)(undefined), false);
});
(0, node_test_1.default)('11. who may manage a schedule (owner / coordinator-on-CEO-calendar)', () => {
    const ceoAppt = { user_id: 'ceo', is_ceo_appointment: true };
    const coordinatorOwn = { user_id: 'coord', is_ceo_appointment: false };
    // Owner may edit their own in every case.
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('ceo', 'ceo', ceoAppt), true);
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('coord', 'coordinator', coordinatorOwn), true);
    // The coordinator runs the CEO calendar.
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('coord', 'coordinator', ceoAppt), true);
    // The CEO may not reach into the coordinator's private entries.
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('ceo', 'ceo', coordinatorOwn), false);
    // Someone unrelated (or an unknown role) manages nothing.
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('stranger', 'user', ceoAppt), false);
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('stranger', 'coordinator', coordinatorOwn), false);
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('', 'coordinator', ceoAppt), false);
});
(0, node_test_1.default)('14. CEO scope requests stay on the CEO calendar', () => {
    // 1. explicit "mine" is allowed and scoped to the CEO's own records.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('ceo', 'mine'), { allowed: true, scope: 'mine' });
    // 2. "all" is denied for the CEO (cannot retrieve other users' schedules).
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('ceo', 'all'), { allowed: false, scope: 'mine' });
    // no scope parameter at all still resolves to the safe own-calendar view.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('ceo', undefined), { allowed: true, scope: 'mine' });
});
(0, node_test_1.default)('15. coordinator scope requests may use the shared coordination view', () => {
    // 3. the coordinator may request the shared view and coordinate CEO appointments.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('coordinator', 'all'), { allowed: true, scope: 'all' });
    // and may still request her own calendar explicitly.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('coordinator', 'mine'), { allowed: true, scope: 'mine' });
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)('coordinator', undefined), { allowed: true, scope: 'mine' });
});
(0, node_test_1.default)('15b. unauthenticated / unknown roles never receive the shared view', () => {
    // Missing role (e.g. middleware let an unverified principal through) must
    // not be treated as the coordinator.
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)(undefined, 'all'), { allowed: false, scope: 'mine' });
    strict_1.default.deepEqual((0, scheduling_1.resolveScheduleScope)(undefined, undefined), { allowed: true, scope: 'mine' });
    for (const role of ['viewer', 'employee', 'admin', 'CEO', 'Coordinator', ' coordinator ']) {
        strict_1.default.equal((0, scheduling_1.resolveScheduleScope)(role, 'all').allowed, false, `${role} must not get "all"`);
        strict_1.default.equal((0, scheduling_1.resolveScheduleScope)(role, 'all').scope, 'mine');
    }
});
(0, node_test_1.default)('15b2. a user cannot bypass restrictions with query-parameter tricks', () => {
    // Only the exact, role-authorized token grants "all": case, whitespace,
    // arrays (repeated params) and unrelated values all fall back to "mine".
    const bypassAttempts = ['ALL', 'All', ' all ', 'all ', ' all', 'true', 'shared', 'everyone', ['all'], ['all', 'all'], '', null, 0, 1, true];
    bypassAttempts.forEach((attempt) => {
        const result = (0, scheduling_1.resolveScheduleScope)('ceo', attempt);
        strict_1.default.equal(result.allowed, true, `CEO + ${JSON.stringify(attempt)} should stay allowed (own view)`);
        strict_1.default.equal(result.scope, 'mine', `CEO + ${JSON.stringify(attempt)} must resolve to mine`);
    });
    // And a forged array containing "all" must not unlock the shared view.
    strict_1.default.equal((0, scheduling_1.resolveScheduleScope)('ceo', ['all']).scope, 'mine');
    strict_1.default.equal((0, scheduling_1.resolveScheduleScope)('stranger', ['all']).scope, 'mine');
});
(0, node_test_1.default)('15b3. ownership stays with the appointment owner, not the record creator', () => {
    // The coordinator may create on behalf of the CEO: the row is owned by the
    // CEO (user_id), so management/read decisions follow user_id.
    const ceoAppointmentCreatedByCoordinator = { user_id: 'ceo', created_by: 'coordinator', is_ceo_appointment: true };
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('ceo', 'ceo', ceoAppointmentCreatedByCoordinator), true);
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('ceo', 'ceo', ceoAppointmentCreatedByCoordinator), true);
    strict_1.default.equal((0, scheduling_1.canManageSchedule)('coordinator', 'coordinator', ceoAppointmentCreatedByCoordinator), true);
    // A coordinator's own private entry stays private even though she is the creator.
    const coordinatorPrivate = { user_id: 'coordinator', created_by: 'coordinator', is_ceo_appointment: false };
    strict_1.default.equal((0, scheduling_1.canReadSchedule)('ceo', 'ceo', coordinatorPrivate), false);
    strict_1.default.equal((0, scheduling_1.resolveScheduleScope)('ceo', 'all').allowed, false);
    strict_1.default.equal((0, scheduling_1.resolveScheduleScope)('coordinator', 'all').allowed, true);
});
//# sourceMappingURL=scheduling.test.js.map