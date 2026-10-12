"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCoordinator = void 0;
exports.authenticateToken = authenticateToken;
exports.requireCEO = requireCEO;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function authenticateToken(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access denied. No token provided.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
}
function requireCEO(req, res, next) {
    if (req.user?.role !== 'ceo') {
        res.status(403).json({ error: 'CEO access required.' });
        return;
    }
    next();
}
function requireAuth(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
    }
    next();
}
/** Restrict a route to one or more roles. Must run after authenticateToken. */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'You do not have permission to perform this action.' });
            return;
        }
        next();
    };
}
/** External CEO booking requests may only be approved/rejected/rescheduled by the coordinator. */
exports.requireCoordinator = requireRole('coordinator');
//# sourceMappingURL=auth.js.map