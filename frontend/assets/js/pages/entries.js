/** entries.html — GET /me/entries?from=&to= (ДЗ 3) */
TT.page = {
    init() {
        const $form = $('#filter-form');
        const range = TT.fmt.range('month');
        $form.find('[name=from]').val(range.from);
        $form.find('[name=to]').val(range.to);

        $('[data-preset]').on('click', (e) => {
            const r = TT.fmt.range(e.currentTarget.dataset.preset);
            $form.find('[name=from]').val(r.from);
            $form.find('[name=to]').val(r.to);
            $form.trigger('submit');
        });
        $form.on('submit', (e) => {
            e.preventDefault();
            this.load($form);
        });
        this.load($form);
    },

    async load($form) {
        TT.ui.clearErrors($form);
        const { from, to } = TT.ui.formData($form);
        $('#entries').html(TT.ui.loadingRow(7));
        try {
            const entries = await TT.api.myEntries(from, to);
            this.render(entries);
        } catch (err) {
            $('#entries').html(TT.ui.emptyRow(7, 'Не вдалося завантажити записи'));
            TT.ui.error(err, $form);
        }
    },

    render(entries) {
        const minutes = (e) => (e.ended_at ? Math.round((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000) : null);
        const sum = (type) => entries.filter((e) => e.type === type && e.ended_at).reduce((s, e) => s + minutes(e), 0);
        const days = new Set(entries.filter((e) => e.type === 'work').map((e) => e.started_at.slice(0, 10)));

        $('#sum-days').text(days.size);
        $('#sum-worked').text(TT.fmt.minutes(sum('work') - sum('lunch')));
        $('#sum-lunch').text(TT.fmt.minutes(sum('lunch')));
        $('#sum-late').text(entries.filter((e) => e.is_late).length);

        if (!entries.length) {
            $('#entries').html(TT.ui.emptyRow(7, 'За цей період записів немає'));
            return;
        }

        // новіші дні зверху, всередині дня — за часом
        const byDay = {};
        entries.forEach((e) => (byDay[e.started_at.slice(0, 10)] ||= []).push(e));
        const html = Object.keys(byDay).sort().reverse().map((day) => byDay[day].map((e, i) => `
            <tr class="${i === 0 ? 'table-group-divider' : ''}">
                <td class="tabular">${i === 0 ? `<span class="fw-semibold">${TT.fmt.date(day)}</span> <small class="text-body-secondary">${TT.fmt.weekday(day)}</small>` : ''}</td>
                <td>${e.type === 'work' ? '<i class="bi bi-briefcase text-success me-1"></i>' : '<i class="bi bi-cup-hot text-warning me-1"></i>'}${TT.fmt.label('entryType', e.type)}</td>
                <td class="tabular">${TT.fmt.time(e.started_at)}</td>
                <td class="tabular">${e.ended_at ? TT.fmt.time(e.ended_at) : '<span class="badge text-bg-success">триває</span>'}</td>
                <td class="tabular">${TT.fmt.minutes(minutes(e))}</td>
                <td>${e.is_late ? '<span class="badge text-bg-danger">запізнення</span> ' : ''}${e.is_manual ? '<span class="badge text-bg-info">правка адміна</span>' : ''}</td>
                <td class="text-body-secondary small">${TT.fmt.esc(e.note || '')}</td>
            </tr>`).join('')).join('');
        $('#entries').html(html);
    },
};
