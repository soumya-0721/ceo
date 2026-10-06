import { queryRetry } from '../config/database';

/**
 * Single source of truth for availability.
 *
 * Pipeline for any date:
 *   working hours (availability table, fallback 09:00-18:00)
 *   - CEO schedules
 *   - Coordinator schedules
 *   - focus sessions
 *   - existing bookings
 *   = free windows -> discrete bookable slots
 *
 * Everything is computed in minutes so overlaps are never compared as strings.
 */

export interface TimeRange {
    start: string; // HH:MM
    end: string;   // HH:MM
}

export interface Slot extends TimeRange {
    duration: number;
}

const DEFAULT_WORK_START = '09:00';
const DEFAULT_WORK_END = '18:00';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function normalize(time: string): string {
    return toTime(toMinutes((time || '').substring(0, 5)));
}

function isValidDate(date: string): boolean {
    if (!DATE_RE.test(date)) return false;
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

/** Day of week (0=Sun) for a YYYY-MM-DD string, free of timezone drift. */
function dayOfWeek(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sort + merge overlapping/adjacent ranges so an occupied period is only counted once. */
function mergeRanges(ranges: TimeRange[]): TimeRange[] {
    const clean = ranges
        .filter(r => r && toMinutes(r.end) > toMinutes(r.start))
        .map(r => ({ start: normalize(r.start), end: normalize(r.end) }))
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const merged: TimeRange[] = [];
    for (const range of clean) {
        const last = merged[merged.length - 1];
        if (last && toMinutes(range.start) <= toMinutes(last.end)) {
            if (toMinutes(range.end) > toMinutes(last.end)) last.end = range.end;
        } else {
            merged.push({ ...range });
        }
    }
    return merged;
}

/** Subtract `cuts` from `base` (both assumed merged). */
function subtractRanges(base: TimeRange[], cuts: TimeRange[]): TimeRange[] {
    const result: TimeRange[] = [];
    for (const window of base) {
        let cursor = toMinutes(window.start);
        const end = toMinutes(window.end);
        for (const cut of cuts) {
            const cutStart = toMinutes(cut.start);
            const cutEnd = toMinutes(cut.end);
            if (cutEnd <= cursor || cutStart >= end) continue;
            if (cutStart > cursor) result.push({ start: toTime(cursor), end: toTime(Math.min(cutStart, end)) });
            cursor = Math.max(cursor, cutEnd);
            if (cursor >= end) break;
        }
        if (cursor < end) result.push({ start: toTime(cursor), end: toTime(end) });
    }
    return result;
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

function rangeMinutes(ranges: TimeRange[]): number {
    return ranges.reduce((sum, r) => sum + (toMinutes(r.end) - toMinutes(r.start)), 0);
}

function addMinutes(time: string, minutes: number): string {
    return toTime(toMinutes(time) + minutes);
}

export function dateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
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
export function todayStr(): string {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
}

export class SlotService {
    /** Open windows for a date: availability rows for that weekday, else default working hours. */
    async getWorkingWindows(date: string): Promise<TimeRange[]> {
        const rows = await queryRetry(
            'SELECT start_time, end_time, is_available FROM availability WHERE day_of_week = $1',
            [dayOfWeek(date)]
        );

        const open = rows.rows.filter((r: any) => r.is_available !== false).map((r: any) => ({
            start: normalize(r.start_time), end: normalize(r.end_time)
        }));
        const closed = rows.rows.filter((r: any) => r.is_available === false).map((r: any) => ({
            start: normalize(r.start_time), end: normalize(r.end_time)
        }));

        let windows = open.length ? mergeRanges(open) : [{ start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }];
        if (closed.length) windows = subtractRanges(windows, mergeRanges(closed));
        return windows;
    }

    /** Every occupied period for a date (schedules of both users + focus + bookings), merged. */
    async getBusyRanges(date: string): Promise<TimeRange[]> {
        const [schedules, focus, bookings] = await Promise.all([
            queryRetry(
                `SELECT start_time, end_time FROM schedules
                 WHERE schedule_date = $1 AND status = 'active'`,
                [date]
            ),
            queryRetry(
                `SELECT start_time, end_time FROM focus_sessions
                 WHERE focus_date = $1 AND status = 'active'`,
                [date]
            ),
            queryRetry(
                `SELECT preferred_time, duration FROM bookings
                 WHERE booking_date = $1 AND status IN ('pending','accepted')`,
                [date]
            )
        ]);

        const blocks: TimeRange[] = [];
        for (const row of schedules.rows) blocks.push({ start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of focus.rows) blocks.push({ start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of bookings.rows) {
            const start = normalize(row.preferred_time);
            blocks.push({ start, end: addMinutes(start, row.duration || 30) });
        }
        return mergeRanges(blocks);
    }

    async getFreeWindows(date: string): Promise<TimeRange[]> {
        const [working, busy] = await Promise.all([this.getWorkingWindows(date), this.getBusyRanges(date)]);
        return subtractRanges(working, busy);
    }

    /** Discrete start times (stepping by `duration`) that fit entirely inside a free window. */
    async getAvailableSlots(date: string, durationMinutes: number): Promise<Slot[]> {
        if (!isValidDate(date)) return [];
        const duration = Math.max(5, Math.min(480, durationMinutes || 30));
        const free = await this.getFreeWindows(date);

        const slots: Slot[] = [];
        for (const window of free) {
            const start = toMinutes(window.start);
            const end = toMinutes(window.end);
            for (let cursor = start; cursor + duration <= end; cursor += duration) {
                slots.push({ start: toTime(cursor), end: toTime(cursor + duration), duration });
            }
        }
        return slots;
    }

    async isSlotAvailable(date: string, startTime: string, durationMinutes: number): Promise<boolean> {
        if (!isValidDate(date) || !DATE_RE.test(date)) return false;
        if (!/^\d{2}:\d{2}/.test(startTime || '')) return false;
        const duration = Math.max(5, Math.min(480, durationMinutes || 30));
        const start = toMinutes(startTime);
        const end = start + duration;
        const free = await this.getFreeWindows(date);
        return free.some(w => start >= toMinutes(w.start) && end <= toMinutes(w.end));
    }

    /** Candidate replacements when a requested time is taken. */
    async suggestSlots(date: string, durationMinutes: number, limit = 5): Promise<Slot[]> {
        const slots = await this.getAvailableSlots(date, durationMinutes);
        return slots.slice(0, limit);
    }

    /** Week data for the schedule dashboards: free windows + totals per day. */
    async getWeekOverview(startDate: string, endDate: string) {
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            throw new Error('Invalid date range');
        }

        const dates = dateRange(startDate, endDate);
        const weekdays = Array.from(new Set(dates.map(dayOfWeek)));

        const [availability, schedules, focus, bookings] = await Promise.all([
            queryRetry('SELECT day_of_week, start_time, end_time, is_available FROM availability WHERE day_of_week = ANY($1)', [weekdays]),
            queryRetry(
                `SELECT schedule_date, start_time, end_time FROM schedules
                 WHERE schedule_date BETWEEN $1 AND $2 AND status = 'active'`,
                [startDate, endDate]
            ),
            queryRetry(
                `SELECT focus_date, start_time, end_time FROM focus_sessions
                 WHERE focus_date BETWEEN $1 AND $2 AND status = 'active'`,
                [startDate, endDate]
            ),
            queryRetry(
                `SELECT booking_date, preferred_time, duration FROM bookings
                 WHERE booking_date BETWEEN $1 AND $2 AND status IN ('pending','accepted')`,
                [startDate, endDate]
            )
        ]);

        const workingByDay = new Map<number, Array<TimeRange & { isAvailable: boolean }>>();
        for (const row of availability.rows) {
            const list = workingByDay.get(row.day_of_week) || [];
            list.push({ start: normalize(row.start_time), end: normalize(row.end_time), isAvailable: row.is_available !== false });
            workingByDay.set(row.day_of_week, list);
        }

        const busyByDate = new Map<string, TimeRange[]>();
        const push = (date: string, range: TimeRange) => {
            const list = busyByDate.get(date) || [];
            list.push(range);
            busyByDate.set(date, list);
        };
        for (const row of schedules.rows) push(row.schedule_date, { start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of focus.rows) push(row.focus_date, { start: normalize(row.start_time), end: normalize(row.end_time) });
        for (const row of bookings.rows) {
            const start = normalize(row.preferred_time);
            push(row.booking_date, { start, end: addMinutes(start, row.duration || 30) });
        }

        const days = dates.map(date => {
            const dayRows = workingByDay.get(dayOfWeek(date)) || [];
            const open = dayRows.filter(r => r.isAvailable).map(r => ({ start: r.start, end: r.end }));
            const closed = dayRows.filter(r => !r.isAvailable).map(r => ({ start: r.start, end: r.end }));
            let working = open.length ? mergeRanges(open) : [{ start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }];
            if (closed.length) working = subtractRanges(working, mergeRanges(closed));

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
    rangesOverlap(a: TimeRange, b: TimeRange): boolean {
        return overlaps(a, b);
    }
}

export const slotService = new SlotService();
