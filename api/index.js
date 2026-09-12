const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ===== Database =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ===== Auth Middleware =====
function authenticateToken(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'next360-secret');
        next();
    } catch { return res.status(403).json({ error: 'Invalid token.' }); }
}

// ===== Express App =====
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ===== Auth Routes =====
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, process.env.JWT_SECRET || 'next360-secret', { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, maxAge: 86400000, sameSite: 'lax' });
        res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role, avatar: user.avatar } });
    } catch (e) { console.error('Login error:', e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('token'); res.json({ message: 'Logged out' }); });

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('SELECT id, username, full_name, email, role, avatar, last_login FROM users WHERE id = $1', [req.user.id]);
        res.json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/auth/users', authenticateToken, async (_req, res) => {
    try { const r = await pool.query('SELECT id, username, full_name, email, role, avatar, is_active FROM users ORDER BY full_name'); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Schedules =====
app.get('/api/schedules', authenticateToken, async (req, res) => {
    try {
        const { date, startDate, endDate } = req.query;
        let r;
        if (date) r = await pool.query(`SELECT s.*, u.full_name as creator_name FROM schedules s LEFT JOIN users u ON s.created_by=u.id WHERE s.schedule_date=$1 AND s.status NOT IN ('archived') ORDER BY s.start_time`, [date]);
        else if (startDate && endDate) r = await pool.query(`SELECT s.*, u.full_name as creator_name FROM schedules s LEFT JOIN users u ON s.created_by=u.id WHERE s.schedule_date BETWEEN $1 AND $2 AND s.status NOT IN ('archived') ORDER BY s.schedule_date, s.start_time`, [startDate, endDate]);
        else { const today = new Date().toISOString().split('T')[0]; r = await pool.query(`SELECT s.*, u.full_name as creator_name FROM schedules s LEFT JOIN users u ON s.created_by=u.id WHERE s.schedule_date=$1 AND s.status NOT IN ('archived') ORDER BY s.start_time`, [today]); }
        res.json(r.rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/schedules/stats', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const meetings = await pool.query(`SELECT COUNT(*) as count FROM schedules WHERE schedule_date=$1 AND status='active' AND schedule_type != 'personal'`, [today]);
        const slots = await pool.query(`SELECT start_time, end_time FROM schedules WHERE schedule_date=$1 AND status='active' ORDER BY start_time`, [today]);
        const focus = await pool.query(`SELECT start_time, end_time FROM focus_sessions WHERE focus_date=$1 AND status='active'`, [today]);
        const all = [...slots.rows, ...focus.rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
        let freeMin = 0, cur = '09:00';
        for (const b of all) { if (cur < b.start_time) { const [sh, sm] = cur.split(':').map(Number), [eh, em] = b.start_time.split(':').map(Number); freeMin += (eh*60+em)-(sh*60+sm); } if (b.end_time > cur) cur = b.end_time; }
        if (cur < '18:00') { const [sh, sm] = cur.split(':').map(Number); freeMin += 18*60 - (sh*60+sm); }
        res.json({ todayMeetings: parseInt(meetings.rows[0].count), freeTimeMinutes: freeMin, freeTimeFormatted: `${Math.floor(freeMin/60)}h ${freeMin%60}m` });
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/schedules/available-slots', authenticateToken, async (req, res) => {
    try {
        const { date, duration } = req.query;
        if (!date || !duration) return res.status(400).json({ error: 'Date and duration required' });
        const scheds = await pool.query(`SELECT start_time, end_time FROM schedules WHERE schedule_date=$1 AND status='active' ORDER BY start_time`, [date]);
        const focus = await pool.query(`SELECT start_time, end_time FROM focus_sessions WHERE focus_date=$1 AND status='active' ORDER BY start_time`, [date]);
        const all = [...scheds.rows, ...focus.rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
        const dur = parseInt(duration); let cur = '09:00'; const slots = [];
        for (const b of all) { if (cur < b.start_time) { const [sh,sm]=cur.split(':').map(Number),[eh,em]=b.start_time.split(':').map(Number); if ((eh*60+em)-(sh*60+sm)>=dur) slots.push({start_time:cur,end_time:b.start_time}); } if (b.end_time>cur) cur=b.end_time; }
        if (cur < '18:00') { const [sh,sm]=cur.split(':').map(Number); if (18*60-(sh*60+sm)>=dur) slots.push({start_time:cur,end_time:'18:00'}); }
        res.json(slots);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/schedules/conflict-check', authenticateToken, async (req, res) => {
    try { const { date, startTime, endTime, excludeId } = req.query; let q=`SELECT id,title,start_time,end_time FROM schedules WHERE schedule_date=$1 AND status='active' AND ((start_time<$3 AND end_time>$2))`; const p=[date,startTime,endTime]; if(excludeId){q+=' AND id!=$4';p.push(excludeId);} const r=await pool.query(q,p); res.json({hasConflict:r.rows.length>0,conflicts:r.rows}); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/schedules/:id', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`SELECT s.*, u.full_name as creator_name FROM schedules s LEFT JOIN users u ON s.created_by=u.id WHERE s.id=$1`, [req.params.id]); if (!r.rows[0]) return res.status(404).json({error:'Not found'}); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/schedules', authenticateToken, async (req, res) => {
    try {
        const { title, description, date, startTime, endTime, scheduleType, location, participants, priority, reminderMinutes } = req.body;
        if (!title || !date || !startTime || !endTime) return res.status(400).json({ error: 'Required fields missing' });
        const conflict = await pool.query(`SELECT id FROM schedules WHERE schedule_date=$1 AND status='active' AND ((start_time<$3 AND end_time>$2))`, [date, startTime, endTime]);
        if (conflict.rows.length > 0) return res.status(409).json({ error: 'Time conflict detected' });
        const r = await pool.query(`INSERT INTO schedules (user_id,title,description,schedule_date,start_time,end_time,schedule_type,location,participants,priority,reminder_minutes,status,created_by,updated_by) VALUES ($11,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$11) RETURNING *`, [title,description,date,startTime,endTime,scheduleType||'other',location,participants||[],priority||'medium',reminderMinutes||15,req.user.id]);
        res.status(201).json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/schedules/:id', authenticateToken, async (req, res) => {
    try {
        const fields=[],values=[]; let idx=1;
        const d=req.body;
        if(d.title){fields.push(`title=$${idx++}`);values.push(d.title);}
        if(d.description!==undefined){fields.push(`description=$${idx++}`);values.push(d.description);}
        if(d.date){fields.push(`schedule_date=$${idx++}`);values.push(d.date);}
        if(d.startTime){fields.push(`start_time=$${idx++}`);values.push(d.startTime);}
        if(d.endTime){fields.push(`end_time=$${idx++}`);values.push(d.endTime);}
        if(d.scheduleType){fields.push(`schedule_type=$${idx++}`);values.push(d.scheduleType);}
        if(d.location!==undefined){fields.push(`location=$${idx++}`);values.push(d.location);}
        if(d.participants){fields.push(`participants=$${idx++}`);values.push(d.participants);}
        if(d.priority){fields.push(`priority=$${idx++}`);values.push(d.priority);}
        if(d.reminderMinutes!==undefined){fields.push(`reminder_minutes=$${idx++}`);values.push(d.reminderMinutes);}
        if(d.status){fields.push(`status=$${idx++}`);values.push(d.status);}
        fields.push(`updated_by=$${idx++}`);values.push(req.user.id);
        fields.push('updated_at=NOW()');values.push(req.params.id);
        const r=await pool.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,values);
        res.json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/schedules/:id/status', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE schedules SET status=$1, updated_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`, [req.body.status, req.user.id, req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Availability =====
app.get('/api/availability', authenticateToken, async (req, res) => {
    try { const r = await pool.query('SELECT * FROM availability WHERE user_id=$1 ORDER BY day_of_week,start_time', [req.user.id]); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/availability/today', authenticateToken, async (_req, res) => {
    try { const today = new Date().getDay(); const r = await pool.query(`SELECT a.*, u.full_name FROM availability a LEFT JOIN users u ON a.user_id=u.id WHERE a.day_of_week=$1 AND a.is_available=true ORDER BY a.start_time`, [today]); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/availability', authenticateToken, async (req, res) => {
    try {
        const { dayOfWeek, startTime, endTime, isAvailable, label } = req.body;
        const existing = await pool.query('SELECT id FROM availability WHERE user_id=$1 AND day_of_week=$2 AND start_time=$3 AND end_time=$4', [req.user.id, dayOfWeek, startTime, endTime]);
        let r;
        if (existing.rows.length > 0) r = await pool.query(`UPDATE availability SET is_available=$1, label=$2, updated_at=NOW() WHERE id=$3 RETURNING *`, [isAvailable!==false, label||null, existing.rows[0].id]);
        else r = await pool.query(`INSERT INTO availability (user_id,day_of_week,start_time,end_time,is_available,label) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.user.id,dayOfWeek,startTime,endTime,isAvailable!==false,label||null]);
        res.json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/availability/:id', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM availability WHERE id=$1', [req.params.id]); res.json({ message: 'Removed' }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Bookings =====
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try { const { status } = req.query; let q=`SELECT b.*, u.full_name as handled_by_name FROM bookings b LEFT JOIN users u ON b.handled_by=u.id`; const p=[]; if(status&&status!=='all'){q+=' WHERE b.status=$1';p.push(status);} q+=' ORDER BY b.booking_date DESC'; const r=await pool.query(q,p); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/bookings/pending-count', authenticateToken, async (_req, res) => {
    try { const r = await pool.query(`SELECT COUNT(*) as count FROM bookings WHERE status='pending'`); res.json({ count: parseInt(r.rows[0].count) }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/bookings/:id', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`SELECT b.*, u.full_name as handled_by_name FROM bookings b LEFT JOIN users u ON b.handled_by=u.id WHERE b.id=$1`, [req.params.id]); if(!r.rows[0]) return res.status(404).json({error:'Not found'}); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const { name, email, company, purpose, date, time, duration, notes } = req.body;
        if (!name || !email || !purpose || !date || !time) return res.status(400).json({ error: 'Required fields missing' });
        const r = await pool.query(`INSERT INTO bookings (booked_by_name,booked_by_email,company,purpose,booking_date,preferred_time,duration,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9) RETURNING *`, [name,email,company,purpose,date,time,duration||30,notes,req.user.id]);
        res.status(201).json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/bookings/:id/status', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE bookings SET status=$1, handled_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`, [req.body.status, req.user.id, req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Reminders =====
app.get('/api/reminders', authenticateToken, async (req, res) => {
    try { const { status } = req.query; let q='SELECT * FROM reminders WHERE user_id=$1'; const p=[req.user.id]; if(status&&status!=='all'){q+=' AND status=$2';p.push(status);} q+=' ORDER BY reminder_date,reminder_time'; const r=await pool.query(q,p); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/reminders/active', authenticateToken, async (req, res) => {
    try { const today = new Date().toISOString().split('T')[0]; const r = await pool.query(`SELECT * FROM reminders WHERE user_id=$1 AND status='active' AND reminder_date<=$2 ORDER BY reminder_time`, [req.user.id, today]); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/reminders/pending-count', authenticateToken, async (req, res) => {
    try { const today = new Date().toISOString().split('T')[0]; const r = await pool.query(`SELECT COUNT(*) as count FROM reminders WHERE user_id=$1 AND status='active' AND reminder_date<=$2`, [req.user.id, today]); res.json({ count: parseInt(r.rows[0].count) }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/reminders/:id', authenticateToken, async (req, res) => {
    try { const r = await pool.query('SELECT * FROM reminders WHERE id=$1', [req.params.id]); if(!r.rows[0]) return res.status(404).json({error:'Not found'}); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/reminders', authenticateToken, async (req, res) => {
    try {
        const { title, description, date, time, repeatType, priority } = req.body;
        if (!title || !date || !time) return res.status(400).json({ error: 'Required fields missing' });
        const r = await pool.query(`INSERT INTO reminders (user_id,title,description,reminder_date,reminder_time,repeat_type,priority,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$1) RETURNING *`, [req.user.id,title,description,date,time,repeatType||'once',priority||'medium']);
        res.status(201).json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/reminders/:id', authenticateToken, async (req, res) => {
    try {
        const fields=[],values=[]; let idx=1; const d=req.body;
        if(d.title){fields.push(`title=$${idx++}`);values.push(d.title);}
        if(d.description!==undefined){fields.push(`description=$${idx++}`);values.push(d.description);}
        if(d.date){fields.push(`reminder_date=$${idx++}`);values.push(d.date);}
        if(d.time){fields.push(`reminder_time=$${idx++}`);values.push(d.time);}
        if(d.repeatType){fields.push(`repeat_type=$${idx++}`);values.push(d.repeatType);}
        if(d.priority){fields.push(`priority=$${idx++}`);values.push(d.priority);}
        if(d.status){fields.push(`status=$${idx++}`);values.push(d.status);}
        fields.push('updated_at=NOW()');values.push(req.params.id);
        const r=await pool.query(`UPDATE reminders SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,values);
        res.json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/reminders/:id/complete', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE reminders SET status='completed', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Tasks =====
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try { const { status } = req.query; let q=`SELECT t.*, u.full_name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id WHERE t.user_id=$1`; const p=[req.user.id]; if(status&&status!=='all'){q+=' AND t.status=$2';p.push(status);} q+=" ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END"; const r=await pool.query(q,p); res.json(r.rows); }
    catch(e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.get('/api/tasks/counts', authenticateToken, async (req, res) => {
    try {
        const [pending,today,completed] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND status IN ('pending','in_progress','reopened')`, [req.user.id]),
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND due_date=$2 AND status IN ('pending','in_progress','reopened')`, [req.user.id, new Date().toISOString().split('T')[0]]),
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND status='completed'`, [req.user.id])
        ]);
        res.json({ pending: parseInt(pending.rows[0].count), today: parseInt(today.rows[0].count), completed: parseInt(completed.rows[0].count) });
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`SELECT t.*, u.full_name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id WHERE t.id=$1`, [req.params.id]); if(!r.rows[0]) return res.status(404).json({error:'Not found'}); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, description, dueDate, priority, assignedTo } = req.body;
        if (!title) return res.status(400).json({ error: 'Title required' });
        const r = await pool.query(`INSERT INTO tasks (user_id,title,description,due_date,priority,status,assigned_to,created_by) VALUES ($1,$2,$3,$4,$5,'pending',$6,$1) RETURNING *`, [req.user.id,title,description,dueDate,priority||'medium',assignedTo||req.user.id]);
        res.status(201).json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const fields=[],values=[]; let idx=1; const d=req.body;
        if(d.title){fields.push(`title=$${idx++}`);values.push(d.title);}
        if(d.description!==undefined){fields.push(`description=$${idx++}`);values.push(d.description);}
        if(d.dueDate){fields.push(`due_date=$${idx++}`);values.push(d.dueDate);}
        if(d.priority){fields.push(`priority=$${idx++}`);values.push(d.priority);}
        if(d.status){fields.push(`status=$${idx++}`);values.push(d.status);if(d.status==='completed')fields.push('completed_at=NOW()');if(d.status==='reopened')fields.push('completed_at=NULL');}
        if(d.assignedTo){fields.push(`assigned_to=$${idx++}`);values.push(d.assignedTo);}
        fields.push('updated_at=NOW()');values.push(req.params.id);
        const r=await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,values);
        res.json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/tasks/:id/complete', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE tasks SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/tasks/:id/reopen', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE tasks SET status='reopened', completed_at=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Notifications =====
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try { const { unread } = req.query; let q='SELECT * FROM notifications WHERE user_id=$1'; const p=[req.user.id]; if(unread==='true'){q+=' AND is_read=false';} q+=' ORDER BY created_at DESC'; const r=await pool.query(q,p); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`SELECT COUNT(*) as count FROM notifications WHERE user_id=$1 AND is_read=false`, [req.user.id]); res.json({ count: parseInt(r.rows[0].count) }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try { await pool.query(`UPDATE notifications SET is_read=true WHERE id=$1`, [req.params.id]); res.json({ message: 'Done' }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try { await pool.query(`UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]); res.json({ message: 'Done' }); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Focus Sessions =====
app.get('/api/focus', authenticateToken, async (req, res) => {
    try { const date = req.query.date || new Date().toISOString().split('T')[0]; const r = await pool.query(`SELECT * FROM focus_sessions WHERE focus_date=$1 AND status='active' ORDER BY start_time`, [date]); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/focus', authenticateToken, async (req, res) => {
    try {
        const { title, date, startTime, endTime } = req.body;
        if (!date || !startTime || !endTime) return res.status(400).json({ error: 'Required fields missing' });
        const r = await pool.query(`INSERT INTO focus_sessions (user_id,title,focus_date,start_time,end_time,status,created_by) VALUES ($1,$2,$3,$4,$5,'active',$1) RETURNING *`, [req.user.id,title||'Focus Time',date,startTime,endTime]);
        res.status(201).json(r.rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/focus/:id/cancel', authenticateToken, async (req, res) => {
    try { const r = await pool.query(`UPDATE focus_sessions SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]); res.json(r.rows[0]); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Audit =====
app.get('/api/audit', authenticateToken, async (req, res) => {
    try { const limit = parseInt(req.query.limit) || 50; const r = await pool.query(`SELECT a.*, u.full_name as user_name FROM audit_logs a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.created_at DESC LIMIT $1`, [limit]); res.json(r.rows); }
    catch { res.status(500).json({ error: 'Failed' }); }
});

// ===== Public Booking (No Auth Required) =====
app.get('/api/public/availability', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Date required' });
        const scheds = await pool.query(`SELECT start_time, end_time FROM schedules WHERE schedule_date=$1 AND status='active' ORDER BY start_time`, [date]);
        const focus = await pool.query(`SELECT start_time, end_time FROM focus_sessions WHERE focus_date=$1 AND status='active' ORDER BY start_time`, [date]);
        const booked = await pool.query(`SELECT preferred_time, duration FROM bookings WHERE booking_date=$1 AND status IN ('pending','accepted') ORDER BY preferred_time`, [date]);
        const all = [...scheds.rows, ...focus.rows];
        const bookedSlots = booked.rows.map(b => {
            const [h,m] = b.preferred_time.split(':').map(Number);
            const endMin = h*60+m+parseInt(b.duration);
            return { start_time: b.preferred_time, end_time: `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}` };
        });
        const allBusy = [...all, ...bookedSlots].sort((a,b) => a.start_time.localeCompare(b.start_time));
        let cur = '09:00'; const free = [];
        for (const b of allBusy) { if (cur < b.start_time) { free.push({ start_time: cur, end_time: b.start_time }); } if (b.end_time > cur) cur = b.end_time; }
        if (cur < '18:00') free.push({ start_time: cur, end_time: '18:00' });
        res.json({ date, available: free });
    } catch (e) { res.status(500).json({ error: 'Failed to check availability' }); }
});

app.get('/api/public/schedule', async (req, res) => {
    try {
        const r = await pool.query(`SELECT schedule_date, start_time, end_time, title, schedule_type FROM schedules WHERE schedule_date >= CURRENT_DATE AND status='active' AND schedule_type != 'personal' ORDER BY schedule_date, start_time`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/public/bookings', async (req, res) => {
    try {
        const { name, phone, email, company, purpose, date, time, duration, notes } = req.body;
        if (!name || !phone || !purpose || !date || !time) return res.status(400).json({ error: 'Name, phone, purpose, date and time are required' });
        const conflict = await pool.query(`SELECT id FROM bookings WHERE booking_date=$1 AND preferred_time=$2 AND status IN ('pending','accepted')`, [date, time]);
        if (conflict.rows.length > 0) return res.status(409).json({ error: 'This time slot is already booked. Please choose another.' });
        const ceoUser = await pool.query(`SELECT id FROM users WHERE role='ceo' LIMIT 1`);
        const coordUser = await pool.query(`SELECT id FROM users WHERE role='coordinator' LIMIT 1`);
        const ceoId = ceoUser.rows[0]?.id;
        const coordId = coordUser.rows[0]?.id;
        const booking = await pool.query(
            `INSERT INTO bookings (booked_by_name,booked_by_email,booked_by_phone,company,purpose,booking_date,preferred_time,duration,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING *`,
            [name, email||'', phone, company||'', purpose, date, time, duration||30, notes||'']
        );
        const newBooking = booking.rows[0];
        if (ceoId) {
            await pool.query(
                `INSERT INTO notifications (user_id,from_user_id,title,message,action_type,record_type,record_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [ceoId, null, 'New Booking Request', `${name} wants to meet on ${date} at ${time}. Purpose: ${purpose}. Phone: ${phone}. Duration: ${duration||30}min.`, 'booking_created', 'booking', newBooking.id]
            );
        }
        if (coordId && coordId !== ceoId) {
            await pool.query(
                `INSERT INTO notifications (user_id,from_user_id,title,message,action_type,record_type,record_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [coordId, null, 'New Booking Request', `${name} wants to meet on ${date} at ${time}. Purpose: ${purpose}. Phone: ${phone}. Duration: ${duration||30}min. Please review.`, 'booking_created', 'booking', newBooking.id]
            );
        }
        res.status(201).json({ message: 'Booking request submitted successfully! You will be contacted soon.', booking: newBooking });
    } catch (e) { res.status(500).json({ error: 'Failed to submit booking' }); }
});

// ===== Health =====
app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });

module.exports = app;
