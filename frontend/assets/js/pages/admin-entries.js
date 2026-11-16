/**
 * admin-entries.html — записи часу працівника й ручні правки (бонус ДЗ 3, адмін).
 *   GET   /time-entries?user_id=&from=&to=
 *   PATCH /time-entries/{id}  {started_at, ended_at, note}  — час у форматі 'Y-m-d\\TH:i:s\\Z' (UTC)
 */
TT.page = {
    entries: [],
    editing: null,

    init() {
        const $form = $('#filter-form');
        const $edit = $('#entry-form');
        this.modal = new bootstrap.Modal('#entry-modal');

        const range = TT.fmt.range('week');
        $form.find('[name=from]').val(range.from);
        $form.find('[name=to]').val(range.to);

        TT.api.users(1, 100).then(({ items }) => {
            const selected = Number(TT.ui.param('user_id')) || (items.find((u) => u.role === 'employee') || items[0]).id;
            $form.find('[name=user_id]').html(items.map((u) => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${TT.fmt.esc(u.full_name)}</option>`).join(''));
            this.load($form);
        }).catch((err) => TT.ui.error(err));

        $form.on('submit', (e) => {
            e.preventDefault();
            this.load($form);
        });
        $form.on('change', 'select', () => this.load($form));
        $('#entries').on('click', '[data-edit]', (e) => this.open(Number(e.currentTarget.dataset.edit)));
        $edit.on('input change', 'input', () => this.utcPreview($edit));
        $edit.on('submit', (e) => {
            e.preventDefault();
            this.save($edit, $form);
        });
    },

    async load($form) {
        TT.ui.clearErrors($form);
        const { user_id: userId, from, to } = TT.ui.formData($form);
        if (!userId) return;
        history.replaceState(null, '', `?user_id=${userId}`);
        $('#entries').html(TT.ui.loadingRow(7));
        try {
            this.entries = await TT.api.entries(userId, from, to);
            this.render();
        } catch (err) {
            $('#entries').html(TT.ui.emptyRow(7, 'Не вдалося завантажити записи'));
            TT.ui.error(err, $form);
        }
    },

    render() {
        const minutes = (e) => (e.ended_at ? Math.round((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000) : null);
        const list = this.entries.slice().reverse();
        $('#entries').html(list.length ? list.map((e) => `
            <tr>
                <td class="tabular"><span class="fw-semibold">${TT.fmt.date(e.started_at.slice(0, 10))}</span> <small class="text-body-secondary">${TT.fmt.weekday(e.started_at.slice(0, 10))}</small></td>
                <td>${TT.fmt.label('entryType', e.type)}</td>
                <td class="tabular">${TT.fmt.time(e.started_at)}</td>
                <td class="tabular">${e.ended_at ? TT.fmt.time(e.ended_at) : '<span class="badge text-bg-success">триває</span>'}</td>
                <td class="tabular">${TT.fmt.minutes(minutes(e))}</td>
                <td>${e.is_late ? '<span class="badge text-bg-danger">запізнення</span> ' : ''}${e.is_manual ? '<span class="badge text-bg-info">правка</span> ' : ''}<span class="small text-body-secondary">${TT.fmt.esc(e.note || '')}</span></td>
                <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-edit="${e.id}" title="Редагувати"><i class="bi bi-pencil"></i></button></td>
            </tr>`).join('') : TT.ui.emptyRow(7, 'За цей період записів немає'));
    },

    open(id) {
        const entry = this.entries.find((e) => e.id === id);
        const $edit = $('#entry-form');
        this.editing = entry;
        TT.ui.clearErrors($edit);
        $('#entry-modal-title').text(`${TT.fmt.label('entryType', entry.type)} #${entry.id}`);
        $edit.find('[name=started_at]').val(TT.fmt.toLocalInput(entry.started_at));
        $edit.find('[name=ended_at]').val(TT.fmt.toLocalInput(entry.ended_at));
        $edit.find('[name=note]').val(entry.note || '');
        this.utcPreview($edit);
        this.modal.show();
    },

    utcPreview($edit) {
        const s = TT.fmt.localInputToUtc($edit.find('[name=started_at]').val());
        const e = TT.fmt.localInputToUtc($edit.find('[name=ended_at]').val());
        $('#utc-preview').html(`В API піде: <code>started_at: ${s || '—'}</code>, <code>ended_at: ${e || 'null'}</code> (UTC)`);
    },

    async save($edit, $form) {
        TT.ui.clearErrors($edit);
        const payload = {
            started_at: TT.fmt.localInputToUtc($edit.find('[name=started_at]').val()),
            ended_at: TT.fmt.localInputToUtc($edit.find('[name=ended_at]').val()),
            note: $edit.find('[name=note]').val().trim() || null,
        };
        await TT.ui.withBusy($edit.find('[type=submit]'), async () => {
            try {
                await TT.api.updateEntry(this.editing.id, payload);
                TT.ui.toast('Запис оновлено');
                this.modal.hide();
                this.load($form);
            } catch (err) {
                TT.ui.error(err, $edit);
            }
        });
    },
};
