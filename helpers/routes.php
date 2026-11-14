<?php


return [
    ['GET', '/api/health', [\App\Controllers\HealthController::class, 'check']],
    // ['GET', '/api/health/{id}', [\App\Controllers\HealthController::class, 'show']],
    ['POST', '/api/login', [\App\Controllers\AuthController::class, 'login']],
    ['POST', '/api/auth/login', [\App\Controllers\AuthController::class, 'login']],
    ['GET', '/api/me', [\App\Controllers\AuthController::class, 'me']],
    ['POST', '/api/auth/logout', [\App\Controllers\AuthController::class, 'logout']],
    ['PATCH', '/api/me/password', [\App\Controllers\AuthController::class, 'changePassword']],
];
