/**
 * admin-leaves.html — розгляд заявок (адмін).
 *   GET /leaves?status=, PATCH /leaves/{id}/approve, PATCH /leaves/{id}/reject
 */
TT.page = {
    status: 'pending',

    init() {
        this.status = TT.ui.param('status') || 'pending';
        $('#status-tabs').on('click', '[data-status]', (e) => {
            e.preventDefault();
            this.status = e.currentTarget.dataset.status;
            history.replaceState(null, '', `?status=${this.status}`);
            this.load();
        });
        $('#leaves').on('click', '[data-approve]', (e) => this.review($(e.currentTarget), 'approve'));
        $('#leaves').on('click', '[data-reject]', (e) => this.review($(e.currentTarget), 'reject'));
        this.load();
    },

    async load() {
        $('#status-tabs [data-status]').each((_, el) => $(el).toggleClass('active', el.dataset.status === this.status));
        $('#leaves').html(TT.ui.loadingRow(7));
        try {
            const [list, all] = await Promise.all([
                TT.api.leaves(this.status === 'all' ? undefined : this.status),
                TT.api.leaves(),
            ]);
            ['pending', 'approved', 'rejected'].forEach((s) => $(`[data-count="${s}"]`).text(all.filter((l) => l.status === s).length));
            $('[data-count="all"]').text(all.length);
            this.render(list);
        } catch (err) {
            $('#leaves').html(TT.ui.emptyRow(7, 'Не вдалося завантажити заявки'));
            TT.ui.error(err);
        }
    },

    render(list) {
        const { esc } = TT.fmt;
        // pending — найближчі першими; решта — новіші першими
        const sorted = this.status === 'pending' ? list : list.slice().sort((a, b) => b.date_from.localeCompare(a.date_from));
        $('#leaves').html(sorted.length ? sorted.map((l) => `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="tt-avatar tt-avatar-sm">${esc(TT.fmt.initials(l.user_full_name))}</span>
                        <span>${esc(l.user_full_name || `#${l.user_id}`)}</span>
                    </div>
                </td>
                <td>${TT.fmt.badge('leaveType', l.type, l.type_label)}</td>
                <td class="tabular text-nowrap">${TT.fmt.date(l.date_from)}${l.date_to !== l.date_from ? ` – ${TT.fmt.date(l.date_to)}` : ''}</td>
                <td class="tabular">${l.working_days ?? '—'}</td>
                <td class="small">${esc(l.comment || '')}</td>
                <td>${TT.fmt.badge('leaveStatus', l.status, l.status_label)}
                    <div class="small text-body-secondary">подано ${TT.fmt.dateTime(l.created_at)}</div></td>
                <td class="text-end text-nowrap">${l.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" data-approve="${l.id}"><i class="bi bi-check-lg me-1"></i>Затвердити</button>
                    <button class="btn btn-sm btn-outline-danger" data-reject="${l.id}"><i class="bi bi-x-lg"></i></button>` : ''}
                </td>
            </tr>`).join('') : TT.ui.emptyRow(7, this.status === 'pending' ? 'Немає заявок на розгляді 🎉' : 'Заявок немає'));
    },

    async review($btn, action) {
        const id = $btn.data(action);
        if (action === 'reject') {
            const ok = await TT.ui.confirm({ title: 'Відхилити заявку?', body: 'Працівник побачить статус «Відхилено».', ok: 'Відхилити', variant: 'danger' });
            if (!ok) return;
        }
        await TT.ui.withBusy($btn, async () => {
            try {
                if (action === 'approve') {
                    await TT.api.approveLeave(id);
                    TT.ui.toast('Заявку затверджено');
                } else {
                    await TT.api.rejectLeave(id);
                    TT.ui.toast('Заявку відхилено', 'info');
                }
            } catch (err) {
                TT.ui.error(err);
            }
        });
        TT.ui.refreshPendingBadge();
        this.load();
    },
};
