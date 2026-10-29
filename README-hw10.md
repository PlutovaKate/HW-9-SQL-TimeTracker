# ДЗ — Роутер, health check і логін

Тема: **front controller, маршрутизація, валідація, логін за токеном**. `.htaccess` + `mod_rewrite`, таблиця маршрутів і `preg_match`, JSON-відповіді, клас-валідатор, `password_verify`, токен зі строком дії.

На лекції ми дивились, як запит проходить шлях
`Apache → .htaccess → index.php → Core\Router::dispatch() → контролер → JSON`.
Тепер ти збираєш цей ланцюжок **сам** у своєму проєкті: від налаштування Apache до логіну, який видає токен. Перевіряєш усе запитами з Postman.

Код з лекції можна використовувати як підказку, але не переписуй його бездумно: у ньому є щонайменше три баги, і експерименти нижче допоможуть їх знайти.

## Як працюємо

Головне — експерименти (A1, R1, V1, L1…):

1. **Спочатку** запиши в `answers.md` прогноз: що поверне сервер (статус і тіло)?
2. Надішли запит.
3. Запиши, що сталося насправді, і **чому**: який рядок коду до цього призвів.

Відповіді для самоперевірки сховані в блоках «Перевір себе». Відкривай їх **після** своїх запусків.

## Файли

| Файл | Що з ним робити |
|---|---|
| `answers.md` | Прогнози, результати, пояснення й відповіді на питання. Головний файл здачі |
| `requests.http` | Список запитів, які треба створити в Postman: метод, адреса, тіло |
| `seed.php` | Готовий сідер: копіюєш у `database/seed.php` |

Що з'явиться у твоєму проєкті:

| Файл | Частина |
|---|---|
| `Dockerfile` (змінюєш), `.htaccess` | 1 |
| `index.php` (змінюєш), `helpers/functions.php` (змінюєш), `helpers/routes.php` (переписуєш), `Core/Router.php`, `app/Controllers/HealthController.php` | 2 |
| `Core/Validator.php`, `app/Validators/AuthValidator.php` | 3 |
| `database/migrations/006_add_token_expired_at_to_users.sql`, `app/Enums/Role.php`, `app/Controllers/AuthController.php` (дописуєш) | 4 |

## Як надсилати запити

