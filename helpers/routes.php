<?php


return [
    ['GET', '/api/health', [\App\Controllers\HealthController::class, 'check']],
    // ['GET', '/api/health/{id}', [\App\Controllers\HealthController::class, 'show']],
    ['POST', '/api/login', [\App\Controllers\AuthController::class, 'login']],
];
