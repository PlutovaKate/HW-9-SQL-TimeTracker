# ДЗ — TimeController, валідатори й репозиторій

Тема: **облік часу: check-in, обід, check-out, стан дня, ручні правки адміна**. Репозиторій як місце для бізнес-логіки, транзакції в Eloquent, Collection, Carbon і UTC, власне правило валідатора, перевірка перетину інтервалів.

На лекції ми почали `TimeController` і винесли частину логіки в `TimeEntriesRepository`:
`Router::dispatch() → #[Auth] → TimeController::status() → TimeEntriesRepository::getUserStatus() → JSON`.
Тепер ти доводиш **усі** екшни `TimeController` до контракту з docblock-ів у файлі контролера, поверх свого розв'язку ДЗ 11. Відповіді API — як і раніше: `{"data": ...}` / `{"error": {"code", "message", "fields"}}`.

Головне правило архітектури: **контролер тонкий, логіка в репозиторії**. Екшн контролера — це 1–5 рядків: перевірити вхідні дані валідатором, викликати метод репозиторію, віддати `response()`. Усі «можна / не можна», підрахунки хвилин, транзакції й запити до БД живуть у `TimeEntriesRepository`.

Код з лекції можна брати як підказку, але не копіюй його бездумно. У ньому щонайменше **сім** проблем, і експерименти нижче допоможуть їх знайти.

## Як працюємо

Як і минулого разу, головне — експерименти (T1, O1, S1, U1…):

1. **Спочатку** спрогнозуй: що поверне сервер (статус і тіло) або що буде в БД.
2. Надішли запит або виконай SQL.
3. Подивись, що сталося насправді, і **чому**: який рядок коду до цього призвів.

Більшість експериментів роби **з лекційним кодом**, а вже потім виправляй. Відповіді для самоперевірки сховані в блоках «Перевір себе». Відкривай їх **після** своїх запусків.

## Файли

Що з'явиться у твоєму проєкті:

| Файл | Частина |
|---|---|
| `app/Enums/TimeEntryType.php`, `app/Enums/WorkingState.php`, `app/Models/TimeEntry.php` (змінюєш), `app/Models/LeaveRequest.php` (змінюєш), `helpers/routes.php` (змінюєш) | 0 |
| `app/Repositories/TimeEntriesRepository.php`, `TimeController::checkIn()` | 1 |
| `TimeController::lunchStart()`, `lunchEnd()` | 2 |
| `TimeController::checkOut()` | 3 |
| `TimeController::status()`, `myEntries()`, `index()`, `app/Validators/EntriesValidator.php`, `AdminEntriesValidator.php` | 4 |
| `Core/Validator.php` (змінюєш), `app/Validators/TimeEntryUpdateValidator.php`, `TimeController::update()` | 5 |

## Що в репозиторії

Орієнтовний набір методів (назви можна інші, суть — ні):

```php
class TimeEntriesRepository
{
    public function checkIn(User $user): TimeEntry;
    public function startLunch(User $user): TimeEntry;
    public function endLunch(User $user): TimeEntry;
    public function checkOut(User $user): TimeEntry;
    public function getUserStatus(User $user): array;
    public function getEntries(User $user, string $from, string $to): array;
    public function update(TimeEntry $entry, array $data, User $admin): TimeEntry;

    private function openEntries(User $user): Collection;   // записи з ended_at IS NULL
    private function getState(Collection $open): WorkingState;
}
```

Порушення бізнес-правила (вже на роботі, не на обіді…) репозиторій повідомляє **винятком** `Core\HttpException` з ДЗ 11:
```php
throw new HttpException(409, 'conflict', 'You are already checked in');
```
`index.php` вже ловить його і віддає `jsonError(...)`. Не викликай `jsonError()` у репозиторії — чому, обговоримо в питаннях наприкінці.

---

## Частина 0. Підготовка (~15 хв)

