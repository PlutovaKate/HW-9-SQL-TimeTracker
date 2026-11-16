<?php

return [
    // HW-10 — Health
    ['GET', '/api/health', [\App\Controllers\HealthController::class, 'check']],

    // HW-11 — Authentication
    ['POST', '/api/login', [\App\Controllers\AuthController::class, 'login']],
    ['POST', '/api/auth/login', [\App\Controllers\AuthController::class, 'login']],
    ['GET', '/api/me', [\App\Controllers\AuthController::class, 'me']],
    ['POST', '/api/auth/logout', [\App\Controllers\AuthController::class, 'logout']],
    ['PATCH', '/api/me/password', [\App\Controllers\AuthController::class, 'changePassword']],

    // HW-12 — Time tracking
    ['GET', '/api/time/status', [\App\Controllers\TimeController::class, 'status']],
    ['POST', '/api/time/check-in', [\App\Controllers\TimeController::class, 'checkIn']],
    ['POST', '/api/time/lunch/start', [\App\Controllers\TimeController::class, 'lunchStart']],
    ['POST', '/api/time/lunch/end', [\App\Controllers\TimeController::class, 'lunchEnd']],
    ['POST', '/api/time/check-out', [\App\Controllers\TimeController::class, 'checkOut']],

    // HW-12 — Employee entries
    ['GET', '/api/me/entries', [\App\Controllers\TimeController::class, 'myEntries']],

    // HW-12 — Admin
    ['GET', '/api/time-entries', [\App\Controllers\TimeController::class, 'index']],
    ['PATCH', '/api/time-entries/{id}', [\App\Controllers\TimeController::class, 'update']],


    ['GET', '/api/reports/timesheet', [\App\Controllers\ReportController::class, 'timesheet']],
    ['GET', '/api/reports/team', [\App\Controllers\ReportController::class, 'team']],
    ['GET', '/api/reports/entries', [\App\Controllers\ReportController::class, 'journal']],

];
