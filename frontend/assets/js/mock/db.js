/**
 * Мок-«база даних» у localStorage.
 *
 * Структура повторює таблиці з project.sql: users, time_entries, leave_requests, holidays.
 * Сід детермінований і повторює логіку database/seed.php з лекції 1:
 * 2 повні попередні місяці записів (плюс поточний місяць до вчора), запізнення, обіди, переробки,
 * кілька відпусток і лікарняних, свята.
 *
 * Увага: це лише імітація сервера для фронтенду. Паролі тут лежать відкрито (поле password),
 * у справжньому API — тільки password_hash().
 */
TT.mock = TT.mock || {};

TT.mock.util = (function () {
    const pad = (n) => String(n).padStart(2, '0');

    return {
        pad,
        /** Date → '2026-11-03T06:07:00Z' (формат API, без мілісекунд) */
        iso(date) {
            return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },
        /** Date → '2026-11-03' за UTC */
        ymd(date) {
            return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
        },
        /** '2026-11-03' → Date (UTC-північ) */
        day(ymd) {
            const [y, m, d] = ymd.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d));
        },
        addDays(date, days) {
            return new Date(date.getTime() + days * 86400000);
        },
        addMinutes(date, minutes) {
            return new Date(date.getTime() + minutes * 60000);
        },
        isWeekend(date) {
            const d = date.getUTCDay();
            return d === 0 || d === 6;
        },
        minutesBetween(fromIso, toIso) {
            return Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
        },
        /** 'Y-m-d H:i:s' (UTC) або ISO → ISO */
        normalizeDateTime(value) {
            if (typeof value !== 'string') return null;
            const v = value.trim();
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return v.replace(' ', 'T') + 'Z';
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)) return v;
            return null;
        },
        token() {
            const bytes = new Uint8Array(32);
            (window.crypto || window.msCrypto).getRandomValues(bytes);
            return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        },
    };
})();