1. Перезапусти сідер: `docker exec -it my-php php database/seed.php`. У сіді записи часу є лише за серпень–вересень, тож сьогодні в усіх «чистий» день.
2. Перенеси з лекції `TimeEntryType`, `WorkingState`, `TimeEntry` (з `$visible`, `$appends = ['is_manual']`, `$casts`, `serializeDate()`), `TimeController` і `TimeEntriesRepository`.
3. У `helpers/routes.php` розкоментуй **весь** етап 2 (`status`, `check-in`, `lunch/start`, `lunch/end`, `check-out`), етап 5 (`/me/entries`) і обидва маршрути етапу 11 (`GET /time-entries`, `PATCH /time-entries/{id}`).
4. Замість лекційного `#[Admin]` використовуй `#[Auth(Role::ADMIN)]`.
5. **Пісочниця SQL.** Багато експериментів потребують стану «працівник прийшов о 23:30 учора» тощо. Його задаємо прямо в БД (DataGrip / `docker exec -it db-mysql mysql -uroot -psecret php_08_26`). Почистити сьогоднішні записи Івана:
   ```sql
   DELETE FROM time_entries WHERE user_id = 2 AND (started_at >= UTC_DATE() - INTERVAL 1 DAY OR ended_at IS NULL);
   ```
6. У Postman створи папки `Частина 1` … `Частина 5`. Залогінься як Іван (`ivan@example.com`), токен ляже в `{{token}}`. Для частини 5 знадобиться ще адмін: зроби запит `Логін: адмін` з тим самим скриптом, але кладучи токен у змінну `adminToken`, і в адмінських запитах став *Bearer Token* `{{adminToken}}`.

> **opcache.** У контейнері PHP перевіряє, чи змінився файл, раз на 2 секунди (`opcache.revalidate_freq = 2`). Якщо після правки коду відповідь «не змінилась», почекай пару секунд і надішли ще раз.

---

## Частина 1. Репозиторій і check-in (~45 хв)

