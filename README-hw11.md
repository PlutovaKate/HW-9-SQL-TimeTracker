# ДЗ — Моделі, атрибут `#[Auth]` і AuthController

Тема: **Eloquent-моделі, перевірка токена атрибутом, вихід, профіль і зміна пароля**. `illuminate/database`, `$fillable` / `$hidden` / `$appends` / `$casts`, зв'язки `hasMany` / `belongsTo`, PHP-атрибути й Reflection, Bearer-токен.

На лекції ми замінили «сирий» PDO на моделі Eloquent і навчили роутер перед викликом методу контролера виконувати його атрибути:
`Router::dispatch() → runAction() → #[Auth] → AuthController::me()`.
Тепер ти робиш це **сам** у своєму проєкті, поверх розв'язку ДЗ 10. Відповіді API мають бути такими самими, як у ДЗ 10: `{"data": ...}` / `{"error": {"code", "message", "fields"}}`.

Код з лекції можна брати як підказку, але не копіюй його бездумно. У ньому щонайменше **п'ять** проблем, і експерименти нижче допоможуть їх знайти.

## Як працюємо

Як і минулого разу, головне — експерименти (M1, A1, C1…):

1. **Спочатку** запиши в `answers.md` прогноз: що поверне сервер (статус і тіло)?
2. Надішли запит або запусти скрипт.
3. Запиши, що сталося насправді, і **чому**: який рядок коду до цього призвів.

Відповіді для самоперевірки сховані в блоках «Перевір себе». Відкривай їх **після** своїх запусків.

## Файли

| Файл | Що з ним робити |
|---|---|
| `answers.md` | Прогнози, результати, пояснення й відповіді на питання. Головний файл здачі |

Що з'явиться у твоєму проєкті:

| Файл | Частина |
|---|---|
| `composer.json` (змінюєш), `boot/eloquent.php`, `index.php` (змінюєш), `database/migrations/007_add_updated_at_to_users.sql` | 0 |
| `app/Models/User.php`, `TimeEntry.php`, `LeaveRequest.php`, `Holiday.php`, `AuthController::login()` (переписуєш) | 1 |
| `Core/HttpException.php`, `app/Attributes/Middleware.php`, `app/Attributes/Auth.php`, `Core/Router.php` (змінюєш), `helpers/functions.php` (дописуєш), `AuthController::me()` | 2 |
| `app/Validators/ChangePasswordValidator.php`, `AuthController::logout()` і `changePassword()` | 3 |

## Postman: токен один раз на всю колекцію

Більшість запитів тепер потребують заголовка `Authorization: Bearer <токен>`. Щоб не вставляти токен руками в кожен запит:

1. У колекції **TimeTracker** → *Variables* додай змінну `token` (значення порожнє) → *Save*.
2. Колекція → вкладка *Authorization* → *Auth Type* **Bearer Token** → *Token* `{{token}}` → *Save*. Усі запити з *Auth Type* **Inherit auth from parent** (за замовчуванням) тепер надсилають цей заголовок.
3. У запиті `Логін` (з ДЗ 10) → вкладка *Scripts* → *Post-response* встав:
   ```js
   if (pm.response.code === 200) {
       pm.collectionVariables.set('token', pm.response.json().data.token);
   }
   ```
   Після кожного успішного логіну токен сам потрапляє в `{{token}}`.
4. Щоб надіслати запит **без** токена: у вкладці *Authorization* цього запиту обери **No Auth**.
5. Щоб надіслати **свій** заголовок (експеримент A3): *Authorization* → **No Auth**, а у вкладці *Headers* додай рядок вручну.

Створи в колекції папки `Частина 1`, `Частина 2`, `Частина 3`.

---

## Частина 0. Підготовка (~15 хв)

