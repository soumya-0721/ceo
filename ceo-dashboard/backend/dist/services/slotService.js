"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slotService = exports.SlotService = void 0;
exports.toMinutes = toMinutes;
exports.toTime = toTime;
exports.dateRange = dateRange;
exports.todayStr = todayStr;
const database_1 = require("../config/database");
const DEFAULT_WORK_START = '09:00';
const DEFAULT_WORK_END = '18:00';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
function normalize(time) {
    return toTime(toMinutes((time || '').substring(0, 5)));
}
function isValidDate(date) {
    if (!DATE_RE.test(date))
        return false;
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}
/** Day of week (0=Sun) for a YYYY-MM-DD string, free of timezone drift. */
function dayOfWeek(date) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
/** Sort + merge overlapping/adjacent ranges so an occupied period is only counted once. */
function mergeRanges(ranges) {
    const clean = ranges
        .filter(r => r && toMinutes(r.end) > toMinutes(r.start))
        .map(r => ({ start: normalize(r.start), end: normalize(r.end) }))
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const merged = [];
    for (const range of clean) {
        const last = merged[merged.length - 1];
        if (last && toMinutes(range.start) <= toMinutes(last.end)) {
            if (toMinutes(range.end) > toMinutes(last.end))
                last.end = range.end;
        }
        else {
            merged.push({ ...range });
        }
    }
    return merged;
}
/** Subtract `cuts` from `base` (both assumed merged). */
function subtractRanges(base, cuts) {
    const result = [];
    for (const window of base) {
        let cursor = toMinutes(window.start);
        const end = toMinutes(window.end);
        for (const cut of cuts) {
            const cutStart = toMinutes(cut.start);
            const cutEnd = toMinutes(cut.end);
            if (cutEnd <= cursor || cutStart >= end)
                continue;
            if (cutStart > cursor)
                result.push({ start: toTime(cursor), end: toTime(Math.min(cutStart, end)) });
            cursor = Math.max(cursor, cutEnd);
            if (cursor >= end)
                break;
        }
        if (cursor < end)
            result.push({ start: toTime(cursor), end: toTime(end) });
    }
    return result;
}
function overlaps(a, b) {
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}
function rangeMinutes(ranges) {
    return ranges.reduce((sum, r) => sum + (toMinutes(r.end) - toMinutes(r.start)), 0);
}
function addMinutes(time, minutes) {
    return toTime(toMinutes(time) + minutes);
}
function dateRange(startDate, endDate) {
    const dates = [];
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const cursor = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    while (cursor.getTime() <= end.getTime() && dates.length < 400) {
        dates.push(cursor.toISOString().substring(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}
/** Local calendar date as YYYY-MM-DD (no UTC drift). */
function todayStr() {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
}
class SlotService {
    /** Open windows for a date: availability rows for that weekday (user-scoped), else default working hours. */
    async getWorkingWindows(date, userId) {
        const query = userId
            ? 'SELECT start_time, end_time, is_available FROM availability WHERE day_of_week = $1 AND user_id = $2'
            : 'SELECT start_time, end_time, is_available FROM availability WHERE day_of_week = $1';
        const params = userId ? [dayOfWeek(date), userId] : [dayOfWeek(date)];
        const rows = await (0, database_1.queryRetry)(query, params);
        const open = rows.rows.filter((r) => r.is_available !== false).map((r) => ({
            start: normalize(r.start_time), end: normalize(r.end_time)
        }));
        const closed = rows.rows.filter((r) => r.is_available === false).map((r) => ({
            start: normalize(r.start_time), end: normalize(r.end_time)
        }));
        let windows = open.length ? mergeRanges(open) : [{ start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }];
        if (closed.length)
            windows = subtractRanges(windows, mergeRanges(closed));
        return windows;
    }
    /** Every occupied period for a date (schedules of both users + focus + bookings), merged. */
    async getBusyRanges(date, userId) {
        const scheduleQuery = userId
            ? `SELECT start_time, end_time FROM schedules WHERE schedule_date = $1 AND status = 'active' AND user_id = $2`
            : `SELECT start_time, end_time FROM schedules WHERE schedule_date = $1 AND status = 'active'`;
        const scheduleParams = userId ? [date, userId] : [date];
        const bookingsQuery = `SELECT preferred_time, duration FROM bookings WHERE booking_date = $1 AND status IN ('pending','accepted','rescheduled')`;
        const bookingsParams = [date];
        const [schedules, focus, bookings] = await Promise.all([
            (0, database_1.queryRetry)(scheduleQuery, scheduleParams),
            (0, database_1.queryRetry)(`SELECT start_time, end_time FROM focus_sessions WHERE focus_date = $1 AND status = 'active'`, [date]),
            (0, database_1.queryRetry)(bookingsQuery, bookingsParams)
        ]);
        const blocks = [];
        for (const row of schedules.rows)
            blocks.push({ start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of focus.rows)
            blocks.push({ start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of bookings.rows) {
            const start = normalize(row.preferred_time);
            blocks.push({ start, end: addMinutes(start, row.duration || 30) });
        }
        return mergeRanges(blocks);
    }
    async getFreeWindows(date, userId) {
        const [working, busy] = await Promise.all([this.getWorkingWindows(date, userId), this.getBusyRanges(date)]);
        return subtractRanges(working, busy);
    }
    /** Discrete start times (stepping by `duration`) that fit entirely inside a free window. */
    async getAvailableSlots(date, durationMinutes) {
        if (!isValidDate(date))
            return [];
        const duration = Math.max(5, Math.min(480, durationMinutes || 30));
        const free = await this.getFreeWindows(date);
        const slots = [];
        for (const window of free) {
            const start = toMinutes(window.start);
            const end = toMinutes(window.end);
            for (let cursor = start; cursor + duration <= end; cursor += duration) {
                slots.push({ start: toTime(cursor), end: toTime(cursor + duration), duration });
            }
        }
        return slots;
    }
    async isSlotAvailable(date, startTime, durationMinutes, userId) {
        if (!isValidDate(date) || !DATE_RE.test(date))
            return false;
        if (!/^\d{2}:\d{2}/.test(startTime || ''))
            return false;
        const duration = Math.max(5, Math.min(480, durationMinutes || 30));
        const start = toMinutes(startTime);
        const end = start + duration;
        const free = await this.getFreeWindows(date, userId);
        return free.some(w => start >= toMinutes(w.start) && end <= toMinutes(w.end));
    }
    /** Candidate replacements when a requested time is taken. */
    async suggestSlots(date, durationMinutes, limit = 5) {
        const slots = await this.getAvailableSlots(date, durationMinutes);
        return slots.slice(0, limit);
    }
    /** Week data for the schedule dashboards: free windows + totals per day. */
    async getWeekOverview(startDate, endDate, userId) {
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            throw new Error('Invalid date range');
        }
        const dates = dateRange(startDate, endDate);
        const weekdays = Array.from(new Set(dates.map(dayOfWeek)));
        const [availability, schedules, focus, bookings] = await Promise.all([
            (0, database_1.queryRetry)('SELECT day_of_week, start_time, end_time, is_available FROM availability WHERE day_of_week = ANY($1) AND user_id = $2', [weekdays, userId]),
            (0, database_1.queryRetry)(`SELECT schedule_date, start_time, end_time FROM schedules
                 WHERE schedule_date BETWEEN $1 AND $2 AND status = 'active' AND user_id = $3`, [startDate, endDate, userId]),
            (0, database_1.queryRetry)(`SELECT focus_date, start_time, end_time FROM focus_sessions
                 WHERE focus_date BETWEEN $1 AND $2 AND status = 'active'`, [startDate, endDate]),
            (0, database_1.queryRetry)(`SELECT booking_date, preferred_time, duration FROM bookings
                 WHERE booking_date BETWEEN $1 AND $2 AND status IN ('pending','accepted','rescheduled')`, [startDate, endDate])
        ]);
        const workingByDay = new Map();
        for (const row of availability.rows) {
            const list = workingByDay.get(row.day_of_week) || [];
            list.push({ start: normalize(row.start_time), end: normalize(row.end_time), isAvailable: row.is_available !== false });
            workingByDay.set(row.day_of_week, list);
        }
        const busyByDate = new Map();
        const push = (date, range) => {
            const list = busyByDate.get(date) || [];
            list.push(range);
            busyByDate.set(date, list);
        };
        for (const row of schedules.rows)
            push(row.schedule_date, { start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of focus.rows)
            push(row.focus_date, { start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of bookings.rows) {
            const start = normalize(row.preferred_time);
            push(row.booking_date, { start, end: addMinutes(start, row.duration || 30) });
        }
        const days = dates.map(date => {
            const dayRows = workingByDay.get(dayOfWeek(date)) || [];
            const open = dayRows.filter(r => r.isAvailable).map(r => ({ start: r.start, end: r.end }));
            const closed = dayRows.filter(r => !r.isAvailable).map(r => ({ start: r.start, end: r.end }));
            let working = open.length ? mergeRanges(open) : [{ start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }];
            if (closed.length)
                working = subtractRanges(working, mergeRanges(closed));
            const busy = mergeRanges(busyByDate.get(date) || []);
            const free = subtractRanges(working, busy);
            const workingMinutes = rangeMinutes(working);
            const freeMinutes = rangeMinutes(free);
            return {
                date,
                dayOfWeek: dayOfWeek(date),
                working,
                free,
                busy,
                workingMinutes,
                freeMinutes,
                bookedMinutes: Math.max(0, workingMinutes - freeMinutes)
            };
        });
        const today = todayStr();
        const appointmentsWeek = bookings.rows.filter(b => b.booking_date >= startDate && b.booking_date <= endDate).length;
        const appointmentsToday = bookings.rows.filter(b => b.booking_date === today).length;
        return {
            start: startDate,
            end: endDate,
            days,
            totals: {
                availableMinutes: days.reduce((sum, d) => sum + d.freeMinutes, 0),
                bookedMinutes: days.reduce((sum, d) => sum + d.bookedMinutes, 0),
                appointmentsWeek,
                appointmentsToday
            }
        };
    }
    /** True when two time ranges overlap using proper minute comparison. */
    rangesOverlap(a, b) {
        return overlaps(a, b);
    }
}
exports.SlotService = SlotService;
exports.slotService = new SlotService();
//# sourceMappingURL=slotService.js.map