📖 [Eloquent: inserting](https://laravel.com/docs/eloquent#inserting-and-updating-models) · [refresh / fresh](https://laravel.com/docs/eloquent#refreshing-models) · [Carbon](https://carbon.nesbot.com/docs/)

Контракт — docblock над `checkIn()`:

| Ситуація | Відповідь |
|---|---|
| стан `off_duty`, сьогодні немає затвердженої заявки | `201 {"data": entry}`, `ended_at: null`, `note: null` |
| вже `working` або `on_lunch` | `409 conflict`: `You are already checked in` |
| на сьогодні є затверджена заявка | `409 conflict`: `Check-in is not available: vacation (2026-11-03 – 2026-11-07)` |

**T1. Що повертає `create()`.** Надішли `POST {{baseUrl}}/time/check-in` з лекційним кодом. Подивись уважно на статус і на `data`: це об'єкт чи масив? Чи є в entry всі поля з контракту (порівняй з docblock на початку `TimeController`)? Чому деяких ключів немає, хоча в БД ці колонки є?

**T2. Подвійний check-in.** Надішли check-in ще раз. Що відповів сервер? Скільки відкритих work-записів у Івана в БД?
```sql
SELECT id, type, started_at, ended_at FROM time_entries WHERE user_id = 2 AND ended_at IS NULL;
```

Тепер напиши `checkIn()` у репозиторії:
- стан рахуй з **відкритих** записів (`ended_at IS NULL`) через `getState()`;
- заявку шукай у `$user->leaveRequests()`: `status = 'approved'` і сьогодні між `date_from` та `date_to`. Щоб у повідомленні були дати, а не `2026-11-03T00:00:00.000000Z`, додай у `LeaveRequest` `$casts` для `date_from` / `date_to` (а якщо ще не виправив у ДЗ 11 — `const UPDATED_AT = null;`);
- повертай модель з усіма колонками, контролер віддає `201`.

**T3. Відпустка.** Перевір правило про заявку:
```sql
INSERT INTO leave_requests (user_id, type, date_from, date_to, status)
VALUES (2, 'vacation', UTC_DATE() - INTERVAL 1 DAY, UTC_DATE() + INTERVAL 3 DAY, 'approved');
```
Що відповідає check-in? А якщо змінити `status` на `pending`? Після перевірки видали цей рядок.

**T4. Чий «зараз»?** Лекційний код пише `'started_at' => date('Y-m-d H:i:s')`. Тимчасово додай у `index.php` одразу після `const BASE_DIR` рядок
```php
date_default_timezone_set('Europe/Kyiv');
```
(так буде на будь-якому сервері, де `date.timezone` в `php.ini` не UTC). Почисти записи Івана, зроби check-in і порівняй `started_at` у відповіді з реальним часом UTC (`SELECT UTC_TIMESTAMP();`). Наскільки він «з'їхав» і чому суфікс `Z` тепер бреше? Що станеться з `worked_minutes` і з `"date"` у `/time/status` о 23:30 за Києвом? Прибери рядок з `index.php`.

<details>
<summary>Перевір себе: частина 1</summary>

| Запит | Статус | Тіло |
|---|---|---|
| check-in, `off_duty` | 201 | `{"data":{"id":…,"user_id":2,"type":"work","started_at":"…Z","ended_at":null,"note":null,"is_manual":false}}` |
| check-in ще раз | 409 | `You are already checked in` |
| check-in у стані `on_lunch` | 409 | `You are already checked in` |
| check-in, затверджена відпустка | 409 | `Check-in is not available: vacation (2026-10-30 – 2026-11-03)` (твої дати) |
| check-in, заявка `pending` | 201 | новий запис |
| check-in без токена | 401 | `unauthorized` |

- **T1:** статус **200**, а `data` — **масив** з одного елемента: `{"data":[{"type":"work","started_at":"…","user_id":2,"id":381,"is_manual":false}]}`. Зайві квадратні дужки в `response([$timeEntry->toArray()])`. Ключів `ended_at` і `note` немає: `create()` робить `INSERT` і повертає модель лише з тими атрибутами, які ти **присвоїв** (+ `id`). Значення за замовчуванням з БД (`NULL`) модель не бачить, поки не перечитає рядок: `$entry->refresh()` (перечитує цю ж модель) або `$entry->fresh()` (повертає нову). Фронт чекає `ended_at: null`, а отримує `undefined`.
- **T2:** другий check-in → знову 200, у БД **два** відкриті work-записи. Лекційний `checkIn()` взагалі не дивиться на стан.
- **T3:** з `approved` → 409, з `pending` → 201: блокує лише затверджена заявка.
- **T4:** `started_at` у відповіді на **2 години** більший (у листопаді Київ — UTC+2, влітку — +3): `date()` повертає місцевий час, у БД він лягає як є, а `serializeDate()` чесно дописує `Z`. Записи з'їжджають, `is_late` рахується неправильно, а з 22:00 до 00:00 UTC «сьогодні» для `date('Y-m-d')` уже завтра. Якщо твій `#[Auth]` порівнює `token_expired_at` через `new DateTime(...)`, як на лекції, — побачиш ще й `401 Expired token`: той самий баг у перевірці токена. Правило: **усе в UTC явно** — `gmdate()`, `Carbon::now('UTC')`, а в моделі `closeEntry()` — теж не `date()`.




</details>

---

## Частина 2. Обід (~30 хв)

| Маршрут | Успіх | 409 conflict |
|---|---|---|
| `POST /api/time/lunch/start` | `201 {"data": entry}` — новий lunch | `You are not checked in` (`off_duty`) · `You are already on lunch` (`on_lunch`) · `Lunch has already been taken today` |
| `POST /api/time/lunch/end` | `200 {"data": entry}` — закритий lunch | `You are not on lunch` |

Обід — один на день: якщо сьогодні (UTC) вже є lunch-запис, другий почати не можна.

Реалізуй `startLunch()` і `endLunch()` у репозиторії. Зручно розібрати стани через `match`:
```php
match ($this->getState($this->openEntries($user))) {
    WorkingState::OFF_DUTY => throw new HttpException(409, 'conflict', 'You are not checked in'),
    WorkingState::ON_LUNCH => throw new HttpException(409, 'conflict', 'You are already on lunch'),
    WorkingState::WORKING => null,
};
```
(з PHP 8.0 `throw` — це вираз, тож його можна писати в `match` і після `??`).

**L1. Чи потрібен `?->`?** У лекційному `checkOut()` є `$work?->closeEntry()` одразу після `if (!$work) { jsonError(...) }`. Чи може тут `$work` бути `null`? А в твоєму коді, якщо `jsonError()` без `die()`, а перевірку зроблено через `HttpException`? Що з цього випливає: де `?->` має сенс, а де лише ховає помилку?

<details>
<summary>Перевір себе: частина 2</summary>

Почни з чистого дня Івана і йди по рядках згори вниз.

| Запит | Статус | Тіло |
|---|---|---|
| `lunch/start` до check-in | 409 | `You are not checked in` |
| `lunch/end` до check-in | 409 | `You are not on lunch` |
| check-in | 201 | work-запис |
| `lunch/end` | 409 | `You are not on lunch` |
| `lunch/start` | 201 | lunch-запис, `ended_at: null` |
| `lunch/start` | 409 | `You are already on lunch` |
| `lunch/end` | 200 | той самий lunch, `ended_at` = зараз |
| `lunch/start` | 409 | `Lunch has already been taken today` |

- **L1:** з лекційним `jsonError()` (у ньому `die()`) `$work` після `if` ніколи не `null`, тож `?->` нічого не робить, лише вводить читача в оману. Без `die()` `?->` «тихо» пропустив би закриття і далі впав би на `$work->toArray()`. З `?? throw` змінна гарантовано не `null`, і `?->` не потрібен. `?->` доречний там, де `null` — **нормальний** варіант: `$open->firstWhere('type', TimeEntryType::LUNCH)?->closeEntry()` (обіду може й не бути).

</details>

---

## Частина 3. Check-out і транзакції (~45 хв)

📖 [Транзакції в Eloquent](https://laravel.com/docs/database#database-transactions) · [Collection](https://laravel.com/docs/collections#method-isempty)

`POST /api/time/check-out` → `200 {"data": <закритий work>}`. Якщо є відкритий обід, він закривається **в тій самій транзакції**. Немає відкритого work → `409 You are not checked in`.

**O1. Порожня колекція.** Почисти записи Івана і з лекційним кодом надішли check-out. Яке повідомлення ти отримав і чи воно з контракту? Що повертає `empty($timeEntries)`, коли `get()` нічого не знайшов? Чому?

**O2. Транзакція, яка нічого не відкочує.** Підготуй стан «працює й на обіді»:
```sql
INSERT INTO time_entries (user_id, type, started_at, ended_at, created_by) VALUES
(2, 'work',  UTC_TIMESTAMP() - INTERVAL 3 HOUR,    NULL, 2),
(2, 'lunch', UTC_TIMESTAMP() - INTERVAL 20 MINUTE, NULL, 2);
```
У лекційному `checkOut()` тимчасово встав одразу після `$lunch->closeEntry();`:
```php
throw new PDOException('boom');
```
Надішли check-out. Що відповів сервер? Що тепер у БД з обідом і з роботою? Транзакція ж була — чому `rollBack()` не повернув обід? Підказка: звідки береться `db()` і через яке з'єднання ходить `$lunch->closeEntry()`? Перевір у пісочниці `HealthController::check()`:
```php
response(['same_pdo' => db() === Capsule::connection()->getPdo()]);
```
І ще: що побачить клієнт, якщо замість `boom` буде справжня помилка SQL? Чи добре це?

Прибери `throw`. Перепиши check-out через транзакцію Eloquent:
```php
return Capsule::connection()->transaction(function () use ($user) {
    // ... закрити lunch (якщо є) і work
    return $work;
});
```
`transaction()` сам робить `commit`, а при будь-якому винятку — `rollBack` і кидає виняток далі. Не лови `PDOException` у контролері: неочікувана помилка БД — це `500`, а не `422`.

**O3. Нічна зміна.** Лекційний код шукає відкриті записи лише за сьогодні (`started_at > date('Y-m-d 00:00:00')`). Іван прийшов учора о 23:30 і ще працює:
```sql
INSERT INTO time_entries (user_id, type, started_at, ended_at, created_by)
VALUES (2, 'work', CONCAT(UTC_DATE() - INTERVAL 1 DAY, ' 23:30:00'), NULL, 2);
```
Надішли `GET /time/status`, потім check-out, потім check-in. Що бачиш у кожній відповіді і в БД? Як виправити? (Підказка: відкритий запис відкритий незалежно від дати.)

<details>
<summary>Перевір себе: частина 3</summary>

| Запит | Статус | Тіло / БД |
|---|---|---|
| check-out без check-in | 409 | `You are not checked in` |
| check-out у стані `working` | 200 | work з `ended_at` |
| check-out у стані `on_lunch` | 200 | work з `ended_at`; у БД **обидва** записи закриті тим самим часом |
| check-out ще раз | 409 | `You are not checked in` |
| нічна зміна: status | 200 | `state: working`, entries містить учорашній запис |
| нічна зміна: check-in | 409 | `You are already checked in` |
| нічна зміна: check-out | 200 | учорашній work закрито |

- **O1:** лекційний код відповідає `409 There are no work records` — це повідомлення з **іншої** гілки коду. `get()` повертає об'єкт `Collection`, навіть порожній, а `empty()` для об'єкта завжди `false`. Перевірка `if (empty(...))` ніколи не спрацьовує, і код доходить до `if (!$work)`. Для колекцій: `->isEmpty()` / `->isNotEmpty()`, а ще краще — одразу `firstWhere(...) ?? throw ...`.
- **O2:** `422 {"error":{"code":"Error","message":"boom","fields":{}}}`, а в БД **lunch закритий, work відкритий**. `db()` — це наш власний `Core\DB` з окремим `new PDO(...)`, а Eloquent ходить через своє з'єднання `Capsule`. `same_pdo` = `false`. `db()->beginTransaction()` / `rollBack()` керують транзакцією на з'єднанні, через яке не пройшов **жоден** запит, а `UPDATE` обіду в з'єднанні Eloquent одразу закомітився (autocommit). Справжня SQL-помилка віддала б клієнту текст запиту з назвами таблиць і колонок — витік деталей реалізації, а ще статус 422 («ти неправильно заповнив форму»), хоча винен сервер.
- **O3:** status — `off_duty` і `allowed_actions: ["check_in"]`; check-out → `409`; check-in → `200` і в БД **два** відкриті work-записи: учорашній не закриється вже ніколи. Виправлення: `openEntries()` = `whereNull('ended_at')` без умови на дату, а в `status` показуй записи за сьогодні **плюс** відкриті.

</details>

---

## Частина 4. Стан дня і записи (~45 хв)

Контракт `GET /api/time/status` — у docblock над `status()`. Зверни увагу:
- `worked_minutes` — **ціле число хвилин**: сума всіх work-записів дня мінус сума lunch-записів; відкриті записи рахуємо до «зараз»;
- `entries` — записи за сьогодні, **відсортовані** за `started_at`;
- `server_time` — у тому ж форматі, що й дати в entry: `2026-11-03T10:12:00Z`.

**S1. Обіду ще не було.** Почисти записи Івана, зроби check-in і з лекційним кодом надішли `GET /time/status`. Подивись *Raw*. Що в тілі крім JSON? Який рядок у `getUserStatus()` винен і що там треба перевіряти насправді?

**S2. Скільки я відпрацював?** Задай день з двома сесіями роботи й обідом:
```sql
INSERT INTO time_entries (user_id, type, started_at, ended_at, created_by) VALUES
(2, 'work',  CONCAT(UTC_DATE(), ' 11:00:00'), CONCAT(UTC_DATE(), ' 12:00:00'), 2),
(2, 'work',  CONCAT(UTC_DATE(), ' 06:00:00'), CONCAT(UTC_DATE(), ' 10:00:00'), 2),
(2, 'lunch', CONCAT(UTC_DATE(), ' 08:00:00'), CONCAT(UTC_DATE(), ' 08:30:00'), 2);
```
Порахуй **сам**, скільки має бути `worked_minutes` і `lunch_minutes`. Що повертає лекційний код? Знайди три відмінності від контракту.

**S3. Порядок.** У прикладі вище записи вставлено **не** за часом. У якому порядку вони прийшли в `entries` з лекційним кодом? Чи гарантує це SQL без `ORDER BY`? Звідки тоді такий порядок?

`myEntries()` та `index()` на лекції вже зроблені. Перенеси їх у свій проєкт так, щоб помилки йшли через `HttpException`, і перевір таблицею нижче.

<details>
<summary>Перевір себе: частина 4</summary>

| Запит | Статус | Тіло |
|---|---|---|
| status, чистий день | 200 | `state: off_duty`, `allowed_actions: ["check_in"]`, `worked_minutes: 0`, `entries: []` |
| status після check-in | 200 | `working`, `["lunch_start","check_out"]` |
| status на обіді | 200 | `on_lunch`, `["lunch_end","check_out"]` |
| status після обіду | 200 | `working`, `["check_out"]` |
| status, день з S2 | 200 | `worked_minutes: 270`, `lunch_minutes: 30`, entries у порядку 06:00, 08:00, 11:00 |
| `GET /me/entries?from=2026-09-01&to=2026-09-30` | 200 | записи за вересень, у work — `is_late` |
| `GET /me/entries?from=2026-09-30&to=2026-09-01` | 422 | `fields.to`: `Must be after or equal to from` |
| `GET /me/entries?from=2026-02-30&to=2026-03-01` | 422 | `fields.from`: `... must be a valid date (YYYY-MM-DD).` |
| `GET /time-entries?user_id=2&from=…&to=…` токеном Івана | 403 | `forbidden` |
| те саме адміном, `user_id=999` | 404 | `User not found` |

- **S1:** перед JSON — HTML Xdebug `Warning: Attempt to read property "ended_at" on null` у рядку з `!$lunch->ended_at`. Фронт не може розібрати таку відповідь. Для `working` важливо лише одне: чи був **сьогодні** обід (будь-який, відкритий не може бути — тоді стан `on_lunch`). Тобто `$lunch === null ? ['lunch_start', 'check_out'] : ['check_out']`.
- **S2:** правильно `4·60 + 60 − 30 = 270` і `30`. Лекційний код повертає `"worked_minutes":"04:00:00"`: (1) **рядок** «год:хв:с» замість числа хвилин; (2) рахує лише **перший** work-запис (`->first()`), друга сесія 11:00–12:00 загубилась; (3) обід **не віднімається**. Так само `lunch_minutes` рахує лише перший обід. І ще `server_time` — `"2026-10-31 13:41:32"` без `T` і `Z`. Підказка: `$entries->sum(fn (TimeEntry $e) => ...)` і `($e->ended_at ?? $now)`.
- **S3:** прийшли 06:00, 08:00, 11:00 — «правильно», хоча вставлено в іншому порядку. MySQL пройшов індексом `idx_user_id_started_at (user_id, started_at)`, і рядки вийшли в порядку індексу. Це **деталь виконання**: інший план запиту (інший фільтр, інший індекс, інша версія MySQL) — і порядок зміниться. Без `ORDER BY` порядок не гарантований — пиши `->orderBy('started_at')` явно.

</details>

---

## Частина 5. Ручна правка адміном (~60 хв)

📖 [DateTime::createFromFormat](https://www.php.net/manual/en/datetime.createfromformat.php) · [Перетин інтервалів](https://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap)

`PATCH /api/time-entries/{id}` — лише для адміна. Тіло:
```json
{"started_at": "2026-11-03T06:00:00Z", "ended_at": "2026-11-03T15:00:00Z", "note": "Забув відмітитись"}
```

| Поле | Правила |
|---|---|
| `started_at` | `required`, `datetime` |
| `ended_at` | `nullable`, `datetime` |
| `note` | `nullable`, `string`, `max:255` |

Порядок перевірок і відповіді:

| Ситуація | Відповідь |
|---|---|
| не адмін / без токена | `403 forbidden` / `401 unauthorized` |
| запису немає | `404 not_found`: `Time entry not found` |
| не пройшли правила | `422 validation`, `fields.<поле>` |
| `started_at` у майбутньому | `422`, `fields.started_at`: `Time cannot be in the future` |
| `ended_at <= started_at` | `422`, `fields.ended_at`: `Must be after started_at` |
| інтервал перетинає **інший** запис того ж користувача й типу | `409 conflict`: `The interval overlaps another work entry` (або `lunch`) |
| lunch не лежить усередині жодного work | `409 conflict`: `Lunch must be inside a work interval` |
| усе добре | `200 {"data": entry}`, `created_by` = id адміна → `is_manual: true` |

1. **`Core\Validator`:**
   - правило **`datetime`** — рядок рівно у форматі `Y-m-d\TH:i:s\Z`, справжня дата (`2026-02-30T06:00:00Z` не проходить). Зроби за зразком `validateDate()`;
   - правило **`nullable`**: зараз воно в `DEFAULT_MESSAGES` є, але нічого не робить. Якщо поле передано як `null` і в правилах є `nullable`, решту правил для нього не перевіряємо. Перевір: `{"started_at": "...", "ended_at": null}` не повинен давати помилку `datetime`.
2. **`App\Validators\TimeEntryUpdateValidator`** з таблиці вище.
3. **`TimeEntriesRepository::update()`** — усі перевірки після валідатора, збереження, повертає оновлену модель.

**U1. Двері без замка.** До того як щось писати: з лекційним кодом (порожній `update()`) і розкоментованим маршрутом надішли `PATCH {{baseUrl}}/time-entries/1` з токеном **Івана**, а потім **без токена** взагалі. Що відповідає сервер? Чого бракує над `update()` у лекційному контролері? Що могло б статися, якби тіло методу вже було написане?

**U2. Mass assignment ще раз.** Найкоротша реалізація — `$entry->update(requestBody())`. Що станеться, якщо адмін (або хтось з його токеном) надішле
```json
{"started_at": "...", "ended_at": "...", "user_id": 3, "type": "lunch"}
```
Які з цих полів є в `$fillable` моделі `TimeEntry`? Що буде із записом? Як передати в репозиторій **лише** поля з валідатора?

**U3. Перетин сам із собою.** Інтервали `[a1, a2)` і `[b1, b2)` перетинаються, якщо `a1 < b2 AND b1 < a2`. Напиши перевірку перетину спершу «як є»: усі записи цього користувача і типу, у яких `started_at < :ended_at AND ended_at > :started_at`. Тепер зміни в існуючому записі **лише** `note` (час той самий). Що відповідає сервер? Чому? Виправ.

**U4. Відкритий кінець.** Що означає `ended_at = null` для інтервалу — і в запиті, і в записах, з якими порівнюємо? Задай день з S2 і надішли адміном для запису 06:00–10:00 `"ended_at": null`. Що має відповісти сервер і чому? Що станеться з Іваном, якщо перевірка це пропустить? Допиши перевірку так, щоб `NULL` з обох боків означав «до нескінченності».

<details>
<summary>Перевір себе: частина 5</summary>

День з S2 (work 06:00–10:00 і 11:00–12:00, lunch 08:00–08:30), запити адміном до work 06:00–10:00, якщо не сказано інше. `D` — сьогоднішня дата.

| Тіло / запит | Статус | Тіло відповіді |
|---|---|---|
| токеном Івана | 403 | `forbidden` |
| `/time-entries/99999` | 404 | `Time entry not found` |
| `{}` | 422 | `fields.started_at`: `The started_at field is required.` |
| `"started_at":"2026-10-31 06:00:00"` | 422 | `fields.started_at`: формат |
| `"started_at":"2026-02-30T06:00:00Z"` | 422 | `fields.started_at`: формат |
| `"started_at":"2099-01-01T06:00:00Z"` | 422 | `fields.started_at`: `Time cannot be in the future` |
| `started_at` D 06:00, `ended_at` D 05:00 | 422 | `fields.ended_at`: `Must be after started_at` |
| `note` з 256 символів | 422 | `fields.note`: `... may not be greater than 255 characters.` |
| 06:00–10:00 + `note` | 200 | `note` збережено, `is_manual: true` |
| 06:00–11:30 | 409 | `The interval overlaps another work entry` |
| 06:00, `"ended_at": null` | 409 | `The interval overlaps another work entry` |
| lunch → 10:15–10:45 | 409 | `Lunch must be inside a work interval` |
| lunch → 09:45–10:15 | 409 | `Lunch must be inside a work interval` (вилазить за межі) |
| lunch → 09:00–09:30 + `"user_id":3,"type":"work"` | 200 | `user_id: 2`, `type: lunch` — зайві поля проігноровано |

- **U1:** `200`, тіло порожнє — і з токеном Івана, і **без токена**. Над `update()` немає жодного атрибута, тож роутер просто викликає метод. Як тільки метод почне щось зберігати, будь-хто з інтернету правитиме чужі записи часу. Атрибут — частина контракту екшна: пиши його **разом** з сигнатурою, ще до тіла.
- **U2:** `user_id` і `type` є в `$fillable` (вони потрібні для `create()` у check-in), тож запис переїде до Марії (`user_id = 3`) і стане обідом — у її табелі з'явиться чужий час. Бери тільки дозволені ключі (`array_intersect_key(requestBody(), array_flip(['started_at', 'ended_at', 'note']))`) або присвоюй поля по одному. `$fillable` захищає від полів, які **ніхто** не повинен заповнювати масивом, але не від тих, які не можна міняти саме **в цьому** екшні.
- **U3:** `409 The interval overlaps another work entry`: запис перетинається **сам із собою** — старий рядок ще в БД з тим самим часом. Потрібно `->where('id', '!=', $entry->id)`.
- **U4:** `null` у запиті — «ще триває», тобто до нескінченності: умову `started_at < :ended_at` тоді просто не додаємо. `NULL` у записах з БД — так само: `(ended_at IS NULL OR ended_at > :started_at)`. Без цього `ended_at > :started_at` для `NULL` дає `NULL` (не `true`), і відкриті записи «не перетинаються» ні з чим. Тут 06:00–∞ перетинає 11:00–12:00 → 409. Якби пройшло, у Івана з'явився б **другий відкритий work** у минулому, як в O3.
- Підказка до перевірки перетину:
  ```php
  TimeEntry::where('user_id', $entry->user_id)
      ->where('type', $entry->type)
      ->where('id', '!=', $entry->id)
      ->when($endedAt, fn ($q) => $q->where('started_at', '<', $endedAt))
      ->where(fn ($q) => $q->whereNull('ended_at')->orWhere('ended_at', '>', $startedAt))
      ->exists();
  ```

</details>

---

## Що здати

- Посилання на гілку або PR з кодом: усі маршрути етапів 2, 5 і 11 розкоментовані, `dashboard.html` і `entries.html` працюють, `check()` повернутий до `{"status": "OK"}`, у `index.php` немає `date_default_timezone_set`.
