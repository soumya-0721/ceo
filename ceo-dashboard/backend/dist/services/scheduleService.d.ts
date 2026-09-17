export declare class ScheduleService {
    getByDate(date: string, userId?: string): Promise<any[]>;
    getByDateRange(startDate: string, endDate: string, userId?: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    checkConflict(date: string, startTime: string, endTime: string, excludeId?: string): Promise<any[]>;
    getAvailableSlots(date: string, durationMinutes: number): Promise<any[]>;
    private timeDiffMinutes;
    create(data: any): Promise<any>;
    update(id: string, data: any, userId: string): Promise<any>;
    getStats(userId: string): Promise<{
        todayMeetings: number;
        freeTimeMinutes: number;
        freeTimeFormatted: string;
    }>;
}
export declare const scheduleService: ScheduleService;
