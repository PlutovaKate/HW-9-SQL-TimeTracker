/**
 * dashboard.html — стан працівника і кнопки обліку часу.
 *   GET  /time/status, POST /time/check-in | lunch/start | lunch/end | check-out
 *   GET  /me/leave-balance, GET /me/leaves
 */
TT.page = {
    status: null,
    offset: 0, // різниця між годинником браузера і server_time

    ACTIONS: {
        check_in: { text: 'Я прийшов', icon: 'box-arrow-in-right', cls: 'btn-light', call: () => TT.api.checkIn(), done: 'Check-in записано. Гарного дня!' },
        lunch_start: { text: 'На обід', icon: 'cup-hot', cls: 'btn-light', call: () => TT.api.lunchStart(), done: 'Смачного! Обід почався.' },
        lunch_end: { text: 'Повернувся з обіду', icon: 'arrow-return-left', cls: 'btn-light', call: () => TT.api.lunchEnd(), done: 'З поверненням!' },
        check_out: { text: 'Я пішов', icon: 'box-arrow-right', cls: 'btn-outline-light', call: () => TT.api.checkOut(), done: 'Робочий день завершено. До завтра!' },
    },

    init() {
        const user = TT.auth.user();
        const hour = new Date().getHours();
        const hello = hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір';
        $('#greeting').text(`${hello}, ${user.full_name.split(' ')[0]}!`);
        $('#today').text(new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
        $('#plan-start').text(TT.fmt.workStartLocal(user.work_start));
        $('#plan-norm').text(`${user.daily_hours} год`);

        $('#actions').on('click', '[data-action]', (e) => this.act($(e.currentTarget)));
        $('#refresh').on('click', () => this.load());

        this.load();
        this.loadSide();
        setInterval(() => this.load(), 60000);
        setInterval(() => this.tick(), 1000);
    },

    now() {
        return new Date(Date.now() - this.offset);
    },

    async load() {
        try {
            const status = await TT.api.status();
            this.offset = Date.now() - Date.parse(status.server_time);
            this.status = status;
            this.render();
        } catch (err) {
            TT.ui.error(err);
        }
    },

    async act($btn) {
        const action = this.ACTIONS[$btn.data('action')];
        $('#actions .btn').prop('disabled', true);
        try {
            await TT.ui.withBusy($btn, action.call);
            TT.ui.toast(action.done);
        } catch (err) {
            TT.ui.error(err);
        }
        await this.load();
    },

    /** Секунди роботи й обіду за сьогодні; відкриті записи рахуємо до «зараз» */
    seconds() {
        const now = this.now().getTime();
        const sum = (type) => this.status.entries
            .filter((e) => e.type === type)
            .reduce((s, e) => s + Math.max(0, ((e.ended_at ? Date.parse(e.ended_at) : now) - Date.parse(e.started_at)) / 1000), 0);
        const work = sum('work');
        const lunch = sum('lunch');
        return { worked: Math.max(0, work - lunch), lunch };
    },

    tick() {
        if (!this.status) return;
        const { worked, lunch } = this.seconds();
        const norm = TT.auth.user().daily_hours * 3600;
        $('#clock').text(TT.fmt.clock(worked));
        $('#tile-worked').text(TT.fmt.minutes(Math.floor(worked / 60)));
        $('#tile-lunch').text(TT.fmt.minutes(Math.floor(lunch / 60)));
        const pct = Math.min(100, Math.round((worked / norm) * 100));
        $('#norm-bar').css('width', `${pct}%`).attr('aria-valuenow', pct);
        $('#norm-text').text(worked >= norm ? 'Норму виконано' : `${pct}% · ще ${TT.fmt.minutes(Math.ceil((norm - worked) / 60))}`);
        this.renderTimeline();
    },

    render() {
        const s = this.status;
        const { esc } = TT.fmt;
        $('#state-card').attr('data-state', s.state);
        $('#state-label').html(`${s.state !== 'off_duty' ? '<span class="tt-pulse me-2"></span>' : ''}${esc(s.state_label || TT.fmt.label('state', s.state))}`);

        const work = s.entries.filter((e) => e.type === 'work');
        const openWork = work.find((e) => !e.ended_at);
        const openLunch = s.entries.find((e) => e.type === 'lunch' && !e.ended_at);
        let since = '';
        if (openLunch) since = `на обіді з ${TT.fmt.time(openLunch.started_at)}`;
        else if (openWork) since = `на роботі з ${TT.fmt.time(openWork.started_at)}`;
        else if (work.length) since = `сьогодні завершено о ${TT.fmt.time(work[work.length - 1].ended_at)}`;
        else since = 'сьогодні ще не відмічався';
        $('#state-since').text(since);

        $('#actions').html(s.allowed_actions.map((key) => {
            const a = this.ACTIONS[key];
            return a ? `<button type="button" class="btn btn-lg ${a.cls}" data-action="${key}"><i class="bi bi-${a.icon} me-2"></i>${a.text}</button>` : '';
        }).join('') || '<span class="opacity-75">Немає доступних дій</span>');

        $('#today-entries').html(s.entries.length ? s.entries.map((e) => {
            const end = e.ended_at ? Date.parse(e.ended_at) : this.now().getTime();
            const minutes = Math.round((end - Date.parse(e.started_at)) / 60000);
            return `<tr>
                <td>${e.type === 'work' ? '<i class="bi bi-briefcase text-success me-2"></i>' : '<i class="bi bi-cup-hot text-warning me-2"></i>'}${TT.fmt.label('entryType', e.type)}</td>
                <td class="tabular">${TT.fmt.time(e.started_at)}</td>
                <td class="tabular">${e.ended_at ? TT.fmt.time(e.ended_at) : '<span class="badge text-bg-success">триває</span>'}</td>
                <td class="tabular">${TT.fmt.minutes(minutes)}</td>
                <td class="text-end">${e.is_manual ? '<span class="badge text-bg-info" title="Запис змінив адміністратор">правка</span>' : ''}</td>
            </tr>`;
        }).join('') : TT.ui.emptyRow(5, 'Записів за сьогодні ще немає'));

        this.tick();
    },

    renderTimeline() {
        const s = this.status;
        const now = this.now();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        let fromH = 7;
        let toH = 20;
        s.entries.forEach((e) => {
            fromH = Math.min(fromH, new Date(e.started_at).getHours());
            toH = Math.max(toH, (e.ended_at ? new Date(e.ended_at) : now).getHours() + 1);
        });
        toH = Math.min(24, Math.max(toH, now.getHours() + 1));
        const span = (toH - fromH) * 3600000;
        const pos = (t) => Math.max(0, Math.min(100, ((t - dayStart.getTime() - fromH * 3600000) / span) * 100));

        const segs = s.entries.map((e) => {
            const start = pos(Date.parse(e.started_at));
            const end = pos(e.ended_at ? Date.parse(e.ended_at) : now.getTime());
            const title = `${TT.fmt.label('entryType', e.type)}: ${TT.fmt.time(e.started_at)} – ${e.ended_at ? TT.fmt.time(e.ended_at) : 'зараз'}`;
            return `<div class="tt-timeline-seg ${e.type} ${e.ended_at ? '' : 'open'}" style="left:${start}%;width:${Math.max(0.3, end - start)}%" title="${title}"></div>`;
        }).join('');
        $('#timeline').html(segs + `<div class="tt-timeline-now" style="left:${pos(now.getTime())}%" title="Зараз"></div>`);

        const step = toH - fromH > 12 ? 3 : 2;
        const labels = [];
        for (let h = fromH; h <= toH; h += step) {
            labels.push(`<span style="left:${((h - fromH) / (toH - fromH)) * 100}%">${String(h).padStart(2, '0')}:00</span>`);
        }
        $('#timeline-scale').html(labels.join(''));
    },

    async loadSide() {
        const year = new Date().getFullYear();
        try {
            const [balance, leaves] = await Promise.all([TT.api.balance(year), TT.api.myLeaves()]);
            const pct = (n) => (balance.total ? (n / balance.total) * 100 : 0);
            $('#balance').html(`
                <div class="d-flex align-items-end gap-2 mb-2">
                    <span class="tt-stat">${balance.left}</span>
                    <span class="text-body-secondary mb-1">з ${balance.total} днів залишилось у ${balance.year}</span>
                </div>
                <div class="progress-stacked mb-2" style="height:.6rem">
                    <div class="progress" style="width:${pct(balance.used)}%"><div class="progress-bar bg-primary"></div></div>
                    <div class="progress" style="width:${pct(balance.pending)}%"><div class="progress-bar bg-warning"></div></div>
                </div>
                <div class="small text-body-secondary">
                    <span class="tt-legend-dot bg-primary"></span>використано ${balance.used}
                    <span class="tt-legend-dot bg-warning ms-3"></span>на розгляді ${balance.pending}
                </div>`);

            const today = TT.fmt.ymd();
            const upcoming = leaves.filter((l) => l.date_to >= today && l.status !== 'rejected')
                .sort((a, b) => a.date_from.localeCompare(b.date_from)).slice(0, 3);
            $('#upcoming').html(upcoming.length ? upcoming.map((l) => `
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                    <span>${TT.fmt.badge('leaveType', l.type, l.type_label)}
                        <span class="ms-1 tabular">${TT.fmt.date(l.date_from)}${l.date_to !== l.date_from ? ' – ' + TT.fmt.date(l.date_to) : ''}</span></span>
                    ${TT.fmt.badge('leaveStatus', l.status, l.status_label)}
                </li>`).join('') : `<li class="list-group-item">${TT.ui.empty('Запланованих відсутностей немає', 'calendar-check')}</li>`);
        } catch (err) {
            TT.ui.error(err);
        }
    },
};
