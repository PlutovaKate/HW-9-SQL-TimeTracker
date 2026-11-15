/**
 * Лекція 4: відпустки, лікарняні, відгули (+ ДЗ 4).
 *   POST   /me/leaves              {type, date_from, date_to, comment} → 201
 *   GET    /me/leaves              → мої заявки                         (ДЗ)
 *   DELETE /me/leaves/{id}         → 204, лише своя pending             (ДЗ)
 *   GET    /me/leave-balance?year= → {year, total, used, pending, left}
 *   GET    /leaves?status=         → усі заявки з user_full_name (адмін) (ДЗ)
 *   PATCH  /leaves/{id}/approve | /leaves/{id}/reject (адмін)
 */
(function () {
    const { route, http, validate, util } = TT.mock;
    const TYPES = ['vacation', 'sick', 'day_off'];

    function leaveJson(leave, db) {
        const json = {
            id: leave.id,
            user_id: leave.user_id,
            type: leave.type,
            type_label: TT.fmt.label('leaveType', leave.type),
            date_from: leave.date_from,
            date_to: leave.date_to,
            status: leave.status,
            status_label: TT.fmt.label('leaveStatus', leave.status),
            comment: leave.comment,
            reviewed_by: leave.reviewed_by,
            reviewed_at: leave.reviewed_at,
            created_at: leave.created_at,
            working_days: TT.mock.db.workingDays(leave.date_from, leave.date_to),
        };
        if (db) {
            const user = db.users.find((u) => u.id === leave.user_id);
            json.user_full_name = user ? user.full_name : null;
        }
        return json;
    }

    /** Баланс відпустки за рік: робочі дні затверджених і pending-заявок у межах року */
    function balance(db, user, year) {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        const days = (status) => db.leave_requests
            .filter((l) => l.user_id === user.id && l.type === 'vacation' && l.status === status
                && l.date_from <= yearEnd && l.date_to >= yearStart)
            .reduce((sum, l) => sum + TT.mock.db.workingDays(l.date_from, l.date_to, year), 0);
        const used = days('approved');
        const pending = days('pending');
        return { year, total: user.vacation_days, used, pending, left: user.vacation_days - used - pending };
    }

    /**
     * Помилка балансу або null.
     * countPending=true  — при поданні: pending-заявки вже «зарезервували» дні;
     * countPending=false — при затвердженні: сама заявка теж pending, рахуємо тільки approved.
     */
    function balanceError(db, user, from, to, countPending) {
        for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
            const b = balance(db, user, year);
            const requested = TT.mock.db.workingDays(from, to, year);
            const available = b.total - b.used - (countPending ? b.pending : 0);
            if (requested > available) {
                return `Not enough vacation days in ${year}: requested ${requested}, available ${Math.max(0, available)}`;
            }
        }
        return null;
    }

    TT.mock.leaves = { leaveJson, balance };

    route('POST', '/me/leaves', ({ db, user, body, now }) => {
        const data = validate(body, {
            type: `required|in:${TYPES.join(',')}`,
            date_from: 'required|date',
            date_to: 'required|date',
            comment: 'max:255',
        });
        if (data.date_from > data.date_to) {
            throw http.validation({ date_to: 'Must be after or equal to date_from' });
        }
        const today = util.ymd(now);
        if (data.type !== 'sick' && data.date_from < today) {
            throw http.validation({ date_from: 'Cannot be in the past' });
        }
        if (TT.mock.db.workingDays(data.date_from, data.date_to) === 0) {
            throw http.validation({ date_to: 'The period contains no working days' });
        }

        const overlap = db.leave_requests.find((l) => l.user_id === user.id && ['pending', 'approved'].includes(l.status)
            && l.date_from <= data.date_to && l.date_to >= data.date_from);
        if (overlap) {
            throw http.validation({
                date_from: `Overlaps with request #${overlap.id} (${overlap.date_from} – ${overlap.date_to})`,
            });
        }

        if (data.type === 'vacation') {
            const error = balanceError(db, user, data.date_from, data.date_to, true);
            if (error) throw http.validation({ date_to: error });
        }

        // лікарняний не потребує затвердження
        const autoApproved = data.type === 'sick';
        const leave = {
            id: TT.mock.db.nextId('leave_requests'),
            user_id: user.id,
            type: data.type,
            date_from: data.date_from,
            date_to: data.date_to,
            status: autoApproved ? 'approved' : 'pending',
            comment: data.comment || null,
            reviewed_by: null,
            reviewed_at: autoApproved ? util.iso(now) : null,
            created_at: util.iso(now),
        };
        db.leave_requests.push(leave);
        return http.json(leaveJson(leave), 201);
    });

    route('GET', '/me/leaves', ({ db, user }) => http.json(
        db.leave_requests.filter((l) => l.user_id === user.id)
            .sort((a, b) => b.date_from.localeCompare(a.date_from))
            .map((l) => leaveJson(l)),
    ));

    route('DELETE', '/me/leaves/{id}', ({ db, user, params }) => {
        const index = db.leave_requests.findIndex((l) => l.id === Number(params.id) && l.user_id === user.id);
        // чужа заявка → 404, щоб не розкривати, що такий id існує
        if (index === -1) throw http.notFound('Leave request not found');
        if (db.leave_requests[index].status !== 'pending') throw http.conflict('Only pending requests can be cancelled');
        db.leave_requests.splice(index, 1);
        return http.noContent();
    });

    route('GET', '/me/leave-balance', ({ db, user, query, now }) => {
        const year = query.year ? Number(query.year) : now.getUTCFullYear();
        if (!Number.isInteger(year) || year < 2000 || year > 2100) throw http.validation({ year: 'Must be a valid year' });
        return http.json(balance(db, user, year));
    });

    route('GET', '/leaves', ({ db, query }) => {
        if (query.status && !['pending', 'approved', 'rejected'].includes(query.status)) {
            throw http.validation({ status: 'Must be one of: pending,approved,rejected' });
        }
        const list = db.leave_requests
            .filter((l) => !query.status || l.status === query.status)
            .sort((a, b) => a.date_from.localeCompare(b.date_from));
        return http.json(list.map((l) => leaveJson(l, db)));
    }, { admin: true });

    function review(status) {
        return ({ db, params, user: admin, now }) => {
            const leave = db.leave_requests.find((l) => l.id === Number(params.id));
            if (!leave) throw http.notFound('Leave request not found');
            if (leave.status !== 'pending') throw http.conflict(`Request is already ${leave.status}`);

            if (status === 'approved' && leave.type === 'vacation') {
                const owner = db.users.find((u) => u.id === leave.user_id);
                const error = balanceError(db, owner, leave.date_from, leave.date_to, false);
                if (error) throw http.conflict(error);
            }
            leave.status = status;
            leave.reviewed_by = admin.id;
            leave.reviewed_at = util.iso(now);
            return http.json(leaveJson(leave, db));
        };
    }

    route('PATCH', '/leaves/{id}/approve', review('approved'), { admin: true });
    route('PATCH', '/leaves/{id}/reject', review('rejected'), { admin: true });
})();
