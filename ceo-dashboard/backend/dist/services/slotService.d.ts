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
    start: string;
    end: string;
}
export interface Slot extends TimeRange {
    duration: number;
}
export declare function toMinutes(time: string): number;
export declare function toTime(totalMinutes: number): string;
export declare function dateRange(startDate: string, endDate: string): string[];
/** Local calendar date as YYYY-MM-DD (no UTC drift). */
export declare function todayStr(): string;
export declare class SlotService {
    /** Open windows for a date: availability rows for that weekday, else default working hours. */
    getWorkingWindows(date: string): Promise<TimeRange[]>;
    /** Every occupied period for a date (schedules of both users + focus + bookings), merged. */
    getBusyRanges(date: string): Promise<TimeRange[]>;
    getFreeWindows(date: string): Promise<TimeRange[]>;
    /** Discrete start times (stepping by `duration`) that fit entirely inside a free window. */
    getAvailableSlots(date: string, durationMinutes: number): Promise<Slot[]>;
    isSlotAvailable(date: string, startTime: string, durationMinutes: number): Promise<boolean>;
    /** Candidate replacements when a requested time is taken. */
    suggestSlots(date: string, durationMinutes: number, limit?: number): Promise<Slot[]>;
    /** Week data for the schedule dashboards: free windows + totals per day. */
    getWeekOverview(startDate: string, endDate: string): Promise<{
        start: string;
        end: string;
        days: {
            date: string;
            dayOfWeek: number;
            working: TimeRange[];
            free: TimeRange[];
            busy: TimeRange[];
            workingMinutes: number;
            freeMinutes: number;
            bookedMinutes: number;
        }[];
        totals: {
            availableMinutes: number;
            bookedMinutes: number;
            appointmentsWeek: number;
            appointmentsToday: number;
        };
    }>;
    /** True when two time ranges overlap using proper minute comparison. */
    rangesOverlap(a: TimeRange, b: TimeRange): boolean;
}
export declare const slotService: SlotService;
