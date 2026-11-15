/**
 * Токен і поточний користувач (localStorage).
 * Доступ до сторінки задає атрибут <body data-auth="guest|user|admin">.
 */
TT.auth = {
    token() {
        return TT.store.get('tt_token');
    },

    user() {
        return TT.store.get('tt_user');
    },

    save(token, user) {
        TT.store.set('tt_token', token);
        TT.store.set('tt_user', user);
    },

    setUser(user) {
        TT.store.set('tt_user', user);
    },

    clear() {
        TT.store.remove('tt_token');
        TT.store.remove('tt_user');
    },

    isAdmin() {
        const user = this.user();
        return !!user && user.role === 'admin';
    },

    currentPage() {
        return (location.pathname.split('/').pop() || 'index.html') + location.search;
    },

    redirectToLogin() {
        const next = this.currentPage();
        location.href = 'login.html' + (next && !next.startsWith('login.html') ? `?next=${encodeURIComponent(next)}` : '');
    },

    /** true — можна показувати сторінку; false — уже пішов редірект */
    guard(level) {
        if (level === 'guest') {
            if (this.token()) {
                location.replace('dashboard.html');
                return false;
            }
            return true;
        }
        if (!this.token() || !this.user()) {
            this.redirectToLogin();
            return false;
        }
        if (level === 'admin' && !this.isAdmin()) {
            location.replace('dashboard.html');
            return false;
        }
        return true;
    },
};
