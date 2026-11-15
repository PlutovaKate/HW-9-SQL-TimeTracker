/**
 * Лекція 3: облік часу (+ перевірка відпусток із лекції 4, ДЗ і бонус ДЗ 3).
 *   POST  /time/check-in | /time/lunch/start | /time/lunch/end | /time/check-out
 *   GET   /time/status                   → {date, state, state_label, allowed_actions, worked_minutes, lunch_minutes, entries, server_time}
 *   GET   /me/entries?from=&to=          → записи з is_late для work            (ДЗ 3)
 *   GET   /time-entries?user_id=&from=&to= → записи будь-якого працівника (адмін) (бонус ДЗ 3, потрібен фронту)
 *   PATCH /time-entries/{id}             {started_at, ended_at, note} → запис (адмін) (бонус ДЗ 3)
 */
(function () {
    const { route, http, validate, util } = TT.mock;

    function entryJson(entry) {
        return {
            id: entry.id,
            user_id: entry.user_id,
            type: entry.type,
            started_at: entry.started_at,
            ended_at: entry.ended_at,
            note: entry.note,
            is_manual: entry.created_by !== null,
        };
    }

    const openEntry = (db, userId, type) => db.time_entries
        .filter((e) => e.user_id === userId && e.type === type && e.ended_at === null)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] || null;

    const entriesOn = (db, userId, ymd) => db.time_entries
        .filter((e) => e.user_id === userId && e.started_at.slice(0, 10) === ymd)
        .sort((a, b) => a.started_at.localeCompare(b.started_at));

    function state(db, userId) {
        if (!openEntry(db, userId, 'work')) return 'off_duty';
        return openEntry(db, userId, 'lunch') ? 'on_lunch' : 'working';
    }

    function lunchTakenToday(db, userId, now) {
        return entriesOn(db, userId, util.ymd(now)).some((e) => e.type === 'lunch');
    }

    function allowedActions(db, userId, now) {
        const s = state(db, userId);
        if (s === 'off_duty') return ['check_in'];
        if (s === 'on_lunch') return ['lunch_end', 'check_out'];
        return lunchTakenToday(db, userId, now) ? ['check_out'] : ['lunch_start', 'check_out'];
    }

    /** Тривалість записів у хвилинах; відкритий запис рахуємо до «зараз» */
    function sumMinutes(entries, type, now) {
        return entries.filter((e) => e.type === type)
            .reduce((sum, e) => sum + util.minutesBetween(e.started_at, e.ended_at || util.iso(now)), 0);
    }

    function isLate(user, firstWorkIso) {
        const [h, m] = user.work_start.split(':').map(Number);
        const start = new Date(firstWorkIso);
        const limit = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), h, m + TT.config.LATE_TOLERANCE);
        return start.getTime() > limit;
    }

    function approvedLeaveOn(db, userId, ymd) {
        return db.leave_requests.find((l) => l.user_id === userId && l.status === 'approved'
            && l.date_from <= ymd && l.date_to >= ymd) || null;
    }

    function summary(db, user, now) {
        const today = util.ymd(now);
        const entries = entriesOn(db, user.id, today);
        const s = state(db, user.id);
        const work = sumMinutes(entries, 'work', now);
        const lunch = sumMinutes(entries, 'lunch', now);
        return {
            date: today,
            state: s,
            state_label: TT.fmt.label('state', s),
            allowed_actions: allowedActions(db, user.id, now),
            worked_minutes: Math.max(0, work - lunch),
            lunch_minutes: lunch,
            entries: entries.map(entryJson),
            server_time: util.iso(now),
        };
    }

    // спільне для звітів (reports.js)
    TT.mock.time = { entryJson, state, isLate, openEntry, entriesOn, sumMinutes };

    function start(db, user, type, now) {
        const entry = {
            id: TT.mock.db.nextId('time_entries'), user_id: user.id, type,
            started_at: util.iso(now), ended_at: null, note: null, created_by: null,
        };
        db.time_entries.push(entry);
        return entry;
    }

    route('POST', '/time/check-in', ({ db, user, now }) => {
        if (state(db, user.id) !== 'off_duty') throw http.conflict('You are already checked in');
        const leave = approvedLeaveOn(db, user.id, util.ymd(now));
        if (leave) {
            throw http.conflict(`Check-in is not available: ${leave.type} (${leave.date_from} – ${leave.date_to})`);
        }
        return http.json(entryJson(start(db, user, 'work', now)), 201);
    });

    route('POST', '/time/lunch/start', ({ db, user, now }) => {
        const s = state(db, user.id);
        if (s === 'off_duty') throw http.conflict('You are not checked in');
        if (s === 'on_lunch') throw http.conflict('You are already on lunch');
        if (lunchTakenToday(db, user.id, now)) throw http.conflict('Lunch has already been taken today');
        return http.json(entryJson(start(db, user, 'lunch', now)), 201);
    });

    route('POST', '/time/lunch/end', ({ db, user, now }) => {
        const lunch = openEntry(db, user.id, 'lunch');
        if (!lunch) throw http.conflict('You are not on lunch');
        lunch.ended_at = util.iso(now);
        return http.json(entryJson(lunch));
    });

    route('POST', '/time/check-out', ({ db, user, now }) => {
        const work = openEntry(db, user.id, 'work');
        if (!work) throw http.conflict('You are not checked in');
        // в API це одна транзакція: закрити забутий обід і роботу
        const lunch = openEntry(db, user.id, 'lunch');
        if (lunch) lunch.ended_at = util.iso(now);
        work.ended_at = util.iso(now);
        return http.json(entryJson(work));
    });

    route('GET', '/time/status', ({ db, user, now }) => http.json(summary(db, user, now)));

    function periodEntries(db, user, query) {
        const data = validate(query, { from: 'required|date', to: 'required|date' });
        if (data.from > data.to) throw http.validation({ to: 'Must be after or equal to from' });

        const list = db.time_entries
            .filter((e) => e.user_id === user.id && e.started_at.slice(0, 10) >= data.from && e.started_at.slice(0, 10) <= data.to)
            .sort((a, b) => a.started_at.localeCompare(b.started_at));

        const seenDays = new Set();
        return list.map((e) => {
            const json = entryJson(e);
            if (e.type === 'work') {
                const day = e.started_at.slice(0, 10);
                json.is_late = !seenDays.has(day) && isLate(user, e.started_at);
                seenDays.add(day);
            }
            return json;
        });
    }

    route('GET', '/me/entries', ({ db, user, query }) => http.json(periodEntries(db, user, query)));

    route('GET', '/time-entries', ({ db, query }) => {
        const { user_id: userId } = validate(query, { user_id: 'required|int' });
        const user = db.users.find((u) => u.id === userId);
        if (!user) throw http.notFound('User not found');
        return http.json(periodEntries(db, user, query));
    }, { admin: true });

    route('PATCH', '/time-entries/{id}', ({ db, params, body, user: admin, now }) => {
        const entry = db.time_entries.find((e) => e.id === Number(params.id));
        if (!entry) throw http.notFound('Time entry not found');

        const data = validate(body, { started_at: 'required|datetime', ended_at: 'datetime', note: 'max:255' });
        const startedAt = util.normalizeDateTime(data.started_at);
        const endedAt = data.ended_at ? util.normalizeDateTime(data.ended_at) : null;

        if (endedAt && endedAt <= startedAt) throw http.validation({ ended_at: 'Must be after started_at' });
        if (startedAt > util.iso(now) || (endedAt && endedAt > util.iso(now))) {
            throw http.validation({ started_at: 'Time cannot be in the future' });
        }

        const far = '9999-12-31T23:59:59Z';
        const overlap = db.time_entries.some((e) => e.id !== entry.id && e.user_id === entry.user_id && e.type === entry.type
            && e.started_at < (endedAt || far) && (e.ended_at || far) > startedAt);
        if (overlap) throw http.conflict(`The interval overlaps another ${entry.type} entry`);

        if (entry.type === 'lunch') {
            const inside = db.time_entries.some((e) => e.user_id === entry.user_id && e.type === 'work'
                && e.started_at <= startedAt && (e.ended_at || far) >= (endedAt || far));
            if (!inside) throw http.conflict('Lunch must be inside a work interval');
        }

        entry.started_at = startedAt;
        entry.ended_at = endedAt;
        entry.note = data.note ?? entry.note;
        entry.created_by = admin.id;
        return http.json(entryJson(entry));
    }, { admin: true });
})();
