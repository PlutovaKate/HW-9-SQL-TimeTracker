/**
 * admin-team.html — команда (адмін).
 *   GET /reports/present           — хто зараз на роботі (бонус ДЗ 5), оновлюється кожні 30 с
 *   GET /reports/team?from=&to=    — звіт по команді (ДЗ 5) + експорт
 *   GET /reports/entries?from=&to=&format= — журнал записів за період, завжди файл
 */
TT.page = {
    init() {
        const $form = $('#team-form');
        const range = TT.fmt.range('month');
        $form.find('[name=from]').val(range.from);
        $form.find('[name=to]').val(range.to);

        $('[data-preset]').on('click', (e) => {
            const r = TT.fmt.range(e.currentTarget.dataset.preset);
            $form.find('[name=from]').val(r.from);
            $form.find('[name=to]').val(r.to);
            this.loadTeam($form);
        });
        $form.on('submit', (e) => {
            e.preventDefault();
            this.loadTeam($form);
        });
        $('[data-export]').on('click', (e) => this.export($(e.currentTarget), $form));
        $('[data-journal]').on('click', (e) => this.exportJournal($(e.currentTarget), $form));
        $('#present-refresh').on('click', () => this.loadPresent());

        this.loadPresent();
        this.loadTeam($form);
        setInterval(() => this.loadPresent(), 30000);
    },

    async loadPresent() {
        try {
            const list = await TT.api.present();
            const { esc } = TT.fmt;
            $('#present-count').text(list.length);
            $('#present-updated').text(`оновлено о ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
            $('#present').html(list.length ? list.map((p) => `
                <div class="col-sm-6 col-xl-4">
                    <div class="card h-100"><div class="card-body d-flex align-items-center gap-3">
                        <span class="tt-avatar">${esc(TT.fmt.initials(p.full_name))}</span>
                        <div class="flex-grow-1 min-w-0">
                            <div class="fw-semibold text-truncate">${esc(p.full_name)}</div>
                            <div class="small text-body-secondary">з ${TT.fmt.time(p.since)} · ${TT.fmt.minutes(p.minutes_today)}</div>
                        </div>
                        ${p.on_lunch ? '<span class="badge text-bg-warning"><i class="bi bi-cup-hot me-1"></i>обід</span>' : '<span class="badge text-bg-success">працює</span>'}
                    </div></div>
                </div>`).join('') : `<div class="col-12">${TT.ui.empty('Зараз ніхто не відмітився на роботі', 'moon-stars')}</div>`);
        } catch (err) {
            TT.ui.error(err);
        }
    },

    async loadTeam($form) {
        TT.ui.clearErrors($form);
        const { from, to } = TT.ui.formData($form);
        $('#team').html(TT.ui.loadingRow(8));
        try {
            const rows = await TT.api.team(from, to);
            const { esc } = TT.fmt;
            $('#team').html(rows.length ? rows.map((r) => `
                <tr>
                    <td><a href="timesheet.html?user_id=${r.user_id}&month=${from.slice(0, 7)}">${esc(r.full_name)}</a></td>
                    <td class="fw-semibold">${TT.fmt.hm(r.worked_minutes)}</td>
                    <td>${TT.fmt.hm(r.norm_minutes)}</td>
                    <td>${TT.fmt.diff(r.diff_minutes)}</td>
                    <td>${r.late_count ? `<span class="badge text-bg-danger">${r.late_count}</span>` : '0'}</td>
                    <td>${r.vacation_days}</td>
                    <td>${r.sick_days}</td>
                    <td>${r.day_off_days}</td>
                </tr>`).join('') : TT.ui.emptyRow(8, 'Немає активних працівників'));

            const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
            $('#team-foot').html(rows.length ? `<tr class="fw-semibold">
                <td>Разом</td><td>${TT.fmt.hm(sum('worked_minutes'))}</td><td>${TT.fmt.hm(sum('norm_minutes'))}</td>
                <td>${TT.fmt.diff(sum('diff_minutes'))}</td><td>${sum('late_count')}</td>
                <td>${sum('vacation_days')}</td><td>${sum('sick_days')}</td><td>${sum('day_off_days')}</td></tr>` : '');
        } catch (err) {
            $('#team').html(TT.ui.emptyRow(8, 'Не вдалося побудувати звіт'));
            TT.ui.error(err, $form);
        }
    },

    async exportJournal($btn, $form) {
        const { from, to } = TT.ui.formData($form);
        const format = $btn.data('journal');
        await TT.ui.withBusy($btn, async () => {
            try {
                await TT.api.download('/reports/entries', { from, to, format }, `entries-${from}-${to}.${format}`);
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },

    async export($btn, $form) {
        const { from, to } = TT.ui.formData($form);
        const format = $btn.data('export');
        await TT.ui.withBusy($btn, async () => {
            try {
                await TT.api.download('/reports/team', { from, to, format }, `team-${from}-${to}.${format}`);
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },
};