Усі запити надсилаємо з **[Postman](https://www.postman.com/downloads/)**. Запити створюєш сам, вручну — `requests.http` лише підказує, які саме.

1. Створи колекцію **TimeTracker** (*New → Collection*), а в ній — папки `Частина 1–2`, `Частина 4`.
2. Щоб не писати адресу щоразу, відкрий колекцію → вкладка *Variables* → додай змінну `baseUrl` зі значенням `http://localhost/api` і натисни *Save*. Далі в рядку адреси пишеш `{{baseUrl}}/health`.
3. **GET-запит:** *Add request* → метод `GET` → адреса `{{baseUrl}}/health` → *Send*.
4. **POST-запит з JSON:** метод `POST` → адреса `{{baseUrl}}/auth/login` → вкладка *Body* → *raw* → у випадаючому списку праворуч обери **JSON** → встав тіло:
   ```json
   {"email": "ivan@example.com", "password": "password"}
   ```
   Postman сам додасть заголовок `Content-Type: application/json`.
5. **Запит без тіла** (експеримент L2): у вкладці *Body* обери *none*.
6. Кожен запит зберігай (`Ctrl+S` / `Cmd+S`) у потрібну папку з назвою на зразок `Логін: невірний пароль` — так його легко повторити після змін у коді.

Відповідь дивись у нижній панелі:
- праворуч угорі — **статус** (`200 OK`, `401 Unauthorized`…). Це так само важливо, як і тіло;
- вкладка *Body* → *Pretty* показує JSON з відступами, *Raw* — відповідь як є. Якщо у відповіді кілька JSON поспіль або HTML, *Pretty* може її не розібрати — тоді дивись *Raw*;
- вкладка *Headers* — заголовки відповіді.

> Якщо у відповіді (*Raw*) замість JSON бачиш HTML-таблицю з `( ! )` — це Xdebug показує попередження чи помилку PHP. Не лякайся, а **читай її**: там написано, що сталося і в якому рядку.

---

## Частина 0. Підготовка (~10 хв)

1. Скопіюй `seed.php` з цієї папки в `database/seed.php` свого проєкту.
2. Застосуй міграції й наповни базу (пароль у всіх користувачів — `password`):
   ```bash
   docker exec -it my-php php bin/migration.php
   docker exec -it my-php php database/seed.php
   ```
   Користувачі: `admin@example.com`, `ivan@example.com`, `maria@example.com`, …, `former@example.com` (звільнений, `is_active = 0`).
3. Встанови Postman і створи колекцію зі змінною `baseUrl` (див. вище).

---

## Частина 1. Усі `/api/...` → `index.php` (~20 хв)

📖 [mod_rewrite](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html)

**A1.** Перш ніж щось міняти, надішли `GET {{baseUrl}}/health`. Що відповість сервер і **хто** саме — Apache чи PHP?

1. У `Dockerfile` увімкни модуль `rewrite` (`a2enmod rewrite`) і перезбери контейнер:
   ```bash
   docker compose up -d --build
   ```
2. Створи `.htaccess` у корені проєкту. Він має:
   - відправляти в `index.php` **лише** запити, шлях яких починається з `api` (`/api`, `/api/health`, `/api/auth/login`…);
   - решту (`/frontend/...`, файли) не чіпати — Apache віддає їх як є;
   - передавати в PHP заголовок `Authorization` (Apache сам цього не робить; знадобиться на наступних лекціях).
3. Тимчасово допиши в кінець `index.php` рядок `echo $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI'];` і перевір:
   - `GET {{baseUrl}}/health` → `GET /api/health`;
   - `POST {{baseUrl}}/what/ever?x=1` → `POST /api/what/ever?x=1`;
   - `GET http://localhost/frontend/` (без `/api`) повертає HTML-сторінку, а не текст з `index.php`.

   Після перевірки цей рядок прибери.

<details>
<summary>Перевір себе: частина 1</summary>

- **A1:** `404 Not Found` у вигляді **HTML-сторінки Apache**. PHP навіть не запускався: файлу `/api/health` на диску немає, а правил переписування ще немає.
- `.htaccess` з лекції:
  ```apache
  RewriteEngine On
  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
  RewriteRule ^api(/.*)?$ index.php [QSA,L]
  ```
- Якщо після змін усе одно HTML 404 — найімовірніше, контейнер не перезібрано і `mod_rewrite` вимкнений.

</details>

---

## Частина 2. Роутер і health check (~40 хв)

📖 [preg_match](https://www.php.net/manual/en/function.preg-match.php) · [parse_url](https://www.php.net/manual/en/function.parse-url.php) · [json_encode](https://www.php.net/manual/en/function.json-encode.php) · [Spread `...`](https://www.php.net/manual/en/functions.arguments.php#functions.variable-arg-list)

**Формат відповідей** — однаковий для всього API:
```json
{"data": {...}}
{"error": {"code": "not_found", "message": "...", "fields": {}}}
```
Коди помилок пишемо малими літерами з підкресленням: `validation`, `unauthorized`, `not_found`.

1. **Хелпери** в `helpers/functions.php`:
   - `response(array $data = [], int $status = 200): void` — ставить статус і `Content-Type: application/json`, друкує `{"data": ...}`;
   - `jsonError(int $status, string $code, string $message, array $fields = []): void` — те саме для `{"error": ...}`. Порожні `fields` мають бути `{}`, а не `[]`: подумай, як цього досягти;
   - `requestBody(): array` — JSON-тіло запиту як масив. **Завжди** повертає масив, навіть коли тіла немає або там не JSON.
2. **Таблиця маршрутів** — `helpers/routes.php` повертає масив рядків `[метод, шлях, [Контролер::class, 'метод']]`. Стару заготовку з `match` видали.
3. **`Core\Router::dispatch(string $method, string $uri): void`**:
   - бере зі `$uri` лише шлях, без `?query`, і прибирає слеш у кінці;
   - проходить по таблиці маршрутів, перетворює шаблон шляху на regex (`/api/users/{id}` → `#^/api/users/(\d+)$#`) і шукає перший, що збігся і за методом, і за шляхом;
   - створює контролер і викликає його метод, передаючи значення `{...}` аргументами;
   - якщо нічого не підійшло — `404 not_found`.
4. **`index.php`** викликає `\Core\Router::dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'])`.
5. **`App\Controllers\HealthController::check()`** → `200 {"data": {"status": "OK"}}`. Маршрут `GET /api/health`.
6. Перевір параметри маршруту: додай **тимчасовий** маршрут `GET /api/health/{id}` → `HealthController::show($id)`, який повертає `{"data": {"id": ...}}`. Після перевірки прибери і маршрут, і метод.

**R1.** Що поверне `GET {{baseUrl}}/health/abc`? Хто вирішив — контролер чи роутер?

**R2.** Чому `helpers/routes.php` **не можна** додавати в `autoload.files` у `composer.json`, як `helpers/functions.php`?

<details>
<summary>Перевір себе: частина 2</summary>

| Запит | Статус | Тіло |
|---|---|---|
| `GET /api/health` | 200 | `{"data":{"status":"OK"}}` |
| `GET /api/health/` | 200 | те саме (слеш у кінці прибирає роутер) |
| `GET /api/health?x=1` | 200 | те саме |
| `GET /api/nope` | 404 | `{"error":{"code":"not_found","message":"...","fields":{}}}` |
| `POST /api/health` | 404 | шлях є, але метод не той (див. бонус) |
| `GET /api/health/5` | 200 | `{"data":{"id":"5"}}` — значення з URL завжди рядок |
| `GET /api/health/abc` | 404 | **роутер**: `{id}` → `(\d+)`, `abc` під regex не підходить, до контролера запит не доходить |

- `fields: {}`: порожній PHP-масив `json_encode` перетворює на `[]`, а порожній об'єкт — на `{}`, тому `(object) $fields`.
- **R2:** файл з `autoload.files` підключається через `require` при кожному запуску, а результат (`return [...]`) викидається. Роутеру потрібен саме масив, тому він робить `$routes = require ...` сам.

</details>

---

## Частина 3. Валідатор (~30 хв)

📖 [filter_var](https://www.php.net/manual/en/function.filter-var.php) · [Late static binding](https://www.php.net/manual/en/language.oop5.late-static-bindings.php)

Як на лекції: **базовий клас** `Core\Validator` уміє перевіряти правила, а **підклас** на кожну форму лише описує, які поля й правила потрібні.

```php
class AuthValidator extends Validator
{
    static protected array $rules = [
        'email' => ['required', 'string', 'email', 'max:255'],
        'password' => ['required', 'string', 'min:8', 'max:255'],
    ];
}

// у контролері:
if (!AuthValidator::validate()) {
    jsonError(422, 'validation', 'Validation failed', AuthValidator::errors());
    return;
}
```

1. `Core\Validator`:
   - `static public function validate(): bool` — перевіряє `requestBody()` за `static::$rules`, заповнює помилки;
   - `static public function errors(): array` — `['поле' => 'повідомлення']`, одна помилка на поле;
   - правила: `required`, `string`, `email`, `min:N`, `max:N`. Для **рядка** `min`/`max` — довжина (`mb_strlen`), для **числа** — значення;
   - якщо поля немає в тілі, перевіряється лише `required`;
   - **невідоме правило** (наприклад, помилка в назві `'reqired'`) — кидай виняток, а не пропускай мовчки.
2. `App\Validators\AuthValidator` — правила з прикладу вище.

**V1.** На лекції `min`/`max` визначали «число це чи рядок» через `is_numeric($value)`. Що тоді станеться з паролем `"123"` і правилом `min:8`? Чому для JSON краще `is_int()` / `is_float()`?

**V2.** Чому `validate()` у базовому класі має читати `static::$rules`, а не `self::$rules`?

<details>
<summary>Перевір себе: частина 3</summary>

- **V1:** `is_numeric("123") === true`, тож `min:8` порівняє **число** 123 ≥ 8 і пропустить тризначний пароль. У JSON `"123"` (у лапках) приходить рядком, а `123` (без лапок) — числом, тому `is_int()`/`is_float()` точно розрізняють їх.
- **V2:** `self::` завжди означає клас, де написано код (`Validator`, де `$rules = []`), тож валідатор не перевірив би нічого. `static::` — клас, на якому викликали метод (`AuthValidator`).
- Навіщо виняток на невідоме правило: на лекції правила `in`, `gt`, `nullable` мали тексти помилок, але потрапляли в `default => true` і пропускали будь-що. Виняток одразу показує помилку в назві правила.

</details>

---

## Частина 4. Логін (~45 хв)

📖 [password_verify](https://www.php.net/manual/en/function.password-verify.php) · [random_bytes](https://www.php.net/manual/en/function.random-bytes.php) · [HTTP-коди 401 vs 422](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses)

Логін має відповідати так:

| Запит | Відповідь |
|---|---|
| `POST /api/auth/login` з правильними даними | `200 {"data": {"token": "...", "user": {...}}}` |
| порожні або невалідні поля | `422 {"error": {"code": "validation", "message": "...", "fields": {...}}}` |
| невірний email, невірний пароль або `is_active = 0` | `401 {"error": {"code": "unauthorized", "message": "Invalid email or password", "fields": {}}}` — **одна й та сама** відповідь для всіх трьох випадків |

1. **Міграція** `database/migrations/006_add_token_expired_at_to_users.sql`: колонка `token_expired_at DATETIME` після `api_token`. Запусти `bin/migration.php`.
2. **`App\Enums\Role`** (`'admin'`, `'employee'`) з методом `label()`: `Адміністратор` / `Працівник`.
3. **`publicUser(array $user): array`** у `helpers/functions.php` — рядок з БД → JSON-представлення користувача:
   ```json
   {
     "id": 2,
     "full_name": "Іван Петренко",
     "email": "ivan@example.com",
     "phone": null,
     "role": "employee",
     "role_label": "Працівник",
     "work_start": "06:00:00",
     "daily_hours": 8,
     "vacation_days": 24,
     "is_active": true,
     "created_at": "2026-07-02T08:00:00Z"
   }
   ```
   - **без** `password`, `api_token`, `token_expired_at`;
   - числа — числами, `is_active` — `true`/`false` (PDO повертає все рядками: `"2"`, `"1"`);
   - `role_label` — з enum: `Role::from($user['role'])->label()`;
   - `created_at` — ISO-8601 UTC з `T` і `Z`.
4. **`AuthController::login()`**, маршрут `POST /api/auth/login`:
   1. `AuthValidator` → 422;
   2. шукаємо користувача за email (prepared statement!);
   3. немає, `is_active = 0` або `password_verify` не збігся → 401;
   4. генеруємо токен `bin2hex(random_bytes(32))`, строк дії — **2 години від зараз, в UTC**; записуємо обидва в `users`;
   5. `200 {"data": {"token": ..., "user": publicUser(...)}}`.
5. **L1. Забутий `return`.** Тимчасово прибери `return` після `jsonError(401, ...)`. Надішли логін `maria@example.com` / `wrongpass1` і подивись у БД:
   ```sql
   SELECT email, api_token, token_expired_at FROM users WHERE email = 'maria@example.com';
   ```
   Що в тілі відповіді (*Raw*)? Що в БД? Чому `jsonError()` сама не може «зупинити» метод і які є інші способи (назви хоча б два)? Поверни `return` на місце.
6. **L2.** Тимчасово зроби так, щоб `requestBody()` повертала просто результат `json_decode(...)` без перевірки, і надішли логін **без тіла**. Що буде в тілі відповіді? А який **статус**? Поверни як було.
7. **L3.** Чому погано, коли на «немає такого email» і «невірний пароль» сервер відповідає **по-різному**?

<details>
<summary>Перевір себе: частина 4</summary>

| Запит | Статус | Тіло |
|---|---|---|
| `ivan@` / `password` | 200 | `{"data":{"token":"<64 символи>","user":{"id":2,...,"role_label":"Працівник",...}}}` |
| `maria@` / `wrongpass1` | 401 | `{"error":{"code":"unauthorized","message":"Invalid email or password","fields":{}}}` |
| `nobody@example.com` / `password` | 401 | те саме, слово в слово |
| `former@` / `password` | 401 | те саме |
| без тіла | 422 | `fields.email` і `fields.password`: `... field is required.` |
| `ivan@` / `"123"` | 422 | `fields.password`: `... at least 8 characters.` |
| `ivan@` / `12345678` (число, без лапок) | 422 | `fields.password`: `... must be a string.` |

- Після логіну Івана: `SELECT api_token, token_expired_at, UTC_TIMESTAMP() FROM users WHERE id = 2;` — `token_expired_at` на 2 години більший за `UTC_TIMESTAMP()`. Для UTC зручно `gmdate('Y-m-d H:i:s', time() + 2 * 60 * 60)`.
- **L1:** у тілі **дві** відповіді поспіль: `{"error": ... }`, далі попередження Xdebug `Cannot set response code - headers already sent` і `{"data":{"token":...}}`. У БД у Марії з'явився токен — **з невірним паролем отримали робочий токен**. `jsonError()` — звичайна функція: вона друкує JSON і повертає керування назад у метод. Інші способи: `exit` усередині `jsonError()` або виняток + `try/catch` в `index.php`.
- **L2:** `Fatal error: Uncaught TypeError: requestBody(): Return value must be of type array, null returned` — `json_decode('')` дає `null`. Статус **200**: помилку надрукував Xdebug, а нормальний 500 ніхто не відправив.
- **L3:** різні відповіді дозволяють перебором дізнатися, які email зареєстровані (user enumeration).

</details>

---

## Що здати

- Посилання на гілку або PR з кодом.
- `answers.md`: A1, R1, R2, V1, V2, L1–L3 (прогноз → факт → чому).
