"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3000'),
    jwtSecret: process.env.JWT_SECRET || 'next360-default-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'next360_ceo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    }
};
//# sourceMappingURL=env.js.map