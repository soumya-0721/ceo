export declare class AvailabilityService {
    getByUser(userId: string): Promise<any[]>;
    /**
     * Working windows for the current weekday across the team. Only the minimum
     * fields needed to show "who is available" are returned - internal ids and
     * audit timestamps are deliberately omitted.
     */
    getTodayAvailability(): Promise<any[]>;
    upsert(userId: string, dayOfWeek: number, startTime: string, endTime: string, isAvailable: boolean, label?: string): Promise<any>;
    delete(id: string, userId: string): Promise<any>;
}
export declare const availabilityService: AvailabilityService;
