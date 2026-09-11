export declare class ReminderService {
    getByUser(userId: string, status?: string): Promise<any[]>;
    getActiveReminders(userId: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    getPendingCount(userId: string): Promise<number>;
}
export declare const reminderService: ReminderService;
