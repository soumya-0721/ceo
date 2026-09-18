"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const scheduleRoutes_1 = __importDefault(require("./routes/scheduleRoutes"));
const availabilityRoutes_1 = __importDefault(require("./routes/availabilityRoutes"));
const bookingRoutes_1 = __importDefault(require("./routes/bookingRoutes"));
const reminderRoutes_1 = __importDefault(require("./routes/reminderRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const focusRoutes_1 = __importDefault(require("./routes/focusRoutes"));
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000');
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
const staticPath = process.env.VERCEL
    ? path_1.default.join(process.cwd(), 'ceo-dashboard/frontend')
    : path_1.default.join(__dirname, '../../frontend');
app.use(express_1.default.static(staticPath));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/schedules', scheduleRoutes_1.default);
app.use('/api/availability', availabilityRoutes_1.default);
app.use('/api/bookings', bookingRoutes_1.default);
app.use('/api/reminders', reminderRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/focus', focusRoutes_1.default);
app.use('/api/audit', auditRoutes_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('*', (_req, res) => {
    if (_req.path.includes('.')) {
        res.status(404).send('Not found');
    }
    else {
        res.sendFile(path_1.default.join(staticPath, 'index.html'));
    }
});
app.use(errorHandler_1.errorHandler);
app.use(errorHandler_1.notFoundHandler);
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason?.message || reason);
});
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Next360 CEO Command Center running on http://localhost:${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map