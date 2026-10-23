
-- 1. Свято без дати заборонено (K7)
ALTER TABLE holidays MODIFY date DATE NOT NULL;

-- 2. Початок роботи — це час доби, тобто менше 24:00 (T7)
ALTER TABLE users ADD CONSTRAINT chk_users_work_start CHECK (work_start < '24:00:00');

-- 3. is_active — тільки 0 або 1 (T8)
ALTER TABLE users ADD CONSTRAINT chk_users_is_active CHECK (is_active IN (true, false));

-- 4. Кінець роботи пізніше за початок. Але ended_at = NULL дозволено: людина ще на роботі (L1)
ALTER TABLE time_entries ADD CONSTRAINT chk_time_entries_range CHECK (ended_at IS NULL OR ended_at > started_at);

-- 5. Відпустка: кінець не раніше за початок (L2)
ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_requests_dates CHECK (date_from <= date_to);

-- 6. created_by (L3)
-- Выбран вариант (а): всегда сохранять id создателя записи.
-- Колонка остаётся NOT NULL, изменение не требуется.