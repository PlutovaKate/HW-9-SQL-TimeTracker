<?php

namespace App\Repositories;

use App\Enums\TimeEntryType;
use App\Enums\WorkingState;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use App\Models\TimeEntry;
use Core\HttpException;
use Illuminate\Database\Capsule\Manager as Capsule;

class TimeEntriesRepository
{
    /**
     * Получить состояние пользователя и статистику за текущий день. / Get the user's state and today's statistics.
     */
    public function getUserStatus(User $user): array
    {
        $today = gmdate('Y-m-d');
        $tomorrow = gmdate('Y-m-d', strtotime($today . ' +1 day'));

        $timeEntries = $user->timeEntries()
            ->where('started_at', '>=', $today . ' 00:00:00')
            ->where('started_at', '<', $tomorrow . ' 00:00:00')
            ->orderBy('started_at')
            ->get();

        // Ищем открытые записи за все даты, включая ночные смены. / Include open entries from previous days for overnight shifts.
        $openEntries = $user->timeEntries()
            ->whereNull('ended_at')
            ->get();

        $state = $this->getState($openEntries);

        $hasLunchToday = $timeEntries->contains(
            fn($entry) => $entry->type === TimeEntryType::LUNCH
        );

        $workSeconds = 0;
        $lunchSeconds = 0;
        $now = time();

        foreach ($timeEntries as $entry) {
            $start = $entry->started_at->getTimestamp();
            $end = $entry->ended_at
                ? $entry->ended_at->getTimestamp()
                : $now;

            $seconds = max(0, $end - $start);

            if ($entry->type === TimeEntryType::WORK) {
                $workSeconds += $seconds;
            } elseif ($entry->type === TimeEntryType::LUNCH) {
                $lunchSeconds += $seconds;
            }
        }

        $workedMinutes = intdiv(
            max(0, $workSeconds - $lunchSeconds),
            60
        );

        $lunchMinutes = intdiv($lunchSeconds, 60);

        $allowedActions = match (true) {
            $state === WorkingState::OFF_DUTY
            => ['check_in'],

            $state === WorkingState::ON_LUNCH
            => ['lunch_end', 'check_out'],

            $state === WorkingState::WORKING && !$hasLunchToday
            => ['lunch_start', 'check_out'],

            default => ['check_out'],
        };

        return [
            'date' => $today,
            'state' => $state->value,
            'state_label' => $state->label(),
            'allowed_actions' => $allowedActions,
            'worked_minutes' => $workedMinutes,
            'lunch_minutes' => $lunchMinutes,
            'entries' => $timeEntries->toArray(),
            'server_time' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
    }

    // Допуск опоздания — 10 минут после work_start. / Late tolerance is 10 minutes after work_start.
    private const int LATE_TOLERANCE = 10;

    /**
     * Получить записи пользователя за период [from, to] включительно. / Get entries for the inclusive [from, to] range.
     * Признак is_late устанавливается для первого рабочего интервала дня. / Set is_late on the first work entry of each day.
     */
    public function getEntries(User $user, string $from, string $to): array
    {
        $entries = $user->timeEntries()
            ->where('started_at', '>=', "$from 00:00:00")
            ->where('started_at', '<=', "$to 23:59:59")
            ->orderBy('started_at')
            ->get();

        $seenDays = [];
        $result = [];

        foreach ($entries as $entry) {
            $item = $entry->toArray();

            if ($entry->type === TimeEntryType::WORK) {
                $day = $entry->started_at->format('Y-m-d');
                $item['is_late'] = !isset($seenDays[$day]) && $this->isLate($user, $entry->started_at);
                $seenDays[$day] = true;
            }

            $result[] = $item;
        }

        return $result;
    }

    /**
     * Проверить опоздание относительно начала рабочего дня. / Check lateness against the scheduled work start.
     */
    private function isLate(User $user, Carbon $startedAt): bool
    {
        // work_start хранится как TIME, например 06:00:00. / work_start is stored as TIME, e.g. 06:00:00.
        $deadline = Carbon::parse($startedAt->format('Y-m-d') . ' ' . $user->work_start)
            ->addMinutes(self::LATE_TOLERANCE);

        return $startedAt->greaterThan($deadline);
    }

    /**
     * Определить состояние по открытым записям. / Determine the state from open entries.
     */
    private function getState(Collection $collection): WorkingState
    {
        $hasWork = $collection->contains(
            fn($entry) => $entry->type === TimeEntryType::WORK
        );

        $hasLunch = $collection->contains(
            fn($entry) => $entry->type === TimeEntryType::LUNCH
        );

        return match (true) {
            $hasWork && $hasLunch => WorkingState::ON_LUNCH,
            $hasWork => WorkingState::WORKING,
            default => WorkingState::OFF_DUTY,
        };
    }

    /**
     * Начать смену, если нет открытых записей и утверждённого отпуска. / Start a shift if no entries are open and no approved leave applies.
     */
    public function checkIn(User $user): TimeEntry
    {
        $openEntries = $user->timeEntries()
            ->whereNull('ended_at')
            ->get();

        if ($openEntries->isNotEmpty()) {
            throw new HttpException(
                409,
                'conflict',
                'You are already checked in'
            );
        }

        $today = gmdate('Y-m-d');

        $approvedLeave = $user->leaveRequests()
            ->where('status', 'approved')
            ->whereDate('date_from', '<=', $today)
            ->whereDate('date_to', '>=', $today)
            ->first();

        if ($approvedLeave) {
            throw new HttpException(
                409,
                'conflict',
                sprintf(
                    'Check-in is not available: vacation (%s – %s)',
                    $approvedLeave->date_from->format('Y-m-d'),
                    $approvedLeave->date_to->format('Y-m-d')
                )
            );
        }

        return $user->timeEntries()
            ->create([
                'type' => TimeEntryType::WORK,
                'started_at' => gmdate('Y-m-d H:i:s'),
                'created_by' => $user->id,
            ])
            ->refresh();
    }

    /**
     * Начать обед при открытой смене и отсутствии другого обеда сегодня. / Start lunch during an open shift if no lunch was taken today.
     */
    public function lunchStart(User $user): TimeEntry
    {
        $openEntries = $user->timeEntries()
            ->whereNull('ended_at')
            ->get();

        $openWork = $openEntries->first(
            fn($entry) => $entry->type === TimeEntryType::WORK
        );

        $openLunch = $openEntries->first(
            fn($entry) => $entry->type === TimeEntryType::LUNCH
        );

        if (!$openWork) {
            throw new HttpException(
                409,
                'conflict',
                'You are not checked in'
            );
        }

        if ($openLunch) {
            throw new HttpException(
                409,
                'conflict',
                'You are already on lunch'
            );
        }

        $today = gmdate('Y-m-d');

        $lunchTakenToday = $user->timeEntries()
            ->where('type', TimeEntryType::LUNCH->value)
            ->where('started_at', '>=', $today . ' 00:00:00')
            ->where('started_at', '<', gmdate('Y-m-d 00:00:00', strtotime($today . ' +1 day')))
            ->exists();

        if ($lunchTakenToday) {
            throw new HttpException(
                409,
                'conflict',
                'Lunch has already been taken today'
            );
        }

        return $user->timeEntries()
            ->create([
                'type' => TimeEntryType::LUNCH,
                'started_at' => gmdate('Y-m-d H:i:s'),
                'created_by' => $user->id,
            ])
            ->refresh();
    }

    /**
     * Завершить открытый обед. / End the open lunch interval.
     */
    public function lunchEnd(User $user): TimeEntry
    {
        $lunch = $user->timeEntries()
            ->where('type', TimeEntryType::LUNCH->value)
            ->whereNull('ended_at')
            ->first();

        if (!$lunch) {
            throw new HttpException(
                409,
                'conflict',
                'You are not on lunch'
            );
        }

        $lunch->ended_at = gmdate('Y-m-d H:i:s');
        $lunch->save();

        return $lunch->refresh();
    }

    /**
     * Завершить смену и открытый обед в одной транзакции. / End the shift and any open lunch in one transaction.
     */
    public function checkOut(User $user): TimeEntry
    {
        return Capsule::connection()->transaction(function () use ($user) {
            $openEntries = $user->timeEntries()
                ->whereNull('ended_at')
                ->lockForUpdate()
                ->get();

            $work = $openEntries->first(
                fn($entry) => $entry->type === TimeEntryType::WORK
            );

            if (!$work) {
                throw new HttpException(
                    409,
                    'conflict',
                    'You are not checked in'
                );
            }

            $lunch = $openEntries->first(
                fn($entry) => $entry->type === TimeEntryType::LUNCH
            );

            $now = gmdate('Y-m-d H:i:s');

            if ($lunch) {
                $lunch->ended_at = $now;
                $lunch->save();
            }

            $work->ended_at = $now;
            $work->save();

            return $work->refresh();
        });
    }
}
