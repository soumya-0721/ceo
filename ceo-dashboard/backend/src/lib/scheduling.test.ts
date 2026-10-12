import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePriority,
    priorityLabel,
    priorityRank,
    rangesOverlap,
    findConflicts,
    assignColumns,
    canApproveBooking,
    isConfirmedBookingStatus,
    isPendingBookingStatus,
    bookingStatusLabel,
    validateMeetingWindow,
    addMinutes,
    normalizeTime,
    scheduleAdvisoryKey,
    canManageSchedule,
    canReadSchedule,
    canReadBooking,
    resolveScheduleScope,
    overrideDecision,
    buildOverrideFields
} from './scheduling';

test('normalizePriority maps UI labels onto the DB enum', () => {
    assert.equal(normalizePriority('critical'), 'urgent');
    assert.equal(normalizePriority('Critical'), 'urgent');
    assert.equal(normalizePriority('normal'), 'medium');
    assert.equal(normalizePriority('high'), 'high');
    assert.equal(normalizePriority('low'), 'low');
    assert.equal(normalizePriority('urgent'), 'urgent');
    assert.equal(normalizePriority(undefined), 'medium');
    assert.equal(normalizePriority('nonsense'), 'medium');
});

test('priorityLabel renders Low/Normal/High/Critical', () => {
    assert.equal(priorityLabel('low'), 'Low');
    assert.equal(priorityLabel('medium'), 'Normal');
    assert.equal(priorityLabel('high'), 'High');
    assert.equal(priorityLabel('urgent'), 'Critical');
});

test('priorityRank orders low < normal < high < critical', () => {
    assert.ok(priorityRank('low') < priorityRank('medium'));
    assert.ok(priorityRank('medium') < priorityRank('high'));
    assert.ok(priorityRank('high') < priorityRank('urgent'));
});

test('rangesOverlap uses minute comparison, not string ordering', () => {
    assert.equal(rangesOverlap({ start: '13:00', end: '14:00' }, { start: '13:30', end: '14:30' }), true);
    assert.equal(rangesOverlap({ start: '13:00', end: '14:00' }, { start: '14:00', end: '15:00' }), false);
    assert.equal(rangesOverlap({ start: '09:00', end: '10:00' }, { start: '09:30', end: '09:45' }), true);
});

test('findConflicts detects overlaps but excludes the record being edited', () => {
    const existing = [
        { id: 'a', start: '13:00', end: '14:00', title: 'Board meeting' },
        { id: 'b', start: '16:00', end: '17:00', title: 'Call' }
    ];
    const conflicts = findConflicts({ id: 'new', start: '13:30', end: '14:30' }, existing);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].id, 'a');

    // editing an appointment must not conflict with itself
    const selfEdit = findConflicts({ id: 'a', start: '13:00', end: '14:00' }, existing);
    assert.equal(selfEdit.length, 0);
});

test('assignColumns places overlapping events side by side', () => {
    const layout = assignColumns([
        { id: 'x', start: '13:00', end: '14:00' },
        { id: 'y', start: '13:00', end: '14:00' },
        { id: 'z', start: '16:00', end: '17:00' }
    ]);
    const x = layout.find(l => l.id === 'x')!;
    const y = layout.find(l => l.id === 'y')!;
    const z = layout.find(l => l.id === 'z')!;
    assert.equal(x.columns, 2);
    assert.equal(y.columns, 2);
    assert.notEqual(x.column, y.column);
    assert.equal(z.columns, 1);
});

test('only the coordinator may approve bookings', () => {
    assert.equal(canApproveBooking('coordinator'), true);
    assert.equal(canApproveBooking('ceo'), false);
    assert.equal(canApproveBooking(undefined), false);
});

test('confirmed vs pending booking statuses', () => {
    assert.equal(isConfirmedBookingStatus('accepted'), true);
    assert.equal(isConfirmedBookingStatus('rescheduled'), true);
    assert.equal(isConfirmedBookingStatus('pending'), false);
    assert.equal(isConfirmedBookingStatus('rejected'), false);
    assert.equal(isPendingBookingStatus('pending'), true);
    assert.equal(bookingStatusLabel('accepted'), 'Approved');
    assert.equal(bookingStatusLabel('rescheduled'), 'Rescheduled');
    assert.equal(bookingStatusLabel('rejected'), 'Rejected');
});

