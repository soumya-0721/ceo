export declare class TaskService {
    getByUser(userId: string, status?: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    getCounts(userId: string): Promise<{
        pending: number;
        today: number;
        completed: number;
    }>;
}
export declare const taskService: TaskService;
