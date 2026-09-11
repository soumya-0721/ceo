import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
        fullName: string;
    };
}
export declare function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireCEO(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void;
