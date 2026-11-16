/**
 * Форматування для інтерфейсу.
 *
 * API завжди віддає час в UTC (ISO-8601 з «Z»), а показуємо ми його в часовому поясі браузера.
 * Дати без часу (YYYY-MM-DD: відпустки, дні табеля) не конвертуємо: це «календарні» дні.
 */
TT.fmt = (function () {
    const pad = (n) => String(n).padStart(2, '0');

    const LABELS = {
        state: { off_duty: 'Не на роботі', working: 'Працює', on_lunch: 'На обіді' },
        entryType: { work: 'Робота', lunch: 'Обід' },
        leaveType: { vacation: 'Відпустка', sick: 'Лікарняний', day_off: 'Відгул' },
        leaveStatus: { pending: 'На розгляді', approved: 'Затверджено', rejected: 'Відхилено' },
        dayStatus: {
            working: 'Робочий', weekend: 'Вихідний', holiday: 'Свято',
            vacation: 'Відпустка', sick: 'Лікарняний', day_off: 'Відгул',
        },
        role: { admin: 'Адміністратор', employee: 'Працівник' },
    };

    const BADGES = {
        leaveStatus: { pending: 'text-bg-warning', approved: 'text-bg-success', rejected: 'text-bg-secondary' },
        leaveType: { vacation: 'text-bg-info', sick: 'text-bg-warning', day_off: 'text-bg-primary' },
        state: { off_duty: 'text-bg-secondary', working: 'text-bg-success', on_lunch: 'text-bg-warning' },
        role: { admin: 'text-bg-primary', employee: 'text-bg-secondary' },
    };

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** '2026-11-03' → Date (локальна північ), щоб показати день без зсуву поясу. */
    function parseYmd(ymd) {
        const [y, m, d] = String(ymd).split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    return {
        LABELS,
        esc,
        pad,
        parseYmd,

        label(group, value) {
            return (LABELS[group] && LABELS[group][value]) || value;
        },

        badge(group, value, text) {
            const cls = (BADGES[group] && BADGES[group][value]) || 'text-bg-secondary';
            return `<span class="badge ${cls}">${esc(text ?? this.label(group, value))}</span>`;
        },

        /** ISO UTC → '09:14' (локальний час) */
        time(iso) {
            if (!iso) return '—';
            return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        },

        /** ISO UTC → '03.11.2026, 09:14' */
        dateTime(iso) {
            if (!iso) return '—';
            return new Date(iso).toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        },

        /** '2026-11-03' → '03.11.2026' */
        date(ymd) {
            if (!ymd) return '—';
            return parseYmd(ymd).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        /** '2026-11-03' → 'вт' */
        weekday(ymd) {
            return parseYmd(ymd).toLocaleDateString('uk-UA', { weekday: 'short' });
        },

        /** '2026-11' → 'листопад 2026' */
        month(ym) {
            const [y, m] = ym.split('-').map(Number);
            return new Date(y, m - 1, 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        },

        /** 485 → '8 год 05 хв' */
        minutes(total) {
            if (total === null || total === undefined) return '—';
            const sign = total < 0 ? '−' : '';
            const abs = Math.abs(Math.round(total));
            const h = Math.floor(abs / 60);
            const m = abs % 60;
            return h > 0 ? `${sign}${h} год ${pad(m)} хв` : `${sign}${m} хв`;
        },

        /** 485 → '8:05' (компактно для таблиць) */
        hm(total) {
            if (total === null || total === undefined) return '—';
            const sign = total < 0 ? '−' : '';
            const abs = Math.abs(Math.round(total));
            return `${sign}${Math.floor(abs / 60)}:${pad(abs % 60)}`;
        },

        /** Різниця з нормою з кольором: +0:15 зелений, −1:20 червоний */
        diff(total) {
            if (!total) return '<span class="text-body-secondary">0:00</span>';
            const cls = total > 0 ? 'text-success' : 'text-danger';
            return `<span class="${cls} fw-semibold">${total > 0 ? '+' : ''}${this.hm(total)}</span>`;
        },

        /** Секунди → '02:15:09' для живого таймера */
        clock(seconds) {
            const s = Math.max(0, Math.floor(seconds));
            return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
        },

        /** Початок роботи '06:00:00' (UTC) → локальний час на сьогодні, напр. '09:00' */
        workStartLocal(utcTime) {
            if (!utcTime) return '—';
            const [h, m] = utcTime.split(':').map(Number);
            const now = new Date();
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
            return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        },

        /** Локальна дата → 'YYYY-MM-DD' (для <input type="date">) */
        ymd(date = new Date()) {
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        },

        /** Поточний місяць 'YYYY-MM' або зі зсувом */
        ym(offset = 0) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() + offset);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        },

        /** ISO UTC → значення для <input type="datetime-local"> у локальному часі */
        toLocalInput(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            return `${this.ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },

        /** <input type="datetime-local"> → 'Y-m-d H:i:s' в UTC (формат PATCH /time-entries/{id}) */
        localInputToUtc(value) {
            if (!value) return null;
            const d = new Date(value);
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T`
                + `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;
        },

        /** Кількість робочих днів між датами включно (без вихідних і свят) */
        workingDays(from, to, holidayDates = []) {
            if (!from || !to || from > to) return 0;
            const holidays = new Set(holidayDates);
            let count = 0;
            for (let d = parseYmd(from); d <= parseYmd(to); d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0 && day !== 6 && !holidays.has(this.ymd(d))) count++;
            }
            return count;
        },

        /** Готові періоди для фільтрів: {from, to} у форматі YYYY-MM-DD */
        range(preset) {
            const today = new Date();
            const y = today.getFullYear();
            const m = today.getMonth();
            if (preset === 'week') {
                const monday = new Date(today);
                monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
                return { from: this.ymd(monday), to: this.ymd(today) };
            }
            if (preset === 'last_month') {
                return { from: this.ymd(new Date(y, m - 1, 1)), to: this.ymd(new Date(y, m, 0)) };
            }
            if (preset === 'two_months') {
                return { from: this.ymd(new Date(y, m - 2, 1)), to: this.ymd(today) };
            }
            return { from: this.ymd(new Date(y, m, 1)), to: this.ymd(today) };
        },

        initials(name) {
            return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
        },
    };
})();
