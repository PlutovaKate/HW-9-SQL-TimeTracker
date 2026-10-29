<?php

use App\Enums\Role;

function db(): PDO
{
    return \Core\DB::getInstance();
}

function response(array $data = [], int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE);
}

function jsonError(int $status, string $code, string $message, array $fields = []): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => [
            'code' => $code,
            'message' => $message,
            'fields' => (object) $fields,
        ]
    ], JSON_UNESCAPED_UNICODE);
}

function requestBody(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}


function publicUser(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'phone' => $user['phone'] ?? null,
        'role' => $user['role'],
        'role_label' => Role::from($user['role'])->label(),
        'daily_hours' => (int) $user['daily_hours'],
        'vacation_days' => (int) $user['vacation_days'],
        'is_active' => (bool) $user['is_active'],
        'created_at' => gmdate('c', strtotime($user['created_at'] . ' UTC')),
    ];
}