📖 [Eloquent без Laravel (Capsule)](https://github.com/illuminate/database#usage-instructions)

1. Встанови Eloquent:
   ```bash
   composer require illuminate/database
   ```
2. `boot/eloquent.php` — як на лекції: `Capsule` з `addConnection([...])` (дані з `.env`), `setAsGlobal()`, `bootEloquent()`. Підключи його в `index.php` **після** `$dotenv->load()`.
3. Міграція `database/migrations/007_add_updated_at_to_users.sql`:
   ```sql
   ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER created_at;
   ```
   **Поки що не запускай її.** Вона знадобиться в експерименті M2.
4. **Пісочниця.** Для експериментів M2, M3 і C2 тимчасово заміняєш тіло `HealthController::check()` кодом з README і надсилаєш `GET {{baseUrl}}/health`. Після кожного експерименту повертай `check()` до `response(['status' => 'OK'])`. Потрібні `use` (`App\Models\...`, `Illuminate\Database\Capsule\Manager as Capsule`) допиши на початку файлу.

---

## Частина 1. Моделі (~50 хв)

📖 [Eloquent: моделі](https://laravel.com/docs/eloquent) · [Зв'язки](https://laravel.com/docs/eloquent-relationships) · [Серіалізація](https://laravel.com/docs/eloquent-serialization) · [Mass assignment](https://laravel.com/docs/eloquent#mass-assignment)

1. Створи чотири моделі в `app/Models/` для таблиць `users`, `time_entries`, `leave_requests`, `holidays` (схема — `database/migrations/001–007`):
   - `$fillable` — поля, які можна заповнювати масивом;
   - зв'язки, як на лекції: `User` → `timeEntries()`, `leaveRequests()`, `leaveRequestReviews()`; `TimeEntry` → `user()`, `creator()`; `LeaveRequest` → `user()`, `reviewer()`;
   - `$casts`: `User.role` → `Role::class`, `User.is_active` → `boolean`, дати й час → `datetime` / `date`.
2. **M1. Модель у JSON.** У `AuthController::login()` заміни пошук через PDO на `User::where('email', ...)->first()`, а `publicUser($user)` — на `$user->toArray()`. Збереження токена поки лиши на PDO (`$user->id` замість `$user['id']`). Надішли логін `ivan@example.com` / `password`. Що в `user`? Чого там не повинно бути?
3. Доведи `User` до контракту з ДЗ 10, щоб `$user->toArray()` повертав **рівно** такий JSON (порядок ключів не важливий):
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
   - `$hidden` — що **ніколи** не потрапляє в JSON;
   - `$appends` + аксесор `roleLabel()` — поле `role_label`, якого немає в таблиці;
   - формат `created_at` — перевизнач у моделі `serializeDate(DateTimeInterface $date): string`.

   Після цього `publicUser()` з `helpers/functions.php` можна видалити.
4. **M2. Хто такий `updated_at`?** Переведи збереження токена в `login()` на модель (`$user->update([...])`, як на лекції) і надішли логін. Що сталося? Тепер запусти міграцію 007 і повтори. Далі в пісочниці створи по одному запису кожної іншої моделі (у транзакції, тож у БД нічого не залишиться):
   ```php
   public function check(): void
   {
       Capsule::connection()->beginTransaction();
       $holiday = Holiday::create(['date' => '2099-01-01', 'title' => 'Тестове свято']);
       Capsule::connection()->rollBack();

       response($holiday->toArray());
   }
   ```
   Потім те саме з
   `LeaveRequest::create(['user_id' => 2, 'type' => 'day_off', 'date_from' => '2099-01-02', 'date_to' => '2099-01-02'])` і
   `TimeEntry::create(['user_id' => 2, 'type' => 'work', 'started_at' => '2099-01-03 06:00:00', 'created_by' => 2])`.
   Яку колонку Eloquent намагається записати і чому? Виправ **моделі**, а не таблиці: у кожної таблиці свій набір колонок часу.
5. **M3. N+1.** Скільки SQL-запитів треба, щоб дізнатися автора кожної заявки на відпустку?
   ```php
   public function check(): void
   {
       $db = Capsule::connection();
       $db->enableQueryLog();

       foreach (LeaveRequest::all() as $leave) {
           $leave->user->full_name;
       }
       $all = count($db->getQueryLog());

       $db->flushQueryLog();

       foreach (LeaveRequest::with('user')->get() as $leave) {
           $leave->user->full_name;
       }

       response([
           'all' => $all,
           'with' => count($db->getQueryLog()),
           'with_queries' => array_column($db->getQueryLog(), 'query'),
       ]);
   }
   ```
   Звідки ця різниця? Скільки запитів буде, коли заявок стане 1000?
6. **M4. `$fillable`.** На лекції в `$fillable` моделі `User` були `role`, `api_token`, `is_active`.
   - Уяви, що згодом реєстрація робить `User::create(requestBody())`. Що надішле хитрий користувач?
   - Прибери `api_token` і `token_expired_at` з `$fillable`, але залиш у `login()` лекційне `$user->update(['api_token' => ..., 'token_expired_at' => ...])`. Залогінься і подивись у БД, що в `api_token`. Чому так, і як тепер зберегти токен?

<details>
<summary>Перевір себе: частина 1</summary>

- **M1:** у `user` є `password` (bcrypt-хеш), `api_token`, `token_expired_at` (після міграції 007 ще й `updated_at`), а `role_label` немає. `created_at` має вигляд `"2026-07-02T08:00:00.000000Z"`. `toArray()` віддає **всі** колонки, якщо їх не сховати. На лекції `GET /me` повертав саме `auth()->toArray()`, тож хеш пароля й токен бачив кожен, хто його викликав.
- Підказка до п. 3:
  ```php
  protected $hidden = ['password', 'api_token', 'token_expired_at', 'updated_at'];
  protected $appends = ['role_label'];

  protected function roleLabel(): Attribute // Illuminate\Database\Eloquent\Casts\Attribute
  {
      return Attribute::get(fn () => $this->role->label());
  }

  protected function serializeDate(DateTimeInterface $date): string
  {
      return $date->format('Y-m-d\TH:i:s\Z');
  }
  ```
  `Z` у кінці чесний лише тому, що PHP і БД у нас працюють в UTC (див. `seed.php`).
- **M2:** без міграції 007 логін падає: `Unknown column 'users.updated_at' in 'field list'`, а статус **200** (як у L2 з ДЗ 10). Eloquent за замовчуванням сам заповнює `created_at` і `updated_at` при кожному `save()`/`create()`/`update()`. Саме тому на лекції з'явилася міграція 007. У пісочниці з лекційними моделями всі три `create` падають з `QueryException: ... Unknown column 'updated_at' in 'field list'` (у SQL видно, що Eloquent дописав і `updated_at`, і `created_at`), бо ні в одній з трьох таблиць цієї колонки немає. Виправлення:
  - `Holiday`, `TimeEntry`: `public $timestamps = false;` — колонок часу немає взагалі;
  - `LeaveRequest`: `const UPDATED_AT = null;` — `created_at` є, `updated_at` немає.
- **M3:** `all()` → **1 + N** запитів (у сіді 7 заявок → 8 запитів): кожне `$leave->user` — окремий `SELECT ... FROM users WHERE id = ?`. `with('user')` → **2** запити: `select * from leave_requests` і `select * from users where id in (2, 3, ...)`. На 1000 заявок це 1001 запит проти 2.
- **M4:** у тілі можна передати `"role": "admin", "is_active": true` — і стати адміном (mass assignment). У `$fillable` — лише те, що користувач **може** заповнювати сам. Поле поза `$fillable` `update([...])` **мовчки викидає**: логін віддає токен, у БД його немає, і `/me` з ним повертає 401. Службові поля присвоюй напряму:
  ```php
  $user->api_token = bin2hex(random_bytes(32));
  $user->token_expired_at = gmdate('Y-m-d H:i:s', time() + 2 * 60 * 60);
  $user->save();
  ```

</details>

---

## Частина 2. Атрибут `#[Auth]` (~60 хв)

📖 [Атрибути](https://www.php.net/manual/en/language.attributes.php) · [ReflectionMethod::getAttributes](https://www.php.net/manual/en/reflectionfunctionabstract.getattributes.php) · [ReflectionAttribute::newInstance](https://www.php.net/manual/en/reflectionattribute.newinstance.php) · [Bearer](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization)

Захищений маршрут має відповідати так:

| Запит | Відповідь |
|---|---|
| правильний, не протермінований токен активного користувача | те, що поверне контролер |
| немає заголовка, невірний токен, протермінований, `is_active = 0` | `401 {"error": {"code": "unauthorized", "message": "Unauthenticated", "fields": {}}}` |

1. **`apiToken(): ?string`** у `helpers/functions.php` — токен із заголовка `Authorization: Bearer <token>` або `null`.
2. **`auth(): ?User`** — поточний користувач за токеном або `null`.
3. **`AuthController::me()`**, маршрут `GET /api/me` → `200 {"data": <user>}`. Поки без атрибута.
4. **`App\Attributes\Auth`** — атрибут для методу (`#[Attribute(Attribute::TARGET_METHOD)]`) з `__invoke()`: якщо `auth()` повернула `null` → 401. Познач ним `me()`.
5. **`Core\Router::runAction()`** — як на лекції: через Reflection дістає атрибути методу контролера, виконує їх, потім викликає сам метод.

**A1. Атрибут, який не зупиняє запит.** Твоя `jsonError()` з ДЗ 10 не робить `die()`. Напиши `Auth::__invoke()` просто з `jsonError(401, ...)`. Надішли `GET {{baseUrl}}/me` **без токена** і `POST {{baseUrl}}/auth/logout` без токена (маршрут додай уже зараз, метод `logout()` — як на лекції). Що в тілі (*Raw*)? Чому `return` в атрибуті тут не допоможе, на відміну від L1 у ДЗ 10?

Виправ так, щоб атрибут **зупиняв** запит. На лекції для цього в `jsonError()` додали `die()`. Ми зробимо через виняток:
- `Core\HttpException extends Exception` з `status`, `errorCode` і `fields` (`$code` у `Exception` уже зайнятий: це `int`);
- атрибут робить `throw new HttpException(401, 'unauthorized', 'Unauthenticated')`;
- `index.php` обгортає `Router::dispatch(...)` у `try/catch (HttpException $e)` і викликає `jsonError(...)`.

**A2. Чужий атрибут.** Тимчасово додай над `me()` ще й вбудований атрибут PHP `#[\Deprecated]`. Що відповість `GET /me` з лекційним `runAction()` (`new $attrClass; $attribute();` для **кожного** атрибута)?

Виправ `runAction()`:
- створи інтерфейс `App\Attributes\Middleware` з `public function __invoke(): void;` і реалізуй його в `Auth`;
- бери лише такі атрибути: `getAttributes(Middleware::class, ReflectionAttribute::IS_INSTANCEOF)`;
- створюй їх через `$attribute->newInstance()`, а не `new $attrClass`.

Після перевірки прибери `#[\Deprecated]`.

**A3. Регістр заголовка.** На лекції `apiToken()` читала `apache_request_headers()['Authorization']`. Напиши так само, залогінься й надішли `GET /me`, заголовок вписавши вручну **малими літерами** (*Authorization* → No Auth, *Headers*: `authorization` = `Bearer <токен>`). Що відповість сервер? Що каже про регістр назв заголовків [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)?

Виправ: у ДЗ 10 `.htaccess` уже кладе заголовок у `$_SERVER['HTTP_AUTHORIZATION']` («знадобиться на наступних лекціях» — от і знадобилось). Регулярний вираз зроби строгим: `/^Bearer\s+(\S+)$/i`. Що з лекційним `/Bearer\s(\S+)/` дасть заголовок `NotBearer <токен>`?

**A4. Деактивований користувач.** На лекції `auth()` шукала лише за `api_token`, а строк дії перевіряв атрибут. Залогінься як `maria@example.com`, потім у БД:
```sql
UPDATE users SET is_active = 0 WHERE email = 'maria@example.com';
```
Що поверне `GET /me` з її токеном? Поверни `is_active = 1`.

Перенеси **всі** перевірки в `auth()`: токен збігається, `token_expired_at > зараз (UTC)`, `is_active = 1`. Тоді атрибуту лишається `auth() === null → 401`, а будь-який код, що викликає `auth()`, не отримає «мертвого» користувача. І ще: атрибут викликає `auth()`, потім контролер викликає `auth()` знову — це два однакові `SELECT`. Зроби так, щоб за один запит користувача шукали лише раз (підказка: `static` змінна у функції).

Перевір строк дії:
```sql
UPDATE users SET token_expired_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE email = 'maria@example.com';
```

<details>
<summary>Перевір себе: частина 2</summary>

| Запит | Статус | Тіло |
|---|---|---|
| `GET /me` без токена | 401 | `{"error":{"code":"unauthorized","message":"Unauthenticated","fields":{}}}` |
| `GET /me`, `Bearer abc` | 401 | те саме |
| `GET /me` з токеном Івана | 200 | `{"data":{"id":2,...,"role_label":"Працівник"}}` — **без** `password`, `api_token` |
| `GET /me`, заголовок `authorization` малими | 200 | те саме |
| `GET /me`, `NotBearer <токен>` | 401 | `unauthorized` |
| `GET /me`, Марія з `is_active = 0` | 401 | `unauthorized` |
| `GET /me`, `token_expired_at` хвилину тому | 401 | `unauthorized` |
| `GET /me`, `token_expired_at` через хвилину | 200 | дані Марії |

- **A1:** у тілі **дві** речі: `{"error":{"code":...}}` і HTML Xdebug `Fatal error: Uncaught Error: Call to a member function toArray() on null` (для logout — `Attempt to assign property "api_token" on null`). Статус 401, бо його вже встановила `jsonError()`. Атрибут — окремий об'єкт: `return` з `__invoke()` повертає керування в `runAction()`, і роутер іде далі до контролера. Зупинити запит можна, лише якщо `runAction()` про це дізнається: виняток (або `die()`, як на лекції, але тоді не спрацюють ні `finally`, ні логування, ні тести).
- Підказка до `index.php`:
  ```php
  try {
      \Core\Router::dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
  } catch (\Core\HttpException $e) {
      jsonError($e->status, $e->errorCode, $e->getMessage(), $e->fields);
  }
  ```
- **A2:** `Fatal error: Uncaught Error: Object of type Deprecated is not callable`, статус 200. Лекційний `runAction()` вважає **будь-який** атрибут своїм і викликає його як функцію. З фільтром `Middleware::class` + `IS_INSTANCEOF` `#[\Deprecated]` пропускається. Залишається тільки сповіщення PHP `Deprecated: Method ...::me() is deprecated` — саме для цього цей атрибут і існує. `newInstance()` ще й передає аргументи з `#[Auth(...)]` у конструктор (див. бонус) і перевіряє `TARGET_METHOD`, а `new $attrClass` про аргументи нічого не знає.
- **A3:** `apache_request_headers()` повертає назви так, як їх надіслав клієнт. Ключа `Authorization` немає, є `authorization` → 401, хоча токен правильний. За RFC назви полів заголовків **нечутливі до регістру** (а HTTP/2 узагалі передає їх лише малими). `$_SERVER['HTTP_AUTHORIZATION']` Apache нормалізує сам. `/Bearer\s(\S+)/` без `^` знаходить `Bearer` усередині `NotBearer` і пропускає такий заголовок.
- **A4:** з лекційним `auth()` деактивована Марія отримує **200** зі своїми даними: звільнений працівник працює далі, доки не скінчиться токен. Протермінований токен лекційний код ловив правильно (401), але лише в атрибуті.
- Підказка до `auth()`:
  ```php
  function auth(): ?User
  {
      static $user = false; // false — ще не шукали, null — шукали й не знайшли

      if ($user === false) {
          $token = apiToken();

          $user = $token === null ? null : User::where('api_token', $token)
              ->where('token_expired_at', '>', gmdate('Y-m-d H:i:s'))
              ->where('is_active', true)
              ->first();
      }

      return $user;
  }
  ```

</details>

---

## Частина 3. AuthController (~40 хв)

📖 [password_hash](https://www.php.net/manual/en/function.password-hash.php) · [204 No Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204)

| Маршрут | Метод контролера | Відповідь |
|---|---|---|
| `POST /api/auth/login` | `login()` | `200 {"data": {"token": "...", "user": {...}}}` — як у ДЗ 10, тепер через модель |
| `POST /api/auth/logout` | `logout()` `#[Auth]` | `204`, тіло порожнє |
| `GET /api/me` | `me()` `#[Auth]` | `200 {"data": <user>}` |
| `PATCH /api/me/password` | `changePassword()` `#[Auth]` | `204`, тіло порожнє |

1. Хелпер **`noContent(): void`** — статус 204, без тіла і без `Content-Type`.
2. **`logout()`** — обнуляє `api_token` і `token_expired_at` поточного користувача.
3. **`changePassword()`**. Тіло:
   ```json
   {"current_password": "password", "new_password": "newsecret123"}
   ```
   | Поле | Правила |
   |---|---|
   | `current_password` | `required`, `string`, `max:255` |
   | `new_password` | `required`, `string`, `min:8`, `max:72` |

   - правила — у `App\Validators\ChangePasswordValidator` → `422 validation`;
   - `current_password` не збігається → `422`, `fields.current_password`: `Current password is incorrect`;
   - новий пароль такий самий, як поточний → `422`, `fields.new_password`: `New password must differ from the current one`;
   - інакше записуємо `password_hash($new, PASSWORD_DEFAULT)` → `204`. Поточний токен лишається робочим.

**C1. Один токен на користувача.** Залогінься як Іван, збережи токен (скопіюй з `{{token}}`) і залогінься ще раз. Чи працює **перший** токен у `GET /me`? Чому? Тепер `POST /auth/logout` з другим токеном і повтори з ним `GET /me`. Що треба змінити в БД, щоб Іван міг бути залогінений одночасно з ноутбука й телефона?

**C2. Чому `max:72`.**
У пісочниці:
```php
public function check(): void
{
    $hash = password_hash(str_repeat('a', 72) . 'X', PASSWORD_DEFAULT);

    response([
        'aY' => password_verify(str_repeat('a', 72) . 'Y', $hash),
        'a72' => password_verify(str_repeat('a', 72), $hash),
    ]);
}
```
Пароль — 72 літери `a` і `X`. Що повертає `password_verify` для `...aY` і для 72 літер `a` без нічого? Наше правило `max:72` рахує **символи** (`mb_strlen`), а bcrypt — **байти**. Скільки байтів у кириличному паролі з 40 літер і чи пропустить його `max:72`?

<details>
<summary>Перевір себе: частина 3</summary>

Перед перевіркою перезапусти сідер (`php database/seed.php`), щоб усі паролі знову були `password`. Запити — з токеном Івана.

| Запит | Статус | Тіло |
|---|---|---|
| `PATCH /me/password` без тіла | 422 | `fields.current_password` і `fields.new_password`: `... field is required.` |
| `{"current_password":"wrongpass","new_password":"newsecret123"}` | 422 | `fields.current_password`: `Current password is incorrect` |
| `{"current_password":"password","new_password":"password"}` | 422 | `fields.new_password`: `New password must differ from the current one` |
| `{"current_password":"password","new_password":"short"}` | 422 | `fields.new_password`: `... at least 8 characters.` |
| `new_password` з 73 символів | 422 | `fields.new_password`: `... may not be greater than 72 characters.` |
| `{"current_password":"password","new_password":"newsecret123"}` | 204 | порожньо |
| логін `ivan@` / `password` після зміни | 401 | `Invalid email or password` |
| логін `ivan@` / `newsecret123` | 200 | `{token, user}` |
| `PATCH /me/password` без токена | 401 | `unauthorized` |
| `POST /auth/logout` | 204 | порожньо; у БД `api_token` і `token_expired_at` — `NULL` |
| `GET /me` з токеном після logout | 401 | `unauthorized` |

- **C1:** перший токен → **401**: другий логін перезаписав `users.api_token`. Одна колонка — одна сесія. Для кількох пристроїв потрібна окрема таблиця `api_tokens (id, user_id, token, expired_at, device...)` і зв'язок `User` → `hasMany(ApiToken::class)`; logout видаляє лише свій рядок.
- **C2:** обидва `true`. bcrypt бере лише перші **72 байти**, тож усе після них ігнорується: `aaa…aX`, `aaa…aY` і `aaa…a` — для нього той самий пароль. Кириличні літери в UTF-8 займають по 2 байти: 40 літер = 80 байтів, `mb_strlen` = 40 → `max:72` пропускає, і останні 4 літери bcrypt відкидає. Точніше перевіряти довжину в байтах — `strlen()`.

</details>

---

## Бонус. `#[Auth(Role::ADMIN)]` (~15 хв)

Додай атрибуту необов'язковий аргумент — роль:
```php
#[Auth]               // будь-який залогінений користувач
#[Auth(Role::ADMIN)]  // лише адмін, інакше 403 {"error": {"code": "forbidden", "message": "Forbidden", "fields": {}}}
```
Перевір, тимчасово поставивши `#[Auth(Role::ADMIN)]` на `me()`: Іван → 403, `admin@example.com` → 200, без токена → 401. Чому з лекційним `new $attrClass` це не запрацювало б?

<details>
<summary>Перевір себе: бонус</summary>

```php
public function __construct(public ?Role $role = null)
{
}

public function __invoke(): void
{
    if (auth() === null) {
        throw new HttpException(401, 'unauthorized', 'Unauthenticated');
    }

    if ($this->role !== null && auth()->role !== $this->role) {
        throw new HttpException(403, 'forbidden', 'Forbidden');
    }
}
```
`new $attrClass` створює об'єкт без аргументів, тож `$role` завжди був би `null` і адмінський маршрут пускав би всіх. `newInstance()` передає в конструктор те, що написано в дужках атрибута.

</details>

---

## Що здати

- Посилання на гілку або PR з кодом (`check()` повернутий до `{"status": "OK"}`).
- `answers.md`: M1–M4, A1–A4, C1, C2 (прогноз → факт → чому); бонус — за бажанням.
