export declare class AuditService {
    log(data: {
        userId: string;
        action: string;
        recordType: string;
        recordId?: string;
        oldData?: any;
        newData?: any;
        ipAddress?: string;
    }): Promise<any>;
    getByRecord(recordType: string, recordId: string): Promise<any[]>;
    getRecent(limit?: number): Promise<any[]>;
}
export declare const auditService: AuditService;
