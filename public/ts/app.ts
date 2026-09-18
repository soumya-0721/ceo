declare var bootstrap: any;
let currentUser: any = null;
let currentPage = 'dashboard';
let currentPageDate = new Date();

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    if (api.getToken()) {
        loadApp();
    } else {
        showLogin();
    }
    initLoginForm();
});

function showLogin() {
    document.getElementById('login-screen')!.classList.remove('d-none');
    document.getElementById('app-screen')!.classList.add('d-none');
}

function showApp() {
    document.getElementById('login-screen')!.classList.add('d-none');
    document.getElementById('app-screen')!.classList.remove('d-none');
    buildSidebar();
    showPage('dashboard');
    startNotifPolling();
    showWelcomeGreeting();
    checkWeeklyExportReminder();
}

function showWelcomeGreeting() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const name = currentUser?.fullName || currentUser?.full_name || 'User';

    const toastEl = document.createElement('div');
    toastEl.className = 'toast toast-premium align-items-center border-0';
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi bi-hand-wave" style="color:var(--gold);font-size:18px"></i>
                <span><strong>${greeting}, ${name}!</strong></span>
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.getElementById('toast-container')!.appendChild(toastEl);
    const toast = new (window as any).bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
}

function checkWeeklyExportReminder() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastDismissed = localStorage.getItem('weeklyExportDismissed');
    const todayKey = now.toISOString().split('T')[0];

    if (lastDismissed === todayKey) return;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const toastEl = document.createElement('div');
        toastEl.className = 'toast toast-premium align-items-center border-0';
        toastEl.setAttribute('role', 'alert');
        toastEl.style.borderLeft = '4px solid var(--gold)';
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body d-flex align-items-start gap-2">
                    <i class="bi bi-cloud-download" style="color:var(--gold);font-size:20px;margin-top:2px;"></i>
                    <div>
                        <strong style="font-size:13px;">Weekly Export Reminder</strong>
                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">It's the end of the week. Export your data to keep a backup.</div>
                        <div style="margin-top:8px;display:flex;gap:8px;">
                            <button class="btn btn-sm btn-gold" onclick="showPage('excel')" style="font-size:11px;padding:4px 12px;">Export Now</button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="dismissWeeklyReminder()" style="font-size:11px;padding:4px 12px;">Dismiss</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('toast-container')!.appendChild(toastEl);
        const toast = new (window as any).bootstrap.Toast(toastEl, { delay: 30000 });
        toast.show();
    }
}

function dismissWeeklyReminder() {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem('weeklyExportDismissed', todayKey);
}