TT.mock.db = (function () {
    const KEY = 'tt_mock_db';
    const VERSION = 1;
    const u = TT.mock.util;
    let state = null;

    /** Детермінований генератор випадкових чисел (аналог mt_srand у seed.php) */
    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function seed() {
        const rnd = mulberry32(20261103);
        const rand = (min, max) => min + Math.floor(rnd() * (max - min + 1));

        const now = new Date();
        const y = now.getUTCFullYear();
        const mo = now.getUTCMonth();
        const month1Start = new Date(Date.UTC(y, mo - 2, 1));
        const month2Start = new Date(Date.UTC(y, mo - 1, 1));
        const currentMonth = new Date(Date.UTC(y, mo, 1));
        const nextMonthStart = new Date(Date.UTC(y, mo + 1, 1));
        const today = new Date(Date.UTC(y, mo, now.getUTCDate()));

        const db = {
            version: VERSION,
            seeded_at: u.iso(now),
            seq: {},
            users: [],
            time_entries: [],
            leave_requests: [],
            holidays: [],
        };
        const nextId = (table) => (db.seq[table] = (db.seq[table] || 0) + 1);

        // ---------- Свята ----------
        const fixedHolidays = {
            '01-01': 'Новий рік',
            '06-28': 'День Конституції України',
            '07-15': 'День Української Державності',
            '08-24': 'День Незалежності України',
            '10-01': 'День захисників і захисниць України',
            '12-25': 'Різдво Христове',
        };
        const holidaySet = new Set();
        for (let year = month1Start.getUTCFullYear(); year <= nextMonthStart.getUTCFullYear() + 1; year++) {
            Object.entries(fixedHolidays).forEach(([md, title]) => {
                const date = `${year}-${md}`;
                db.holidays.push({ id: nextId('holidays'), date, title });
                holidaySet.add(date);
            });
        }

        // ---------- Користувачі ----------
        const createdAt = u.iso(u.addDays(month1Start, -30));
        const people = [
            // email, full_name, role, work_start (UTC), daily_hours, vacation_days
            ['admin@example.com', 'Олена Адміністраторка', 'admin', '06:00:00', 8, 24],
            ['ivan@example.com', 'Іван Петренко', 'employee', '06:00:00', 8, 24],
            ['maria@example.com', 'Марія Коваленко', 'employee', '06:00:00', 8, 24],
            ['oleh@example.com', 'Олег Шевчук', 'employee', '07:00:00', 8, 24],
            ['anna@example.com', 'Анна Бондаренко', 'employee', '06:00:00', 8, 24],
            ['taras@example.com', 'Тарас Мельник', 'employee', '05:00:00', 6, 18],
        ];
        const ids = {};
        people.forEach(([email, fullName, role, workStart, dailyHours, vacationDays]) => {
            const id = nextId('users');
            ids[email] = id;
            db.users.push({
                id, full_name: fullName, email, password: 'password', role, api_token: null,
                work_start: workStart, daily_hours: dailyHours, vacation_days: vacationDays,
                is_active: true, created_at: createdAt,
            });
        });
        // Звільнений працівник: без записів, не може залогінитись
        db.users.push({
            id: nextId('users'), full_name: 'Петро Звільнений', email: 'former@example.com', password: 'password',
            role: 'employee', api_token: null, work_start: '06:00:00', daily_hours: 8, vacation_days: 24,
            is_active: false, created_at: createdAt,
        });

        // ---------- Робочі дні ----------
        const workdays = (from, to) => {
            const days = [];
            for (let d = from; d < to; d = u.addDays(d, 1)) {
                if (!u.isWeekend(d) && !holidaySet.has(u.ymd(d))) days.push(d);
            }
            return days;
        };
        const month1 = workdays(month1Start, month2Start);
        const month2 = workdays(month2Start, currentMonth);
        const nextMonth = workdays(nextMonthStart, new Date(Date.UTC(y, mo + 2, 1)));
        const pick = (list, i) => u.ymd(list[Math.min(i, list.length - 1)]);

        // ---------- Заявки ----------
        const adminId = ids['admin@example.com'];
        const leaves = [
            ['ivan@example.com', 'vacation', pick(month1, 9), pick(month1, 13), 'approved', 'Відпустка, море'],
            ['taras@example.com', 'vacation', pick(month1, 16), pick(month1, 17), 'rejected', 'Реліз, перенеси, будь ласка'],
            ['maria@example.com', 'sick', pick(month2, 2), pick(month2, 3), 'approved', 'Застуда'],
            ['oleh@example.com', 'day_off', pick(month2, 6), pick(month2, 6), 'approved', 'Сімейні справи'],
            ['anna@example.com', 'vacation', pick(nextMonth, 4), pick(nextMonth, 8), 'pending', null],
            ['oleh@example.com', 'vacation', pick(nextMonth, 10), pick(nextMonth, 11), 'pending', null],
            ['maria@example.com', 'day_off', pick(nextMonth, 1), pick(nextMonth, 1), 'pending', 'Переїзд'],
        ];
        const absent = new Set(); // 'userId|date'
        leaves.forEach(([email, type, from, to, status, comment]) => {
            const reviewed = status !== 'pending';
            db.leave_requests.push({
                id: nextId('leave_requests'), user_id: ids[email], type, date_from: from, date_to: to, status, comment,
                reviewed_by: reviewed ? adminId : null,
                reviewed_at: reviewed ? u.iso(u.addMinutes(u.addDays(u.day(from), -3), 600)) : null,
                created_at: u.iso(u.addMinutes(u.addDays(u.day(from), -7), 540)),
            });
            if (status === 'approved') {
                for (let d = u.day(from); d <= u.day(to); d = u.addDays(d, 1)) absent.add(`${ids[email]}|${u.ymd(d)}`);
            }
        });

        // ---------- Записи часу: від першого місяця до вчора ----------
        const days = workdays(month1Start, today);
        db.users.filter((user) => user.is_active).forEach((user) => {
            const [h, m] = user.work_start.split(':').map(Number);
            days.forEach((day) => {
                if (absent.has(`${user.id}|${u.ymd(day)}`)) return;

                const roll = rand(1, 100);
                const delay = roll <= 70 ? rand(-10, 5) : roll <= 90 ? rand(11, 40) : rand(45, 90);
                const start = u.addMinutes(day, h * 60 + m + delay);
                const norm = user.daily_hours * 60;

                let lunchMinutes = 0;
                if (rand(1, 100) <= 90) {
                    lunchMinutes = rand(30, 60);
                    const lunchStart = u.addMinutes(start, Math.floor(norm / 2) + rand(-30, 30));
                    db.time_entries.push({
                        id: 0, user_id: user.id, type: 'lunch', started_at: u.iso(lunchStart),
                        ended_at: u.iso(u.addMinutes(lunchStart, lunchMinutes)), note: null, created_by: null,
                    });
                }

                const overRoll = rand(1, 100);
                const over = overRoll <= 70 ? rand(0, 15) : overRoll <= 90 ? rand(30, 120) : -rand(15, 60);
                db.time_entries.push({
                    id: 0, user_id: user.id, type: 'work', started_at: u.iso(start),
                    ended_at: u.iso(u.addMinutes(start, norm + lunchMinutes + over)), note: null, created_by: null,
                });
            });
        });
        db.time_entries.sort((a, b) => a.started_at.localeCompare(b.started_at) || (a.type === 'work' ? -1 : 1));
        db.time_entries.forEach((entry) => { entry.id = nextId('time_entries'); });

        return db;
    }

    function persist() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
            // сховище недоступне або переповнене: працюємо в пам'яті до перезавантаження
        }
    }

    function load() {
        if (state) return state;
        try {
            const raw = localStorage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && parsed.version === VERSION) {
                state = parsed;
                return state;
            }
        } catch (e) {
            // пошкоджені дані: пересідуємо
        }
        state = seed();
        persist();
        return state;
    }

    return {
        get data() {
            return load();
        },
        save: persist,
        reset() {
            state = seed();
            persist();
        },
        nextId(table) {
            const db = load();
            db.seq[table] = (db.seq[table] || 0) + 1;
            return db.seq[table];
        },
        /** Набір дат свят для швидкої перевірки */
        holidaySet() {
            return new Set(load().holidays.map((h) => h.date));
        },
        isWorkingDay(ymd) {
            return !u.isWeekend(u.day(ymd)) && !this.holidaySet().has(ymd);
        },
        /** Робочі дні між датами включно; year — обмежити днями одного року */
        workingDays(from, to, year = null) {
            const holidays = this.holidaySet();
            let count = 0;
            for (let d = u.day(from); d <= u.day(to); d = u.addDays(d, 1)) {
                const ymd = u.ymd(d);
                if (year !== null && d.getUTCFullYear() !== year) continue;
                if (!u.isWeekend(d) && !holidays.has(ymd)) count++;
            }
            return count;
        },
    };
})();
