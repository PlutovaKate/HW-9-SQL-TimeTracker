# TimeTracker: фронтенд

Статичний фронтенд для TimeTracker API: HTML, CSS, Bootstrap 5.3, jQuery 3.7 і axios 1.7 з CDN. Збірки й npm немає.

Поки бекенд не готовий, усі запити обробляє **мок-сервер у браузері**. Він відповідає за тим самим контрактом, що й API з лекцій: `{"data": ...}` / `{"error": {code, message, fields}}`, статус-коди 401/403/404/409/422, Bearer-токен. Коли API буде готовий, достатньо вимкнути мок, і фронт піде на `http://localhost:8080/api`.

## Запуск

- Через Docker, який уже є в репозиторії: `docker compose up -d` → <http://localhost/frontend/>.
- Без Docker: `php -S localhost:8000 -t frontend` → <http://localhost:8000/>.

Демо-акаунти (пароль у всіх `password`), їх видно на сторінці входу:

| Email | Роль | Що показує |
|---|---|---|
| `admin@example.com` | адмін | меню «Адміністрування» |
| `ivan@example.com` | працівник | основний сценарій |
| `maria@example.com` | працівник | друга людина для заявок |
| `taras@example.com` | працівник | норма 6 год, 18 днів відпустки |
| `former@example.com` | неактивний | вхід завершується 401 |

Мок-дані генеруються детерміновано (як `database/seed.php`): записи за 2 попередні місяці й поточний місяць до вчора, запізнення, обіди, переробки, відпустки, свята. Усе зберігається в `localStorage`. Відкрийте дві вкладки, наприклад адміна й Івана, і зміни будуть видні в обох.

## API-консоль

Кнопка **API** у правому нижньому куті відкриває журнал усіх запитів фронта: метод, URL, статус, час, тіло запиту й відповіді. Паролі й токени в журналі замасковані. Там же:
- перемикач **Mock-сервер ↔ справжній API** (після перемикання треба увійти знову);
- кнопка **«Скинути демо-дані»**.

## Перехід на справжній API

1. Вимкнути мок: перемикачем в API-консолі або в `assets/js/config.js` (`USE_MOCK: false`). Там же `API_BASE`.
2. API має віддавати CORS-заголовки, бо фронт і API на різних портах:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization
   Access-Control-Expose-Headers: Content-Disposition
   ```
   і відповідати `204` на `OPTIONS` (ДЗ 1, `Response::withCors()`). Без `Expose-Headers` файли експорту все одно завантажаться, але з іменем за замовчуванням.
3. Якщо API лежить недоступний, фронт покаже тост «API недоступний».

## Контракт: що очікує фронт

Назви полів узято з підпланів курсу. Для користувача використано назви колонок із `project.sql`:

```json
{ "id": 2, "full_name": "Іван Петренко", "email": "ivan@example.com", "role": "employee", "role_label": "Працівник",
  "work_start": "06:00:00", "daily_hours": 8, "vacation_days": 24, "is_active": true, "created_at": "2026-07-02T08:00:00Z" }
```

Усі дати й час в API у UTC (`2026-11-03T06:07:00Z`). Фронт сам показує їх у місцевому часі браузера. Дати без часу (`YYYY-MM-DD`) не конвертуються.

| Сторінка | Ендпоінти | Лекція |
|---|---|---|
| `login.html` | `POST /auth/login` | 2 |
| навбар | `GET /me`, `POST /auth/logout`, `GET /leaves?status=pending` (лічильник для адміна) | 2, 4 |
| `dashboard.html` | `GET /time/status`, `POST /time/check-in`, `/time/lunch/start`, `/time/lunch/end`, `/time/check-out`, `GET /me/leave-balance`, `GET /me/leaves` | 3, 4 |
| `entries.html` | `GET /me/entries?from=&to=` | ДЗ 3 |
| `leaves.html` | `POST /me/leaves`, `GET /me/leaves`, `DELETE /me/leaves/{id}`, `GET /me/leave-balance`, `GET /holidays` | 4, ДЗ 4 |
| `timesheet.html` | `GET /reports/timesheet?month=&user_id=&format=json\|csv\|md\|xlsx`, `GET /users` (адмін) | 5 |
| `profile.html` | `GET /me`, `PATCH /me/password` | ДЗ 2 |
| `admin-users.html` | `GET /users?page=&per_page=`, `POST /users`, `PATCH /users/{id}`, `DELETE /users/{id}` | 2, ДЗ 2 |
| `admin-leaves.html` | `GET /leaves?status=`, `PATCH /leaves/{id}/approve`, `PATCH /leaves/{id}/reject` | 4, ДЗ 4 |
| `admin-team.html` | `GET /reports/present`, `GET /reports/team?from=&to=&format=`, `GET /reports/entries?from=&to=&format=` (журнал) | ДЗ 5, лекція про експорт |
| `admin-entries.html` | `GET /time-entries?user_id=&from=&to=`, `PATCH /time-entries/{id}` | бонус ДЗ 3 |
| `admin-holidays.html` | `GET /holidays?year=`, `POST /holidays`, `DELETE /holidays/{id}` | ДЗ 1 |

**Чого немає в підпланах, але фронт це використовує:**
- `GET /time-entries?user_id=&from=&to=` (адмін): список записів будь-якого працівника для ручних правок. Відповідь така сама, як у `/me/entries`.
- `DELETE /holidays/{id}` (адмін).
- `PATCH /users/{id}` з `{"is_active": true}`, щоб повторно активувати користувача.
- Поле `working_days` у заявці. Воно необов'язкове: якщо його немає, фронт порахує дні сам.

## Структура

```
frontend/
  *.html                    сторінки (спільний head і порядок скриптів)
  assets/css/app.css        доповнення до Bootstrap, світла й темна тема
  assets/js/config.js       API_BASE, USE_MOCK, безпечний доступ до localStorage
  assets/js/format.js       UTC → місцевий час, хвилини → «8 год 05 хв», підписи й бейджі
  assets/js/auth.js         токен, поточний користувач, перевірка доступу (<body data-auth="guest|user|admin">)
  assets/js/api.js          axios: Bearer-токен, розбір помилок, 401 → вхід, журнал; TT.api.* по ендпоінтах
  assets/js/layout.js       навбар, тости, помилки форм (422 під полями), модалки підтвердження, API-консоль
  assets/js/pages/*.js      логіка кожної сторінки (TT.page.init)
  assets/js/mock/db.js      «база» в localStorage і сід
  assets/js/mock/server.js  axios adapter, роутер, Validator, Auth/Admin middleware
  assets/js/mock/routes/*.js обробники ендпоінтів (повторюють бізнес-правила лекцій 2–5)
```

Як додати сторінку: скопіюйте будь-яку `*.html`, змініть `data-auth`, `<main>` і останній `<script src="assets/js/pages/…">`, а в `pages/` створіть файл з `TT.page = { init() { … } }`. Для адмінських сторінок додайте пункт у `ADMIN_NAV` у `layout.js`.
