/**
 * timesheet.html — табель за місяць (лекція 5).
 *   GET /reports/timesheet?month=&user_id=           → JSON
 *   GET /reports/timesheet?...&format=csv|json|md|xlsx → файл
 * Адмін бачить вибір працівника (GET /users), працівник — тільки себе.
 */
TT.page = {
    report: null,

    init() {
        const month = TT.ui.param('month') || TT.fmt.ym(0);
        $('#month').val(month);

        if (TT.auth.isAdmin()) {
            $('#user-picker').removeClass('d-none');
            TT.api.users(1, 100).then(({ items }) => {
                const selected = Number(TT.ui.param('user_id')) || TT.auth.user().id;
                $('#user-id').html(items.map((u) => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${TT.fmt.esc(u.full_name)}${u.is_active ? '' : ' (неактивний)'}</option>`).join(''));
                this.load();
            }).catch((err) => TT.ui.error(err));
        } else {
            this.load();
        }

        $('#month, #user-id').on('change', () => this.load());
        $('[data-shift]').on('click', (e) => {
            const [y, m] = $('#month').val().split('-').map(Number);
            const d = new Date(y, m - 1 + Number(e.currentTarget.dataset.shift), 1);
            $('#month').val(`${d.getFullYear()}-${TT.fmt.pad(d.getMonth() + 1)}`);
            this.load();
        });
        $('[data-export]').on('click', (e) => this.export($(e.currentTarget)));
    },

    params() {
        const params = { month: $('#month').val() };
        if (TT.auth.isAdmin() && $('#user-id').val()) params.user_id = $('#user-id').val();
        return params;
    },

    async load() {
        const params = this.params();
        history.replaceState(null, '', `?${new URLSearchParams(params)}`);
        $('#days').html(TT.ui.loadingRow(8));
        try {
            this.report = await TT.api.timesheet(params.month, params.user_id);
            this.render();
        } catch (err) {
            $('#days').html(TT.ui.emptyRow(8, 'Не вдалося побудувати табель'));
            TT.ui.error(err);
        }
    },

    render() {
        const r = this.report;
        const t = r.totals;
        const today = TT.fmt.ymd();
        $('#title').text(`Табель: ${r.user.full_name}`);
        $('#subtitle').text(TT.fmt.month(r.month));

        $('#t-worked').text(TT.fmt.hm(t.worked_minutes));
        $('#t-norm').text(`з ${TT.fmt.hm(t.norm_minutes)} норми`);
        $('#t-diff').html(TT.fmt.diff(t.diff_minutes));
        $('#t-percent').text(t.norm_percent === null ? '—' : `${t.norm_percent}%`);
        $('#t-days').text(t.working_days);
        $('#t-late').text(t.late_count);
        $('#t-absent').text(`${t.vacation_days} / ${t.sick_days} / ${t.day_off_days}`);

        $('#days').html(r.days.map((d) => {
            const future = d.date > today;
            const dayOff = d.day_status !== 'working';
            const statusBadge = {
                working: '', weekend: '<span class="badge text-bg-secondary">вихідний</span>',
                holiday: '<span class="badge text-bg-secondary">свято</span>',
                vacation: '<span class="badge text-bg-info">відпустка</span>',
                sick: '<span class="badge text-bg-warning">лікарняний</span>',
                day_off: '<span class="badge text-bg-primary">відгул</span>',
            }[d.day_status] ?? TT.fmt.esc(d.day_status);
            const noData = !d.first_in && d.day_status === 'working' && !future && d.date !== today;
            return `<tr class="ds-${d.day_status} ${future ? 'is-future' : ''} ${d.date === today ? 'is-today' : ''}">
                <td><span class="fw-semibold">${d.date.slice(8)}</span> <small class="text-body-secondary">${TT.fmt.weekday(d.date)}</small></td>
                <td>${statusBadge}${noData ? '<span class="badge text-bg-danger">немає записів</span>' : ''}</td>
                <td>${TT.fmt.time(d.first_in)}${d.is_late ? ' <i class="bi bi-alarm text-danger" title="Запізнення"></i>' : ''}</td>
                <td>${TT.fmt.time(d.last_out)}</td>
                <td>${d.lunch_minutes ? TT.fmt.hm(d.lunch_minutes) : '—'}</td>
                <td class="fw-semibold">${d.worked_minutes ? TT.fmt.hm(d.worked_minutes) : '—'}</td>
                <td>${d.norm_minutes ? TT.fmt.hm(d.norm_minutes) : '—'}</td>
                <td>${dayOff && !d.worked_minutes ? '—' : TT.fmt.diff(d.diff_minutes)}</td>
            </tr>`;
        }).join(''));

        $('#days-foot').html(`<tr class="fw-semibold">
            <td colspan="5">Разом за місяць</td>
            <td>${TT.fmt.hm(t.worked_minutes)}</td>
            <td>${TT.fmt.hm(t.norm_minutes)}</td>
            <td>${TT.fmt.diff(t.diff_minutes)}</td>
        </tr>`);
    },

    async export($btn) {
        const format = $btn.data('export');
        const params = { ...this.params(), format };
        const userId = params.user_id || TT.auth.user().id;
        await TT.ui.withBusy($btn, async () => {
            try {
                await TT.api.download('/reports/timesheet', params, `timesheet-${userId}-${params.month}.${format}`);
            } catch (err) {
                TT.ui.error(err);
            }
        });
    },
};