test('validateMeetingWindow rejects bad input', () => {
    assert.equal(validateMeetingWindow('2026-10-12', '13:00', '14:00'), null);
    assert.match(validateMeetingWindow('not-a-date', '13:00', '14:00') || '', /valid date/);
    assert.match(validateMeetingWindow('2026-10-12', '14:00', '13:00') || '', /after start/);
    assert.match(validateMeetingWindow('2026-10-12', '09:00', '20:00') || '', /8 hours/);
});

test('time helpers', () => {
    assert.equal(addMinutes('13:00', 90), '14:30');
    assert.equal(normalizeTime('13:00:00'), '13:00');
});

// ===== Overlap / editing / override scenarios =====

const existing = [
    { id: 'a', start: '09:00', end: '10:00', title: 'Board meeting' },
    { id: 'b', start: '11:00', end: '12:00', title: 'Interview' },
    { id: 'c', start: '14:00', end: '15:00', title: 'Team sync' }
];

test('1. two meetings with overlapping times both report the conflict', () => {
    // Meeting that starts inside another meeting:
    assert.equal(rangesOverlap({ start: '09:30', end: '10:30' }, { start: '09:00', end: '10:00' }), true);
    const conflicts = findConflicts({ id: 'x', start: '09:30', end: '10:30', title: 'New' }, [existing[0]]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].id, 'a');
});

test('2. one meeting fully contained within another is a conflict', () => {
    for (const contained of [
        { start: '09:00', end: '10:00' },
        { start: '09:15', end: '09:45' },
        { start: '09:00', end: '09:30' },
        { start: '09:30', end: '10:00' }
    ]) {
        assert.equal(rangesOverlap(contained, { start: '09:00', end: '10:00' }), true, JSON.stringify(contained));
    }
    const conflicts = findConflicts({ id: 'x', start: '09:15', end: '09:45' }, [existing[0]]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].id, 'a');
});

test('3. adjacent meetings (one ends exactly when the next starts) do not conflict', () => {
    assert.equal(rangesOverlap({ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }), false);
    assert.equal(findConflicts({ id: 'x', start: '10:00', end: '11:00' }, [existing[0]]).length, 0);
    assert.equal(findConflicts({ id: 'x', start: '08:00', end: '09:00' }, [existing[0]]).length, 0);
});

test('4. editing a meeting does not conflict with itself', () => {
    const conflicts = findConflicts({ id: 'a', start: '09:00', end: '10:00', title: 'Board meeting (unchanged)' }, existing);
    assert.equal(conflicts.length, 0);

    // Same record moved minutes later still excludes itself:
    const selfMoved = findConflicts({ id: 'a', start: '09:45', end: '10:15' }, existing);
    assert.equal(selfMoved.length, 0);
});

test('5. editing a meeting into an occupied slot reports that meeting', () => {
    const conflicts = findConflicts({ id: 'a', start: '11:15', end: '11:45' }, existing);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].id, 'b');
});

test('6. saving a conflicting meeting is allowed after an explicit override', () => {
    assert.deepEqual(overrideDecision(2, true, true), { ok: true });
    assert.equal(overrideDecision(0, false, true).ok, true);
});

test('7. an override is rejected without the required authorization', () => {
    assert.deepEqual(overrideDecision(1, true, false), { ok: false, reason: 'unauthorized' });
    assert.deepEqual(overrideDecision(1, false, false), { ok: false, reason: 'conflict' });
    assert.deepEqual(overrideDecision(1, false, true), { ok: false, reason: 'conflict' });
});

