const API_BASE = '/api';

interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
    hasConflict?: boolean;
    conflicts?: any[];
    suggestedSlots?: any[];
}

class ApiService {
    private token: string | null = null;

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    getToken(): string | null {
        if (!this.token) this.token = localStorage.getItem('token');
        return this.token;
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const token = this.getToken();
        const headers: any = { 'Content-Type': 'application/json', ...options.headers };
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

    get<T>(endpoint: string): Promise<T> { return this.request<T>(endpoint); }
    post<T>(endpoint: string, body: any): Promise<T> { return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    put<T>(endpoint: string, body: any): Promise<T> { return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    patch<T>(endpoint: string, body?: any): Promise<T> { return this.request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
    delete<T>(endpoint: string): Promise<T> { return this.request<T>(endpoint, { method: 'DELETE' }); }

    // Auth
    login(username: string, password: string) { return this.post<any>('/auth/login', { username, password }); }
    logout() { return this.post<any>('/auth/logout', {}); }
    getMe() { return this.get<any>('/auth/me'); }

    // Schedules
    getSchedules(date?: string, startDate?: string, endDate?: string) {
        let q = '/schedules?';
        if (date) q += `date=${date}`;
        else if (startDate && endDate) q += `startDate=${startDate}&endDate=${endDate}`;
        return this.get<any[]>(q);
    }
    getScheduleStats() { return this.get<any>('/schedules/stats'); }
    getAvailableSlots(date: string, duration: number) { return this.get<any[]>(`/schedules/available-slots?date=${date}&duration=${duration}`); }
    checkConflict(date: string, startTime: string, endTime: string, excludeId?: string) {
        let q = `/schedules/conflict-check?date=${date}&startTime=${startTime}&endTime=${endTime}`;
        if (excludeId) q += `&excludeId=${excludeId}`;
        return this.get<any>(q);
    }
    createSchedule(data: any) { return this.post<any>('/schedules', data); }
    updateSchedule(id: string, data: any) { return this.put<any>(`/schedules/${id}`, data); }
    updateScheduleStatus(id: string, status: string) { return this.patch<any>(`/schedules/${id}/status`, { status }); }

    // Availability
    getAvailability() { return this.get<any[]>('/availability'); }
    getTodayAvailability() { return this.get<any[]>('/availability/today'); }
    upsertAvailability(data: any) { return this.post<any>('/availability', data); }
    deleteAvailability(id: string) { return this.delete<any>(`/availability/${id}`); }

    // Bookings
    getBookings(status?: string) { return this.get<any[]>(`/bookings${status ? `?status=${status}` : ''}`); }
    getPendingBookingsCount() { return this.get<any>('/bookings/pending-count'); }
    createBooking(data: any) { return this.post<any>('/bookings', data); }
    updateBookingStatus(id: string, status: string) { return this.patch<any>(`/bookings/${id}/status`, { status }); }

    // Reminders
    getReminders(status?: string) { return this.get<any[]>(`/reminders${status ? `?status=${status}` : ''}`); }
    getActiveReminders() { return this.get<any[]>('/reminders/active'); }
    getPendingRemindersCount() { return this.get<any>('/reminders/pending-count'); }
    createReminder(data: any) { return this.post<any>('/reminders', data); }
    updateReminder(id: string, data: any) { return this.put<any>(`/reminders/${id}`, data); }
    completeReminder(id: string) { return this.patch<any>(`/reminders/${id}/complete`); }

    // Tasks
    getTasks(status?: string) { return this.get<any[]>(`/tasks${status ? `?status=${status}` : ''}`); }
    getTaskCounts() { return this.get<any>('/tasks/counts'); }
    createTask(data: any) { return this.post<any>('/tasks', data); }
    updateTask(id: string, data: any) { return this.put<any>(`/tasks/${id}`, data); }
    completeTask(id: string) { return this.patch<any>(`/tasks/${id}/complete`); }
    reopenTask(id: string) { return this.patch<any>(`/tasks/${id}/reopen`); }

    // Notifications
    getNotifications(unreadOnly?: boolean) { return this.get<any[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`); }
    getUnreadNotifCount() { return this.get<any>('/notifications/unread-count'); }
    markNotifRead(id: string) { return this.patch<any>(`/notifications/${id}/read`); }
    markAllNotifsRead() { return this.patch<any>('/notifications/read-all'); }

    // Focus
    getFocusSessions(date?: string) { return this.get<any[]>(`/focus${date ? `?date=${date}` : ''}`); }
    createFocusSession(data: any) { return this.post<any>('/focus', data); }
    cancelFocusSession(id: string) { return this.patch<any>(`/focus/${id}/cancel`); }

    // Audit
    getAuditLogs(limit?: number) { return this.get<any[]>(`/audit${limit ? `?limit=${limit}` : ''}`); }
    getAuditByRecord(recordType: string, recordId: string) { return this.get<any[]>(`/audit/${recordType}/${recordId}`); }

    // Public Booking (no auth)
    createPublicBooking(data: any) {
        return fetch('/api/bookings/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(r => r.json());
    }

    // Excel
    exportBookingsExcel() { return this.get<any[]>('/bookings/export'); }
}

const api = new ApiService();
