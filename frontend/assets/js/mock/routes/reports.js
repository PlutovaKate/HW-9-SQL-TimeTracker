/**
 * Лекція 5: звіти та експорт (+ ДЗ і бонус 5).
 *   GET /reports/timesheet?month=YYYY-MM&user_id=&format=json|csv|md
 *   GET /reports/team?from=&to=&format=json|csv|md   (адмін)        (ДЗ)
 *   GET /reports/entries?from=&to=&user_id=&format=json|csv|md (адмін) (лекція про експорт)
 *   format=xlsx мок не будує: 422 з підказкою вимкнути Mock-сервер
 *   GET /reports/present                             (адмін)        (бонус)
 *
 * Логіка повторює ReportService::timesheet(): рахуються тільки закриті записи,
 * статус дня: weekend → holiday → затверджена відсутність → working.
 */
(function () {
    const { route, http, validate, util } = TT.mock;

    function approvedLeaveDays(db, userId, from, to) {
        const result = {};
        db.leave_requests
            .filter((l) => l.user_id === userId && l.status === 'approved' && l.date_from <= to && l.date_to >= from)
            .forEach((l) => {
                for (let d = util.day(l.date_from); d <= util.day(l.date_to); d = util.addDays(d, 1)) {
                    result[util.ymd(d)] = l.type;
                }
            });
        return result;
    }

    /** Агрегати по днях (аналог TimeEntryRepository::dailyTotals) */
    function dailyTotals(db, userId, from, to) {
        const result = {};
        db.time_entries
            .filter((e) => e.user_id === userId && e.ended_at !== null)
            .filter((e) => e.started_at.slice(0, 10) >= from && e.started_at.slice(0, 10) <= to)
            .forEach((e) => {
                const day = e.started_at.slice(0, 10);
                const agg = result[day] || (result[day] = { first_in: null, last_out: null, work_minutes: 0, lunch_minutes: 0 });
                const minutes = util.minutesBetween(e.started_at, e.ended_at);
                if (e.type === 'work') {
                    agg.work_minutes += minutes;
                    if (!agg.first_in || e.started_at < agg.first_in) agg.first_in = e.started_at;
                    if (!agg.last_out || e.ended_at > agg.last_out) agg.last_out = e.ended_at;
                } else {
                    agg.lunch_minutes += minutes;
                }
            });
        return result;
    }

    function days(db, user, from, to) {
        const totals = dailyTotals(db, user.id, from, to);
        const leaves = approvedLeaveDays(db, user.id, from, to);
        const holidays = TT.mock.db.holidaySet();
        const list = [];
        for (let d = util.day(from); d <= util.day(to); d = util.addDays(d, 1)) {
            const date = util.ymd(d);
            const agg = totals[date] || {};
            let status = 'working';
            if (util.isWeekend(d)) status = 'weekend';
            else if (holidays.has(date)) status = 'holiday';
            else if (leaves[date]) status = leaves[date];

            const work = agg.work_minutes || 0;
            const lunch = agg.lunch_minutes || 0;
            const worked = Math.max(0, work - lunch);
            const norm = status === 'working' ? user.daily_hours * 60 : 0;
            list.push({
                date,
                day_status: status,
                first_in: agg.first_in || null,
                last_out: agg.last_out || null,
                work_minutes: work,
                lunch_minutes: lunch,
                worked_minutes: worked,
                norm_minutes: norm,
                diff_minutes: worked - norm,
                is_late: status === 'working' && !!agg.first_in && TT.mock.time.isLate(user, agg.first_in),
            });
        }
        return list;
    }

    function totals(list) {
        const sum = (key) => list.reduce((s, d) => s + d[key], 0);
        const count = (status) => list.filter((d) => d.day_status === status).length;
        const worked = sum('worked_minutes');
        const norm = sum('norm_minutes');
        return {
            working_days: count('working'),
            worked_minutes: worked,
            norm_minutes: norm,
            diff_minutes: worked - norm,
            norm_percent: norm > 0 ? Math.round((worked / norm) * 1000) / 10 : null,
            late_count: list.filter((d) => d.is_late).length,
            vacation_days: count('vacation'),
            sick_days: count('sick'),
            day_off_days: count('day_off'),
            holiday_days: count('holiday'),
        };
    }

    // ---------- Експортери (CsvExporter, JsonExporter, анонімний Markdown-експортер) ----------
    function exportRows(rows, filename, format) {
        if (format === 'csv') {
            const columns = rows.length ? Object.keys(rows[0]) : [];
            const cell = (v) => {
                const s = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
                return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            // BOM + «;» — щоб Excel відкрив кирилицю й колонки без майстра імпорту
            const csv = '﻿' + [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))].join('\r\n');
            return http.file(csv, 'text/csv; charset=utf-8', `${filename}.csv`);
        }
        if (format === 'md') {
            const columns = rows.length ? Object.keys(rows[0]) : [];
            const md = [
                `| ${columns.join(' | ')} |`,
                `| ${columns.map(() => '---').join(' | ')} |`,
                ...rows.map((r) => `| ${columns.map((c) => (r[c] === null ? '' : String(r[c]))).join(' | ')} |`),
            ].join('\n');
            return http.file(md + '\n', 'text/markdown; charset=utf-8', `${filename}.md`);
        }
        return http.file(JSON.stringify({ data: rows }, null, 2), 'application/json; charset=utf-8', `${filename}.json`);
    }

    function format(query) {
        const f = query.format || 'json';
        if (f === 'xlsx') throw http.validation({ format: 'XLSX працює лише зі справжнім API: вимкніть Mock-сервер у кнопці «API»' });
        if (!['json', 'csv', 'md'].includes(f)) throw http.validation({ format: 'Must be one of: json,csv,md,xlsx' });
        return f;
    }

    route('GET', '/reports/timesheet', ({ db, user, query }) => {
        const f = format(query);
        const month = query.month || util.ymd(new Date()).slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw http.validation({ month: 'Must be in format YYYY-MM' });

        let target = user;
        if (query.user_id !== undefined) {
            if (!/^\d+$/.test(query.user_id)) throw http.validation({ user_id: 'Must be an integer' });
            const id = Number(query.user_id);
            if (id !== user.id && user.role !== 'admin') throw http.forbidden('You can only view your own timesheet');
            target = db.users.find((u) => u.id === id);
            if (!target) throw http.notFound('User not found');
        }

        const [y, m] = month.split('-').map(Number);
        const from = `${month}-01`;
        const to = util.ymd(new Date(Date.UTC(y, m, 0)));
        const list = days(db, target, from, to);

        if (f !== 'json') {
            return exportRows(list, `timesheet-${target.id}-${month}`, f);
        }
        return http.json({ user: { id: target.id, full_name: target.full_name }, month, days: list, totals: totals(list) });
    });

    route('GET', '/reports/team', ({ db, query }) => {
        const f = format(query);
        const data = validate(query, { from: 'required|date', to: 'required|date' });
        if (data.from > data.to) throw http.validation({ to: 'Must be after or equal to from' });
        if ((util.day(data.to) - util.day(data.from)) / 86400000 > 366) {
            throw http.validation({ to: 'The period must not exceed 366 days' });
        }

        const rows = db.users.filter((u) => u.is_active && u.role === 'employee')
            .sort((a, b) => a.full_name.localeCompare(b.full_name, 'uk'))
            .map((u) => {
                const t = totals(days(db, u, data.from, data.to));
                return {
                    user_id: u.id,
                    full_name: u.full_name,
                    worked_minutes: t.worked_minutes,
                    norm_minutes: t.norm_minutes,
                    diff_minutes: t.diff_minutes,
                    late_count: t.late_count,
                    vacation_days: t.vacation_days,
                    sick_days: t.sick_days,
                    day_off_days: t.day_off_days,
                };
            });

        if (f !== 'json') {
            return exportRows(rows, `team-${data.from}-${data.to}`, f);
        }
        return http.json(rows);
    }, { admin: true });

    route('GET', '/reports/entries', ({ db, query }) => {
        const data = validate(query, { from: 'required|date', to: 'required|date', format: 'required' });
        const f = format(query);
        if (data.from > data.to) throw http.validation({ to: 'Must be after or equal to from' });

        const rows = db.time_entries
            .filter((e) => e.started_at.slice(0, 10) >= data.from && e.started_at.slice(0, 10) <= data.to)
            .filter((e) => query.user_id === undefined || e.user_id === Number(query.user_id))
            .map((e) => ({
                id: e.id,
                user_id: e.user_id,
                full_name: db.users.find((u) => u.id === e.user_id).full_name,
                type: e.type,
                started_at: e.started_at,
                ended_at: e.ended_at,
                minutes: e.ended_at === null ? null : util.minutesBetween(e.started_at, e.ended_at),
                note: e.note ?? null,
                is_manual: e.created_by !== e.user_id,
            }));

        return exportRows(rows, `entries-${data.from}-${data.to}`, f);
    }, { admin: true });

    route('GET', '/reports/present', ({ db, now }) => {
        const rows = db.users.filter((u) => u.is_active)
            .map((u) => ({ user: u, work: TT.mock.time.openEntry(db, u.id, 'work') }))
            .filter((x) => x.work)
            .sort((a, b) => a.work.started_at.localeCompare(b.work.started_at))
            .map(({ user, work }) => {
                const entries = TT.mock.time.entriesOn(db, user.id, util.ymd(now));
                const workMin = TT.mock.time.sumMinutes(entries, 'work', now);
                const lunchMin = TT.mock.time.sumMinutes(entries, 'lunch', now);
                return {
                    user_id: user.id,
                    full_name: user.full_name,
                    since: work.started_at,
                    on_lunch: !!TT.mock.time.openEntry(db, user.id, 'lunch'),
                    minutes_today: Math.max(0, workMin - lunchMin),
                };
            });
        return http.json(rows);
    }, { admin: true });
})();
