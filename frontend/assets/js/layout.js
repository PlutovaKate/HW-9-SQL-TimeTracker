/**
 * Спільне для всіх сторінок: навбар, тости, помилки форм, підтвердження, API-консоль, тема.
 * Сторінка оголошує TT.page = { init() {...} }, і layout викликає її після перевірки доступу.
 */
TT.ui = (function () {
    const { esc } = TT.fmt;

    const NAV = [
        { href: 'dashboard.html', icon: 'speedometer2', text: 'Головна' },
        { href: 'entries.html', icon: 'clock-history', text: 'Мої записи' },
        { href: 'leaves.html', icon: 'airplane', text: 'Відпустки' },
        { href: 'timesheet.html', icon: 'table', text: 'Табель' },
    ];
    const ADMIN_NAV = [
        { href: 'admin-team.html', icon: 'people', text: 'Команда' },
        { href: 'admin-leaves.html', icon: 'inbox', text: 'Заявки', badge: 'pending' },
        { href: 'admin-users.html', icon: 'person-gear', text: 'Користувачі' },
        { href: 'admin-entries.html', icon: 'pencil-square', text: 'Записи часу' },
        { href: 'admin-holidays.html', icon: 'calendar-heart', text: 'Свята' },
    ];

    const page = () => location.pathname.split('/').pop() || 'index.html';

    function renderNavbar() {
        const user = TT.auth.user();
        if (!user) return;
        const current = page();
        const link = (item) => `
            <li class="nav-item">
                <a class="nav-link ${item.href === current ? 'active' : ''}" href="${item.href}">
                    <i class="bi bi-${item.icon} me-1"></i>${item.text}
                </a>
            </li>`;
        const adminActive = ADMIN_NAV.some((i) => i.href === current);
        const admin = TT.auth.isAdmin() ? `
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle ${adminActive ? 'active' : ''}" href="#" role="button" data-bs-toggle="dropdown">
                    <i class="bi bi-shield-lock me-1"></i>Адміністрування
                    <span class="badge rounded-pill text-bg-warning d-none" data-pending-badge></span>
                </a>
                <ul class="dropdown-menu">
                    ${ADMIN_NAV.map((i) => `
                        <li><a class="dropdown-item ${i.href === current ? 'active' : ''}" href="${i.href}">
                            <i class="bi bi-${i.icon} me-2"></i>${i.text}
                            ${i.badge ? '<span class="badge rounded-pill text-bg-warning ms-1 d-none" data-pending-badge></span>' : ''}
                        </a></li>`).join('')}
                </ul>
            </li>` : '';

        $('#tt-navbar').html(`
            <nav class="navbar ${TT.auth.isAdmin() ? 'navbar-expand-xl' : 'navbar-expand-lg'} tt-navbar border-bottom sticky-top">
                <div class="container">
                    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="dashboard.html">
                        <span class="tt-logo"><i class="bi bi-stopwatch"></i></span> TimeTracker
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#tt-nav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="tt-nav">
                        <ul class="navbar-nav me-auto">${NAV.map(link).join('')}${admin}</ul>
                        <ul class="navbar-nav align-items-lg-center gap-lg-1">
                            <li class="nav-item">
                                <span class="badge ${TT.config.USE_MOCK ? 'text-bg-warning' : 'text-bg-success'} tt-mode-badge"
                                      title="${TT.config.USE_MOCK ? 'Дані з мок-сервера в браузері' : esc(TT.config.API_BASE)}">
                                    ${TT.config.USE_MOCK ? 'MOCK' : 'LIVE'}
                                </span>
                            </li>
                            <li class="nav-item">
                                <button class="btn btn-link nav-link" type="button" data-theme-toggle title="Світла / темна тема">
                                    <i class="bi bi-circle-half"></i>
                                </button>
                            </li>
                            <li class="nav-item dropdown">
                                <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" data-bs-toggle="dropdown">
                                    <span class="tt-avatar tt-avatar-sm">${esc(TT.fmt.initials(user.full_name))}</span>
                                    <span>${esc(user.full_name)}</span>
                                </a>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><span class="dropdown-item-text small text-body-secondary">${esc(user.email)}<br>${esc(user.role_label || TT.fmt.label('role', user.role))}</span></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person me-2"></i>Профіль</a></li>
                                    <li><button class="dropdown-item" type="button" data-logout><i class="bi bi-box-arrow-right me-2"></i>Вийти</button></li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>`);
    }

    function refreshPendingBadge() {
        if (!TT.auth.isAdmin()) return;
        TT.api.leaves('pending').then((list) => {
            $('[data-pending-badge]').text(list.length).toggleClass('d-none', list.length === 0);
        }).catch(() => {});
    }

    // ---------- Тости ----------
    function toast(message, variant = 'success') {
        let $box = $('#tt-toasts');
        if (!$box.length) $box = $('<div id="tt-toasts" class="toast-container position-fixed top-0 end-0 p-3"></div>').appendTo('body');
        const icons = { success: 'check-circle', danger: 'exclamation-octagon', warning: 'exclamation-triangle', info: 'info-circle' };
        const $t = $(`
            <div class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive">
                <div class="d-flex">
                    <div class="toast-body"><i class="bi bi-${icons[variant] || 'info-circle'} me-2"></i>${esc(message)}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>`).appendTo($box);
        const t = new bootstrap.Toast($t[0], { delay: variant === 'danger' ? 6000 : 3500 });
        $t.on('hidden.bs.toast', () => $t.remove());
        t.show();
    }

    // ---------- Форми ----------
    function clearErrors($form) {
        $form.find('.is-invalid').removeClass('is-invalid');
        $form.find('.invalid-feedback[data-generated]').remove();
    }

    function showFieldErrors($form, fields) {
        let shown = 0;
        Object.entries(fields || {}).forEach(([name, message]) => {
            const $input = $form.find(`[name="${name}"]`);
            if (!$input.length) return;
            shown++;
            $input.addClass('is-invalid');
            const $fb = $(`<div class="invalid-feedback" data-generated>${esc(message)}</div>`);
            const $group = $input.closest('.input-group');
            ($group.length ? $group : $input).after($fb);
            if ($group.length) $group.addClass('has-validation');
        });
        return shown;
    }

    /** Показати помилку API: 422 — під полями форми, решта — тостом */
    function error(err, $form = null) {
        if (!(err instanceof TT.ApiError)) {
            console.error(err);
            toast('Неочікувана помилка: ' + (err && err.message ? err.message : err), 'danger');
            return;
        }
        if (err.status === 401) return; // інтерсептор уже веде на login
        if (err.status === 422 && $form) {
            clearErrors($form);
            const shown = showFieldErrors($form, err.fields);
            const rest = Object.entries(err.fields).filter(([name]) => !$form.find(`[name="${name}"]`).length);
            if (!shown || rest.length) {
                toast(rest.length ? rest.map(([k, v]) => `${k}: ${v}`).join('; ') : err.message, 'warning');
            }
            return;
        }
        const prefix = { 403: 'Немає доступу', 404: 'Не знайдено', 409: 'Конфлікт', 422: 'Помилка валідації', 500: 'Помилка сервера' }[err.status];
        const fields = Object.values(err.fields || {}).join('; ');
        toast(`${prefix ? prefix + ': ' : ''}${fields || err.message}`, err.status === 409 ? 'warning' : 'danger');
    }

    /** Значення полів форми → об'єкт; data-type="int" перетворює на число, порожні поля пропускає */
    function formData($form) {
        const result = {};
        $form.find('[name]').each(function () {
            const $el = $(this);
            if ($el.is(':disabled')) return;
            let value = $el.is(':checkbox') ? $el.is(':checked') : $el.val();
            if (typeof value === 'string') value = value.trim();
            if (value === '') return;
            if ($el.data('type') === 'int') value = Number(value);
            result[this.name] = value;
        });
        return result;
    }

    function busy($btn, on) {
        if (on) {
            $btn.data('html', $btn.html()).prop('disabled', true)
                .html(`<span class="spinner-border spinner-border-sm me-1"></span>${$btn.text().trim()}`);
        } else if ($btn.data('html') !== undefined) {
            $btn.prop('disabled', false).html($btn.data('html'));
        }
    }

    /** Обгортка для кнопок: показати спінер на час запиту */
    async function withBusy($btn, fn) {
        busy($btn, true);
        try {
            return await fn();
        } finally {
            busy($btn, false);
        }
    }

    // ---------- Підтвердження (замість window.confirm) ----------
    function confirm({ title = 'Підтвердження', body = '', ok = 'Так', variant = 'primary' } = {}) {
        return new Promise((resolve) => {
            const $m = $(`
                <div class="modal fade" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header"><h5 class="modal-title">${esc(title)}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body">${body}</div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Скасувати</button>
                                <button type="button" class="btn btn-${variant}" data-ok>${esc(ok)}</button>
                            </div>
                        </div>
                    </div>
                </div>`).appendTo('body');
            const modal = new bootstrap.Modal($m[0]);
            let result = false;
            $m.find('[data-ok]').on('click', () => { result = true; modal.hide(); });
            $m.on('hidden.bs.modal', () => { $m.remove(); resolve(result); });
            modal.show();
        });
    }

    // ---------- Заглушки станів ----------
    const loading = (text = 'Завантаження…') => `
        <div class="text-center text-body-secondary py-4"><div class="spinner-border spinner-border-sm me-2"></div>${esc(text)}</div>`;
    const empty = (text, icon = 'inbox') => `
        <div class="text-center text-body-secondary py-5"><i class="bi bi-${icon} fs-2 d-block mb-2"></i>${esc(text)}</div>`;
    const loadingRow = (cols) => `<tr><td colspan="${cols}">${loading()}</td></tr>`;
    const emptyRow = (cols, text) => `<tr><td colspan="${cols}">${empty(text)}</td></tr>`;

    // ---------- API-консоль ----------
    function renderConsole() {
        if (!$('#tt-console').length) {
            $('body').append(`
                <button class="btn btn-dark tt-console-btn shadow" type="button" data-bs-toggle="offcanvas" data-bs-target="#tt-console" title="API-консоль">
                    <i class="bi bi-terminal"></i> API <span class="badge text-bg-light ms-1" data-log-count>0</span>
                </button>
                <div class="offcanvas offcanvas-end tt-console" tabindex="-1" id="tt-console">
                    <div class="offcanvas-header border-bottom">
                        <div>
                            <h5 class="offcanvas-title mb-0"><i class="bi bi-terminal me-2"></i>API-консоль</h5>
                            <small class="text-body-secondary">Кожен запит фронта до API та відповідь</small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
                    </div>
                    <div class="offcanvas-body p-0 d-flex flex-column">
                        <div class="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center">
                            <div class="form-check form-switch mb-0">
                                <input class="form-check-input" type="checkbox" id="tt-mock-switch" ${TT.config.USE_MOCK ? 'checked' : ''}>
                                <label class="form-check-label" for="tt-mock-switch">Mock-сервер</label>
                            </div>
                            <code class="small ms-auto">${esc(TT.config.USE_MOCK ? 'браузер (mock)' : TT.config.API_BASE)}</code>
                            <div class="w-100"></div>
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-log-clear><i class="bi bi-trash me-1"></i>Очистити лог</button>
                            ${TT.config.USE_MOCK ? '<button class="btn btn-sm btn-outline-danger" type="button" data-mock-reset><i class="bi bi-arrow-counterclockwise me-1"></i>Скинути демо-дані</button>' : ''}
                        </div>
                        <div class="flex-grow-1 overflow-auto" data-log-list></div>
                    </div>
                </div>`);
        }

        const methodCls = { GET: 'text-bg-primary', POST: 'text-bg-success', PATCH: 'text-bg-warning', DELETE: 'text-bg-danger' };
        const statusCls = (s) => (s >= 200 && s < 300 ? 'text-success' : s >= 400 && s < 500 ? 'text-warning' : 'text-danger');
        const pretty = (v) => esc(typeof v === 'string' ? v : JSON.stringify(v, null, 2));

        const draw = (items) => {
            $('[data-log-count]').text(items.length);
            $('[data-log-list]').html(items.length ? items.map((it) => `
                <details class="tt-log-item border-bottom">
                    <summary class="d-flex align-items-center gap-2 px-3 py-2">
                        <span class="badge ${methodCls[it.method] || 'text-bg-secondary'} tt-method">${it.method}</span>
                        <code class="text-truncate flex-grow-1">${esc(it.url)}</code>
                        <span class="fw-semibold ${statusCls(it.status)}">${it.status || 'ERR'}</span>
                        <small class="text-body-secondary">${it.ms ?? '?'} мс</small>
                    </summary>
                    <div class="px-3 pb-3 small">
                        <div class="text-body-secondary mb-1">${new Date(it.at).toLocaleTimeString('uk-UA')} · ${it.mock ? 'mock' : 'live'}</div>
                        ${it.request ? `<div class="fw-semibold">Тіло запиту</div><pre class="tt-pre">${pretty(it.request)}</pre>` : ''}
                        <div class="fw-semibold">Відповідь</div><pre class="tt-pre">${it.response === null ? '(порожньо, 204)' : pretty(it.response)}</pre>
                    </div>
                </details>`).join('') : empty('Запитів ще не було', 'terminal'));
        };
        draw(TT.apiLog.items());
        TT.apiLog.onChange(draw);

        $(document).on('change', '#tt-mock-switch', function () {
            TT.store.set('tt_use_mock', this.checked);
            TT.auth.clear(); // токен мока не підходить справжньому API і навпаки
            location.href = 'login.html';
        });
        $(document).on('click', '[data-log-clear]', () => TT.apiLog.clear());
        $(document).on('click', '[data-mock-reset]', async () => {
            const ok = await confirm({
                title: 'Скинути демо-дані?',
                body: 'Усі зміни в мок-базі (записи часу, заявки, користувачі) буде втрачено, а дані згенеровано заново. Доведеться увійти ще раз.',
                ok: 'Скинути', variant: 'danger',
            });
            if (!ok) return;
            TT.mock.db.reset();
            TT.auth.clear();
            location.href = 'login.html';
        });
    }

    // ---------- Тема ----------
    function toggleTheme() {
        const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        TT.store.set('tt_theme', next);
    }

    // ---------- Старт сторінки ----------
    $(function () {
        const level = document.body.dataset.auth || 'user';
        if (!TT.auth.guard(level)) return;

        if (level !== 'guest') {
            renderNavbar();
            refreshPendingBadge();
            // оновити профіль (роль, ім'я) з сервера
            TT.api.me().then((user) => {
                const old = TT.auth.user();
                TT.auth.setUser(user);
                if (!old || old.role !== user.role || old.full_name !== user.full_name) {
                    renderNavbar();
                    refreshPendingBadge();
                }
            }).catch(() => {});
        }
        renderConsole();

        $(document).on('click', '[data-theme-toggle]', toggleTheme);
        $(document).on('click', '[data-logout]', async () => {
            try {
                await TT.api.logout();
            } catch (e) {
                // токен міг уже протухнути: однаково виходимо
            }
            TT.auth.clear();
            location.href = 'login.html';
        });

        if (TT.page && typeof TT.page.init === 'function') TT.page.init();
    });

    return {
        toast, error, clearErrors, showFieldErrors, formData, busy, withBusy, confirm,
        loading, empty, loadingRow, emptyRow, refreshPendingBadge,
        /** Параметр із query string */
        param: (name) => new URLSearchParams(location.search).get(name),
    };
})();
