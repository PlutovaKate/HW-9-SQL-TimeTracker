/** profile.html — GET /me, PATCH /me/password (ДЗ 2) */
TT.page = {
    async init() {
        const $form = $('#password-form');
        $form.on('submit', (e) => {
            e.preventDefault();
            this.changePassword($form);
        });

        try {
            this.render(await TT.api.me());
        } catch (err) {
            TT.ui.error(err);
        }
    },

    render(u) {
        const { esc } = TT.fmt;
        $('#avatar').text(TT.fmt.initials(u.full_name));
        $('#name').text(u.full_name);
        $('#email').text(u.email);
        $('#role').html(TT.fmt.badge('role', u.role, u.role_label));
        $('#details').html(`
            <dt class="col-sm-6">Початок робочого дня</dt>
            <dd class="col-sm-6">${esc(TT.fmt.workStartLocal(u.work_start))} <small class="text-body-secondary">(${esc(u.work_start.slice(0, 5))} UTC)</small></dd>
            <dt class="col-sm-6">Денна норма</dt><dd class="col-sm-6">${u.daily_hours} год</dd>
            <dt class="col-sm-6">Відпустка на рік</dt><dd class="col-sm-6">${u.vacation_days} робочих днів</dd>
            <dt class="col-sm-6">Статус</dt><dd class="col-sm-6">${u.is_active ? '<span class="badge text-bg-success">активний</span>' : '<span class="badge text-bg-secondary">неактивний</span>'}</dd>
            <dt class="col-sm-6">У системі з</dt><dd class="col-sm-6">${TT.fmt.dateTime(u.created_at)}</dd>`);
    },

    async changePassword($form) {
        TT.ui.clearErrors($form);
        const data = TT.ui.formData($form);
        // підтвердження перевіряємо на фронті: API його не приймає
        if (data.new_password && data.new_password !== data.new_password_confirmation) {
            TT.ui.showFieldErrors($form, { new_password_confirmation: 'Паролі не збігаються' });
            return;
        }
        await TT.ui.withBusy($form.find('[type=submit]'), async () => {
            try {
                await TT.api.changePassword({ current_password: data.current_password, new_password: data.new_password });
                $form[0].reset();
                TT.ui.toast('Пароль змінено');
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },
};
