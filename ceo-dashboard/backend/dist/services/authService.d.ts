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
    /** The CEO account. Used to attribute appointments created on the CEO's behalf. */
    getCeo(): Promise<any>;
}
export declare const authService: AuthService;
