export declare class AuthService {
    login(username: string, password: string): Promise<{
        token: string;
        user: {
            id: any;
            username: any;
            fullName: any;
            email: any;
            role: any;
            avatar: any;
        };
    }>;
    getUserById(id: string): Promise<any>;
    getAllUsers(): Promise<any[]>;
}
export declare const authService: AuthService;
