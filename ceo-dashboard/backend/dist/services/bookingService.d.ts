export declare class BookingService {
    getAll(status?: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    updateStatus(id: string, status: string, handledBy: string): Promise<any>;
    getPendingCount(): Promise<number>;
}
export declare const bookingService: BookingService;
