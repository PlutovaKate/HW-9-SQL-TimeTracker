<?php

namespace App\Controllers;

use App\Attributes\Admin;
use App\Attributes\Auth;
use App\Enums\ExportFormat;
use App\Enums\Role;
use App\Models\User;
use App\Repositories\ReportsRepository;
use App\Services\Export\CsvExport;
use App\Services\Export\MarkdownExporter;
use App\Validators\JournalValidator;
use App\Validators\TeamReportValidator;
use App\Validators\TimesheetValidator;
use Core\HttpException;

/*
 * Звіти та експорт. Усі ендпоінти потребують токен (Auth).
 * Рахуються тільки закриті записи (ended_at IS NOT NULL).
 * Статус дня (day_status), за пріоритетом: weekend → holiday → vacation|sick|day_off (затверджена заявка) → working.
 *
 * Експорт (?format=csv|md|json) — файл, а не {"data": ...}:
 *   Content-Type: text/csv; charset=utf-8 | text/markdown; charset=utf-8 | application/json; charset=utf-8
 *   Content-Disposition: attachment; filename="timesheet-2-2026-11.csv"
 *   csv: BOM + роздільник ";" (щоб Excel відкрив кирилицю), булеві як 1/0
 *   md:  таблиця | col | col |
 *   json: {"data": [рядки]}
 * Колонки файлу — ключі рядка (day для timesheet, row для team).
 */

class ReportController
{
    protected ReportsRepository $repository;

    public function __construct()
    {
        $this->repository = new ReportsRepository();
    }

    /*
     * GET /api/reports/timesheet?month=YYYY-MM&user_id=&format=json|csv|md
     * month   — необов'язковий, за замовчуванням поточний; 422 month — "Must be in format YYYY-MM".
     * user_id — необов'язковий, за замовчуванням поточний користувач; 422 user_id — "Must be an integer".
     * format  — необов'язковий, json за замовчуванням; 422 format — "Must be one of: json,csv,md".
     * 403 forbidden: "You can only view your own timesheet" — не адмін просить чужий user_id.
     * 404 not_found: "User not found".
     * 200 {"data": {
     *   "user": {"id": 2, "full_name": "Іван Петренко"},
     *   "month": "2026-11",
     *   "days": [day, ...],     — кожен день місяця
     *   "totals": {
     *     "working_days": 21, "worked_minutes": 10080, "norm_minutes": 10080, "diff_minutes": 0,
     *     "norm_percent": 100.0 | null (якщо норма 0), "late_count": 2,
     *     "vacation_days": 0, "sick_days": 0, "day_off_days": 0, "holiday_days": 0
     *   }
     * }}
     * day: {"date": "2026-11-03", "day_status": "working|weekend|holiday|vacation|sick|day_off",
     *       "first_in": "2026-11-03T06:07:00Z" | null, "last_out": "..." | null,
     *       "work_minutes": 540, "lunch_minutes": 60, "worked_minutes": 480,
     *       "norm_minutes": 480 (daily_hours*60 для working, інакше 0), "diff_minutes": 0, "is_late": false}
     * format=csv|md|json → файл з рядками days, filename="timesheet-{user_id}-{month}.{ext}".
     */
    #[Auth]
    public function timesheet()
    {
        TimesheetValidator::validateOrFail($_GET);

        $user = $this->resolveUser();
        $report = $this->repository->timesheet($user, $_GET['month'] ?? gmdate('Y-m'));
        //        $this->rejectExport();

        if (isset($_GET['format'])) {
            download(
                ExportFormat::from($_GET['format'])->exporter(),
                $report['days'],
                "timesheet-$user->id-$report[month]"
            );
            return;
        }

        response($report);
    }

    /*
     * GET /api/reports/team?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|md   (Admin)
     * from, to — required, date.
     * 422 validation: to — "Must be after or equal to from" | "The period must not exceed 366 days".
     * Лише активні працівники (role = employee), за full_name.
     * 200 {"data": [{"user_id": 2, "full_name": "Іван Петренко", "worked_minutes": 10080, "norm_minutes": 10080,
     *                "diff_minutes": 0, "late_count": 2, "vacation_days": 0, "sick_days": 0, "day_off_days": 0}, ...]}
     * format=csv|md|json → файл, filename="team-{from}-{to}.{ext}".
     */

    #[Admin]
    public function team()
    {
        TeamReportValidator::validateOrFail($_GET);

        $from = $_GET['from'];
        $to = $_GET['to'];

        if ($to < $from) {
            throw HttpException::validation([
                'to' => 'Must be after or equal to from'
            ]);
        }

        if ((strtotime($to) - strtotime($from)) / 86400 > 366) {
            throw HttpException::validation([
                'to' => 'The period must not exceed 366 days'
            ]);
        }

        $rows = $this->repository->team($from, $to);

        if (isset($_GET['format'])) {
            download(
                ExportFormat::from($_GET['format'])->exporter(),
                $rows,
                "team-$from-$to"
            );
            return;
        }

        response($rows);
    }


    /*
     * GET /api/reports/present   (Admin)
     * Хто зараз на роботі: активні користувачі з відкритим work-записом, за since.
     * 200 {"data": [{"user_id": 2, "full_name": "Іван Петренко", "since": "2026-11-03T06:07:00Z",
     *                "on_lunch": false, "minutes_today": 245}, ...]}
     * minutes_today — work мінус lunch за сьогодні, відкриті записи до «зараз».
     */
    #[Admin]
    public function present()
    {
        response($this->repository->present());
    }

    /*
     * GET /api/reports/entries?from=&to=&user_id=&format=csv|md|json   (Admin)
     * Журнал записів часу: завжди файл, рядків може бути сотні тисяч.
     */

    #[Admin]
    public function journal()
    {
        JournalValidator::validateOrFail($_GET);

        $from = $_GET['from'];
        $to = $_GET['to'];

        if ($to < $from) {
            throw HttpException::validation([
                'to' => 'Must be after or equal to from'
            ]);
        }

        $userId = isset($_GET['user_id'])
            ? (int) $_GET['user_id']
            : null;

        $rows = $this->repository->journal($from, $to, $userId);

        download(
            ExportFormat::from($_GET['format'])->exporter(),
            $rows,
            "entries-$from-$to"
        );
    }


    // працівник бачить лише себе, адмін — будь-кого: спершу 403, щоб не розкривати, які id існують
    private function resolveUser(): User
    {
        $current = auth();

        if (!isset($_GET['user_id']) || (int) $_GET['user_id'] === $current->id) {
            return $current;
        }

        if ($current->role !== Role::ADMIN) {
            throw HttpException::forbidden('You can only view your own timesheet');
        }

        return User::find((int) $_GET['user_id']) ?? throw HttpException::notFound('User not found');
    }

    // файли (?format=) реалізуємо на лекції про експорт: поки чесно відповідаємо, що їх ще немає
    private function rejectExport(): void
    {
        if (isset($_GET['format'])) {
            throw new HttpException(501, 'not_implemented', 'Export is not implemented yet');
        }
    }
}
