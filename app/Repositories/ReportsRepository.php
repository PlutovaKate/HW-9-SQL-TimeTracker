<?php

namespace App\Repositories;

use App\Enums\DayStatus;
use App\Enums\LeaveStatus;
use App\Enums\LeaveType;
use App\Enums\Role;
use App\Enums\TimeEntryType;
use App\Models\LeaveRequest;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\WorkCalendar;
use Cassandra\Time;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Support\LazyCollection;

/*
 * Звіти. З БД беремо лише агрегати записів і заявки, а календар накладаємо в PHP.
 * Кількість запитів не залежить від кількості працівників і днів (без N+1).
 */

class ReportsRepository
{
    private const string ISO = 'Y-m-d\TH:i:s\Z';

    /* $month — 'YYYY-MM' */
    public function timesheet(User $user, string $month): array
    {
        $from = "$month-01";
        $to = date('Y-m-t', strtotime($from));

        $days = $this->buildDays(
            $user,
            $from,
            $to,
            $this->dailyTotals([$user->id], $from, $to)[$user->id] ?? [],
            $this->approvedLeaveDays([$user->id], $from, $to)[$user->id] ?? []
        );

        return [
            'user' => ['id' => $user->id, 'full_name' => $user->full_name],
            'month' => $month,
            'days' => $days,
            'totals' => $this->totals($days),
        ];
    }

    public function team(string $from, string $to): array
    {
        $users = User::where('is_active', true)
            ->where('role', Role::EMPLOYEE)
            ->orderBy('full_name')
            ->get();

        $ids = $users->pluck('id')->all();
        $dailyTotals = $this->dailyTotals($ids, $from, $to);
        $leaveDays = $this->approvedLeaveDays($ids, $from, $to);
        $rows = [];

        foreach ($users as $user) {
            $totals = $this->totals($this->buildDays(
                $user,
                $from,
                $to,
                $dailyTotals[$user->id] ?? [],
                $leaveDays[$user->id] ?? []
            ));

            $rows[] = [
                'user_id' => $user->id,
                'full_name' => $user->full_name,
                'worked_minutes' => $totals['worked_minutes'],
                'norm_minutes' => $totals['norm_minutes'],
                'diff_minutes' => $totals['diff_minutes'],
                'late_count' => $totals['late_count'],
                'vacation_days' => $totals['vacation_days'],
                'sick_days' => $totals['sick_days'],
                'day_off_days' => $totals['day_off_days'],
            ];
        }

        return $rows;
    }

    public function present(): array
    {
        $open = TimeEntry::with('user')
            ->where('type', TimeEntryType::WORK)
            ->whereNull('ended_at')
            ->whereHas('user', fn($query) => $query->where('is_active', true))
            ->orderBy('started_at')
            ->get()
            ->unique('user_id');

        $entries = TimeEntry::whereIn('user_id', $open->pluck('user_id'))
            ->where(fn($query) => $query
                ->where('started_at', '>=', gmdate('Y-m-d 00:00:00'))
                ->orWhereNull('ended_at'))
            ->get()
            ->groupBy('user_id');

        $time = new TimeEntriesRepository();
        $now = time();
        $rows = [];

        foreach ($open as $work) {
            $userEntries = $entries[$work->user_id];

            $rows[] = [
                'user_id' => $work->user_id,
                'full_name' => $work->user->full_name,
                'since' => $work->started_at->format(self::ISO),
                'on_lunch' => $userEntries
                    ->where('type', TimeEntryType::LUNCH)
                    ->whereNull('ended_at')
                    ->isNotEmpty(),
                'minutes_today' => $time->workedMinutes($userEntries, $now),
            ];
        }

        return $rows;
    }


    public function journal(string $from, string $to, ?int $userId): LazyCollection
    {
        return Capsule::table('time_entries as te')
            ->join('users as u', 'u.id', '=', 'te.user_id')
            ->select([
                'te.id',
                'te.user_id',
                'u.full_name',
                'te.type',
                'te.started_at',
                'te.ended_at',
                'te.note',
                'te.created_by',
            ])
            ->where('te.started_at', '>=', "$from 00:00:00")
            ->where(
                'te.started_at',
                '<',
                date('Y-m-d', strtotime("$to +1 day")) . ' 00:00:00'
            )
            ->when(
                $userId !== null,
                fn($query) => $query->where('te.user_id', $userId)
            )
            ->lazyById(2000, 'te.id', 'id')
            ->map(function ($entry) {
                return [
                    'id' => (int) $entry->id,
                    'user_id' => (int) $entry->user_id,
                    'full_name' => $entry->full_name,
                    'type' => $entry->type,
                    'started_at' => date(self::ISO, strtotime($entry->started_at)),
                    'ended_at' => $entry->ended_at === null
                        ? null
                        : date(self::ISO, strtotime($entry->ended_at)),
                    'minutes' => $entry->ended_at === null
                        ? null
                        : (int) floor(
                            (strtotime($entry->ended_at) - strtotime($entry->started_at)) / 60
                        ),
                    'note' => $entry->note,
                    'is_manual' => (int) $entry->created_by !== (int) $entry->user_id,
                ];
            });
    }


