# ДЗ №8 — Таблиці, типи і ключі для TimeTracker

Тема: **проєктування бази даних**. Таблиці, типи даних, `NOT NULL`, `DEFAULT`, `UNIQUE`, `PRIMARY KEY`, `FOREIGN KEY`, індекси, міграції.

На лекції ми спроєктували базу для тайм-трекера й написали міграції в `database/migrations/`. У цьому ДЗ ми **перевіримо цю схему на міцність**: чи справді вона захищає дані від помилок.

> **Запити `SELECT`, `UPDATE` і `DELETE` ми ще не проходили.** Тому всі такі запити в ДЗ дано **готовими**: їх треба лише скопіювати й запустити. Іноді в них треба змінити одне значення, це місце позначено ✏️. Розбирати, як вони працюють, будемо на наступних лекціях.
>
> Те саме з `INSERT`: шаблон завжди дано, змінюєш тільки значення.

## Як працюємо

Головне в ДЗ — експерименти з позначкою **🔮**. Для кожного:

1. **Спочатку** запиши в `answers.sql` прогноз: буде помилка чи все пройде?
2. Запусти запит.
3. Запиши, що сталося насправді і **чому**: яке саме правило схеми спрацювало (або не спрацювало).

Помилитись у прогнозі — нормально, оцінюється пояснення «чому». Відповіді для самоперевірки сховані в блоках «Перевір себе». Відкривай їх **після** своїх запусків.

## Файли

| Файл | Що з ним робити |
|---|---|
| `answers.sql` | Сюди пишеш прогнози, результати й пояснення. Це головний файл здачі |
| `seed.sql` | Готові дані за вересень 2026. Знадобиться в частинах 4 і 5 |
| `database/migrations/005_fix_constraints.sql` | Створюєш сам у частині 4 |
| `bin/migration.php` | Доробляєш у частині 6 |

## Підключення до MySQL

Запусти `docker compose up -d`. Параметри підключення:

| Параметр | Значення |
|---|---|
| Host | `127.0.0.1` |
| Port | `3306` |
| User | `root` |
| Password | `secret` |
| Database | `php_08_26` |

Обери один зі способів:

- **DBeaver** (рекомендовано): *New Database Connection → MySQL* і параметри з таблиці. Якщо з'явиться помилка `Public Key Retrieval is not allowed`, відкрий вкладку *Driver properties* і встанови `allowPublicKeyRetrieval = true`. Запити пишемо в *SQL Editor*: один запит виконує `Ctrl+Enter`, увесь файл — `Alt+X` (*Execute SQL Script*).
- **Visual Studio Code**: встанови розширення **Database Client** (автор Weijan Chen), натисни *+* на панелі Database, обери MySQL і введи параметри з таблиці. Запити виконуються з відкритого `.sql`-файлу.
- **Консоль у контейнері**, якщо графічні клієнти не працюють:
  ```bash
  docker exec -it db-mysql mysql -uroot -psecret php_08_26
  ```

Виконати файл цілком (наприклад, `seed.sql`) можна в клієнті через виконання всього скрипту (у DBeaver це `Alt+X`) або командою:

```bash
docker exec -i db-mysql mysql -uroot -psecret php_08_26 < homework/08-sql/seed.sql
```

---

## Частина 1. Створюємо таблиці з міграцій (~15 хв)

