export declare class NotificationService {
    getByUser(userId: string, unreadOnly?: boolean): Promise<any[]>;
    getUnreadCount(userId: string): Promise<number>;
    create(data: {
        userId: string;
        fromUserId: string;
        title: string;
        message: string;
        actionType: string;
        recordType?: string;
        recordId?: string;
        oldValue?: any;
        newValue?: any;
    }): Promise<any>;
    markAsRead(id: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    notifyOtherUser(fromUserId: string, title: string, message: string, actionType: string, recordType?: string, recordId?: string, oldValue?: any, newValue?: any): Promise<void>;
}
export declare const notificationService: NotificationService;
