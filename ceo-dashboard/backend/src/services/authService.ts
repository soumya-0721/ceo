import pool from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export class AuthService {
    async login(username: string, password: string) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
        const user = result.rows[0];

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn as any }
        );

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

    async getUserById(id: string) {
        const result = await pool.query(
            'SELECT id, username, full_name, email, role, avatar, last_login FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async getAllUsers() {
        const result = await pool.query(
            'SELECT id, username, full_name, email, role, avatar, is_active FROM users ORDER BY full_name'
        );
        return result.rows;
    }
}

export const authService = new AuthService();
