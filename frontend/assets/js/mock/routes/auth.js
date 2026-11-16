/**
 * Лекція 2: автентифікація.
 *   POST  /auth/login     {email, password} → {token, user}
 *   POST  /auth/logout    → 204
 *   GET   /me             → user
 *   PATCH /me/password    {current_password, new_password} → 204   (ДЗ 2)
 */
(function () {
    const { route, http, validate, publicUser, util } = TT.mock;

    route('POST', '/auth/login', ({ body, db }) => {
        const data = validate(body, { email: 'required|email|max:255', password: 'required|max:255' });
        const email = data.email.trim().toLowerCase();
        const user = db.users.find((u) => u.email === email);

        // Однакова відповідь для «немає такого email», «невірний пароль» і «деактивований»
        if (!user || user.password !== data.password || !user.is_active) {
            throw http.unauthorized('Invalid email or password');
        }

        user.api_token = util.token();
        return http.json({ token: user.api_token, user: publicUser(user) });
    }, { auth: false });

    route('POST', '/auth/logout', ({ user }) => {
        user.api_token = null;
        return http.noContent();
    });

    route('GET', '/me', ({ user }) => http.json(publicUser(user)));

    route('PATCH', '/me/password', ({ user, body }) => {
        const data = validate(body, { current_password: 'required|max:255', new_password: 'required|min:8|max:72' });
        if (data.current_password !== user.password) {
            throw http.validation({ current_password: 'Current password is incorrect' });
        }
        if (data.new_password === user.password) {
            throw http.validation({ new_password: 'New password must differ from the current one' });
        }
        user.password = data.new_password;
        return http.noContent();
    });
})();