📖 [CREATE TABLE](https://dev.mysql.com/doc/refman/8.0/en/create-table.html) · [Типи даних](https://dev.mysql.com/doc/refman/8.0/en/data-types.html)

1. Якщо на лекції щось не встиг, звір свої `database/migrations/000…004` з лекційними.
2. Виконай міграції в SQL-клієнті **по черзі**: `000`, `001`, `002`, `003`, `004`.
3. Подивись, що вийшло. Це службові команди, вони лише показують структуру:
   ```sql
   SHOW TABLES;
   DESCRIBE users;
   SHOW CREATE TABLE time_entries;
   SHOW INDEX FROM users;
   ```
4. **🔮 Експеримент з порядком.** Видали три таблиці:
   ```sql
   DROP TABLE time_entries, leave_requests, users;
   ```
   Тепер виконай міграцію `002` **раніше** за `001`. Що станеться? Після цього створи все заново в правильному порядку.
5. Дай відповіді в коментарях `answers.sql`:
   - Чому `time_entries.id` має тип `BIGINT`, а `users.id` — `INT`?
   - Що буде записано в `ended_at`, поки людина ще на роботі?
   - Подивись на результат `SHOW INDEX FROM users`. Які індекси є в таблиці і як вони називаються? Ми їм імена не давали, звідки вони взялися?
   - Подивись на `SHOW CREATE TABLE time_entries`. Як MySQL назвав наші зовнішні ключі?

<details>
<summary>Перевір себе: пункт 4</summary>

`ERROR 1824: Failed to open the referenced table 'users'`. Таблиця `time_entries` посилається на `users`, якої ще немає. Тому міграції мають іти в певному порядку, і саме для цього в назвах файлів стоять номери.

</details>

---

## Частина 2. Перший рядок і значення за замовчуванням (~10 хв)

📖 [INSERT](https://dev.mysql.com/doc/refman/8.0/en/insert.html) · [DEFAULT](https://dev.mysql.com/doc/refman/8.0/en/data-type-defaults.html)

1. Додай користувача, вказавши **лише три** поля. ✏️ Підстав своє ім'я та email:
   ```sql
   INSERT INTO users (full_name, email, password)
   VALUES ('Іван Петренко', 'ivan@example.com', 'secret');
   ```
2. Подивись на результат. Цей запит просто показує все, що є в таблиці:
   ```sql
   SELECT * FROM users;
   ```
3. **🔮** У таблиці 11 колонок, а ти заповнив 3. Перед запуском запиши, що з'явиться в кожній з решти восьми колонок, а потім звір із реальним результатом. Для кожної колонки поясни, **яке саме місце в міграції** дало це значення: `AUTO_INCREMENT`, `DEFAULT ...` чи просто `NULL`.
4. Додай собі робочий день. ✏️ Якщо твій `id` не 1, заміни `1`:
   ```sql
   INSERT INTO time_entries (user_id, type, started_at, ended_at, created_by)
   VALUES (1, 'work', '2026-10-01 06:00:00', '2026-10-01 15:00:00', 1);
   ```
   Прибери `ended_at` і його значення, щоб записати «людина ще на роботі». Що тепер лежить у `ended_at`? Перевір через `SELECT * FROM time_entries;`.

---

## Частина 3. «Зламай схему» (~40 хв)

Схема має не пускати в базу дурниці. Перевіримо, чи наша справді це робить. Перед кожним запуском **🔮 прогноз**.

Для експериментів потрібен користувач з частини 2. Якщо в тебе інший email, ✏️ підстав свій.

### 3.1. Типи даних

```sql
-- T1. Ім'я довжиною 300 символів (REPEAT повторює літеру 300 разів)
INSERT INTO users (full_name, email, password) VALUES (REPEAT('а', 300), 't1@example.com', 'x');

-- T2. Робочий день на 300 годин
INSERT INTO users (full_name, email, password, daily_hours) VALUES ('Трудоголік', 't2@example.com', 'x', 300);

-- T3. Від'ємна кількість годин
INSERT INTO users (full_name, email, password, daily_hours) VALUES ('Лінивий', 't3@example.com', 'x', -1);

-- T4. ✏️ Підбери найбільше vacation_days, яке ще пройде. Яке число вже не проходить?
INSERT INTO users (full_name, email, password, vacation_days) VALUES ('Відпускник', 't4@example.com', 'x', 255);

-- T5. Роль, якої немає в ENUM
INSERT INTO users (full_name, email, password, role) VALUES ('Менеджер', 't5@example.com', 'x', 'manager');

-- T6. Свято 30 лютого
INSERT INTO holidays (date, title) VALUES ('2026-02-30', 'Неіснуючий день');

-- T7. Початок роботи о 25:00
INSERT INTO users (full_name, email, password, work_start) VALUES ('Нічна зміна', 't7@example.com', 'x', '25:00:00');

-- T8. is_active = 5
INSERT INTO users (full_name, email, password, is_active) VALUES ('Дуже активний', 't8@example.com', 'x', 5);
```

Після T7 і T8 подивись, що реально збереглося: `SELECT * FROM users;`

<details>
<summary>Перевір себе: типи</summary>

| № | Що станеться | Чому |
|---|---|---|
| T1 | `ERROR 1406: Data too long for column 'full_name'` | `VARCHAR(255)` |
| T2 | `ERROR 1264: Out of range value for column 'daily_hours'` | `TINYINT UNSIGNED` вміщує тільки 0…255 |
| T3 | `ERROR 1264: Out of range value` | `UNSIGNED` означає «без мінуса» |
| T4 | 255 проходить, 256 уже ні | той самий діапазон 0…255 |
| T5 | `ERROR 1265: Data truncated for column 'role'` | значення немає в `ENUM` |
| T6 | `ERROR 1292: Incorrect date value: '2026-02-30'` | `DATE` перевіряє календар |
| T7 | ⚠️ **Успіх!** Збереглося `25:00:00` | `TIME` — це **тривалість** (до 838 годин), а не час доби |
| T8 | ⚠️ **Успіх!** Збереглося `5` | `BOOL` у MySQL — це просто `TINYINT(1)`, тобто будь-яке число від −128 до 127 |

</details>

### 3.2. Ключі та зв'язки

```sql
-- K1. Ще один користувач з уже зайнятим email (✏️ підстав свій email з частини 2)
INSERT INTO users (full_name, email, password) VALUES ('Двійник', 'ivan@example.com', 'x');

-- K2. Два користувачі без api_token
INSERT INTO users (full_name, email, password) VALUES ('Без токена 1', 'k2a@example.com', 'x');
INSERT INTO users (full_name, email, password) VALUES ('Без токена 2', 'k2b@example.com', 'x');

-- K3. Два користувачі з однаковим api_token
INSERT INTO users (full_name, email, password, api_token) VALUES ('Токен 1', 'k3a@example.com', 'x', 'abc');
INSERT INTO users (full_name, email, password, api_token) VALUES ('Токен 2', 'k3b@example.com', 'x', 'abc');

-- K4. Запис часу для користувача, якого не існує
INSERT INTO time_entries (user_id, type, started_at, created_by) VALUES (999, 'work', '2026-10-01 06:00:00', 999);

-- K5. Видалити таблицю users повністю
DROP TABLE users;

-- K6. Двічі одне й те саме свято
INSERT INTO holidays (date, title) VALUES ('2026-12-25', 'Різдво');
INSERT INTO holidays (date, title) VALUES ('2026-12-25', 'Ще раз Різдво');

-- K7. Двічі свято БЕЗ дати
INSERT INTO holidays (title) VALUES ('Без дати');
INSERT INTO holidays (title) VALUES ('Без дати');
```

<details>
<summary>Перевір себе: ключі</summary>

| № | Що станеться | Чому |
|---|---|---|
| K1 | `ERROR 1062: Duplicate entry ... for key 'users.email'` | `UNIQUE` |
| K2 | Обидва записи проходять | `NULL` означає «невідомо», тож два `NULL` не вважаються однаковими і `UNIQUE` їх пропускає |
| K3 | Другий запис дає `ERROR 1062 ... for key 'users.api_token'` | `UNIQUE` |
| K4 | `ERROR 1452: Cannot add or update a child row: a foreign key constraint fails` | `FOREIGN KEY`: користувача 999 немає |
| K5 | `ERROR 3730: Cannot drop table 'users' referenced by a foreign key constraint` | на `users` посилаються інші таблиці |
| K6 | Другий запис дає `ERROR 1062` | `date UNIQUE` |
| K7 | ⚠️ **Успіх!** Два свята без дати | `date` можна не заповнювати, а `UNIQUE` пропускає кілька `NULL` (див. K2) |

</details>

### 3.3. Логічні помилки

```sql
-- L1. Робота закінчилась раніше, ніж почалась (✏️ user_id = твій id)
INSERT INTO time_entries (user_id, type, started_at, ended_at, created_by)
VALUES (1, 'work', '2026-10-02 15:00:00', '2026-10-02 06:00:00', 1);

-- L2. Відпустка з 10 по 1 грудня
INSERT INTO leave_requests (user_id, type, date_from, date_to)
VALUES (1, 'vacation', '2026-12-10', '2026-12-01');

-- L3. Працівник сам натискає «Я прийшов». Хто тут created_by?
INSERT INTO time_entries (user_id, type, started_at)
VALUES (1, 'work', '2026-10-02 06:00:00');
```

<details>
<summary>Перевір себе: логіка</summary>

| № | Що станеться |
|---|---|
| L1 | ⚠️ **Успіх!** Робота «тривала» мінус 9 годин |
| L2 | ⚠️ **Успіх!** Відпустка закінчується раніше, ніж починається |
| L3 | `ERROR 1364: Field 'created_by' doesn't have a default value` |

</details>

### 3.4. Висновки

Дай відповіді в `answers.sql`:

1. Випиши всі експерименти з позначкою ⚠️ **Успіх**. Це **баги нашої схеми**: база пропустила дані, яких бути не повинно.
2. Чому база не дала видалити таблицю `users` (K5)? Як ти думаєш, чи варто взагалі видаляти з бази звільнених працівників, якщо бухгалтерії потрібні їхні старі табелі? Підказка: навіщо в `users` колонка `is_active`?
3. **L3: питання дизайну.** Що має бути в `created_by`, коли працівник відмічається сам? Обери варіант і обґрунтуй:
   - **(а)** завжди id того, хто створив запис (тоді тут id самого працівника);
   - **(б)** `NULL`, якщо працівник відмітився сам, і id адміна, якщо адмін виправляв запис вручну.

---

## Частина 4. Виправляємо схему новою міграцією (~20 хв)

📖 [ALTER TABLE](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html) · [CHECK](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html)

**Правило міграцій:** файл, який уже десь виконали (у колеги, на сервері), не редагують. Замість цього пишуть **нову** міграцію.

Створи `database/migrations/005_fix_constraints.sql`. Нижче шаблон: допиши пропуски `____`. Нові для нас команди:

- `ALTER TABLE таблиця MODIFY колонка ТИП ...` — змінити опис наявної колонки;
- `ALTER TABLE таблиця ADD CONSTRAINT назва CHECK (умова)` — додати правило, яке база перевірятиме при кожному `INSERT`.

```sql
-- 1. Свято без дати заборонено (K7)
ALTER TABLE holidays MODIFY date DATE ____;

-- 2. Початок роботи — це час доби, тобто менше 24:00 (T7)
ALTER TABLE users ADD CONSTRAINT chk_users_work_start CHECK (work_start < '____');

-- 3. is_active — тільки 0 або 1 (T8)
ALTER TABLE users ADD CONSTRAINT chk_users_is_active CHECK (is_active IN (____, ____));

-- 4. Кінець роботи пізніше за початок. Але ended_at = NULL дозволено: людина ще на роботі (L1)
ALTER TABLE time_entries ADD CONSTRAINT chk_time_entries_range CHECK (ended_at IS NULL OR ended_at ____ started_at);

-- 5. Відпустка: кінець не раніше за початок (L2)
ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_requests_dates CHECK (____);

-- 6. created_by — за твоїм рішенням у 3.4 (L3).
--    Якщо обрав варіант (б), зроби колонку необов'язковою:
-- ALTER TABLE time_entries MODIFY created_by INT UNSIGNED ____;
```

**Перед запуском** завантаж `seed.sql`. Він очистить таблиці від «поганих» рядків з частини 3 і заповнить їх нормальними даними. Без цього `ALTER` впаде: база не додасть правило, яке вже порушують наявні дані. Можеш перевірити це сам: спершу запусти `005` без `seed.sql`.

Виконай міграцію й **повтори T7, T8, K7, L1, L2, L3**. У `seed.sql` користувач з `id = 1` теж є, тому `user_id = 1` у прикладах підходить. Тепер усі вони, крім L3 у варіанті (б), мають падати з помилкою.

<details>
<summary>Перевір себе</summary>

- Порушення `CHECK` дає `ERROR 3819: Check constraint 'chk_...' is violated`.
- K7 після виправлення дає `ERROR 1364: Field 'date' doesn't have a default value`.
- L3 у варіанті (б) проходить, і в `created_by` записується `NULL`.
- Якщо запустити `005` без `seed.sql`, вона падає вже на першому рядку: `ERROR 1138: Invalid use of NULL value`. У таблиці лишилось свято без дати з K7. Так само впали б і `CHECK`-правила, через рядки з T7, T8, L1 і L2.

</details>

---

## Частина 5. Дивимось на справжні дані (~15 хв)

1. Завантаж `seed.sql` **ще раз**, щоб прибрати рядки, які додалися під час перевірки `005`.
2. Запусти готові запити й **відповідай на питання, просто дивлячись на результат**. Писати свої запити не треба.

```sql
-- S1. Усі користувачі
SELECT * FROM users;
```
- Скільки адмінів і скільки працівників? Хто з користувачів неактивний?
- У кого робочий день починається не о `06:00:00`? Скільки це за Києвом (UTC+3 влітку)?
- Чому колонка `password` виглядає як `$2y$12$...`, а не як `password`? (Про хешування поговоримо на лекції з PHP.)

```sql
-- S2. Усі заявки на відсутність
SELECT * FROM leave_requests;
```
- Скільки заявок чекають на рішення (`pending`)? Чому в них `reviewed_by` і `reviewed_at` дорівнюють `NULL`?
- `reviewed_by = 1`. Знайди в результаті S1, хто це.

```sql
-- S3. ✏️ Записи часу одного працівника за 1 вересня. Спробуй різні user_id: 2, 3, 4, 5, 6
SELECT * FROM time_entries WHERE user_id = 2 AND started_at < '2026-09-02';
```
- О котрій працівник прийшов і пішов? Скільки тривав обід?
- Чому для одного дня є **два** записи?

```sql
-- S4. Записи, які досі не закриті
SELECT * FROM time_entries WHERE ended_at IS NULL;
```
- Хто «застряг на роботі» і з якого часу? Що, найімовірніше, сталося?

```sql
-- S5. Записи з приміткою
SELECT * FROM time_entries WHERE note IS NOT NULL;
```
- Чому в цьому записі `created_by` не дорівнює `user_id`? Зв'яжи це зі своїм рішенням у 3.4.

<details>
<summary>Перевір себе: частина 5</summary>

- **S1:** 1 адмін, 6 працівників, неактивний Петро Звільнений (`is_active = 0`). Олег починає о `07:00` UTC (10:00 за Києвом), Тарас о `05:00` UTC (08:00), у Тараса ще й 6-годинний день.
- **S2:** 3 заявки в статусі `pending` (№5, №6, №7), їх ще ніхто не розглядав. `reviewed_by = 1` — це Олена Адміністраторка.
- **S3** (`user_id = 2`): прийшов о 06:00, пішов о 15:03, обід з 10:26 до 11:26, тобто 60 хв. Один запис — робота, другий — обід.
- **S4:** Олег (`user_id = 4`), з `2026-09-30 08:06:00`. Найімовірніше, забув відмітити вихід.
- **S5:** запис Анни за 10.09 вніс адмін (`created_by = 1`): вона забула відмітитись.

</details>

> 🧪 **Для допитливих:** спробуй здогадатися, що роблять `WHERE`, `IS NULL` і `<` у цих запитах. Наступна лекція саме про це.

---

## Частина 6. PHP: готуємо `bin/migration.php` до наступної лекції (~30 хв)

На лекції ми почали клас `Migration`, який читає файли з `database/migrations/`. Виконувати їх через PDO будемо наступного разу, а зараз зробимо так, щоб він **правильно знаходив і розбирав** файли. Тут тільки PHP, який ти вже знаєш.

Запуск: `docker exec -it my-php php bin/migration.php`

1. **🔮 Сміття в папці.** Поклади в `database/migrations/` файл `notes.txt` з будь-яким текстом і запусти скрипт. Що він виведе? (На macOS там може опинитися ще й `.DS_Store`.) Зроби так, щоб оброблялися **тільки** файли `.sql`. Підійде `str_ends_with()`, `pathinfo()` або `glob()`.
2. **Порядок.** Гарантуй порядок `000 → 005` явним сортуванням (`sort()`) і поясни в коментарі, навіщо це (згадай експеримент 1.4).
3. **Розбиття на запити.** У файлі `001_create_users.sql` два запити: `CREATE TABLE` і `CREATE FULLTEXT INDEX`. Напиши метод `splitStatements(string $sql): array`, який повертає масив окремих запитів без порожніх рядків і зайвих пробілів. Підказка: `explode()`, `trim()`, `array_filter()`.
4. **Звіт замість `d($sql)`.** Скрипт має виводити, наприклад:
   ```
   000_create_migrations.sql — 1 запит(ів)
     • CREATE TABLE IF NOT EXISTS migrations
   001_create_users.sql — 2 запит(ів)
     • CREATE TABLE IF NOT EXISTS users
     • CREATE FULLTEXT INDEX idx_fulltext_full_name ON users (full_name)
   ...
   Разом: 8 запит(ів) у 5 файлах
   ```
   Для кожного запиту виводь лише перший рядок.

> «8 запитів у 5 файлах» вийде без `005`. З твоєю `005` число буде більшим: стільки, скільки в ній `ALTER`.

**🔮 Питання на подумати:** що зламається в `splitStatements`, якщо в SQL трапиться текст з крапкою з комою всередині, наприклад `COMMENT 'обід; перерва'`? Виправляти не треба, лише опиши.

---

## Бонус

1. **ER-діаграма.** Побудуй діаграму нашої бази в DBeaver: відкрий базу `php_08_26` і перейди на вкладку *ER Diagram*. Якщо працюєш у VS Code, для цього пункту все одно знадобиться DBeaver. Збережи скріншот як `homework/08-sql/er.png`. Чи збігаються стрілки на діаграмі з нашими `FOREIGN KEY`?
2. **Нова таблиця.** «Замовник» хоче знати, хто в якому відділі працює. Напиши міграцію `006_create_departments.sql`:
   - таблиця `departments` (`id`, `title`, де `title` унікальна і не порожня);
   - у `users` нова колонка `department_id` із зовнішнім ключем на `departments`. Колонку можна не заповнювати, бо в адміна відділу немає.

   Синтаксис: `ALTER TABLE users ADD COLUMN ... AFTER role;` і `ALTER TABLE users ADD FOREIGN KEY (...) REFERENCES ...;`. Перевір, що користувача з неіснуючим відділом додати не можна (як у K4).

---

## Що здати

- `homework/08-sql/answers.sql` з прогнозами, результатами й поясненнями;
- `database/migrations/005_fix_constraints.sql`;
- оновлений `bin/migration.php`;
- бонус: `006_create_departments.sql`, `er.png`.
