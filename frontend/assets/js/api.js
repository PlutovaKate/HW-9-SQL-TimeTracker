/**
 * HTTP-клієнт до TimeTracker API.
 *
 * Усі запити йдуть через один екземпляр axios:
 *   - request-інтерсептор додає заголовок Authorization: Bearer <token>;
 *   - response-інтерсептор розпаковує помилку {"error": {...}} у TT.ApiError,
 *     на 401 розлогінює і веде на login.html, і пише кожен запит в «API-консоль».
 *
 * Якщо TT.config.USE_MOCK = true, axios отримує мок-адаптер (assets/js/mock/server.js),
 * і відповіді формує браузер. Код нижче й код сторінок від цього не змінюються.
 */
TT.ApiError = class extends Error {
    constructor(status, code, message, fields = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields || {};
    }
};

/** Журнал запитів для API-консолі (sessionStorage, щоб пережити перехід між сторінками) */
TT.apiLog = (function () {
    const KEY = 'tt_api_log';
    const listeners = [];
    let items = [];
    try {
        items = JSON.parse(sessionStorage.getItem(KEY)) || [];
    } catch (e) {
        items = [];
    }

    const SECRET = /password|token/i;
    function mask(value) {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(mask);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET.test(k) && typeof v === 'string' ? '••••••' : mask(v)]));
    }

    return {
        items: () => items,
        onChange: (fn) => listeners.push(fn),
        clear() {
            items = [];
            try { sessionStorage.removeItem(KEY); } catch (e) { /* ігноруємо */ }
            listeners.forEach((fn) => fn(items));
        },
        add(entry) {
            entry.request = mask(entry.request);
            entry.response = mask(entry.response);
            items.unshift(entry);
            items = items.slice(0, 60);
            try { sessionStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* ігноруємо */ }
            listeners.forEach((fn) => fn(items));
        },
    };
})();

TT.api = (function () {
    const http = axios.create({
        baseURL: TT.config.API_BASE,
        timeout: 15000,
        headers: { Accept: 'application/json' },
    });

    if (TT.config.USE_MOCK) {
        http.defaults.adapter = TT.mock.adapter;
    }

    function log(config, status, body) {
        if (!config) return;
        let request = config.data;
        if (typeof request === 'string') {
            try { request = JSON.parse(request); } catch (e) { /* лишаємо рядком */ }
        }
        const query = new URLSearchParams(Object.entries(config.params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
        TT.apiLog.add({
            at: new Date().toISOString(),
            method: (config.method || 'get').toUpperCase(),
            url: '/api' + config.url + (query ? `?${query}` : ''),
            status,
            ms: config.metadata ? Math.round(performance.now() - config.metadata.start) : null,
            request: request ?? null,
            response: body instanceof Blob ? `[файл ${body.type || 'blob'}, ${body.size} байт]` : body ?? null,
            mock: TT.config.USE_MOCK,
        });
    }

    http.interceptors.request.use((config) => {
        const token = TT.auth.token();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        config.metadata = { start: performance.now() };
        return config;
    });

    http.interceptors.response.use(
        (response) => {
            log(response.config, response.status, response.data);
            return response;
        },
        async (error) => {
            const response = error.response;
            let body = response ? response.data : null;
            // для запитів файлів (responseType: 'blob') помилка теж приходить як Blob
            if (body instanceof Blob) {
                try {
                    body = JSON.parse(await body.text());
                } catch (e) {
                    body = null;
                }
            }
            log(error.config, response ? response.status : 0, body);

            if (!response) {
                throw new TT.ApiError(0, 'network',
                    `API недоступний (${TT.config.API_BASE}). Запустіть бекенд або увімкніть Mock у кнопці «API».`);
            }

            const e = (body && body.error) || {};
            const apiError = new TT.ApiError(response.status, e.code || 'http_error',
                e.message || `HTTP ${response.status}`, e.fields);

            if (response.status === 401 && !(error.config && error.config.skipAuthRedirect)) {
                TT.auth.clear();
                TT.auth.redirectToLogin();
            }
            throw apiError;
        },
    );

    /** Відповідь {"data": ...} → ...; 204 → null */
    const data = (promise) => promise.then((r) => (r.status === 204 ? null : r.data.data));

    function filenameFrom(headers, fallback) {
        const disposition = (headers && (headers['content-disposition'] || headers['Content-Disposition'])) || '';
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        return match ? match[1] : fallback;
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        http,

        // Лекція 1
        health: () => data(http.get('/health')),

        // Лекція 2: автентифікація
        login: (email, password) => data(http.post('/auth/login', { email, password }, { skipAuthRedirect: true })),
        logout: () => data(http.post('/auth/logout', null, { skipAuthRedirect: true })),
        me: () => data(http.get('/me')),
        changePassword: (payload) => data(http.patch('/me/password', payload)),

        // Лекція 2 + ДЗ: користувачі (адмін)
        users: (page = 1, perPage = 20) => data(http.get('/users', { params: { page, per_page: perPage } })),
        user: (id) => data(http.get(`/users/${id}`)),
        createUser: (payload) => data(http.post('/users', payload)),
        updateUser: (id, payload) => data(http.patch(`/users/${id}`, payload)),
        deactivateUser: (id) => data(http.delete(`/users/${id}`)),

        // Лекція 3: облік часу
        status: () => data(http.get('/time/status')),
        checkIn: () => data(http.post('/time/check-in')),
        lunchStart: () => data(http.post('/time/lunch/start')),
        lunchEnd: () => data(http.post('/time/lunch/end')),
        checkOut: () => data(http.post('/time/check-out')),
        myEntries: (from, to) => data(http.get('/me/entries', { params: { from, to } })),
        entries: (userId, from, to) => data(http.get('/time-entries', { params: { user_id: userId, from, to } })),
        updateEntry: (id, payload) => data(http.patch(`/time-entries/${id}`, payload)),

        // Лекція 4: відпустки
        myLeaves: () => data(http.get('/me/leaves')),
        requestLeave: (payload) => data(http.post('/me/leaves', payload)),
        cancelLeave: (id) => data(http.delete(`/me/leaves/${id}`)),
        balance: (year) => data(http.get('/me/leave-balance', { params: { year } })),
        leaves: (status) => data(http.get('/leaves', { params: { status } })),
        approveLeave: (id) => data(http.patch(`/leaves/${id}/approve`)),
        rejectLeave: (id) => data(http.patch(`/leaves/${id}/reject`)),

        // Лекція 5: звіти
        timesheet: (month, userId) => data(http.get('/reports/timesheet', { params: { month, user_id: userId } })),
        team: (from, to) => data(http.get('/reports/team', { params: { from, to } })),
        present: () => data(http.get('/reports/present')),

        // ДЗ 1: свята
        holidays: (year) => data(http.get('/holidays', { params: { year } })),
        createHoliday: (payload) => data(http.post('/holidays', payload)),
        deleteHoliday: (id) => data(http.delete(`/holidays/${id}`)),

        /** Завантажити файл звіту (?format=csv|json|md|xlsx) і зберегти його */
        async download(path, params, fallbackName) {
            // великий файл качається довго: глобальний timeout тут не діє
            const response = await http.get(path, { params, responseType: 'blob', timeout: 0 });
            saveBlob(response.data, filenameFrom(response.headers, fallbackName));
        },
    };
})();