    /*
     * Агрегати закритих записів по днях (UTC) для кількох користувачів за один запит.
     * @return array<int, array<string, array>> [user_id][Y-m-d] => first_in, last_out, work_minutes, lunch_minutes
     */
    private function dailyTotals(array $userIds, string $from, string $to): array
    {
        $rows = Capsule::table('time_entries')
            ->selectRaw("
                user_id,
                DATE(started_at) AS day,
                MIN(CASE WHEN type = 'work' THEN started_at END) AS first_in,
                MAX(CASE WHEN type = 'work' THEN ended_at END) AS last_out,
                SUM(CASE WHEN type = 'work' THEN TIMESTAMPDIFF(MINUTE, started_at, ended_at) ELSE 0 END) AS work_minutes,
                SUM(CASE WHEN type = 'lunch' THEN TIMESTAMPDIFF(MINUTE, started_at, ended_at) ELSE 0 END) AS lunch_minutes
            ")
            ->whereIn('user_id', $userIds)
            ->whereNotNull('ended_at')
            ->where('started_at', '>=', "$from 00:00:00")
            ->where('started_at', '<', date('Y-m-d', strtotime("$to +1 day")) . ' 00:00:00')
            ->groupByRaw('user_id, DATE(started_at)')
            ->get();

        $result = [];

        foreach ($rows as $row) {
            $result[$row->user_id][$row->day] = [
                'first_in' => $row->first_in,
                'last_out' => $row->last_out,
                // SUM() у MySQL повертає DECIMAL, PDO віддає його рядком
                'work_minutes' => (int) $row->work_minutes,
                'lunch_minutes' => (int) $row->lunch_minutes,
            ];
        }

        return $result;
    }

    /* @return array<int, array<string, LeaveType>> [user_id][Y-m-d] => тип затвердженої відсутності */
    private function approvedLeaveDays(array $userIds, string $from, string $to): array
    {
        $leaves = LeaveRequest::whereIn('user_id', $userIds)
            ->where('status', LeaveStatus::APPROVED)
            ->where('date_from', '<=', $to)
            ->where('date_to', '>=', $from)
            ->get();

        $result = [];

        foreach ($leaves as $leave) {
            // обрізаємо заявку до меж періоду
            $start = max($leave->date_from->format('Y-m-d'), $from);
            $end = min($leave->date_to->format('Y-m-d'), $to);

            foreach (WorkCalendar::days($start, $end) as $day) {
                $result[$leave->user_id][$day->format('Y-m-d')] = $leave->type;
            }
        }

        return $result;
    }

    private function buildDays(User $user, string $from, string $to, array $totals, array $leaveDays): array
    {
        $holidays = WorkCalendar::holidays();
        $dailyNorm = $user->daily_hours * 60;
        $days = [];

        foreach (WorkCalendar::days($from, $to) as $day) {
            $date = $day->format('Y-m-d');
            $total = $totals[$date] ?? null;

            // порядок — це пріоритет: відпустка, що накриває суботу, не робить суботу днем відпустки
            $status = match (true) {
                WorkCalendar::isWeekend($day) => DayStatus::WEEKEND,
                isset($holidays[$date]) => DayStatus::HOLIDAY,
                isset($leaveDays[$date]) => DayStatus::fromLeave($leaveDays[$date]),
                default => DayStatus::WORKING,
            };

            $work = $total['work_minutes'] ?? 0;
            $lunch = $total['lunch_minutes'] ?? 0;
            $worked = max(0, $work - $lunch);
            $norm = $status === DayStatus::WORKING ? $dailyNorm : 0;
            $firstIn = $total['first_in'] ?? null;

            $days[] = [
                'date' => $date,
                'day_status' => $status->value,
                'first_in' => $this->toIso($firstIn),
                'last_out' => $this->toIso($total['last_out'] ?? null),
                'work_minutes' => $work,
                'lunch_minutes' => $lunch,
                'worked_minutes' => $worked,
                'norm_minutes' => $norm,
                'diff_minutes' => $worked - $norm,
                'is_late' => $status === DayStatus::WORKING && $firstIn !== null && $user->isLate($firstIn),
            ];
        }

        return $days;
    }

    private function totals(array $days): array
    {
        $count = array_count_values(array_column($days, 'day_status'));
        $worked = array_sum(array_column($days, 'worked_minutes'));
        $norm = array_sum(array_column($days, 'norm_minutes'));

        return [
            'working_days' => $count[DayStatus::WORKING->value] ?? 0,
            'worked_minutes' => $worked,
            'norm_minutes' => $norm,
            'diff_minutes' => $worked - $norm,
            // норма може бути 0 (весь період у відпустці), а ділити на нуль не можна
            'norm_percent' => $norm > 0 ? round($worked / $norm * 100, 1) : null,
            'late_count' => count(array_filter(array_column($days, 'is_late'))),
            'vacation_days' => $count[DayStatus::VACATION->value] ?? 0,
            'sick_days' => $count[DayStatus::SICK->value] ?? 0,
            'day_off_days' => $count[DayStatus::DAY_OFF->value] ?? 0,
            'holiday_days' => $count[DayStatus::HOLIDAY->value] ?? 0,
        ];
    }

    private function toIso(?string $dbTime): ?string
    {
        return $dbTime === null ? null : date(self::ISO, strtotime($dbTime));
    }
}
