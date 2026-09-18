const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

process.env.VERCEL = process.env.VERCEL || '1';

const { default: authRoutes } = require('../ceo-dashboard/backend/dist/routes/authRoutes');
const { default: scheduleRoutes } = require('../ceo-dashboard/backend/dist/routes/scheduleRoutes');
const { default: availabilityRoutes } = require('../ceo-dashboard/backend/dist/routes/availabilityRoutes');
const { default: bookingRoutes } = require('../ceo-dashboard/backend/dist/routes/bookingRoutes');
const { default: reminderRoutes } = require('../ceo-dashboard/backend/dist/routes/reminderRoutes');
const { default: taskRoutes } = require('../ceo-dashboard/backend/dist/routes/taskRoutes');
const { default: notificationRoutes } = require('../ceo-dashboard/backend/dist/routes/notificationRoutes');
const { default: focusRoutes } = require('../ceo-dashboard/backend/dist/routes/focusRoutes');
const { default: auditRoutes } = require('../ceo-dashboard/backend/dist/routes/auditRoutes');
const { errorHandler, notFoundHandler } = require('../ceo-dashboard/backend/dist/middleware/errorHandler');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

app.use(errorHandler);
app.use(notFoundHandler);

module.exports = app;
