import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import availabilityRoutes from './routes/availabilityRoutes';
import bookingRoutes from './routes/bookingRoutes';
import reminderRoutes from './routes/reminderRoutes';
import taskRoutes from './routes/taskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import focusRoutes from './routes/focusRoutes';
import auditRoutes from './routes/auditRoutes';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const staticPath = process.env.VERCEL
    ? path.join(process.cwd(), 'public')
    : path.join(__dirname, '../../frontend');

app.use(express.static(staticPath));

app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (_req, res) => {
    if (_req.path.includes('.')) {
        res.status(404).send('Not found');
    } else {
        res.sendFile(path.join(staticPath, 'index.html'));
    }
});

app.use(errorHandler);
app.use(notFoundHandler);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason: any) => {
    console.error('Unhandled Rejection:', reason?.message || reason);
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Next360 CEO Command Center running on http://localhost:${PORT}`);
    });
}

export default app;