function exportAllData() {
    showToast('Preparing full export...', 'info');

    Promise.all([
        api.getSchedules(undefined, getWeekAgoDate(), getTodayDate()),
        api.getBookings(),
        api.getTasks(),
        api.getReminders(),
        api.getNotifications(),
        api.getFocusSessions()
    ]).then(([schedules, bookings, tasks, reminders, notifications, focus]) => {
        const wb = (window as any).XLSX.utils.book_new();
        const today = getTodayDate();

        if (schedules.length) {
            const scheduleData = schedules.map((s: any) => ({
                'Title': s.title,
                'Description': s.description || '',
                'Date': s.schedule_date,
                'Start Time': formatTime12(s.start_time?.substring(0,5)),
                'End Time': formatTime12(s.end_time?.substring(0,5)),
                'Type': (s.schedule_type || 'other').replace('_', ' '),
                'Location': s.location || '',
                'Participants': Array.isArray(s.participants) ? s.participants.join(', ') : (s.participants || ''),
                'Priority': s.priority || 'medium',
                'Status': s.status || 'active',
                'Reminder': s.reminder_minutes + ' min'
            }));
            const ws = (window as any).XLSX.utils.json_to_sheet(scheduleData);
            (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Schedules');
        }

        if (bookings.length) {
            const bookingData = bookings.map((b: any) => ({
                'Name': b.booked_by_name,
                'Email': b.booked_by_email,
                'Company': b.company || '',
                'Phone': b.phone || '',
                'Address': b.address || '',
                'Place': b.place || '',
                'Purpose': b.purpose || '',
                'Topic': b.what || '',
                'Date': b.booking_date,
                'Time': formatTime12(b.preferred_time?.substring(0,5)),
                'Duration': (b.duration || 30) + ' min',
                'Frequency': b.frequency || 'one-time',
                'Visitor Type': b.visitor_type || 'external',
                'Status': b.status || 'pending',
                'Notes': b.notes || ''
            }));
            const ws = (window as any).XLSX.utils.json_to_sheet(bookingData);
            (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
        }

        if (tasks.length) {
            const taskData = tasks.map((t: any) => ({
                'Title': t.title,
                'Description': t.description || '',
                'Due Date': t.due_date || '',
                'Priority': t.priority || 'medium',
                'Status': t.status || 'pending'
            }));
            const ws = (window as any).XLSX.utils.json_to_sheet(taskData);
            (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
        }

        if (reminders.length) {
            const reminderData = reminders.map((r: any) => ({
                'Title': r.title,
                'Description': r.description || '',
                'Date': r.reminder_date,
                'Time': formatTime12(r.reminder_time?.substring(0,5)),
                'Repeat': r.repeat_type || 'once',
                'Priority': r.priority || 'medium',
                'Status': r.status || 'pending'
            }));
            const ws = (window as any).XLSX.utils.json_to_sheet(reminderData);
            (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Reminders');
        }

        if (focus.length) {
            const focusData = focus.map((f: any) => ({
                'Title': f.title || 'Focus Time',
                'Date': f.focus_date,
                'Start': formatTime12(f.start_time?.substring(0,5)),
                'End': formatTime12(f.end_time?.substring(0,5)),
                'Status': f.status || 'active'
            }));
            const ws = (window as any).XLSX.utils.json_to_sheet(focusData);
            (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Focus Sessions');
        }

        if (wb.SheetNames.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        (window as any).XLSX.writeFile(wb, `next360_full_export_${today}.xlsx`);
        showToast(`Exported ${wb.SheetNames.length} sheets successfully`);
    }).catch(() => showToast('Failed to export data', 'danger'));
}

function exportSchedulesExcel() {
    api.getSchedules(undefined, getWeekAgoDate(), getTodayDate()).then((schedules: any[]) => {
        if (!schedules.length) { showToast('No schedules to export', 'warning'); return; }
        const data = schedules.map((s: any) => ({
            'Title': s.title,
            'Description': s.description || '',
            'Date': s.schedule_date,
            'Start Time': formatTime12(s.start_time?.substring(0,5)),
            'End Time': formatTime12(s.end_time?.substring(0,5)),
            'Type': (s.schedule_type || 'other').replace('_', ' '),
            'Location': s.location || '',
            'Participants': Array.isArray(s.participants) ? s.participants.join(', ') : (s.participants || ''),
            'Priority': s.priority || 'medium',
            'Status': s.status || 'active'
        }));
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Schedules');
        (window as any).XLSX.writeFile(wb, `next360_schedules_${getTodayDate()}.xlsx`);
        showToast('Schedules exported');
    }).catch(() => showToast('Failed to export', 'danger'));
}

function exportTasksExcel() {
    api.getTasks().then((tasks: any[]) => {
        if (!tasks.length) { showToast('No tasks to export', 'warning'); return; }
        const data = tasks.map((t: any) => ({
            'Title': t.title,
            'Description': t.description || '',
            'Due Date': t.due_date || '',
            'Priority': t.priority || 'medium',
            'Status': t.status || 'pending'
        }));
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
        (window as any).XLSX.writeFile(wb, `next360_tasks_${getTodayDate()}.xlsx`);
        showToast('Tasks exported');
    }).catch(() => showToast('Failed to export', 'danger'));
}

function exportRemindersExcel() {
    api.getReminders().then((reminders: any[]) => {
        if (!reminders.length) { showToast('No reminders to export', 'warning'); return; }
        const data = reminders.map((r: any) => ({
            'Title': r.title,
            'Description': r.description || '',
            'Date': r.reminder_date,
            'Time': formatTime12(r.reminder_time?.substring(0,5)),
            'Repeat': r.repeat_type || 'once',
            'Priority': r.priority || 'medium',
            'Status': r.status || 'pending'
        }));
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Reminders');
        (window as any).XLSX.writeFile(wb, `next360_reminders_${getTodayDate()}.xlsx`);
        showToast('Reminders exported');
    }).catch(() => showToast('Failed to export', 'danger'));
}

function getTodayDate() { return new Date().toISOString().split('T')[0]; }
function getWeekAgoDate() { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }

function initLoginForm() {
    document.getElementById('login-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = (document.getElementById('login-username') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;
        const btn = document.getElementById('login-btn')!;
        const errEl = document.getElementById('login-error')!;

        btn.querySelector('.btn-text')!.classList.add('d-none');
        btn.querySelector('.btn-spinner')!.classList.remove('d-none');
        errEl.classList.add('d-none');

        try {
            const result = await api.login(username, password);
            api.setToken(result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            currentUser = result.user;
            showApp();
        } catch (err: any) {
            errEl.textContent = err.error || 'Login failed';
            errEl.classList.remove('d-none');
        } finally {
            btn.querySelector('.btn-text')!.classList.remove('d-none');
            btn.querySelector('.btn-spinner')!.classList.add('d-none');
        }
    });
}

async function loadApp() {
    try {
        currentUser = await api.getMe();
        localStorage.setItem('user', JSON.stringify(currentUser));
        showApp();
    } catch {
        api.clearToken();
        showLogin();
    }
}

// ===== Sidebar =====
function buildSidebar() {
    const initial = currentUser?.fullName?.[0] || currentUser?.full_name?.[0] || 'U';
    const role = currentUser?.role === 'ceo' ? 'CEO' : 'Coordinator';

    const menuItems = [
        { id: 'dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
        { id: 'calendar', icon: 'bi-calendar3', label: 'Calendar' },
        { id: 'schedule', icon: 'bi-clock-history', label: "Today's Schedule" },
        { id: 'availability', icon: 'bi-toggle2-on', label: 'Availability' },
        { id: 'bookings', icon: 'bi-calendar-check', label: 'Bookings' },
        { id: 'reminders', icon: 'bi-bell', label: 'Reminders' },
        { id: 'tasks', icon: 'bi-list-task', label: 'Tasks' },
        { id: 'notifications', icon: 'bi-inbox', label: 'Notifications' },
        { id: 'excel', icon: 'bi-file-earmark-excel', label: 'Excel Data' },
        { id: 'settings', icon: 'bi-gear', label: 'Settings' },
    ];

    const html = `
        <div class="sidebar-brand">
            <img src="img/Screenshot 2026-08-13 113539.png" alt="Next360" style="width:38px;height:38px;border-radius:10px;">
            <span>Next360</span>
        </div>
        <div class="sidebar-nav">
            ${menuItems.map(m => `
                <div class="nav-item" data-page="${m.id}" onclick="showPage('${m.id}')">
                    <i class="bi ${m.icon}"></i>
                    <span>${m.label}</span>
                    ${m.id === 'notifications' ? '<span class="badge rounded-pill d-none" id="notif-badge" style="background:var(--danger);color:white;font-size:10px;margin-left:auto;">0</span>' : ''}
                    ${m.id === 'bookings' ? '<span class="badge rounded-pill d-none" id="booking-badge" style="background:var(--warning);color:white;font-size:10px;margin-left:auto;">0</span>' : ''}
                </div>
            `).join('')}
        </div>
        <div class="sidebar-decoration">
            <div class="deco-text">"Better Decisions for a Healthier Tomorrow"</div>
        </div>
        <div class="sidebar-footer">
            <div class="user-info">
                <img src="${currentUser?.role === 'ceo' ? 'img/Screenshot 2026-08-20 162312.png' : 'img/soumya-photo.svg'}" alt="${currentUser?.full_name}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
                <div style="flex:1;">
                    <div class="user-name">${currentUser?.fullName || currentUser?.full_name || 'User'}</div>
                    <div class="user-role">${role}</div>
                </div>
                <button class="btn btn-link p-0" onclick="handleLogout()" title="Logout" style="color:var(--text-muted);">
                    <i class="bi bi-box-arrow-right"></i>
                </button>
            </div>
        </div>
    `;

    document.getElementById('desktop-sidebar')!.innerHTML = html;
    document.getElementById('mobile-sidebar-content')!.innerHTML = `
        <div class="sidebar-nav">
            ${menuItems.map(m => `
                <div class="nav-item" data-page="${m.id}" onclick="showPage('${m.id}'); bootstrap.Offcanvas.getInstance(document.getElementById('sidebar-offcanvas'))?.hide();">
                    <i class="bi ${m.icon}"></i><span>${m.label}</span>
                </div>
            `).join('')}
        </div>
        <div class="sidebar-footer">
            <div class="user-info">
                <img src="${currentUser?.role === 'ceo' ? 'img/Screenshot 2026-08-20 162312.png' : 'img/soumya-photo.svg'}" alt="${currentUser?.full_name}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
                <div style="flex:1;">
                    <div class="user-name">${currentUser?.fullName || currentUser?.full_name}</div>
                    <div class="user-role">${role}</div>
                </div>
            </div>
        </div>
    `;
}

function handleLogout() {
    api.logout().catch(() => {});
    api.clearToken();
    currentUser = null;
    window.location.reload();
}

// ===== Navigation =====
function showPage(page: string) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', (el as HTMLElement).dataset.page === page);
    });

    const wrapper = document.getElementById('content-wrapper')!;
    wrapper.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-forest"></div></div>';

    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'calendar': renderCalendar(); break;
        case 'schedule': renderSchedule(); break;
        case 'availability': renderAvailability(); break;
        case 'bookings': renderBookings(); break;
        case 'reminders': renderReminders(); break;
        case 'tasks': renderTasks(); break;
        case 'notifications': renderNotifications(); break;
        case 'excel': renderExcel(); break;
        case 'settings': renderSettings(); break;
        default: renderDashboard();
    }
}

// ===== Helpers =====
function formatDate(d: Date) {
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime12(time: string) {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${m.toString().padStart(2, '0')} ${period}`;
}

function timeNow() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function showToast(message: string, type: string = 'success') {
    const icons: any = { success: 'check-circle-fill', warning: 'exclamation-triangle-fill', danger: 'x-circle-fill', info: 'info-circle-fill' };
    const colors: any = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)' };

    const toastEl = document.createElement('div');
    toastEl.className = 'toast toast-premium align-items-center border-0';
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${icons[type] || icons.info}" style="color:${colors[type] || colors.info}"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.getElementById('toast-container')!.appendChild(toastEl);
    const toast = new (window as any).bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
}

function showEmptyState(icon: string, message: string) {
    return `<div class="empty-state"><i class="bi ${icon}"></i><p>${message}</p></div>`;
}

// ===== Dashboard =====
async function renderDashboard() {
    const wrapper = document.getElementById('content-wrapper')!;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

    try {
        const [scheduleStats, schedules, tasks, pendingBookings, reminders, focusSessions] = await Promise.all([
            api.getScheduleStats().catch(() => ({ todayMeetings: 0, freeTimeFormatted: '0h 0m' })),
            api.getSchedules(today).catch(() => []),
            api.getTaskCounts().catch(() => ({ pending: 0, today: 0, completed: 0 })),
            api.getPendingBookingsCount().catch(() => ({ count: 0 })),
            api.getActiveReminders().catch(() => []),
            api.getFocusSessions(today).catch(() => [])
        ]);

        const nowTime = timeStr.replace(/ AM| PM/, '').trim();
        const isFocus = focusSessions.some((f: any) => nowTime >= f.start_time.substring(0,5) && nowTime <= f.end_time.substring(0,5));
        const currentMeeting = schedules.find((s: any) => nowTime >= s.start_time.substring(0,5) && nowTime <= s.end_time.substring(0,5) && s.schedule_type !== 'personal');
        const nextMeeting = schedules.find((s: any) => s.start_time.substring(0,5) > nowTime && s.status === 'active');

        let statusHtml = '<span class="status-indicator status-available"><span class="status-dot"></span>Available</span>';
        if (isFocus) statusHtml = '<span class="status-indicator status-focus-mode"><span class="status-dot"></span>Focus Mode</span>';
        else if (currentMeeting) statusHtml = '<span class="status-indicator status-meeting"><span class="status-dot"></span>In Meeting</span>';

        let nextMeetingHtml = '<div class="text-center text-muted py-4"><i class="bi bi-calendar-check" style="font-size:32px;opacity:0.2"></i><p class="mt-2 mb-0">No upcoming meetings</p></div>';
        if (nextMeeting) {
            const [nh, nm] = nextMeeting.start_time.split(':').map(Number);
            const targetTime = new Date();
            targetTime.setHours(nh, nm, 0, 0);
            const diffMs = targetTime.getTime() - now.getTime();
            const diffMin = Math.max(0, Math.floor(diffMs / 60000));
            const countdownText = diffMin <= 0 ? 'Starting now' : `Starts in ${diffMin} minutes`;

            nextMeetingHtml = `
                <div class="next-time-display">${formatTime12(nextMeeting.start_time)}</div>
                <div class="next-meeting-title">${nextMeeting.title}</div>
                ${nextMeeting.description ? `<div class="next-meta" style="font-style:italic"><i class="bi bi-chat-dots me-1"></i>${nextMeeting.description}</div>` : ''}
                ${nextMeeting.location ? `<div class="next-meta"><i class="bi bi-geo-alt me-1"></i>${nextMeeting.location}</div>` : ''}
                ${nextMeeting.participants?.length ? `<div class="next-meta"><i class="bi bi-people me-1"></i>${Array.isArray(nextMeeting.participants) ? nextMeeting.participants.join(', ') : nextMeeting.participants}</div>` : ''}
                <div class="next-meta"><i class="bi bi-clock me-1"></i>${formatTime12(nextMeeting.start_time)} - ${formatTime12(nextMeeting.end_time)}</div>
                <div class="next-meta"><i class="bi bi-tag me-1"></i>${(nextMeeting.schedule_type || 'other').replace('_', ' ')} ${nextMeeting.priority && nextMeeting.priority !== 'medium' ? '&middot; <span style="color:' + (nextMeeting.priority === 'urgent' ? '#dc3545' : nextMeeting.priority === 'high' ? '#C9A227' : '') + '">' + nextMeeting.priority + ' priority</span>' : ''}</div>
                <div class="next-countdown">${countdownText}</div>
                <button class="btn btn-sm btn-gold me-2" onclick="editSchedule('${nextMeeting.id}')"><i class="bi bi-pencil me-1"></i>Edit</button>
                <button class="btn btn-sm btn-outline-light" onclick="showPage('schedule')"><i class="bi bi-eye me-1"></i>View</button>
            `;
        }

        wrapper.innerHTML = `
            <div class="hero-banner">
                <div class="hero-top">
                    <div>
                        <div class="hero-date-badge"><i class="bi bi-calendar3"></i> Today</div>
                        <div class="hero-title">${greeting}, ${currentUser?.fullName || currentUser?.full_name || 'User'}</div>
                        <div class="hero-subtitle">${formatDate(now)} &middot; ${timeStr}</div>
                    </div>
                    <div class="hero-quote"><p>Small steps today, big impact tomorrow</p></div>
                </div>
                <div class="hero-actions">
                    <button class="btn-hero btn-hero-search" onclick="openFindTimeModal()"><i class="bi bi-search"></i> Find Time</button>
                    <button class="btn-hero btn-hero-add" onclick="openScheduleModal()"><i class="bi bi-plus-lg"></i> Add Schedule</button>
                </div>
            </div>

            <div class="row g-3 mb-4 fade-in">
                <div class="col-6 col-lg-3">
                    <div class="stat-card forest-card">
                        <div class="stat-icon forest"><i class="bi bi-calendar-event"></i></div>
                        <div class="stat-value">${scheduleStats.todayMeetings}</div>
                        <div class="stat-label">Today's Meetings</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card success-card">
                        <div class="stat-icon success"><i class="bi bi-clock"></i></div>
                        <div class="stat-value">${scheduleStats.freeTimeFormatted}</div>
                        <div class="stat-label">Available Time</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card gold-card">
                        <div class="stat-icon warning"><i class="bi bi-list-task"></i></div>
                        <div class="stat-value">${tasks.pending}</div>
                        <div class="stat-label">Pending Tasks</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card info-card">
                        <div class="stat-icon info"><i class="bi bi-calendar-plus"></i></div>
                        <div class="stat-value">${pendingBookings.count}</div>
                        <div class="stat-label">Booking Requests</div>
                    </div>
                </div>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-lg-4">
                    <div class="card-premium h-100">
                        <div class="card-header"><i class="bi bi-pie-chart me-2"></i>Task Overview</div>
                        <div class="card-body">
                            <div class="chart-container"><canvas id="taskChart"></canvas></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card-premium h-100">
                        <div class="card-header"><i class="bi bi-bar-chart me-2"></i>Weekly Activity</div>
                        <div class="card-body">
                            <div class="chart-container"><canvas id="weeklyChart"></canvas></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card-premium h-100">
                        <div class="card-header"><i class="bi bi-graph-up me-2"></i>Booking Stats</div>
                        <div class="card-body">
                            <div class="chart-container"><canvas id="bookingChart"></canvas></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-lg-5">
                    <div class="next-meeting-card slide-up">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:0.7;font-weight:600">What's Next</div>
                        </div>
                        ${nextMeetingHtml}
                    </div>
                </div>
                <div class="col-lg-7">
                    <div class="card-premium h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-clock-history me-2"></i>Today's Timeline</span>
                            <button class="btn btn-sm btn-outline-forest" onclick="showPage('schedule')">View All</button>
                        </div>
                        <div class="card-body" style="max-height:320px;overflow-y:auto">
                            ${schedules.length === 0 ? showEmptyState('bi-calendar3', 'No schedules for today') :
                            schedules.map((s: any) => {
                                const isNow = nowTime >= s.start_time.substring(0,5) && nowTime <= s.end_time.substring(0,5);
                                const barClass = s.schedule_type === 'personal' ? 'focus' : s.schedule_type === 'review' ? 'booked' : 'busy';
                                const priorityColor = s.priority === 'urgent' ? '#dc3545' : s.priority === 'high' ? '#C9A227' : '';
                                return `
                                    <div class="timeline-item ${isNow ? 'current-time-line' : ''}" style="cursor:pointer" onclick="editSchedule('${s.id}')">
                                        <div class="timeline-time">${formatTime12(s.start_time.substring(0,5))}</div>
                                        <div class="timeline-bar ${barClass}"></div>
                                        <div class="timeline-content">
                                            <div class="event-title">${s.title} ${priorityColor ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${priorityColor};margin-left:4px;vertical-align:middle"></span>` : ''}</div>
                                            <div class="event-detail">${s.location ? '<i class="bi bi-geo-alt me-1"></i>' + s.location : ''} ${s.participants?.length ? '<i class="bi bi-people me-1"></i>' + (Array.isArray(s.participants) ? s.participants.join(', ') : s.participants) : ''}</div>
                                            ${s.description ? `<div class="event-detail" style="font-style:italic;color:#999"><i class="bi bi-chat-dots me-1"></i>${s.description.length > 50 ? s.description.substring(0, 50) + '...' : s.description}</div>` : ''}
                                        </div>
                                        <span class="timeline-status status-${barClass}">${isNow ? 'NOW' : s.schedule_type?.replace('_',' ') || 'meeting'}</span>
                                    </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-lg-6">
                    <div class="card-premium">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-list-task me-2"></i>Today's Tasks</span>
                            <button class="btn btn-sm btn-outline-forest" onclick="showPage('tasks')">View All</button>
                        </div>
                        <div class="card-body" id="dash-tasks"></div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card-premium">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-bell me-2"></i>Reminders</span>
                            <button class="btn btn-sm btn-outline-forest" onclick="showPage('reminders')">View All</button>
                        </div>
                        <div class="card-body" id="dash-reminders"></div>
                    </div>
                </div>
            </div>

            <div class="text-center mt-4">
                <button class="btn btn-forest me-2" onclick="openScheduleModal()"><i class="bi bi-plus-lg me-1"></i>Schedule</button>
                <button class="btn btn-gold me-2" onclick="openReminderModal()"><i class="bi bi-bell me-1"></i>Reminder</button>
                <button class="btn btn-outline-forest me-2" onclick="openTaskModal()"><i class="bi bi-list-task me-1"></i>Task</button>
                <button class="btn btn-outline-forest" onclick="openBookingModal()"><i class="bi bi-calendar-plus me-1"></i>Booking</button>
            </div>
        `;

        // Load dashboard tasks
        loadDashTasks();
        loadDashReminders();
        initDashboardCharts(scheduleStats, tasks, pendingBookings);
    } catch (err) {
        wrapper.innerHTML = `<div class="alert alert-danger">Failed to load dashboard</div>`;
    }
}

async function loadDashTasks() {
    try {
        const tasks = await api.getTasks('pending');
        const el = document.getElementById('dash-tasks');
        if (!el) return;
        if (tasks.length === 0) { el.innerHTML = showEmptyState('bi-check-circle', 'No pending tasks'); return; }
        el.innerHTML = tasks.slice(0, 5).map((t: any) => `
            <div class="task-item">
                <div class="task-check ${t.status === 'completed' ? 'completed' : ''}" onclick="completeTask('${t.id}')">
                    ${t.status === 'completed' ? '<i class="bi bi-check" style="font-size:11px"></i>' : ''}
                </div>
                <div class="task-info">
                    <div class="task-title ${t.status === 'completed' ? 'completed' : ''}">${t.title}</div>
                    <div class="task-meta"><span class="priority-dot ${t.priority}"></span> ${t.priority} ${t.due_date ? '&middot; Due ' + t.due_date : ''}</div>
                </div>
            </div>
        `).join('');
    } catch {}
}

async function loadDashReminders() {
    try {
        const reminders = await api.getActiveReminders();
        const el = document.getElementById('dash-reminders');
        if (!el) return;
        if (reminders.length === 0) { el.innerHTML = showEmptyState('bi-bell', 'No active reminders'); return; }
        el.innerHTML = reminders.slice(0, 5).map((r: any) => `
            <div class="task-item">
                <span class="priority-dot ${r.priority}" style="margin-top:6px"></span>
                <div class="task-info">
                    <div class="task-title">${r.title}</div>
                    <div class="task-meta">${r.reminder_date} at ${formatTime12(r.reminder_time?.substring(0,5))} &middot; ${r.repeat_type}</div>
                </div>
            </div>
        `).join('');
    } catch {}
}

function initDashboardCharts(scheduleStats: any, tasks: any, pendingBookings: any) {
    const forestColor = '#173F35';
    const goldColor = '#C9A227';
    const successColor = '#3E8E68';
    const infoColor = '#4B7FA3';
    const warningColor = '#D99A2B';

    // Task Pie Chart
    const taskCtx = document.getElementById('taskChart') as HTMLCanvasElement;
    if (taskCtx) {
        new (window as any).Chart(taskCtx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Completed', 'Today'],
                datasets: [{
                    data: [tasks.pending || 1, tasks.completed || 0, tasks.today || 0],
                    backgroundColor: [warningColor, successColor, forestColor],
                    borderWidth: 0,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true, pointStyleWidth: 8, font: { size: 11 } } }
                }
            }
        });
    }

    // Weekly Bar Chart
    const weeklyCtx = document.getElementById('weeklyChart') as HTMLCanvasElement;
    if (weeklyCtx) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        new (window as any).Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [
                    { label: 'Meetings', data: [3, 5, 2, 4, scheduleStats.todayMeetings || 1], backgroundColor: forestColor, borderRadius: 4 },
                    { label: 'Tasks', data: [2, 3, 4, 1, tasks.today || 2], backgroundColor: goldColor, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 11 } } } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }
            }
        });
    }

    // Booking Line Chart
    const bookingCtx = document.getElementById('bookingChart') as HTMLCanvasElement;
    if (bookingCtx) {
        new (window as any).Chart(bookingCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                datasets: [{
                    label: 'Bookings',
                    data: [2, 1, 3, 0, pendingBookings.count || 1],
                    borderColor: forestColor,
                    backgroundColor: 'rgba(23,63,53,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: forestColor,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }
            }
        });
    }
}

// ===== Excel Export =====
function exportBookingsToExcel() {
    api.exportBookingsExcel().then((bookings: any[]) => {
        if (!bookings.length) { showToast('No bookings to export', 'warning'); return; }
        const data = bookings.map((b: any) => ({
            'Name': b.booked_by_name,
            'Email': b.booked_by_email,
            'Company': b.company,
            'Phone': b.phone,
            'Address': b.address,
            'Place': b.place,
            'Purpose': b.purpose,
            'What': b.what,
            'Date': b.booking_date,
            'Time': b.preferred_time,
            'Duration': b.duration + ' min',
            'Frequency': b.frequency,
            'Visitor Type': b.visitor_type,
            'Status': b.status,
            'Notes': b.notes
        }));
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
        (window as any).XLSX.writeFile(wb, `next360_bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Excel file exported successfully');
    }).catch(() => showToast('Failed to export', 'danger'));
}

function uploadExcel() {
    const input = document.getElementById('excel-file-input') as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) { showToast('Please select a file', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = (window as any).XLSX.read(e.target?.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = (window as any).XLSX.utils.sheet_to_json(ws);
            showToast(`Parsed ${data.length} rows from ${file.name}`);
            const listEl = document.getElementById('excel-file-list');
            if (listEl) {
                listEl.innerHTML += `<div class="d-flex justify-content-between align-items-center p-2 rounded mb-1" style="background:rgba(62,142,104,0.06)">
                    <span style="font-size:13px"><i class="bi bi-file-earmark-excel me-2" style="color:var(--success)"></i>${file.name} (${data.length} rows)</span>
                    <span class="badge bg-success">Uploaded</span>
                </div>`;
            }
            input.value = '';
        } catch (err) {
            showToast('Failed to parse Excel file', 'danger');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===== Schedule Page =====
async function renderSchedule() {
    const wrapper = document.getElementById('content-wrapper')!;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = formatDate(now);

    try {
        const [schedules, focusSessions] = await Promise.all([
            api.getSchedules(today),
            api.getFocusSessions(today)
        ]);

        const hours = Array.from({ length: 13 }, (_, i) => i + 7);
        const nowTime = timeNow();
        const meetingCount = schedules.filter((s: any) => s.schedule_type !== 'personal').length;
        const focusCount = focusSessions.length;
        const freeSlots = hours.filter(h => {
            const hStr = `${h.toString().padStart(2,'0')}:00`;
            const hEnd = `${(h+1).toString().padStart(2,'0')}:00`;
            const hasEvent = schedules.some((s: any) => s.start_time.substring(0,5) < hEnd && s.end_time.substring(0,5) > hStr);
            const hasFocus = focusSessions.some((f: any) => f.start_time.substring(0,5) < hEnd && f.end_time.substring(0,5) > hStr);
            return !hasEvent && !hasFocus;
        }).length;

        const typeColors: Record<string, string> = {
            client_meeting: '#1B5E3B',
            employee_meeting: '#2D8B57',
            team_meeting: '#34A77B',
            interview: '#C8962E',
            business_meeting: '#3B82B0',
            review: '#8B5CF6',
            personal: '#E0A526',
            other: '#6B7280'
        };

        const typeIcons: Record<string, string> = {
            client_meeting: 'bi-building',
            employee_meeting: 'bi-person-badge',
            team_meeting: 'bi-people',
            interview: 'bi-mic',
            business_meeting: 'bi-briefcase',
            review: 'bi-clipboard-check',
            personal: 'bi-heart',
            other: 'bi-three-dots'
        };

        wrapper.innerHTML = `
            <div class="hero-banner" style="margin-bottom:24px;">
                <div class="hero-top">
                    <div>
                        <div class="hero-date-badge"><i class="bi bi-calendar3"></i> ${dayName}</div>
                        <div class="hero-title">Today's Schedule</div>
                        <div class="hero-subtitle">${dateFormatted}</div>
                    </div>
                    <div class="hero-quote"><p>Small steps today, big impact tomorrow</p></div>
                </div>
                <div class="hero-actions">
                    <button class="btn-hero btn-hero-search" onclick="openFindTimeModal()"><i class="bi bi-search"></i> Find Time</button>
                    <button class="btn-hero btn-hero-add" onclick="openScheduleModal()"><i class="bi bi-plus-lg"></i> Add Schedule</button>
                </div>
            </div>

            <div class="row g-3 mb-4 fade-in">
                <div class="col-6 col-lg-3">
                    <div class="stat-card forest-card">
                        <div class="stat-icon forest"><i class="bi bi-calendar-event"></i></div>
                        <div class="stat-value">${meetingCount}</div>
                        <div class="stat-label">Meetings</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card success-card">
                        <div class="stat-icon success"><i class="bi bi-clock"></i></div>
                        <div class="stat-value">${freeSlots}</div>
                        <div class="stat-label">Free Slots</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card info-card">
                        <div class="stat-icon info"><i class="bi bi-headphones"></i></div>
                        <div class="stat-value">${focusCount}</div>
                        <div class="stat-label">Focus Sessions</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="stat-card gold-card">
                        <div class="stat-icon warning"><i class="bi bi-lightning"></i></div>
                        <div class="stat-value">${schedules.length}</div>
                        <div class="stat-label">Total Events</div>
                    </div>
                </div>
            </div>

            <div class="card-premium" style="overflow:visible;">
                <div class="card-header d-flex justify-content-between align-items-center" style="border-bottom:2px solid var(--green-soft);">
                    <span style="font-weight:700;font-size:13px;color:var(--forest);text-transform:uppercase;letter-spacing:0.5px;"><i class="bi bi-clock-history me-2"></i>Timeline</span>
                    <span style="font-size:12px;color:var(--text-muted);">${schedules.length + focusCount} events today</span>
                </div>
                <div class="card-body p-0">
                    ${hours.map(h => {
                        const hourStr = `${h.toString().padStart(2,'0')}:00`;
                        const hourEnd = `${(h+1).toString().padStart(2,'0')}:00`;
                        const isCurrentHour = nowTime >= hourStr && nowTime < hourEnd;
                        const isPast = nowTime >= hourEnd;

                        const events = schedules.filter((s: any) => {
                            const st = s.start_time.substring(0,5);
                            const et = s.end_time.substring(0,5);
                            return st < hourEnd && et > hourStr;
                        });

                        const focus = focusSessions.find((f: any) => f.start_time.substring(0,5) < hourEnd && f.end_time.substring(0,5) > hourStr);

                        const hasAny = events.length > 0 || focus;

                        return `
                            <div class="schedule-row" style="display:flex;min-height:80px;border-bottom:1px solid var(--border-light);${isPast && !hasAny ? 'opacity:0.45;' : ''}">
                                <div class="schedule-time-col" style="width:100px;padding:14px 16px;background:${isCurrentHour ? 'linear-gradient(135deg,rgba(27,94,59,0.06),rgba(52,167,123,0.04))' : 'transparent'};border-right:2px solid ${isCurrentHour ? 'var(--emerald)' : 'var(--border-light)'};display:flex;align-items:flex-start;gap:6px;position:relative;">
                                    ${isCurrentHour ? '<span style="position:absolute;left:-4px;top:14px;width:8px;height:8px;border-radius:50%;background:var(--danger);box-shadow:0 0 8px rgba(217,79,79,0.4);animation:blink 2s infinite;"></span>' : ''}
                                    <span style="font-size:12.5px;font-weight:700;color:${isCurrentHour ? 'var(--forest)' : isPast ? 'var(--text-muted)' : 'var(--text-secondary)'};letter-spacing:-0.2px;">${formatTime12(hourStr)}</span>
                                </div>
                                <div style="flex:1;padding:10px 16px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='rgba(27,94,59,0.015)'" onmouseout="this.style.background='transparent'" onclick="openScheduleModal(null,'${hourStr}')">
                                    ${focus ? `
                                        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:6px;background:linear-gradient(135deg,rgba(59,130,176,0.08),rgba(59,130,176,0.04));border-radius:var(--radius-sm);border-left:3px solid var(--info);">
                                            <div style="width:34px;height:34px;border-radius:8px;background:rgba(59,130,176,0.12);display:flex;align-items:center;justify-content:center;"><i class="bi bi-headphones" style="color:var(--info);font-size:14px;"></i></div>
                                            <div style="flex:1;">
                                                <div style="font-size:13px;font-weight:600;color:var(--info);">${focus.title || 'Focus Time'}</div>
                                                <div style="font-size:11px;color:var(--text-muted);">${formatTime12(focus.start_time.substring(0,5))} - ${formatTime12(focus.end_time.substring(0,5))}</div>
                                            </div>
                                            <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(59,130,176,0.1);color:var(--info);">Focus</span>
                                        </div>
                                    ` : ''}
                                    ${events.map((s: any) => {
                                        const color = typeColors[s.schedule_type] || typeColors.other;
                                        const icon = typeIcons[s.schedule_type] || typeIcons.other;
                                        const sType = (s.schedule_type || 'other').replace('_', ' ');
                                        return `
                                            <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;margin-bottom:6px;background:linear-gradient(135deg,${color}08,${color}04);border-radius:var(--radius-sm);border-left:3px solid ${color};cursor:pointer;transition:all 0.2s;box-shadow:var(--shadow-xs);" onclick="event.stopPropagation();editSchedule('${s.id}')" onmouseover="this.style.boxShadow='var(--shadow-sm)';this.style.transform='translateX(2px)'" onmouseout="this.style.boxShadow='var(--shadow-xs)';this.style.transform='none'">
                                                <div style="width:34px;height:34px;border-radius:8px;background:${color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi ${icon}" style="color:${color};font-size:14px;"></i></div>
                                                <div style="flex:1;min-width:0;">
                                                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                                                        <span style="font-size:13.5px;font-weight:600;color:var(--text);">${s.title}</span>
                                                        ${s.priority && s.priority !== 'medium' ? `<span style="font-size:9px;text-transform:uppercase;letter-spacing:0.3px;font-weight:600;padding:2px 6px;border-radius:4px;background:${s.priority === 'urgent' ? 'rgba(217,79,79,0.1)' : s.priority === 'high' ? 'rgba(224,165,38,0.1)' : 'rgba(107,114,128,0.1)'};color:${s.priority === 'urgent' ? 'var(--danger)' : s.priority === 'high' ? 'var(--warning)' : 'var(--text-muted)'}">${s.priority}</span>` : ''}
                                                    </div>
                                                    <div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                                        <span><i class="bi bi-clock me-1"></i>${formatTime12(s.start_time.substring(0,5))} - ${formatTime12(s.end_time.substring(0,5))}</span>
                                                        ${s.location ? `<span><i class="bi bi-geo-alt me-1"></i>${s.location}</span>` : ''}
                                                        ${s.participants?.length ? `<span><i class="bi bi-people me-1"></i>${Array.isArray(s.participants) ? s.participants.join(', ') : s.participants}</span>` : ''}
                                                    </div>
                                                    ${s.description ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><i class="bi bi-chat-dots me-1"></i>${s.description.length > 70 ? s.description.substring(0, 70) + '...' : s.description}</div>` : ''}
                                                </div>
                                                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
                                                    <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding:3px 8px;border-radius:6px;background:${color}12;color:${color};">${sType}</span>
                                                </div>
                                            </div>`;
                                    }).join('')}
                                    ${!hasAny ? `
                                        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;color:var(--text-muted);font-size:12.5px;cursor:pointer;" onclick="event.stopPropagation();openScheduleModal(null,'${hourStr}')">
                                            <i class="bi bi-plus-circle" style="font-size:16px;opacity:0.3;"></i>
                                            <span style="opacity:0.5;">No schedule &middot; Click to add</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>

            <div style="margin-top:24px;padding:20px 24px;background:linear-gradient(135deg,var(--green-soft),rgba(52,167,123,0.05));border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:12px;font-weight:600;color:var(--forest);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Keep Going</div>
                    <div style="font-size:13px;color:var(--text-secondary);">Every meeting brings you closer to your goals</div>
                </div>
                <div style="font-size:28px;opacity:0.2;">&#127793;</div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load schedule</div>';
    }
}

// ===== Calendar Page =====
async function renderCalendar() {
    const wrapper = document.getElementById('content-wrapper')!;
    const year = currentPageDate.getFullYear();
    const month = currentPageDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const startDate = `${year}-${(month+1).toString().padStart(2,'0')}-01`;
    const endDate = `${year}-${(month+1).toString().padStart(2,'0')}-${daysInMonth.toString().padStart(2,'0')}`;

    try {
        const schedules = await api.getSchedules(undefined, startDate, endDate);

        const monthName = currentPageDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let daysHtml = '';
        for (let i = 0; i < firstDay; i++) {
            daysHtml += '<div class="calendar-day other-month"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const daySchedules = schedules.filter((s: any) => s.schedule_date === dateStr);

            daysHtml += `
                <div class="calendar-day ${isToday ? 'today' : ''}" onclick="currentPageDate=new Date(${year},${month},${d});openScheduleModal(null,null,'${dateStr}')">
                    <div class="day-number">${d}</div>
                    ${daySchedules.slice(0,3).map((s: any) => `
                        <div class="calendar-event meeting" title="${s.title}${s.participants?.length ? '\nWith: ' + (Array.isArray(s.participants) ? s.participants.join(', ') : s.participants) : ''}${s.location ? '\nAt: ' + s.location : ''}${s.description ? '\nNote: ' + s.description : ''}" onclick="event.stopPropagation();editSchedule('${s.id}')">${formatTime12(s.start_time?.substring(0,5))} ${s.title}${s.participants?.length ? ' <i class="bi bi-people" style="font-size:9px"></i>' : ''}</div>
                    `).join('')}
                    ${daySchedules.length > 3 ? `<div style="font-size:10px;color:#888">+${daySchedules.length - 3} more</div>` : ''}
                </div>`;
        }

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Calendar</h4>
                    <div class="subtitle">${monthName}</div>
                </div>
                <div class="d-flex gap-2 align-items-center">
                    <button class="btn btn-outline-forest btn-sm" onclick="changeMonth(-1)"><i class="bi bi-chevron-left"></i></button>
                    <span class="fw-semibold">${monthName}</span>
                    <button class="btn btn-outline-forest btn-sm" onclick="changeMonth(1)"><i class="bi bi-chevron-right"></i></button>
                    <button class="btn btn-gold ms-2" onclick="openScheduleModal()"><i class="bi bi-plus-lg me-1"></i>Add</button>
                </div>
            </div>
            <div class="card-premium p-3">
                <div class="calendar-grid">
                    ${dayNames.map(d => `<div class="calendar-header-cell">${d}</div>`).join('')}
                    ${daysHtml}
                </div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load calendar</div>';
    }
}

function changeMonth(delta: number) {
    currentPageDate.setMonth(currentPageDate.getMonth() + delta);
    renderCalendar();
}

// ===== Availability Page =====
async function renderAvailability() {
    const wrapper = document.getElementById('content-wrapper')!;
    try {
        const availability = await api.getAvailability();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Availability</h4>
                    <div class="subtitle">Manage your available hours</div>
                </div>
                <button class="btn btn-gold" onclick="addAvailability()"><i class="bi bi-plus-lg me-1"></i>Add Slot</button>
            </div>
            <div class="row g-3">
                ${days.map((day, i) => {
                    const slots = availability.filter((a: any) => a.day_of_week === i);
                    return `
                        <div class="col-md-6 col-lg-4">
                            <div class="card-premium">
                                <div class="card-header fw-semibold">${day}</div>
                                <div class="card-body">
                                    ${slots.length === 0 ? '<div class="text-muted" style="font-size:12px">No availability set</div>' :
                                    slots.map((s: any) => `
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span style="font-size:13px">${formatTime12(s.start_time?.substring(0,5))} - ${formatTime12(s.end_time?.substring(0,5))}</span>
                                            <span class="badge ${s.is_available ? 'bg-success' : 'bg-secondary'}">${s.is_available ? 'Available' : 'Blocked'}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>`;
                }).join('')}
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load availability</div>';
    }
}

async function addAvailability() {
    const day = prompt('Day of week (0=Sun, 1=Mon, ..., 6=Sat):');
    if (day === null) return;
    const start = prompt('Start time (HH:MM):');
    const end = prompt('End time (HH:MM):');
    if (!start || !end) return;

    try {
        await api.upsertAvailability({ dayOfWeek: parseInt(day), startTime: start, endTime: end, isAvailable: true });
        showToast('Availability updated');
        renderAvailability();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
}

// ===== Bookings Page =====
async function renderBookings() {
    const wrapper = document.getElementById('content-wrapper')!;
    try {
        const bookings = await api.getBookings();

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Bookings</h4>
                    <div class="subtitle">Manage booking requests</div>
                </div>
                <button class="btn btn-gold" onclick="openBookingModal()"><i class="bi bi-plus-lg me-1"></i>New Booking</button>
            </div>
            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-sm btn-outline-forest active" onclick="filterBookings('all',this)">All</button>
                <button class="btn btn-sm btn-outline-forest" onclick="filterBookings('pending',this)">Pending</button>
                <button class="btn btn-sm btn-outline-forest" onclick="filterBookings('accepted',this)">Accepted</button>
                <button class="btn btn-sm btn-outline-forest" onclick="filterBookings('rejected',this)">Rejected</button>
            </div>
            <div class="card-premium">
                <div class="card-body p-0">
                    ${bookings.length === 0 ? showEmptyState('bi-calendar-check', 'No bookings yet') : `
                    <div class="table-responsive">
                        <table class="table table-premium mb-0">
                            <thead><tr><th>Name</th><th>Company</th><th>Date</th><th>Time</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${bookings.map((b: any) => `
                                    <tr data-status="${b.status}">
                                        <td class="fw-semibold">${b.booked_by_name}</td>
                                        <td>${b.company || '-'}</td>
                                        <td>${b.booking_date}</td>
                                        <td>${formatTime12(b.preferred_time?.substring(0,5))}</td>
                                        <td>${b.purpose?.substring(0, 30)}${b.purpose?.length > 30 ? '...' : ''}</td>
                                        <td><span class="badge ${b.status === 'accepted' ? 'bg-success' : b.status === 'pending' ? 'bg-warning' : b.status === 'rejected' ? 'bg-danger' : 'bg-secondary'}">${b.status}</span></td>
                                        <td>
                                            ${b.status === 'pending' ? `
                                                <button class="btn btn-sm btn-outline-success me-1" onclick="handleBooking('${b.id}','accepted')"><i class="bi bi-check"></i></button>
                                                <button class="btn btn-sm btn-outline-danger" onclick="handleBooking('${b.id}','rejected')"><i class="bi bi-x"></i></button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load bookings</div>';
    }
}

function filterBookings(status: string, btn: HTMLElement) {
    document.querySelectorAll('.d-flex .btn-outline-forest').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('table tbody tr').forEach((row: any) => {
        row.style.display = status === 'all' || row.dataset.status === status ? '' : 'none';
    });
}

async function handleBooking(id: string, status: string) {
    try {
        await api.updateBookingStatus(id, status);
        showToast(`Booking ${status}`);
        renderBookings();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
}

// ===== Reminders Page =====
async function renderReminders() {
    const wrapper = document.getElementById('content-wrapper')!;
    try {
        const reminders = await api.getReminders();

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Reminders</h4>
                    <div class="subtitle">Never miss an important task</div>
                </div>
                <button class="btn btn-gold" onclick="openReminderModal()"><i class="bi bi-plus-lg me-1"></i>Add Reminder</button>
            </div>
            <div class="card-premium">
                <div class="card-body">
                    ${reminders.length === 0 ? showEmptyState('bi-bell', 'No reminders') :
                    reminders.map((r: any) => `
                        <div class="task-item">
                            <span class="priority-dot ${r.priority}" style="margin-top:6px"></span>
                            <div class="task-info flex-grow-1">
                                <div class="task-title ${r.status === 'completed' ? 'completed' : ''}">${r.title}</div>
                                <div class="task-meta">${r.reminder_date} at ${formatTime12(r.reminder_time?.substring(0,5))} &middot; ${r.repeat_type} &middot; <span class="badge ${r.status === 'completed' ? 'bg-success' : 'bg-warning'}">${r.status}</span></div>
                            </div>
                            <div class="d-flex gap-1">
                                ${r.status !== 'completed' ? `<button class="btn btn-sm btn-outline-success" onclick="completeReminder('${r.id}')"><i class="bi bi-check-lg"></i></button>` : ''}
                                <button class="btn btn-sm btn-outline-forest" onclick="editReminder('${r.id}')"><i class="bi bi-pencil"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load reminders</div>';
    }
}

async function completeReminder(id: string) {
    try {
        await api.completeReminder(id);
        showToast('Reminder completed');
        renderReminders();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
}

// ===== Tasks Page =====
async function renderTasks() {
    const wrapper = document.getElementById('content-wrapper')!;
    try {
        const [pending, completed, allTasks] = await Promise.all([
            api.getTasks('pending'),
            api.getTasks('completed'),
            api.getTasks()
        ]);

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Tasks</h4>
                    <div class="subtitle">${pending.length} pending &middot; ${completed.length} completed</div>
                </div>
                <button class="btn btn-gold" onclick="openTaskModal()"><i class="bi bi-plus-lg me-1"></i>Add Task</button>
            </div>
            <div class="row g-3">
                <div class="col-lg-8">
                    <div class="card-premium">
                        <div class="card-header"><i class="bi bi-list-task me-2"></i>Pending Tasks</div>
                        <div class="card-body">
                            ${pending.length === 0 ? showEmptyState('bi-check-circle', 'All tasks completed!') :
                            pending.map((t: any) => `
                                <div class="task-item">
                                    <div class="task-check" onclick="completeTask('${t.id}')"></div>
                                    <div class="task-info flex-grow-1" onclick="editTask('${t.id}')" style="cursor:pointer">
                                        <div class="task-title">${t.title}</div>
                                        <div class="task-meta"><span class="priority-dot ${t.priority}"></span> ${t.priority} ${t.due_date ? '&middot; Due ' + t.due_date : ''}</div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-forest" onclick="editTask('${t.id}')"><i class="bi bi-pencil"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card-premium">
                        <div class="card-header"><i class="bi bi-check-circle me-2"></i>Completed</div>
                        <div class="card-body" style="max-height:400px;overflow-y:auto">
                            ${completed.length === 0 ? showEmptyState('bi-inbox', 'No completed tasks') :
                            completed.slice(0, 10).map((t: any) => `
                                <div class="task-item">
                                    <div class="task-check completed"><i class="bi bi-check" style="font-size:11px"></i></div>
                                    <div class="task-info">
                                        <div class="task-title completed">${t.title}</div>
                                        <div class="task-meta">Completed</div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-forest" onclick="reopenTask('${t.id}')"><i class="bi bi-arrow-counterclockwise"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load tasks</div>';
    }
}

async function completeTask(id: string) {
    try {
        await api.completeTask(id);
        showToast('Task completed');
        renderTasks();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
}

async function reopenTask(id: string) {
    try {
        await api.reopenTask(id);
        showToast('Task reopened');
        renderTasks();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
}

// ===== Notifications Page =====
async function renderNotifications() {
    const wrapper = document.getElementById('content-wrapper')!;
    try {
        const notifications = await api.getNotifications();

        wrapper.innerHTML = `
            <div class="content-header">
                <div>
                    <h4>Notifications</h4>
                    <div class="subtitle">${notifications.filter((n: any) => !n.is_read).length} unread</div>
                </div>
                <button class="btn btn-outline-forest" onclick="markAllRead()"><i class="bi bi-check-all me-1"></i>Mark All Read</button>
            </div>
            <div class="card-premium">
                <div class="card-body p-0">
                    ${notifications.length === 0 ? showEmptyState('bi-inbox', 'No notifications') :
                    notifications.map((n: any) => `
                        <div class="notification-item ${!n.is_read ? 'unread' : ''}" onclick="markNotifRead('${n.id}',this)">
                            <div class="notif-title">${n.title}</div>
                            <div class="notif-message">${n.message}</div>
                            <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        wrapper.innerHTML = '<div class="alert alert-danger">Failed to load notifications</div>';
    }
}

async function markNotifRead(id: string, el: HTMLElement) {
    try {
        await api.markNotifRead(id);
        el.classList.remove('unread');
        updateNotifBadge();
    } catch {}
}

async function markAllRead() {
    try {
        await api.markAllNotifsRead();
        showToast('All notifications marked as read');
        renderNotifications();
        updateNotifBadge();
    } catch {}
}

// ===== Excel Page =====
function renderExcel() {
    const wrapper = document.getElementById('content-wrapper')!;
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

    wrapper.innerHTML = `
        <div class="hero-banner" style="margin-bottom:24px;">
            <div class="hero-top">
                <div>
                    <div class="hero-date-badge"><i class="bi bi-cloud-download"></i> Export</div>
                    <div class="hero-title">Data Manager</div>
                    <div class="hero-subtitle">Import and export your weekly data</div>
                </div>
                <div class="hero-quote"><p>Keep your data safe, export regularly</p></div>
            </div>
            <div class="hero-actions">
                <button class="btn-hero btn-hero-add" onclick="exportAllData()"><i class="bi bi-download"></i> Export All Data</button>
            </div>
        </div>

        <div class="row g-3 mb-4 fade-in">
            <div class="col-6 col-lg-3">
                <div class="stat-card forest-card" style="cursor:pointer" onclick="exportSchedulesExcel()">
                    <div class="stat-icon forest"><i class="bi bi-calendar-event"></i></div>
                    <div class="stat-label">Schedules</div>
                    <div style="font-size:11px;color:var(--emerald);margin-top:4px;font-weight:500;"><i class="bi bi-download me-1"></i>Export</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card gold-card" style="cursor:pointer" onclick="exportBookingsToExcel()">
                    <div class="stat-icon gold"><i class="bi bi-calendar-check"></i></div>
                    <div class="stat-label">Bookings</div>
                    <div style="font-size:11px;color:var(--gold);margin-top:4px;font-weight:500;"><i class="bi bi-download me-1"></i>Export</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card success-card" style="cursor:pointer" onclick="exportTasksExcel()">
                    <div class="stat-icon success"><i class="bi bi-list-task"></i></div>
                    <div class="stat-label">Tasks</div>
                    <div style="font-size:11px;color:var(--success);margin-top:4px;font-weight:500;"><i class="bi bi-download me-1"></i>Export</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card info-card" style="cursor:pointer" onclick="exportRemindersExcel()">
                    <div class="stat-icon info"><i class="bi bi-bell"></i></div>
                    <div class="stat-label">Reminders</div>
                    <div style="font-size:11px;color:var(--info);margin-top:4px;font-weight:500;"><i class="bi bi-download me-1"></i>Export</div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-5">
                <div class="card-premium h-100">
                    <div class="card-header"><i class="bi bi-upload me-2"></i>Import Excel File</div>
                    <div class="card-body">
                        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('excel-file-input').click()">
                            <i class="bi bi-cloud-arrow-up"></i>
                            <p class="mb-1 fw-semibold" style="font-size:14px">Click to upload or drag and drop</p>
                            <p class="mb-0" style="font-size:12px;color:var(--text-muted)">Supports .xlsx, .xls, .csv files</p>
                        </div>
                        <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="uploadExcel()">
                        <button class="btn btn-forest w-100 mt-3" onclick="uploadExcel()"><i class="bi bi-upload me-1"></i>Upload File</button>
                    </div>
                </div>
            </div>
            <div class="col-lg-7">
                <div class="card-premium h-100">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span><i class="bi bi-clock-history me-2"></i>Export History</span>
                        <span style="font-size:11px;color:var(--text-muted);">Last 7 days data</span>
                    </div>
                    <div class="card-body">
                        <div style="padding:16px;background:linear-gradient(135deg,var(--green-soft),rgba(52,167,123,0.05));border-radius:var(--radius);margin-bottom:16px;">
                            <div style="font-size:12px;font-weight:600;color:var(--forest);margin-bottom:4px;"><i class="bi bi-info-circle me-1"></i> Weekly Export</div>
                            <div style="font-size:12px;color:var(--text-secondary);">All exports include data from the last 7 days. A reminder is shown every weekend to keep your data backed up.</div>
                        </div>
                        <div class="d-flex flex-column gap-2">
                            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background:var(--green-soft);cursor:pointer;" onclick="exportAllData()">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-file-earmark-zip" style="color:var(--forest);font-size:16px;"></i>
                                    <div>
                                        <div style="font-size:13px;font-weight:600;">Full Export (All Data)</div>
                                        <div style="font-size:11px;color:var(--text-muted);">Schedules, Bookings, Tasks, Reminders, Focus</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-forest"><i class="bi bi-download"></i></button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background:rgba(27,94,59,0.02);cursor:pointer;" onclick="exportSchedulesExcel()">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-calendar3" style="color:var(--forest);font-size:16px;"></i>
                                    <div>
                                        <div style="font-size:13px;font-weight:500;">Schedules Only</div>
                                        <div style="font-size:11px;color:var(--text-muted);">Last 7 days of meetings</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-forest"><i class="bi bi-download"></i></button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background:rgba(27,94,59,0.02);cursor:pointer;" onclick="exportBookingsToExcel()">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-calendar-check" style="color:var(--gold);font-size:16px;"></i>
                                    <div>
                                        <div style="font-size:13px;font-weight:500;">Bookings Only</div>
                                        <div style="font-size:11px;color:var(--text-muted);">All booking requests</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-forest"><i class="bi bi-download"></i></button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background:rgba(27,94,59,0.02);cursor:pointer;" onclick="exportTasksExcel()">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-list-task" style="color:var(--success);font-size:16px;"></i>
                                    <div>
                                        <div style="font-size:13px;font-weight:500;">Tasks Only</div>
                                        <div style="font-size:11px;color:var(--text-muted);">All tasks with status</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-forest"><i class="bi bi-download"></i></button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background:rgba(27,94,59,0.02);cursor:pointer;" onclick="exportRemindersExcel()">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-bell" style="color:var(--info);font-size:16px;"></i>
                                    <div>
                                        <div style="font-size:13px;font-weight:500;">Reminders Only</div>
                                        <div style="font-size:11px;color:var(--text-muted);">All reminders with repeat info</div>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-forest"><i class="bi bi-download"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const zone = document.getElementById('upload-zone');
    if (zone) {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const input = document.getElementById('excel-file-input') as HTMLInputElement;
            if (e.dataTransfer?.files.length) {
                input.files = e.dataTransfer.files;
                uploadExcel();
            }
        });
    }
}

// ===== Settings Page =====
function renderSettings() {
    const wrapper = document.getElementById('content-wrapper')!;
    const isCeo = currentUser?.role === 'ceo';
    wrapper.innerHTML = `
        <div class="content-header">
            <div>
                <h4>Settings</h4>
                <div class="subtitle">Manage your account and data</div>
            </div>
        </div>
        <div class="row g-4">
            <div class="col-lg-6">
                <div class="card-premium">
                    <div class="card-header"><i class="bi bi-person me-2"></i>Profile</div>
                    <div class="card-body">
                        <div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" value="${currentUser?.fullName || currentUser?.full_name || ''}" disabled></div>
                        <div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" value="${currentUser?.email || ''}" disabled></div>
                        <div class="mb-3"><label class="form-label">Role</label><input type="text" class="form-control" value="${currentUser?.role?.toUpperCase() || ''}" disabled></div>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card-premium">
                    <div class="card-header"><i class="bi bi-clock me-2"></i>Working Hours</div>
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-6"><label class="form-label">Start</label><input type="time" class="form-control" value="09:00"></div>
                            <div class="col-6"><label class="form-label">End</label><input type="time" class="form-control" value="18:00"></div>
                        </div>
                    </div>
                </div>
            </div>
            ${isCeo ? `
            <div class="col-12">
                <div class="card-premium" style="border:1px solid rgba(217,79,79,0.2);">
                    <div class="card-header" style="background:rgba(217,79,79,0.04);color:var(--danger);"><i class="bi bi-exclamation-triangle me-2"></i>Data Management</div>
                    <div class="card-body">
                        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
                            <div>
                                <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">Clear All Data</div>
                                <div style="font-size:12.5px;color:var(--text-secondary);max-width:500px;">This will permanently delete all schedules, bookings, tasks, reminders, notifications, focus sessions, audit logs, and excel data. Users will NOT be deleted. This action cannot be undone.</div>
                            </div>
                            <button class="btn btn-danger" onclick="confirmClearAllData()" style="white-space:nowrap;flex-shrink:0;"><i class="bi bi-trash me-1"></i>Clear All Data</button>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function confirmClearAllData() {
    const confirmed = confirm('Are you absolutely sure you want to delete ALL data?\n\nThis includes:\n- All schedules\n- All bookings\n- All tasks\n- All reminders\n- All notifications\n- All focus sessions\n- All audit logs\n- All excel data\n\nUsers will NOT be deleted.\n\nThis CANNOT be undone.');
    if (!confirmed) return;

    const doubleConfirm = confirm('FINAL CONFIRMATION: Type "DELETE" mentally and click OK to proceed with deleting everything.');
    if (!doubleConfirm) return;

    api.clearAllData().then((result) => {
        showToast('All data has been cleared successfully', 'success');
        setTimeout(() => showPage('dashboard'), 1500);
    }).catch((err: any) => {
        showToast(err.error || 'Failed to clear data', 'danger');
    });
}

// ===== Modals =====
function openScheduleModal(schedule?: any, defaultTime?: string, defaultDate?: string) {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('scheduleModal'));
    document.getElementById('scheduleModalTitle')!.textContent = schedule ? 'Edit Schedule' : 'Add Schedule';
    (document.getElementById('sch-id') as HTMLInputElement).value = schedule?.id || '';
    (document.getElementById('sch-title') as HTMLInputElement).value = schedule?.title || '';
    (document.getElementById('sch-description') as HTMLTextAreaElement).value = schedule?.description || '';
    (document.getElementById('sch-date') as HTMLInputElement).value = schedule?.schedule_date || defaultDate || new Date().toISOString().split('T')[0];
    (document.getElementById('sch-start') as HTMLInputElement).value = schedule?.start_time?.substring(0,5) || defaultTime || '09:00';
    (document.getElementById('sch-end') as HTMLInputElement).value = schedule?.end_time?.substring(0,5) || '';
    (document.getElementById('sch-type') as HTMLSelectElement).value = schedule?.schedule_type || 'other';
    (document.getElementById('sch-location') as HTMLInputElement).value = schedule?.location || '';
    (document.getElementById('sch-participants') as HTMLInputElement).value = schedule?.participants?.join(', ') || '';
    (document.getElementById('sch-priority') as HTMLSelectElement).value = schedule?.priority || 'medium';
    (document.getElementById('sch-reminder') as HTMLInputElement).value = schedule?.reminder_minutes || '15';
    (document.getElementById('sch-status') as HTMLSelectElement).value = schedule?.status || 'active';
    document.getElementById('conflict-alert')!.classList.add('d-none');
    modal.show();
}

function openBookingModal() {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('bookingModal'));
    (document.getElementById('bk-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    modal.show();
}

function openReminderModal(reminder?: any) {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('reminderModal'));
    document.getElementById('reminderModalTitle')!.textContent = reminder ? 'Edit Reminder' : 'Add Reminder';
    (document.getElementById('rem-id') as HTMLInputElement).value = reminder?.id || '';
    (document.getElementById('rem-title') as HTMLInputElement).value = reminder?.title || '';
    (document.getElementById('rem-description') as HTMLTextAreaElement).value = reminder?.description || '';
    (document.getElementById('rem-date') as HTMLInputElement).value = reminder?.reminder_date || new Date().toISOString().split('T')[0];
    (document.getElementById('rem-time') as HTMLInputElement).value = reminder?.reminder_time?.substring(0,5) || '09:00';
    (document.getElementById('rem-repeat') as HTMLSelectElement).value = reminder?.repeat_type || 'once';
    (document.getElementById('rem-priority') as HTMLSelectElement).value = reminder?.priority || 'medium';
    modal.show();
}

function openTaskModal(task?: any) {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('taskModal'));
    document.getElementById('taskModalTitle')!.textContent = task ? 'Edit Task' : 'Add Task';
    (document.getElementById('tsk-id') as HTMLInputElement).value = task?.id || '';
    (document.getElementById('tsk-title') as HTMLInputElement).value = task?.title || '';
    (document.getElementById('tsk-description') as HTMLTextAreaElement).value = task?.description || '';
    (document.getElementById('tsk-due') as HTMLInputElement).value = task?.due_date || '';
    (document.getElementById('tsk-priority') as HTMLSelectElement).value = task?.priority || 'medium';
    modal.show();
}

function openFocusModal() {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('focusModal'));
    (document.getElementById('foc-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    modal.show();
}

function openFindTimeModal() {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('findTimeModal'));
    (document.getElementById('ft-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    document.getElementById('available-slots-list')!.innerHTML = '';
    modal.show();
}

// Auto-calculate end time (30 min after start) when start time changes
document.getElementById('sch-start')?.addEventListener('change', (e) => {
    const startVal = (e.target as HTMLInputElement).value;
    const endField = document.getElementById('sch-end') as HTMLInputElement;
    if (startVal && (!endField.value || endField.value <= startVal)) {
        const [h, m] = startVal.split(':').map(Number);
        const endM = m + 30;
        const endH = h + Math.floor(endM / 60);
        endField.value = `${endH.toString().padStart(2, '0')}:${(endM % 60).toString().padStart(2, '0')}`;
    }
});

// ===== Modal Save Handlers =====
document.getElementById('save-schedule-btn')?.addEventListener('click', async () => {
    const id = (document.getElementById('sch-id') as HTMLInputElement).value;
    const data = {
        title: (document.getElementById('sch-title') as HTMLInputElement).value,
        description: (document.getElementById('sch-description') as HTMLTextAreaElement).value,
        date: (document.getElementById('sch-date') as HTMLInputElement).value,
        startTime: (document.getElementById('sch-start') as HTMLInputElement).value,
        endTime: (document.getElementById('sch-end') as HTMLInputElement).value,
        scheduleType: (document.getElementById('sch-type') as HTMLSelectElement).value,
        location: (document.getElementById('sch-location') as HTMLInputElement).value,
        participants: (document.getElementById('sch-participants') as HTMLInputElement).value.split(',').map((s: string) => s.trim()).filter(Boolean),
        priority: (document.getElementById('sch-priority') as HTMLSelectElement).value,
        reminderMinutes: parseInt((document.getElementById('sch-reminder') as HTMLInputElement).value),
        status: (document.getElementById('sch-status') as HTMLSelectElement).value,
    };

    if (!data.title || !data.date || !data.startTime || !data.endTime) {
        showToast('Please fill required fields', 'warning');
        return;
    }

    try {
        if (id) {
            await api.updateSchedule(id, data);
            showToast('Schedule updated');
        } else {
            await api.createSchedule(data);
            showToast('Schedule created');
        }
        bootstrap.Modal.getInstance(document.getElementById('scheduleModal'))?.hide();
        if (currentPage === 'dashboard') renderDashboard();
        else if (currentPage === 'schedule') renderSchedule();
        else if (currentPage === 'calendar') renderCalendar();
    } catch (err: any) {
        if (err.hasConflict) {
            const alert = document.getElementById('conflict-alert')!;
            let slotsHtml = '';
            if (err.suggestedSlots?.length) {
                slotsHtml = '<br><strong>Suggested slots:</strong> ' + err.suggestedSlots.map((s: any) => `${formatTime12(s.start_time)} - ${formatTime12(s.end_time)}`).join(', ');
            }
            alert.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${err.error || 'Time conflict detected'}${slotsHtml}`;
            alert.classList.remove('d-none');
        } else {
            showToast(err.error || 'Failed to save', 'danger');
        }
    }
});

document.getElementById('save-booking-btn')?.addEventListener('click', async () => {
    const data = {
        name: (document.getElementById('bk-name') as HTMLInputElement).value,
        email: (document.getElementById('bk-email') as HTMLInputElement).value,
        company: (document.getElementById('bk-company') as HTMLInputElement).value,
        purpose: (document.getElementById('bk-purpose') as HTMLTextAreaElement).value,
        date: (document.getElementById('bk-date') as HTMLInputElement).value,
        time: (document.getElementById('bk-time') as HTMLInputElement).value,
        duration: parseInt((document.getElementById('bk-duration') as HTMLSelectElement).value),
        notes: (document.getElementById('bk-notes') as HTMLInputElement).value,
        address: (document.getElementById('bk-address') as HTMLInputElement)?.value || '',
        place: (document.getElementById('bk-place') as HTMLInputElement)?.value || '',
        phone: (document.getElementById('bk-phone') as HTMLInputElement)?.value || '',
        visitorType: (document.getElementById('bk-visitor-type') as HTMLSelectElement)?.value || 'external',
        frequency: (document.getElementById('bk-frequency') as HTMLSelectElement)?.value || 'once',
        what: (document.getElementById('bk-what') as HTMLTextAreaElement)?.value || '',
    };

    if (!data.name || !data.email || !data.purpose || !data.date || !data.time) {
        showToast('Please fill required fields', 'warning');
        return;
    }

    try {
        await api.createBooking(data);
        showToast('Booking request submitted');
        bootstrap.Modal.getInstance(document.getElementById('bookingModal'))?.hide();
        if (currentPage === 'bookings') renderBookings();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
});

document.getElementById('save-reminder-btn')?.addEventListener('click', async () => {
    const id = (document.getElementById('rem-id') as HTMLInputElement).value;
    const data = {
        title: (document.getElementById('rem-title') as HTMLInputElement).value,
        description: (document.getElementById('rem-description') as HTMLTextAreaElement).value,
        date: (document.getElementById('rem-date') as HTMLInputElement).value,
        time: (document.getElementById('rem-time') as HTMLInputElement).value,
        repeatType: (document.getElementById('rem-repeat') as HTMLSelectElement).value,
        priority: (document.getElementById('rem-priority') as HTMLSelectElement).value,
    };

    if (!data.title || !data.date || !data.time) {
        showToast('Please fill required fields', 'warning');
        return;
    }

    try {
        if (id) {
            await api.updateReminder(id, data);
            showToast('Reminder updated');
        } else {
            await api.createReminder(data);
            showToast('Reminder created');
        }
        bootstrap.Modal.getInstance(document.getElementById('reminderModal'))?.hide();
        if (currentPage === 'reminders') renderReminders();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
});

document.getElementById('save-task-btn')?.addEventListener('click', async () => {
    const id = (document.getElementById('tsk-id') as HTMLInputElement).value;
    const data = {
        title: (document.getElementById('tsk-title') as HTMLInputElement).value,
        description: (document.getElementById('tsk-description') as HTMLTextAreaElement).value,
        dueDate: (document.getElementById('tsk-due') as HTMLInputElement).value || null,
        priority: (document.getElementById('tsk-priority') as HTMLSelectElement).value,
    };

    if (!data.title) {
        showToast('Please enter a title', 'warning');
        return;
    }

    try {
        if (id) {
            await api.updateTask(id, data);
            showToast('Task updated');
        } else {
            await api.createTask(data);
            showToast('Task created');
        }
        bootstrap.Modal.getInstance(document.getElementById('taskModal'))?.hide();
        if (currentPage === 'tasks') renderTasks();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
});

document.getElementById('save-focus-btn')?.addEventListener('click', async () => {
    const data = {
        title: (document.getElementById('foc-title') as HTMLInputElement).value || 'Focus Time',
        date: (document.getElementById('foc-date') as HTMLInputElement).value,
        startTime: (document.getElementById('foc-start') as HTMLInputElement).value,
        endTime: (document.getElementById('foc-end') as HTMLInputElement).value,
    };

    if (!data.date || !data.startTime || !data.endTime) {
        showToast('Please fill required fields', 'warning');
        return;
    }

    try {
        await api.createFocusSession(data);
        showToast('Focus time scheduled');
        bootstrap.Modal.getInstance(document.getElementById('focusModal'))?.hide();
    } catch (err: any) {
        showToast(err.error || 'Failed', 'danger');
    }
});

// ===== Edit helpers =====
async function editSchedule(id: string) {
    try {
        const schedule = await api.get(`/schedules/${id}`);
        openScheduleModal(schedule);
    } catch {
        showToast('Failed to load schedule', 'danger');
    }
}

async function editReminder(id: string) {
    try {
        const reminder = await api.get(`/reminders/${id}`);
        openReminderModal(reminder);
    } catch {
        showToast('Failed to load reminder', 'danger');
    }
}

async function editTask(id: string) {
    try {
        const task = await api.get(`/tasks/${id}`);
        openTaskModal(task);
    } catch {
        showToast('Failed to load task', 'danger');
    }
}

// ===== Find Available Slots =====
async function findAvailableSlots() {
    const date = (document.getElementById('ft-date') as HTMLInputElement).value;
    const duration = parseInt((document.getElementById('ft-duration') as HTMLSelectElement).value);
    const el = document.getElementById('available-slots-list')!;

    if (!date) { el.innerHTML = '<div class="alert alert-warning">Please select a date</div>'; return; }

    try {
        const slots = await api.getAvailableSlots(date, duration);
        if (slots.length === 0) {
            el.innerHTML = '<div class="alert alert-info">No available slots for this date</div>';
            return;
        }
        el.innerHTML = slots.map((s: any) => `
            <div class="d-flex justify-content-between align-items-center p-2 rounded mb-1" style="background:rgba(62,142,104,0.06)">
                <span style="font-size:13px">${formatTime12(s.start_time)} - ${formatTime12(s.end_time)}</span>
                <button class="btn btn-sm btn-outline-forest" onclick="document.getElementById('sch-date').value='${date}';document.getElementById('sch-start').value='${s.start_time}';document.getElementById('sch-end').value='${s.end_time}';bootstrap.Modal.getInstance(document.getElementById('findTimeModal'))?.hide();openScheduleModal(null,'${s.start_time}','${date}')">
                    <i class="bi bi-plus"></i> Book
                </button>
            </div>
        `).join('');
    } catch (err: any) {
        el.innerHTML = `<div class="alert alert-danger">${err.error || 'Failed to find slots'}</div>`;
    }
}

// ===== Notification Polling =====
let notifPollInterval: any;

function startNotifPolling() {
    updateNotifBadge();
    notifPollInterval = setInterval(updateNotifBadge, 30000);
}

async function updateNotifBadge() {
    try {
        const { count } = await api.getUnreadNotifCount();
        const badges = document.querySelectorAll('#notif-badge, #mobile-notif-badge');
        badges.forEach(badge => {
            badge.textContent = count.toString();
            badge.classList.toggle('d-none', count === 0);
        });
    } catch {}
}
