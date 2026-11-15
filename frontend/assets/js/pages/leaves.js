/**
 * leaves.html — мої відпустки, лікарняні, відгули.
 *   POST /me/leaves, GET /me/leaves, DELETE /me/leaves/{id}, GET /me/leave-balance, GET /holidays
 */
TT.page = {
    holidays: [],
    balance: null,

    init() {
        const $form = $('#leave-form');
        const today = TT.fmt.ymd();
        $form.find('[name=date_from], [name=date_to]').val(today);

        $form.on('input change', 'input, select', () => this.preview($form));
        $form.on('submit', (e) => {
            e.preventDefault();
            this.submit($form);
        });
        $('#my-leaves').on('click', '[data-cancel]', (e) => this.cancel(e.currentTarget.dataset.cancel));

        TT.api.holidays().then((list) => {
            this.holidays = list.map((h) => h.date);
            this.preview($form);
        }).catch(() => {});
        this.loadBalance();
        this.loadList();
        this.preview($form);
    },

    preview($form) {
        const { type, date_from: from, date_to: to } = TT.ui.formData($form);
        // лікарняний можна оформити заднім числом, решту — тільки з сьогодні
        $form.find('[name=date_from]').attr('min', type === 'sick' ? null : TT.fmt.ymd());
        if (from && (!to || to < from)) $form.find('[name=date_to]').val(from);

        const days = TT.fmt.workingDays(from, $form.find('[name=date_to]').val(), this.holidays);
        const $p = $('#leave-preview');
        let cls = 'alert-light';
        let text = `Робочих днів у заявці: <strong>${days}</strong> (без вихідних і свят).`;
        if (type === 'vacation' && this.balance) {
            const available = this.balance.left;
            text += ` Доступно: <strong>${available}</strong>.`;
            if (days > available) cls = 'alert-warning';
        }
        if (type === 'sick') text += ' Лікарняний затверджується автоматично.';
        if (days === 0) {
            cls = 'alert-warning';
            text = 'У вибраному періоді немає робочих днів.';
        }
        $p.attr('class', `alert ${cls} small mb-3`).html(text);
    },

    async submit($form) {
        TT.ui.clearErrors($form);
        const payload = TT.ui.formData($form);
        await TT.ui.withBusy($form.find('[type=submit]'), async () => {
            try {
                const leave = await TT.api.requestLeave(payload);
                TT.ui.toast(leave.status === 'approved' ? 'Лікарняний зареєстровано' : 'Заявку надіслано на розгляд');
                $form.find('[name=comment]').val('');
                this.loadBalance();
                this.loadList();
            } catch (err) {
                TT.ui.error(err, $form);
            }
        });
    },

    async cancel(id) {
        const ok = await TT.ui.confirm({ title: 'Скасувати заявку?', body: 'Заявку буде видалено. Подати нову можна будь-коли.', ok: 'Скасувати заявку', variant: 'danger' });
        if (!ok) return;
        try {
            await TT.api.cancelLeave(id);
            TT.ui.toast('Заявку скасовано', 'info');
            this.loadBalance();
            this.loadList();
        } catch (err) {
            TT.ui.error(err);
        }
    },

    async loadBalance() {
        try {
            const b = await TT.api.balance(new Date().getFullYear());
            this.balance = b;
            const pct = (n) => (b.total ? (n / b.total) * 100 : 0);
            $('#balance').html(`
                <div class="row text-center g-2 mb-3">
                    <div class="col"><div class="tt-stat">${b.total}</div><div class="tt-stat-label">на рік</div></div>
                    <div class="col"><div class="tt-stat text-primary">${b.used}</div><div class="tt-stat-label">використано</div></div>
                    <div class="col"><div class="tt-stat text-warning">${b.pending}</div><div class="tt-stat-label">на розгляді</div></div>
                    <div class="col"><div class="tt-stat ${b.left < 0 ? 'text-danger' : 'text-success'}">${b.left}</div><div class="tt-stat-label">залишок</div></div>
                </div>
                <div class="progress-stacked" style="height:.6rem">
                    <div class="progress" style="width:${pct(b.used)}%"><div class="progress-bar bg-primary"></div></div>
                    <div class="progress" style="width:${pct(b.pending)}%"><div class="progress-bar bg-warning"></div></div>
                </div>`);
            this.preview($('#leave-form'));
        } catch (err) {
            TT.ui.error(err);
        }
    },

    async loadList() {
        $('#my-leaves').html(TT.ui.loadingRow(6));
        try {
            const list = await TT.api.myLeaves();
            $('#my-leaves').html(list.length ? list.map((l) => `
                <tr>
                    <td>${TT.fmt.badge('leaveType', l.type, l.type_label)}</td>
                    <td class="tabular">${TT.fmt.date(l.date_from)}${l.date_to !== l.date_from ? ` – ${TT.fmt.date(l.date_to)}` : ''}</td>
                    <td class="tabular">${l.working_days ?? TT.fmt.workingDays(l.date_from, l.date_to, this.holidays)}</td>
                    <td>${TT.fmt.badge('leaveStatus', l.status, l.status_label)}${l.reviewed_at ? `<div class="small text-body-secondary">${TT.fmt.dateTime(l.reviewed_at)}</div>` : ''}</td>
                    <td class="small">${TT.fmt.esc(l.comment || '')}</td>
                    <td class="text-end">${l.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger" data-cancel="${l.id}" title="Скасувати"><i class="bi bi-x-lg"></i></button>` : ''}</td>
                </tr>`).join('') : TT.ui.emptyRow(6, 'Заявок ще немає'));
        } catch (err) {
            $('#my-leaves').html(TT.ui.emptyRow(6, 'Не вдалося завантажити заявки'));
            TT.ui.error(err);
        }
    },
};