test('8. override audit fields preserve who, when, and why', () => {
    const fields = buildOverrideFields('user-1', 'Soumya', 'Client insisted');
    assert.equal(fields.conflictOverride, true);
    assert.equal(fields.overrideBy, 'user-1');
    assert.match(fields.overrideAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(fields.overrideReason, 'Client insisted');

    const defaulted = buildOverrideFields('user-2', 'Nikhil');
    assert.equal(defaulted.overrideReason, 'Override confirmed by Nikhil');
});

test('9. concurrent edits to the same owner serialize on the same advisory key', () => {
    const key = scheduleAdvisoryKey('owner-1', '2026-10-12');
    assert.equal(key, 'schedule:owner-1:2026-10-12');
    assert.equal(scheduleAdvisoryKey('owner-1', '2026-10-12'), key);
    // Different owner or different date -> a different lock, so unrelated edits run in parallel.
    assert.notEqual(scheduleAdvisoryKey('owner-2', '2026-10-12'), key);
    assert.notEqual(scheduleAdvisoryKey('owner-1', '2026-10-13'), key);
});

test('10. invalid dates, times and missing fields are rejected', () => {
    assert.match(validateMeetingWindow('2026-02-30', '09:00', '10:00') || '', /valid date/);
    assert.match(validateMeetingWindow('', '09:00', '10:00') || '', /valid date/);
    assert.match(validateMeetingWindow('2026-10-12', '', '10:00') || '', /start time/);
    assert.match(validateMeetingWindow('2026-10-12', '10:00', '') || '', /end time/);
    assert.match(validateMeetingWindow('2026-10-12', 'bad', '10:00') || '', /start time/);
    assert.match(validateMeetingWindow('2026-10-12', '14:00', '13:00') || '', /after start/);
    assert.match(validateMeetingWindow('2026-10-12', '08:00', '17:00') || '', /8 hours/);
    assert.equal(validateMeetingWindow('2026-10-12', '10:30', '11:00'), null);
});

test('12. who may read a schedule (mirrors write ownership, blocks CEO over private entries)', () => {
    const ceoAppt = { user_id: 'ceo', is_ceo_appointment: true };
    const coordinatorPrivate = { user_id: 'coord', is_ceo_appointment: false };
    // Owner reads their own entry.
    assert.equal(canReadSchedule('ceo', 'ceo', ceoAppt), true);
    assert.equal(canReadSchedule('coord', 'coordinator', coordinatorPrivate), true);
    // Coordinator reads CEO appointments (they run that calendar).
    assert.equal(canReadSchedule('coord', 'coordinator', ceoAppt), true);
    // CEO cannot read the coordinator's private entry by guessing an id.
    assert.equal(canReadSchedule('ceo', 'ceo', coordinatorPrivate), false);
    // Unrelated roles / missing record / missing user are denied.
    assert.equal(canReadSchedule('other', 'ceo', coordinatorPrivate), false);
    assert.equal(canReadSchedule('other', 'viewer', ceoAppt), false);
    assert.equal(canReadSchedule('', 'ceo', ceoAppt), false);
    assert.equal(canReadSchedule('ceo', 'ceo', {}), false);
});

test('13. who may read a booking (CEO and coordinator only)', () => {
    assert.equal(canReadBooking('ceo'), true);
    assert.equal(canReadBooking('coordinator'), true);
    assert.equal(canReadBooking('viewer'), false);
    assert.equal(canReadBooking('employee'), false);
    assert.equal(canReadBooking(undefined), false);
});

test('11. who may manage a schedule (owner / coordinator-on-CEO-calendar)', () => {
    const ceoAppt = { user_id: 'ceo', is_ceo_appointment: true };
    const coordinatorOwn = { user_id: 'coord', is_ceo_appointment: false };
    // Owner may edit their own in every case.
    assert.equal(canManageSchedule('ceo', 'ceo', ceoAppt), true);
    assert.equal(canManageSchedule('coord', 'coordinator', coordinatorOwn), true);
    // The coordinator runs the CEO calendar.
    assert.equal(canManageSchedule('coord', 'coordinator', ceoAppt), true);
    // The CEO may not reach into the coordinator's private entries.
    assert.equal(canManageSchedule('ceo', 'ceo', coordinatorOwn), false);
    // Someone unrelated (or an unknown role) manages nothing.
    assert.equal(canManageSchedule('stranger', 'user', ceoAppt), false);
    assert.equal(canManageSchedule('stranger', 'coordinator', coordinatorOwn), false);
    assert.equal(canManageSchedule('', 'coordinator', ceoAppt), false);
});

test('14. CEO scope requests stay on the CEO calendar', () => {
    // 1. explicit "mine" is allowed and scoped to the CEO's own records.
    assert.deepEqual(resolveScheduleScope('ceo', 'mine'), { allowed: true, scope: 'mine' });
    // 2. "all" is denied for the CEO (cannot retrieve other users' schedules).
    assert.deepEqual(resolveScheduleScope('ceo', 'all'), { allowed: false, scope: 'mine' });
    // no scope parameter at all still resolves to the safe own-calendar view.
    assert.deepEqual(resolveScheduleScope('ceo', undefined), { allowed: true, scope: 'mine' });
});

test('15. coordinator scope requests may use the shared coordination view', () => {
    // 3. the coordinator may request the shared view and coordinate CEO appointments.
    assert.deepEqual(resolveScheduleScope('coordinator', 'all'), { allowed: true, scope: 'all' });
    // and may still request her own calendar explicitly.
    assert.deepEqual(resolveScheduleScope('coordinator', 'mine'), { allowed: true, scope: 'mine' });
    assert.deepEqual(resolveScheduleScope('coordinator', undefined), { allowed: true, scope: 'mine' });
});

test('15b. unauthenticated / unknown roles never receive the shared view', () => {
    // Missing role (e.g. middleware let an unverified principal through) must
    // not be treated as the coordinator.
    assert.deepEqual(resolveScheduleScope(undefined, 'all'), { allowed: false, scope: 'mine' });
    assert.deepEqual(resolveScheduleScope(undefined, undefined), { allowed: true, scope: 'mine' });
    for (const role of ['viewer', 'employee', 'admin', 'CEO', 'Coordinator', ' coordinator ']) {
        assert.equal(resolveScheduleScope(role, 'all').allowed, false, `${role} must not get "all"`);
        assert.equal(resolveScheduleScope(role, 'all').scope, 'mine');
    }
});

test('15b2. a user cannot bypass restrictions with query-parameter tricks', () => {
    // Only the exact, role-authorized token grants "all": case, whitespace,
    // arrays (repeated params) and unrelated values all fall back to "mine".
    const bypassAttempts: any[] = ['ALL', 'All', ' all ', 'all ', ' all', 'true', 'shared', 'everyone', ['all'], ['all', 'all'], '', null, 0, 1, true];
    bypassAttempts.forEach((attempt) => {
        const result = resolveScheduleScope('ceo', attempt);
        assert.equal(result.allowed, true, `CEO + ${JSON.stringify(attempt)} should stay allowed (own view)`);
        assert.equal(result.scope, 'mine', `CEO + ${JSON.stringify(attempt)} must resolve to mine`);
    });
    // And a forged array containing "all" must not unlock the shared view.
    assert.equal(resolveScheduleScope('ceo', ['all']).scope, 'mine');
    assert.equal(resolveScheduleScope('stranger', ['all']).scope, 'mine');
});

test('15b3. ownership stays with the appointment owner, not the record creator', () => {
    // The coordinator may create on behalf of the CEO: the row is owned by the
    // CEO (user_id), so management/read decisions follow user_id.
    const ceoAppointmentCreatedByCoordinator = { user_id: 'ceo', created_by: 'coordinator', is_ceo_appointment: true };
    assert.equal(canManageSchedule('ceo', 'ceo', ceoAppointmentCreatedByCoordinator), true);
    assert.equal(canReadSchedule('ceo', 'ceo', ceoAppointmentCreatedByCoordinator), true);
    assert.equal(canManageSchedule('coordinator', 'coordinator', ceoAppointmentCreatedByCoordinator), true);
    // A coordinator's own private entry stays private even though she is the creator.
    const coordinatorPrivate = { user_id: 'coordinator', created_by: 'coordinator', is_ceo_appointment: false };
    assert.equal(canReadSchedule('ceo', 'ceo', coordinatorPrivate), false);
    assert.equal(resolveScheduleScope('ceo', 'all').allowed, false);
    assert.equal(resolveScheduleScope('coordinator', 'all').allowed, true);
});
