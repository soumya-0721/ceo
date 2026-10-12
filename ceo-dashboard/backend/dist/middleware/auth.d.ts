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
/** Restrict a route to one or more roles. Must run after authenticateToken. */
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
/** External CEO booking requests may only be approved/rejected/rescheduled by the coordinator. */
export declare const requireCoordinator: (req: AuthRequest, res: Response, next: NextFunction) => void;
