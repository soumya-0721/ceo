export declare class AvailabilityService {
    getByUser(userId: string): Promise<any[]>;
    getTodayAvailability(): Promise<any[]>;
    upsert(userId: string, dayOfWeek: number, startTime: string, endTime: string, isAvailable: boolean, label?: string): Promise<any>;
    delete(id: string, userId: string): Promise<any>;
}
export declare const availabilityService: AvailabilityService;
