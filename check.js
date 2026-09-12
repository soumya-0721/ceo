const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_xiXhMYv1aZm5@ep-dry-flower-a5767ild-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function check() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('Tables:', tables.rows.map(r=>r.table_name));

  const users = await pool.query('SELECT id,username,full_name,role FROM users');
  console.log('Users:', JSON.stringify(users.rows, null, 2));

  const schedCount = await pool.query('SELECT COUNT(*) FROM schedules');
  console.log('Schedules count:', schedCount.rows[0].count);

  const taskCount = await pool.query('SELECT COUNT(*) FROM tasks');
  console.log('Tasks count:', taskCount.rows[0].count);

  const notifCount = await pool.query('SELECT COUNT(*) FROM notifications');
  console.log('Notifications count:', notifCount.rows[0].count);

  pool.end();
}
check().catch(e => { console.error(e); process.exit(1); });
