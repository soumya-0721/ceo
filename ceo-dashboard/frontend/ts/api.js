const API_BASE = '/api';

class ApiService {
    constructor() {
        this.token = null;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    getToken() {
        if (!this.token) this.token = localStorage.getItem('token');
        return this.token;
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            this.clearToken();
            window.location.reload();
            throw new Error('Unauthorized');
        }

        const data = await response.json();
        if (!response.ok) throw { status: response.status, ...data };
        return data;
    }

    get(endpoint) { return this.request(endpoint); }
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }

    login(username, password) { return this.post('/auth/login', { username, password }); }
    logout() { return this.post('/auth/logout', {}); }
    getMe() { return this.get('/auth/me'); }

    getSchedules(date, startDate, endDate) {
        let q = '/schedules?';
        if (date) q += `date=${date}`;
        else if (startDate && endDate) q += `startDate=${startDate}&endDate=${endDate}`;
        return this.get(q);
    }
    getScheduleStats() { return this.get('/schedules/stats'); }
    getAvailableSlots(date, duration) { return this.get(`/schedules/available-slots?date=${date}&duration=${duration}`); }
    checkConflict(date, startTime, endTime, excludeId) {
        let q = `/schedules/conflict-check?date=${date}&startTime=${startTime}&endTime=${endTime}`;
        if (excludeId) q += `&excludeId=${excludeId}`;
        return this.get(q);
    }
    createSchedule(data) { return this.post('/schedules', data); }
    updateSchedule(id, data) { return this.put(`/schedules/${id}`, data); }
    updateScheduleStatus(id, status) { return this.patch(`/schedules/${id}/status`, { status }); }

    getAvailability() { return this.get('/availability'); }
    getTodayAvailability() { return this.get('/availability/today'); }
    upsertAvailability(data) { return this.post('/availability', data); }
    deleteAvailability(id) { return this.delete(`/availability/${id}`); }

    getBookings(status) { return this.get(`/bookings${status ? `?status=${status}` : ''}`); }
    getPendingBookingsCount() { return this.get('/bookings/pending-count'); }
    createBooking(data) { return this.post('/bookings', data); }
    updateBookingStatus(id, status) { return this.patch(`/bookings/${id}/status`, { status }); }

    getReminders(status) { return this.get(`/reminders${status ? `?status=${status}` : ''}`); }
    getActiveReminders() { return this.get('/reminders/active'); }
    getPendingRemindersCount() { return this.get('/reminders/pending-count'); }
    createReminder(data) { return this.post('/reminders', data); }
    updateReminder(id, data) { return this.put(`/reminders/${id}`, data); }
    completeReminder(id) { return this.patch(`/reminders/${id}/complete`); }

    getTasks(status) { return this.get(`/tasks${status ? `?status=${status}` : ''}`); }
    getTaskCounts() { return this.get('/tasks/counts'); }
    createTask(data) { return this.post('/tasks', data); }
    updateTask(id, data) { return this.put(`/tasks/${id}`, data); }
    completeTask(id) { return this.patch(`/tasks/${id}/complete`); }
    reopenTask(id) { return this.patch(`/tasks/${id}/reopen`); }

    getNotifications(unreadOnly) { return this.get(`/notifications${unreadOnly ? '?unread=true' : ''}`); }
    getUnreadNotifCount() { return this.get('/notifications/unread-count'); }
    markNotifRead(id) { return this.patch(`/notifications/${id}/read`); }
    markAllNotifsRead() { return this.patch('/notifications/read-all'); }

    getFocusSessions(date) { return this.get(`/focus${date ? `?date=${date}` : ''}`); }
    createFocusSession(data) { return this.post('/focus', data); }
    cancelFocusSession(id) { return this.patch(`/focus/${id}/cancel`); }

    getAuditLogs(limit) { return this.get(`/audit${limit ? `?limit=${limit}` : ''}`); }
    getAuditByRecord(recordType, recordId) { return this.get(`/audit/${recordType}/${recordId}`); }

    createPublicBooking(data) {
        return fetch('/api/bookings/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(r => r.json());
    }

    exportBookingsExcel() { return this.get('/bookings/export'); }
}

const api = new ApiService();
