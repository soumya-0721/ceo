type Runner = {
    query: (text: string, params?: any[]) => Promise<any>;
};
export declare class BookingService {
    getAll(status?: string): Promise<any[]>;
    getById(id: string, runner?: Runner): Promise<any>;
    /** Row lock for the duration of an approval transaction. */
    getByIdForUpdate(id: string, runner: Runner): Promise<any>;
    create(data: any, runner?: Runner): Promise<any>;
    updateStatus(id: string, status: string, handledBy: string, runner?: Runner): Promise<any>;
    /**
     * Records the outcome of an approval / reschedule: links the single CEO meeting,
     * stamps the approver, and (for reschedules) stores the new requested slot.
     */
    setApproval(id: string, data: {
        status: string;
        scheduleId?: string | null;
        approvedBy?: string | null;
        handledBy?: string | null;
        date?: string;
        time?: string;
        duration?: number;
    }, runner?: Runner): Promise<any>;
    getPendingCount(): Promise<number>;
}
export declare const bookingService: BookingService;
export {};
