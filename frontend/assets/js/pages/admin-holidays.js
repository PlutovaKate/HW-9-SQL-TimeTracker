/** admin-holidays.html — GET /holidays?year=, POST /holidays, DELETE /holidays/{id} (ДЗ 1) */
TT.page = {
    init() {
        const year = new Date().getFullYear();
        const years = [year - 1, year, year + 1];
        $('#year').html(years.map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join(''))
            .on('change', () => this.load());

        const $form = $('#holiday-form');
        $form.on('submit', (e) => {
            e.preventDefault();
            this.create($form);
        });
        $('#holidays').on('click', '[data-delete]', (e) => this.remove(e.currentTarget.dataset.delete));
        this.load();
    },

    async load() {
        $('#holidays').html(TT.ui.loadingRow(4));
        try {
            const list = await TT.api.holidays($('#year').val());
            const today = TT.fmt.ymd();
            $('#holidays').html(list.length ? list.map((h) => `
                <tr class="${h.date < today ? 'text-body-secondary' : ''}">
                    <td class="tabular fw-semibold">${TT.fmt.date(h.date)}</td>
                    <td>${TT.fmt.weekday(h.date)}</td>
                    <td>${TT.fmt.esc(h.title)}</td>
                    <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-delete="${h.id}" title="Видалити"><i class="bi bi-trash"></i></button></td>
                </tr>`).join('') : TT.ui.emptyRow(4, 'Свят на цей рік не додано'));
        } catch (err) {
            $('#holidays').html(TT.ui.emptyRow(4, 'Не вдалося завантажити свята'));
            TT.ui.error(err);
        }
    },

    async create($form) {
        TT.ui.clearErrors($form);
        await TT.ui.withBusy($form.find('[type=submit]'), async () => {
            try {
                const h = await TT.api.createHoliday(TT.ui.formData($form));
                TT.ui.toast(`Свято «${h.title}» додано`);
                $form[0].reset();
                $('#year').val(h.date.slice(0, 4));
                this.load();
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },

    async remove(id) {
        const ok = await TT.ui.confirm({ title: 'Видалити свято?', body: 'Цей день знову стане робочим у табелі та підрахунку відпусток.', ok: 'Видалити', variant: 'danger' });
        if (!ok) return;
        try {
            await TT.api.deleteHoliday(id);
            TT.ui.toast('Свято видалено', 'info');
            this.load();
        } catch (err) {
            TT.ui.error(err);
        }
    },
};
