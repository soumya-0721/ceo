import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
        fullName: string;
    };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Access denied. No token provided.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

export function requireCEO(req: AuthRequest, res: Response, next: NextFunction): void {
    if (req.user?.role !== 'ceo') {
        res.status(403).json({ error: 'CEO access required.' });
        return;
    }
    next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
    }
    next();
}
