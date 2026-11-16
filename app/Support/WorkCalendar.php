<?php

namespace App\Support;

use App\Models\Holiday;
use DateInterval;
use DatePeriod;
use DateTimeImmutable;

/*
 * Робочий календар: вихідні й свята. Дати — рядки Y-m-d, усі межі включно.
 * Свята читаємо один раз за запит, тож цикли по днях не породжують N+1.
 */
class WorkCalendar
{
    static protected ?array $holidays = null;

    /** @return array<string, true> дата => true */
    static public function holidays(): array
    {
        return static::$holidays ??= array_fill_keys(
            Holiday::query()->toBase()->pluck('date')->all(),
            true
        );
    }

    static public function isWeekend(DateTimeImmutable $day): bool
    {
        return (int) $day->format('N') >= 6;
    }

    /** @return DatePeriod<DateTimeImmutable> кожен день періоду */
    static public function days(string $from, string $to): DatePeriod
    {
        return new DatePeriod(
            new DateTimeImmutable($from),
            new DateInterval('P1D'),
            new DateTimeImmutable($to),
            DatePeriod::INCLUDE_END_DATE
        );
    }

    // $year — рахувати лише дні цього року (заявка може перетинати Новий рік)
    static public function workingDays(string $from, string $to, ?int $year = null): int
    {
        $holidays = static::holidays();
        $count = 0;

        foreach (static::days($from, $to) as $day) {
            if ($year !== null && (int) $day->format('Y') !== $year) {
                continue;
            }

            if (!static::isWeekend($day) && !isset($holidays[$day->format('Y-m-d')])) {
                $count++;
            }
        }

        return $count;
    }
}
