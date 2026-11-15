<?php

namespace App\Controllers;

/**
 * Контроллер учёта рабочего времени. / Work time tracking controller.
 * Все маршруты требуют авторизации; административные — роль ADMIN. / All routes require authentication; admin routes require ADMIN role.
 * Даты в API передаются в UTC. / API timestamps use UTC.
 */

use App\Enums\Role;
use App\Attributes\Auth;
use App\Enums\TimeEntryType;
use App\Models\TimeEntry;
use App\Models\User;
use App\Validators\AdminEntriesValidator;
use App\Validators\EntriesValidator;
use App\Enums\WorkingState;
use App\Repositories\TimeEntriesRepository;
use App\Validators\UpdateTimeEntryValidator;
use Core\HttpException;

class TimeController
{
    protected TimeEntriesRepository $repository;

    public function __construct()
    {
        $this->repository = new TimeEntriesRepository();
    }

    /**
     * Начать рабочую смену. / Start a work shift.
     * Создаёт открытую запись work; при активной смене или отпуске возвращает 409. / Creates an open work entry; returns 409 for an active shift or approved leave.
     */
    #[Auth]
    public function checkIn()
    {
        $timeEntry = $this->repository->checkIn(auth());

        response($timeEntry->toArray(), 201);
    }

    #[Auth]
    public function lunchStart()
    {
        $timeEntry = $this->repository->lunchStart(auth());

        response($timeEntry->toArray(), 201);
    }

    #[Auth]
    public function lunchEnd()
    {
        $timeEntry = $this->repository->lunchEnd(auth());

        response($timeEntry->toArray(), 200);
    }

    /**
     * Завершить рабочую смену. / Finish a work shift.
     * Закрывает рабочую запись и открытый обед в одной транзакции. / Closes work and any open lunch in one transaction.
     */
    #[Auth]
    public function checkOut()
    {
        $timeEntry = $this->repository->checkOut(auth());

        response($timeEntry->toArray(), 200);
    }

    /**
     * Получить текущее состояние и статистику за день. / Get current state and daily statistics.
     * Возвращает разрешённые действия, минуты и записи. / Returns allowed actions, minutes and entries.
     */
    #[Auth]
    public function status()
    {
        response($this->repository->getUserStatus(auth()));
    }

    /**
     * Получить свои записи за период включительно. / Get own entries for an inclusive date range.
     * Первый рабочий интервал дня может иметь признак опоздания. / The first work entry of a day may have a late flag.
     */
    #[Auth]
    public function myEntries()
    {
        [$from, $to] = $this->validatePeriod(EntriesValidator::class);

        response($this->repository->getEntries(auth(), $from, $to));
    }

    /**
     * Получить записи выбранного пользователя (только администратор). / Get a user's entries (admin only).
     * Проверяет параметры периода и существование пользователя. / Validates the date range and user existence.
     */
    #[Auth(Role::ADMIN)]
    public function index()
    {
        [$from, $to] = $this->validatePeriod(AdminEntriesValidator::class);

        $user = User::find((int) $_GET['user_id']);

        if (!$user) {
            throw new \Core\HttpException(
                404,
                'not_found',
                'User not found'
            );
        }

        response($this->repository->getEntries($user, $from, $to));
    }

    /**
     * Проверить параметры периода и вернуть [from, to]. / Validate date-range parameters and return [from, to].
     * @param class-string<\Core\Validator> $validator
     */
    private function validatePeriod(string $validator): array
    {
        if (!$validator::validate($_GET)) {
            throw new \Core\HttpException(
                422,
                'validation',
                'Validation failed',
                $validator::errors()
            );
        }

        if ($_GET['to'] < $_GET['from']) {
            throw new \Core\HttpException(
                422,
                'validation',
                'Validation failed',
                ['to' => 'Must be after or equal to from']
            );
        }

        return [$_GET['from'], $_GET['to']];
    }

    /**
     * Редактировать запись времени (только администратор). / Edit a time entry (admin only).
     * Проверяет даты, пересечения и нахождение обеда внутри смены. / Validates dates, overlaps and lunch containment.
     * Изменяет только разрешённые поля и фиксирует администратора. / Updates only allowed fields and records the admin.
     */

