<?php

/*
 * Заміри для частини 4: як читати велику таблицю, щоб вона не вбила пам'ять.
 * Скопіюй у bin/export-bench.php і запускай у контейнері (Xdebug вимкнено, вивід у /dev/null):
 *
 *   docker exec my-php php -d xdebug.mode=off bin/export-bench.php get 30000
 *   docker exec my-php php -d xdebug.mode=off bin/export-bench.php lazy 2000
 *
 * Режими:
 *   get    <max_id>  — TimeEntry::with('user')->get(): усі моделі разом у пам'яті (лише записи з id <= max_id)
 *   cursor           — Capsule::connection()->cursor(): «по рядку», але подивись на пам'ять
 *   lazy   <chunk>   — query builder + lazyById(<chunk>): порції WHERE id > ? LIMIT <chunk>
 *   models <chunk>   — Eloquent-моделі + lazyById(<chunk>) (на 655 тис. записів — близько хвилини)
 */

use App\Models\TimeEntry;
use App\Services\Export\CsvExport;
use Illuminate\Database\Capsule\Manager as Capsule;

define('BASE_DIR', dirname(__DIR__));

require BASE_DIR . '/vendor/autoload.php';

Dotenv\Dotenv::createUnsafeImmutable(BASE_DIR)->load();
date_default_timezone_set('UTC');

require BASE_DIR . '/boot/eloquent.php';

$mode = $argv[1] ?? 'lazy';
$arg = (int) ($argv[2] ?? 2000);
$start = microtime(true);

$fromModel = fn (TimeEntry $entry) => [
    'id' => $entry->id,
    'user_id' => $entry->user_id,
    'full_name' => $entry->user->full_name,
    'type' => $entry->type->value,
    'started_at' => (string) $entry->started_at,
    'ended_at' => (string) $entry->ended_at,
    'note' => $entry->note,
];

$builder = fn () => Capsule::table('time_entries as te')
    ->join('users as u', 'u.id', '=', 'te.user_id')
    ->select('te.id', 'te.user_id', 'u.full_name', 'te.type', 'te.started_at', 'te.ended_at', 'te.note');

function cursorRows(\Illuminate\Database\Query\Builder $query): Generator
{
    foreach ($query->orderBy('te.id')->cursor() as $row) {
        yield (array) $row;
    }
}

$rows = match ($mode) {
    'get' => TimeEntry::with('user')->where('id', '<=', $arg)->orderBy('id')->get()->map($fromModel)->all(),
    'cursor' => cursorRows($builder()),
    'lazy' => $builder()->lazyById($arg, 'te.id', 'id')->map(fn (object $row) => (array) $row),
    'models' => TimeEntry::with('user')->lazyById($arg)->map($fromModel),
};

(new CsvExport())->write($rows, '/dev/null');

printf(
    "%-7s %-7s %.1f с, пік %d МБ\n",
    $mode,
    $argv[2] ?? '',
    microtime(true) - $start,
    memory_get_peak_usage(true) / 1048576
);
