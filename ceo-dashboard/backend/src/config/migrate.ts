import pool from './database';

async function migrate() {
    try {
        console.log('Running migration...');

        // Add new columns to bookings table if they don't exist
        const alterCols = [
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address TEXT",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS place VARCHAR(200)",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'once'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS what TEXT",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visitor_type VARCHAR(50) DEFAULT 'external'",
        ];

        for (const sql of alterCols) {
            await pool.query(sql);
            console.log(`OK: ${sql.substring(0, 50)}...`);
        }

        // Create excel_data table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS excel_data (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id),
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                row_count INTEGER DEFAULT 0,
                status VARCHAR(30) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('OK: excel_data table');

        // Ensure users exist with correct passwords
        const users = await pool.query("SELECT username, full_name FROM users");
        console.log('Existing users:', users.rows);

        if (users.rows.length === 0) {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('ceo123', 10);
            const hash2 = await bcrypt.hash('soumya123', 10);
            await pool.query(
                "INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1,$2,$3,$4,$5)",
                ['ceo', hash, 'Samhith', 'samhith@next360.com', 'ceo']
            );
            await pool.query(
                "INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1,$2,$3,$4,$5)",
                ['soumya', hash2, 'Soumya', 'soumya@next360.com', 'coordinator']
            );
            console.log('Created default users');
        } else {
            // Update passwords to make sure they work
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('ceo123', 10);
            const hash2 = await bcrypt.hash('soumya123', 10);
            await pool.query("UPDATE users SET password_hash=$1 WHERE username='ceo'", [hash]);
            await pool.query("UPDATE users SET password_hash=$1 WHERE username='soumya'", [hash2]);
            console.log('Updated user passwords');
        }

        console.log('Migration complete!');
        process.exit(0);
    } catch (error: any) {
        console.error('Migration error:', error.message);
        process.exit(1);
    }
}

migrate();
