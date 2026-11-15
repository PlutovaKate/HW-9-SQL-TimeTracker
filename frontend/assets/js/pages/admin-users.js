/**
 * admin-users.html — користувачі (адмін).
 *   GET /users?page=&per_page=, POST /users, PATCH /users/{id}, DELETE /users/{id} (деактивація)
 */
TT.page = {
    page: 1,
    perPage: 5,
    editing: null,
    users: [],

    init() {
        this.modal = new bootstrap.Modal('#user-modal');
        const $form = $('#user-form');

        $('#per-page').val(this.perPage).on('change', (e) => {
            this.perPage = Number(e.target.value);
            this.page = 1;
            this.load();
        });
        $('#pagination').on('click', '[data-page]', (e) => {
            e.preventDefault();
            this.page = Number(e.currentTarget.dataset.page);
            this.load();
        });
        $('#new-user').on('click', () => this.open(null));
        $('#users').on('click', '[data-edit]', (e) => this.open(this.users.find((u) => u.id === Number(e.currentTarget.dataset.edit))));
        $('#users').on('click', '[data-toggle-active]', (e) => this.toggleActive(Number(e.currentTarget.dataset.toggleActive)));
        $form.on('input', '[name=work_start]', () => this.workStartHint($form));
        $form.on('submit', (e) => {
            e.preventDefault();
            this.save($form);
        });

        this.load();
    },

    async load() {
        $('#users').html(TT.ui.loadingRow(7));
        try {
            const res = await TT.api.users(this.page, this.perPage);
            if (res.page > res.pages && res.pages > 0) {
                this.page = res.pages;
                return this.load();
            }
            this.users = res.items;
            this.render(res);
        } catch (err) {
            $('#users').html(TT.ui.emptyRow(7, 'Не вдалося завантажити користувачів'));
            TT.ui.error(err);
        }
    },

    render(res) {
        const { esc } = TT.fmt;
        const me = TT.auth.user().id;
        $('#total').text(res.total);
        $('#users').html(res.items.length ? res.items.map((u) => `
            <tr class="${u.is_active ? '' : 'text-body-secondary'}">
                <td class="text-body-secondary">${u.id}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="tt-avatar tt-avatar-sm">${esc(TT.fmt.initials(u.full_name))}</span>
                        <div><div class="fw-semibold">${esc(u.full_name)}${u.id === me ? ' <span class="badge text-bg-light border">це ви</span>' : ''}</div>
                        <small class="text-body-secondary">${esc(u.email)}</small></div>
                    </div>
                </td>
                <td>${TT.fmt.badge('role', u.role, u.role_label)}</td>
                <td class="tabular">${TT.fmt.workStartLocal(u.work_start)} <small class="text-body-secondary">(${u.work_start.slice(0, 5)} UTC)</small></td>
                <td class="tabular">${u.daily_hours} год · ${u.vacation_days} дн</td>
                <td>${u.is_active ? '<span class="badge text-bg-success">активний</span>' : '<span class="badge text-bg-secondary">неактивний</span>'}</td>
                <td class="text-end text-nowrap">
                    <a class="btn btn-sm btn-outline-secondary" href="timesheet.html?user_id=${u.id}" title="Табель"><i class="bi bi-table"></i></a>
                    <a class="btn btn-sm btn-outline-secondary" href="admin-entries.html?user_id=${u.id}" title="Записи часу"><i class="bi bi-clock-history"></i></a>
                    <button class="btn btn-sm btn-outline-primary" data-edit="${u.id}" title="Редагувати"><i class="bi bi-pencil"></i></button>
                    ${u.id === me ? '' : `<button class="btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}" data-toggle-active="${u.id}"
                        title="${u.is_active ? 'Деактивувати' : 'Активувати'}"><i class="bi bi-${u.is_active ? 'person-x' : 'person-check'}"></i></button>`}
                </td>
            </tr>`).join('') : TT.ui.emptyRow(7, 'Користувачів немає'));

        const pages = [];
        for (let p = 1; p <= res.pages; p++) {
            pages.push(`<li class="page-item ${p === res.page ? 'active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`);
        }
        $('#pagination').html(`
            <li class="page-item ${res.page <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${res.page - 1}">&laquo;</a></li>
            ${pages.join('')}
            <li class="page-item ${res.page >= res.pages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${res.page + 1}">&raquo;</a></li>`);
    },

    open(user) {
        const $form = $('#user-form');
        this.editing = user;
        $form[0].reset();
        TT.ui.clearErrors($form);
        $('#user-modal-title').text(user ? `Редагування: ${user.full_name}` : 'Новий користувач');
        $('#password-group').toggleClass('d-none', !!user);
        $form.find('[name=password]').prop('disabled', !!user);

        const values = user || { role: 'employee', work_start: '06:00:00', daily_hours: 8, vacation_days: 24 };
        ['full_name', 'email', 'role', 'daily_hours', 'vacation_days'].forEach((k) => $form.find(`[name=${k}]`).val(values[k] ?? ''));
        $form.find('[name=work_start]').val((values.work_start || '06:00:00').slice(0, 5));
        this.workStartHint($form);
        this.modal.show();
    },

    workStartHint($form) {
        const v = $form.find('[name=work_start]').val();
        $('#work-start-hint').text(v ? `≈ ${TT.fmt.workStartLocal(v + ':00')} за вашим місцевим часом` : '');
    },

    async save($form) {
        TT.ui.clearErrors($form);
        const data = TT.ui.formData($form);
        await TT.ui.withBusy($form.find('[type=submit]'), async () => {
            try {
                if (this.editing) {
                    await TT.api.updateUser(this.editing.id, data);
                    TT.ui.toast('Зміни збережено');
                } else {
                    await TT.api.createUser(data);
                    TT.ui.toast('Користувача створено');
                }
                this.modal.hide();
                this.load();
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },

    async toggleActive(id) {
        const user = this.users.find((u) => u.id === id);
        if (!user) return;
        try {
            if (user.is_active) {
                const ok = await TT.ui.confirm({
                    title: 'Деактивувати користувача?',
                    body: `<strong>${TT.fmt.esc(user.full_name)}</strong> не зможе увійти, а його токен буде скинуто. Записи й заявки залишаться.`,
                    ok: 'Деактивувати', variant: 'danger',
                });
                if (!ok) return;
                await TT.api.deactivateUser(id);
                TT.ui.toast('Користувача деактивовано', 'info');
            } else {
                await TT.api.updateUser(id, { is_active: true });
                TT.ui.toast('Користувача активовано');
            }
            this.load();
        } catch (err) {
            TT.ui.error(err);
        }
    },
};
