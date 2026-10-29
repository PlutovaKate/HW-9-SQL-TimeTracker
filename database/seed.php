<?php

/*
 * Запуск: docker exec -it my-php php database/seed.php
 * Перезаписує ВСІ дані в users, time_entries, leave_requests, holidays.
 */

define('BASE_DIR', dirname(__DIR__));

require_once BASE_DIR . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createUnsafeImmutable(BASE_DIR);
$dotenv->load();

date_default_timezone_set('UTC');
mt_srand(2026); // однакові «випадкові» дані при кожному запуску

db()->exec("SET time_zone = '+00:00'");

$fmt = static fn(DateTimeImmutable $d): string => $d->format('Y-m-d H:i:s');

// ---------- 0. Очищення (TRUNCATE робить неявний COMMIT, тому до транзакції) ----------
db()->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach (['time_entries', 'leave_requests', 'holidays', 'users'] as $table) {
    db()->exec("TRUNCATE TABLE {$table}");
}
db()->exec('SET FOREIGN_KEY_CHECKS = 1');

db()->beginTransaction();

// ---------- 1. Період: два повні попередні місяці ----------
$currentMonth = new DateTimeImmutable('first day of this month midnight');
$month1Start = $currentMonth->modify('-2 months');
$month2Start = $currentMonth->modify('-1 month');
$nextMonthStart = $currentMonth->modify('+1 month');

// ---------- 2. Свята (фіксовані дати) ----------
$fixedHolidays = [
    '01-01' => 'Новий рік',
    '06-28' => 'День Конституції України',
    '07-15' => 'День Української Державності',
    '08-24' => 'День Незалежності України',
    '10-01' => 'День захисників і захисниць України',
    '12-25' => 'Різдво Христове',
];

$holidayDates = [];
$insertHoliday = db()->prepare('INSERT INTO holidays (date, title) VALUES (:date, :title)');
$firstYear = (int)$month1Start->format('Y');
$lastYear = (int)$nextMonthStart->format('Y') + 1;

for ($year = $firstYear; $year <= $lastYear; $year++) {
    foreach ($fixedHolidays as $monthDay => $title) {
        $date = "{$year}-{$monthDay}";
        $insertHoliday->execute(['date' => $date, 'title' => $title]);
        $holidayDates[$date] = true;
    }
}

// ---------- 3. Користувачі (пароль у всіх: password) ----------
$passwordHash = password_hash('password', PASSWORD_DEFAULT); // один хеш на всіх: швидше
$createdAt = $fmt($month1Start->modify('-30 days')->setTime(8, 0));

$users = [
    // email => [full_name, role, work_start (UTC), daily_hours, vacation_days, is_active]
    'admin@example.com' => ['Олена Адміністраторка', 'admin', '06:00:00', 8, 24, 1],
    'ivan@example.com' => ['Іван Петренко', 'employee', '06:00:00', 8, 24, 1],
    'maria@example.com' => ['Марія Коваленко', 'employee', '06:00:00', 8, 24, 1],
    'oleh@example.com' => ['Олег Шевчук', 'employee', '07:00:00', 8, 24, 1],
    'anna@example.com' => ['Анна Бондаренко', 'employee', '06:00:00', 8, 24, 1],
    'taras@example.com' => ['Тарас Мельник', 'employee', '05:00:00', 6, 18, 1],
    // звільнений: без записів часу, не може залогінитись
    'former@example.com' => ['Петро Звільнений', 'employee', '06:00:00', 8, 24, 0],
];

$insertUser = db()->prepare(
    'INSERT INTO users (full_name, email, password, role, work_start, daily_hours, vacation_days, is_active, created_at)
     VALUES (:full_name, :email, :password, :role, :work_start, :daily_hours, :vacation_days, :is_active, :created_at)'
);

$userIds = [];
foreach ($users as $email => [$fullName, $role, $workStart, $dailyHours, $vacationDays, $isActive]) {
    $insertUser->execute([
        'full_name' => $fullName,
        'email' => $email,
        'password' => $passwordHash,
        'role' => $role,
        'work_start' => $workStart,
        'daily_hours' => $dailyHours,
        'vacation_days' => $vacationDays,
        'is_active' => $isActive,
        'created_at' => $createdAt,
    ]);
    $userIds[$email] = (int)db()->lastInsertId();
}
$adminId = $userIds['admin@example.com'];

// ---------- 4. Робочі дні: пн–пт без свят у [$from, $to) ----------
$workdays = static function (DateTimeImmutable $from, DateTimeImmutable $to) use ($holidayDates): array {
    $days = [];
    for ($day = $from; $day < $to; $day = $day->modify('+1 day')) {
        if ((int)$day->format('N') <= 5 && !isset($holidayDates[$day->format('Y-m-d')])) {
            $days[] = $day;
        }
    }

    return $days;
};

$month1 = $workdays($month1Start, $month2Start);
$month2 = $workdays($month2Start, $currentMonth);
$nextMonth = $workdays($nextMonthStart, $nextMonthStart->modify('+1 month'));

