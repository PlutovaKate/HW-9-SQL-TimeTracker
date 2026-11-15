<?php

namespace App\Enums;

/**
 * Типы записей учёта рабочего времени.
 * / Types of work time tracking entries.
 */
enum TimeEntryType: string
{
    // Рабочее время. / Working time.
    case WORK = 'work';

        // Обеденный перерыв. / Lunch break.
    case LUNCH = 'lunch';

    /**
     * Получить отображаемое название типа записи.
     * / Get the display label for the entry type.
     */
    public function label(): string
    {
        return match ($this) {
            self::WORK => 'Робота',
            self::LUNCH => 'Обід',
        };
    }
}
