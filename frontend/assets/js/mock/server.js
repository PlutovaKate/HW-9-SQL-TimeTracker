/**
 * Мок-сервер: власний axios adapter, який замість мережевого запиту
 * знаходить обробник за методом і шляхом і повертає відповідь у форматі API:
 *   успіх   → {"data": ...}
 *   помилка → {"error": {"code", "message", "fields"}}
 *
 * Обробники маршрутів лежать у mock/routes/*.js і реєструються через TT.mock.route().
 * Сторінки про мок нічого не знають: вони працюють зі звичайним axios.
 */
TT.mock = TT.mock || {};

(function () {
    const routes = [];

    class HttpError extends Error {
        constructor(status, code, message, fields = {}) {
            super(message);
            this.status = status;
            this.code = code;
            this.fields = fields;
        }
    }

    TT.mock.HttpError = HttpError;

    /** Відповіді й помилки, як у App\Core\Response та App\Core\Exceptions */
    TT.mock.http = {
        json: (data, status = 200) => ({ status, body: { data }, headers: { 'content-type': 'application/json; charset=utf-8' } }),
        noContent: () => ({ status: 204, body: null, headers: {} }),
        file: (content, contentType, filename) => ({
            status: 200,
            body: content,
            raw: true,
            headers: {
                'content-type': contentType,
                'content-disposition': `attachment; filename="${filename}"`,
            },
        }),
        notFound: (message = 'Not found') => new HttpError(404, 'not_found', message),
        unauthorized: (message = 'Unauthorized') => new HttpError(401, 'unauthorized', message),
        forbidden: (message = 'Forbidden') => new HttpError(403, 'forbidden', message),
        conflict: (message) => new HttpError(409, 'conflict', message),
        validation: (fields, message = 'Validation failed') => new HttpError(422, 'validation', message, fields),
    };

    /**
     * Аналог App\Core\Validator::validate(): ті самі правила й тексти помилок.
     * Повертає лише поля з $rules; кидає 422, якщо є помилки.
     */
    TT.mock.validate = function (data, rules) {
        const errors = {};
        const result = {};
        Object.entries(rules).forEach(([field, ruleString]) => {
            const list = ruleString.split('|');
            const value = data ? data[field] : undefined;
            if (value === undefined || value === null || value === '') {
                if (list.includes('required')) errors[field] = 'This field is required';
                return;
            }
            const isInt = list.includes('int');
            for (const rule of list) {
                const [name, arg] = rule.split(':');
                const size = isInt ? Number(value) : String(value).length;
                let error = null;
                if (name === 'int' && !/^-?\d+$/.test(String(value))) error = 'Must be an integer';
                if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) error = 'Must be a valid email';
                if (name === 'min' && size < Number(arg)) error = isInt ? `Must be at least ${arg}` : `Must be at least ${arg} characters`;
                if (name === 'max' && size > Number(arg)) error = isInt ? `Must be at most ${arg}` : `Must be at most ${arg} characters`;
                if (name === 'in' && !arg.split(',').includes(String(value))) error = `Must be one of: ${arg}`;
                if (name === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) error = 'Must be a date in format YYYY-MM-DD';
                if (name === 'datetime' && TT.mock.util.normalizeDateTime(String(value)) === null) {
                    error = 'Must be a datetime in format YYYY-MM-DDTHH:MM:SSZ';
                }
                if (error) {
                    errors[field] = error;
                    break;
                }
            }
            if (!errors[field]) result[field] = isInt ? Number(value) : value;
        });
        if (Object.keys(errors).length) throw TT.mock.http.validation(errors);
        return result;
    };

    /**
     * Реєстрація маршруту, як $router->get('/api/users/{id}', ..., [Auth, Admin]).
     * opts.auth  — потрібен Bearer-токен (за замовчуванням true)
     * opts.admin — тільки для адміністратора
     */
    TT.mock.route = function (method, path, handler, opts = {}) {
        const keys = [];
        const pattern = new RegExp('^' + path.replace(/\{(\w+)\}/g, (_, key) => {
            keys.push(key);
            return '([^/]+)';
        }) + '$');
        routes.push({ method, path, pattern, keys, handler, auth: opts.auth !== false, admin: !!opts.admin });
    };

    /** Публічний профіль користувача (без password та api_token) */
    TT.mock.publicUser = function (user) {
        return {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            role_label: TT.fmt.label('role', user.role),
            work_start: user.work_start,
            daily_hours: user.daily_hours,
            vacation_days: user.vacation_days,
            is_active: user.is_active,
            created_at: user.created_at,
        };
    };

    function header(config, name) {
        const h = config.headers || {};
        if (typeof h.get === 'function') return h.get(name);
        return h[name] || h[name.toLowerCase()];
    }

    function parseRequest(config) {
        const base = config.baseURL || '';
        let url = config.url || '';
        if (base && url.startsWith(base)) url = url.slice(base.length);
        const [path, queryString] = url.split('?');
        const query = {};
        new URLSearchParams(queryString || '').forEach((v, k) => { query[k] = v; });
        Object.entries(config.params || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') query[k] = String(v);
        });
        let body = {};
        if (typeof config.data === 'string' && config.data !== '') {
            try {
                body = JSON.parse(config.data);
            } catch (e) {
                throw new HttpError(400, 'bad_request', 'Invalid JSON body');
            }
        } else if (config.data && typeof config.data === 'object') {
            body = config.data;
        }
        return { method: (config.method || 'get').toUpperCase(), path: '/' + path.replace(/^\/+/, ''), query, body };
    }

    function handle(config) {
        const req = parseRequest(config);
        const db = TT.mock.db.data;

        if (req.method === 'GET' && req.path === '/health') {
            return TT.mock.http.json({ status: 'ok', mock: true });
        }

        let allowed = [];
        for (const route of routes) {
            const match = req.path.match(route.pattern);
            if (!match) continue;
            if (route.method !== req.method) {
                allowed.push(route.method);
                continue;
            }

            const params = {};
            route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });

            // AuthMiddleware / AdminMiddleware
            let user = null;
            if (route.auth) {
                const auth = header(config, 'Authorization') || '';
                const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
                user = token ? db.users.find((u) => u.api_token === token && u.is_active) : null;
                if (!user) throw TT.mock.http.unauthorized();
                if (route.admin && user.role !== 'admin') throw TT.mock.http.forbidden();
            }

            return route.handler({ ...req, params, user, db, now: new Date() });
        }

        if (allowed.length) {
            throw new HttpError(405, 'method_not_allowed',
                `Method ${req.method} is not allowed for /api${req.path}. Allowed: ${allowed.join(', ')}`);
        }
        throw new HttpError(404, 'not_found', 'Route not found');
    }

    function toResponse(result, config) {
        let data = result.body;
        if (result.raw) {
            data = config.responseType === 'blob' ? new Blob([data], { type: result.headers['content-type'] }) : data;
        } else if (data !== null && config.responseType === 'blob') {
            data = new Blob([JSON.stringify(data)], { type: 'application/json' });
        } else if (data !== null) {
            // глибока копія: сторінка не повинна мати посилань на об'єкти «бази»
            data = JSON.parse(JSON.stringify(data));
        }
        return { data, status: result.status, statusText: String(result.status), headers: result.headers, config, request: {} };
    }

    TT.mock.adapter = function (config) {
        const [min, max] = TT.config.MOCK_DELAY;
        const delay = min + Math.random() * (max - min);

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                let result;
                try {
                    result = handle(config);
                    TT.mock.db.save();
                } catch (e) {
                    if (e instanceof HttpError) {
                        result = {
                            status: e.status,
                            body: { error: { code: e.code, message: e.message, fields: e.fields || {} } },
                            headers: { 'content-type': 'application/json; charset=utf-8' },
                        };
                    } else {
                        console.error('[mock] 500', e);
                        result = {
                            status: 500,
                            body: { error: { code: 'server_error', message: String(e.message || e), fields: {} } },
                            headers: { 'content-type': 'application/json; charset=utf-8' },
                        };
                    }
                }

                const response = toResponse(result, config);
                if (response.status >= 200 && response.status < 300) {
                    resolve(response);
                } else {
                    const code = response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST';
                    reject(new axios.AxiosError(`Request failed with status code ${response.status}`, code, config, {}, response));
                }
            }, delay);
        });
    };
})();