// ---------- 5. Заявки на відсутність ----------
$leaves = [
    // [email, type, from, to, status, comment]
    ['ivan@example.com', 'vacation', $month1[9], $month1[13], 'approved', 'Відпустка, море'],
    ['taras@example.com', 'vacation', $month1[16], $month1[17], 'rejected', 'Реліз, перенеси, будь ласка'],
    ['maria@example.com', 'sick', $month2[2], $month2[3], 'approved', 'Застуда'],
    ['oleh@example.com', 'day_off', $month2[6], $month2[6], 'approved', 'Сімейні справи'],
    ['anna@example.com', 'vacation', $nextMonth[4], $nextMonth[8], 'pending', null],
    ['oleh@example.com', 'vacation', $nextMonth[10], $nextMonth[11], 'pending', null],
    ['maria@example.com', 'day_off', $nextMonth[1], $nextMonth[1], 'pending', 'Переїзд'],
];

$insertLeave = db()->prepare(
    'INSERT INTO leave_requests (user_id, type, date_from, date_to, status, comment, reviewed_by, reviewed_at, created_at)
     VALUES (:user_id, :type, :date_from, :date_to, :status, :comment, :reviewed_by, :reviewed_at, :created_at)'
);

$absent = []; // [email][Y-m-d] = true — дні, коли записів часу немає

foreach ($leaves as [$email, $type, $from, $to, $status, $comment]) {
    // лікарняний подається в той самий день, решта — за тиждень
    $created = $type === 'sick' ? $from->setTime(5, 30) : $from->modify('-7 days')->setTime(8, 0);
    $reviewed = $status === 'pending' ? null : $created->modify('+2 hours');

    $insertLeave->execute([
        'user_id' => $userIds[$email],
        'type' => $type,
        'date_from' => $from->format('Y-m-d'),
        'date_to' => $to->format('Y-m-d'),
        'status' => $status,
        'comment' => $comment,
        'reviewed_by' => $status === 'pending' ? null : $adminId,
        'reviewed_at' => $reviewed === null ? null : $fmt($reviewed),
        'created_at' => $fmt($created),
    ]);

    if ($status === 'approved') {
        for ($day = $from; $day <= $to; $day = $day->modify('+1 day')) {
            $absent[$email][$day->format('Y-m-d')] = true;
        }
    }
}

// ---------- 6. Записи часу ----------
$insertEntry = db()->prepare(
    'INSERT INTO time_entries (user_id, type, started_at, ended_at, note, created_by)
     VALUES (:user_id, :type, :started_at, :ended_at, :note, :created_by)'
);

$entriesCount = 0;

foreach ($users as $email => [, $role, $workStart, $dailyHours,, $isActive]) {
    if ($role === 'admin' || !$isActive) {
        continue;
    }

    $userId = $userIds[$email];
    [$hour, $minute] = array_map('intval', explode(':', $workStart));

    foreach ([...$month1, ...$month2] as $day) {
        if (isset($absent[$email][$day->format('Y-m-d')])) {
            continue;
        }

        // прихід: 70% вчасно (±), 20% запізнення 11–40 хв, 10% сильне запізнення
        $roll = mt_rand(1, 100);
        $delay = match (true) {
            $roll <= 70 => mt_rand(-10, 5),
            $roll <= 90 => mt_rand(11, 40),
            default => mt_rand(45, 90),
        };
        $start = $day->setTime($hour, $minute)->modify(sprintf('%+d minutes', $delay));

        // обід у 90% днів: приблизно посередині дня, 30–60 хв
        $lunchMinutes = 0;
        if (mt_rand(1, 100) <= 90) {
            $lunchMinutes = mt_rand(30, 60);
            $lunchStart = $start->modify(sprintf('+%d minutes', intdiv($dailyHours * 60, 2) + mt_rand(-30, 30)));
            $insertEntry->execute([
                'user_id' => $userId,
                'type' => 'lunch',
                'started_at' => $fmt($lunchStart),
                'ended_at' => $fmt($lunchStart->modify("+{$lunchMinutes} minutes")),
                'note' => null,
                'created_by' => $userId,
            ]);
            $entriesCount++;
        }

        // відхід: 70% майже вчасно, 20% переробка 30–120 хв, 10% пішов раніше
        $roll = mt_rand(1, 100);
        $extra = match (true) {
            $roll <= 70 => mt_rand(0, 15),
            $roll <= 90 => mt_rand(30, 120),
            default => -mt_rand(15, 60),
        };
        $end = $start->modify(sprintf('%+d minutes', $dailyHours * 60 + $lunchMinutes + $extra));

        $note = match (true) {
            $delay > 10 && mt_rand(1, 3) === 1 => 'Затримався в дорозі',
            $extra >= 30 && mt_rand(1, 2) === 1 => 'Реліз',
            $extra < 0 && mt_rand(1, 2) === 1 => 'Пішов раніше, лікар',
            default => null,
        };

        $insertEntry->execute([
            'user_id' => $userId,
            'type' => 'work',
            'started_at' => $fmt($start),
            'ended_at' => $fmt($end),
            'note' => $note,
            'created_by' => $userId,
        ]);
        $entriesCount++;
    }
}

db()->commit();

printf(
    "Seeded: %d users, %d holidays, %d leave requests, %d time entries (%s — %s)\n",
    count($userIds),
    count($holidayDates),
    count($leaves),
    $entriesCount,
    $month1Start->format('Y-m-d'),
    $currentMonth->modify('-1 day')->format('Y-m-d'),
);
echo "Login: admin@example.com / password, ivan@example.com / password, ...\n";
