export declare class FocusService {
    getByDate(date: string): Promise<any[]>;
    create(data: any): Promise<any>;
    updateStatus(id: string, status: string): Promise<any>;
    cancel(id: string): Promise<any>;
}
export declare const focusService: FocusService;
