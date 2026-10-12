type Runner = {
    query: (text: string, params?: any[]) => Promise<any>;
};
export declare class ScheduleService {
    /**
     * Schedules owned by `userId` (the CEO's calendar = user_id = CEO).
     * `scope === 'all'` returns every owner (shared coordination view).
     * Filtering is by owner (user_id), NOT created_by, so an appointment Soumya
     * creates *for* the CEO belongs to the CEO while her own entries stay separate.
     */
    getByDate(date: string, userId?: string, scope?: string): Promise<any[]>;
    getByDateRange(startDate: string, endDate: string, userId?: string, scope?: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    /**
     * Overlap detection across a person's commitments. Proper minute-based range
     * comparison, never string ordering. `excludeId` drops the record being edited
     * so editing cannot raise a false self-conflict.
     */
    checkConflict(date: string, startTime: string, endTime: string, excludeId?: string, ownerId?: string, runner?: Runner): Promise<any>;
    /** Free windows for a date, from the shared availability engine (includes bookings). */
    getAvailableSlots(date: string, durationMinutes: number): Promise<import("./slotService").Slot[]>;
    create(data: any, runner?: Runner): Promise<any>;
    update(id: string, data: any, userId: string, runner?: Runner): Promise<any>;
    getStats(userId: string): Promise<{
        todayMeetings: number;
        freeTimeMinutes: number;
        freeTimeFormatted: string;
    }>;
}
export declare const scheduleService: ScheduleService;
export {};