    #[Auth(Role::ADMIN)]
    public function update(int $id)
    {
        $entry = TimeEntry::find($id);

        if (!$entry) {
            throw new HttpException(
                404,
                'not_found',
                'Time entry not found'
            );
        }

        $data = requestBody();

        if (!UpdateTimeEntryValidator::validate($data)) {
            throw new HttpException(
                422,
                'validation',
                'Validation failed',
                UpdateTimeEntryValidator::errors()
            );
        }

        $startedAt = new \DateTimeImmutable(
            $data['started_at'],
            new \DateTimeZone('UTC')
        );

        $endedAt = isset($data['ended_at'])
            ? new \DateTimeImmutable(
                $data['ended_at'],
                new \DateTimeZone('UTC')
            )
            : null;

        $now = new \DateTimeImmutable(
            'now',
            new \DateTimeZone('UTC')
        );

        if ($startedAt > $now) {
            throw new HttpException(
                422,
                'validation',
                'Validation failed',
                ['started_at' => 'Time cannot be in the future']
            );
        }

        if ($endedAt !== null && $endedAt <= $startedAt) {
            throw new HttpException(
                422,
                'validation',
                'Validation failed',
                ['ended_at' => 'Must be after started_at']
            );
        }

        // Проверяем пересечения с другими записями того же пользователя и типа. / Check overlaps with other entries of the same user and type.
        $query = TimeEntry::query()
            ->where('user_id', $entry->user_id)
            ->where('type', $entry->type->value)
            ->where('id', '!=', $entry->id)
            ->where(function ($query) use ($startedAt) {
                $query->whereNull('ended_at')
                    ->orWhere(
                        'ended_at',
                        '>',
                        $startedAt->format('Y-m-d H:i:s')
                    );
            });

        if ($endedAt !== null) {
            $query->where(
                'started_at',
                '<',
                $endedAt->format('Y-m-d H:i:s')
            );
        }

        if ($query->exists()) {
            throw new HttpException(
                409,
                'conflict',
                'The interval overlaps another ' .
                    $entry->type->value . ' entry'
            );
        }

        // Обед должен полностью находиться внутри рабочего интервала. / Lunch must fit entirely inside a work interval.
        if ($entry->type === TimeEntryType::LUNCH) {
            $workQuery = TimeEntry::query()
                ->where('user_id', $entry->user_id)
                ->where('type', TimeEntryType::WORK->value)
                ->where(
                    'started_at',
                    '<=',
                    $startedAt->format('Y-m-d H:i:s')
                )
                ->where(function ($query) use ($endedAt) {
                    if ($endedAt === null) {
                        $query->whereNull('ended_at');
                    } else {
                        $query->whereNull('ended_at')
                            ->orWhere(
                                'ended_at',
                                '>=',
                                $endedAt->format('Y-m-d H:i:s')
                            );
                    }
                });

            if (!$workQuery->exists()) {
                throw new HttpException(
                    409,
                    'conflict',
                    'Lunch must be inside a work interval'
                );
            }
        }


        // При изменении рабочего интервала проверяем существующие обеды. / Ensure existing lunches remain within the edited work interval.
        if ($entry->type === TimeEntryType::WORK) {
            $lunches = TimeEntry::query()
                ->where('user_id', $entry->user_id)
                ->where('type', TimeEntryType::LUNCH->value)
                ->where(
                    'started_at',
                    '>=',
                    $entry->started_at->format('Y-m-d H:i:s')
                )
                ->when(
                    $entry->ended_at !== null,
                    function ($query) use ($entry) {
                        $query->where(
                            'started_at',
                            '<',
                            $entry->ended_at->format('Y-m-d H:i:s')
                        );
                    }
                )
                ->get();

            foreach ($lunches as $lunch) {
                $lunchStartsBeforeWork =
                    $lunch->started_at < $startedAt;

                $lunchEndsAfterWork =
                    $endedAt !== null
                    && (
                        $lunch->ended_at === null
                        || $lunch->ended_at > $endedAt
                    );

                if ($lunchStartsBeforeWork || $lunchEndsAfterWork) {
                    throw new HttpException(
                        409,
                        'conflict',
                        'Existing lunch must remain inside the work interval'
                    );
                }
            }
        }


        // Обновляем только разрешённые поля. / Update only permitted fields.
        $entry->update([
            'started_at' => $startedAt->format('Y-m-d H:i:s'),
            'ended_at' => $endedAt?->format('Y-m-d H:i:s'),
            'note' => $data['note'] ?? null,
            'created_by' => auth()->id,
        ]);

        response($entry->refresh()->toArray());
    }
}
