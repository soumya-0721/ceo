const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,database:'next360_ceo',user:'postgres',password:'postgres'});
(async () => {
  const hash1 = await bcrypt.hash('ceo123', 10);
  const hash2 = await bcrypt.hash('soumya123', 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2', [hash1, 'ceo']);
  await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2', [hash2, 'soumya']);
  console.log('Passwords updated for CEO and Soumya');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
