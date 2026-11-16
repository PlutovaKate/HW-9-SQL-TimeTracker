/**
 * Лекція 2 + ДЗ 2: користувачі (тільки адмін).
 *   GET    /users?page=&per_page=  → {items, total, page, per_page, pages}
 *   POST   /users                   → 201 user
 *   GET    /users/{id}              → user
 *   PATCH  /users/{id}              → user
 *   DELETE /users/{id}              → 204 (деактивація, а не видалення)
 */
(function () {
    const { route, http, validate, publicUser } = TT.mock;
    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

    function findUser(db, id) {
        const user = db.users.find((u) => u.id === Number(id));
        if (!user) throw http.notFound('User not found');
        return user;
    }

    function normalizeWorkStart(value) {
        if (value === undefined) return undefined;
        if (!TIME_RE.test(String(value))) {
            throw http.validation({ work_start: 'Expected format HH:MM or HH:MM:SS (UTC)' });
        }
        return value.length === 5 ? `${value}:00` : value;
    }

    route('GET', '/users', ({ db, query }) => {
        const perPage = Math.min(100, Math.max(1, parseInt(query.per_page || '20', 10) || 20));
        const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
        const total = db.users.length;
        const items = db.users.slice().sort((a, b) => a.id - b.id)
            .slice((page - 1) * perPage, page * perPage).map(publicUser);
        return http.json({ items, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) });
    }, { admin: true });

    route('POST', '/users', ({ db, body }) => {
        const data = validate(body, {
            full_name: 'required|min:2|max:255',
            email: 'required|email|max:255',
            password: 'required|min:8|max:72',
            role: 'required|in:admin,employee',
            work_start: 'max:8',
            daily_hours: 'int|min:1|max:12',
            vacation_days: 'int|min:0|max:60',
        });
        const email = data.email.trim().toLowerCase();
        if (db.users.some((u) => u.email === email)) {
            throw http.validation({ email: 'Email is already taken' });
        }
        const user = {
            id: TT.mock.db.nextId('users'),
            full_name: data.full_name.trim(),
            email,
            password: data.password,
            role: data.role,
            api_token: null,
            work_start: normalizeWorkStart(data.work_start ?? '06:00:00'),
            daily_hours: data.daily_hours ?? 8,
            vacation_days: data.vacation_days ?? 24,
            is_active: true,
            created_at: TT.mock.util.iso(new Date()),
        };
        db.users.push(user);
        return http.json(publicUser(user), 201);
    }, { admin: true });

    route('GET', '/users/{id}', ({ db, params }) => http.json(publicUser(findUser(db, params.id))), { admin: true });

    route('PATCH', '/users/{id}', ({ db, params, body, user: admin }) => {
        const user = findUser(db, params.id);
        // allowlist полів: password, api_token тут змінити не можна
        const data = validate(body, {
            full_name: 'min:2|max:255',
            email: 'email|max:255',
            role: 'in:admin,employee',
            work_start: 'max:8',
            daily_hours: 'int|min:1|max:12',
            vacation_days: 'int|min:0|max:60',
        });
        if (data.email !== undefined) {
            data.email = data.email.trim().toLowerCase();
            if (db.users.some((u) => u.email === data.email && u.id !== user.id)) {
                throw http.validation({ email: 'Email is already taken' });
            }
        }
        if (data.role !== undefined && user.id === admin.id && data.role !== 'admin') {
            throw http.conflict('You cannot remove the admin role from yourself');
        }
        if (data.work_start !== undefined) data.work_start = normalizeWorkStart(data.work_start);
        if (body && typeof body.is_active === 'boolean') {
            if (!body.is_active && user.id === admin.id) throw http.conflict('You cannot deactivate yourself');
            data.is_active = body.is_active;
        }
        Object.assign(user, data);
        if (user.is_active === false) user.api_token = null;
        return http.json(publicUser(user));
    }, { admin: true });

    route('DELETE', '/users/{id}', ({ db, params, user: admin }) => {
        const user = findUser(db, params.id);
        if (user.id === admin.id) throw http.conflict('You cannot deactivate yourself');
        user.is_active = false;
        user.api_token = null;
        return http.noContent();
    }, { admin: true });
})();
