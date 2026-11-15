/** login.html — POST /auth/login */
TT.page = {
    DEMO: [
        ['admin@example.com', 'Олена Адміністраторка', 'адмін'],
        ['ivan@example.com', 'Іван Петренко', 'працівник'],
        ['maria@example.com', 'Марія Коваленко', 'працівник'],
        ['taras@example.com', 'Тарас Мельник', '6 год/день'],
        ['former@example.com', 'Петро Звільнений', 'неактивний → 401'],
    ],

    init() {
        const $form = $('#login-form');
        const { esc } = TT.fmt;

        $('#demo-accounts').html(this.DEMO.map(([email, name, note]) => `
            <button type="button" class="list-group-item list-group-item-action tt-demo-account d-flex align-items-center gap-3" data-email="${esc(email)}">
                <span class="tt-avatar tt-avatar-sm">${esc(TT.fmt.initials(name))}</span>
                <span class="flex-grow-1 text-start"><span class="d-block">${esc(name)}</span><small class="text-body-secondary">${esc(email)}</small></span>
                <span class="badge text-bg-light border">${esc(note)}</span>
            </button>`).join(''));
        $('#demo-block').toggleClass('d-none', !TT.config.USE_MOCK);

        $('#demo-accounts').on('click', '[data-email]', function () {
            $form.find('[name=email]').val(this.dataset.email);
            $form.find('[name=password]').val('password');
            $form.trigger('submit');
        });

        $form.on('submit', async (e) => {
            e.preventDefault();
            TT.ui.clearErrors($form);
            $('#login-alert').addClass('d-none');
            const { email = '', password = '' } = TT.ui.formData($form);

            await TT.ui.withBusy($form.find('[type=submit]'), async () => {
                try {
                    const { token, user } = await TT.api.login(email, password);
                    TT.auth.save(token, user);
                    const next = TT.ui.param('next');
                    // приймаємо тільки локальні сторінки, щоб ?next= не вів на чужий сайт
                    location.href = next && /^[\w-]+\.html(\?.*)?$/.test(next) ? next : 'dashboard.html';
                } catch (err) {
                    if (err.status === 401) {
                        $('#login-alert').removeClass('d-none').text('Невірний email або пароль, або обліковий запис деактивовано.');
                    } else {
                        TT.ui.error(err, $form);
                    }
                }
            });
        });
    },
};
