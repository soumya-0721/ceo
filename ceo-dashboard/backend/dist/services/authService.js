"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
class AuthService {
    async login(username, password) {
        const result = await database_1.default.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
        const user = result.rows[0];
        if (!user) {
            throw new Error('Invalid credentials');
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }
        await database_1.default.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, env_1.config.jwtSecret, { expiresIn: env_1.config.jwtExpiresIn });
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        };
    }
    async getUserById(id) {
        const result = await database_1.default.query('SELECT id, username, full_name, email, role, avatar, last_login FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }
    async getAllUsers() {
        const result = await database_1.default.query('SELECT id, username, full_name, email, role, avatar, is_active FROM users ORDER BY full_name');
        return result.rows;
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map