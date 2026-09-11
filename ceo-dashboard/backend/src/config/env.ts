import dotenv from 'dotenv';
dotenv.config();

export const config = {
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
