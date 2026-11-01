<?php

namespace App\Controllers;

use App\Validators\AuthValidator;

class AuthController
{
    public function login(): void
    {
        $data = requestBody();

        if (!AuthValidator::validate($data)) {
            jsonError(422, 'validation_error', 'Ошибка валидации', AuthValidator::errors());
            return;
        }

        $pdo = db();

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$data['email']]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$user || !password_verify($data['password'], $user['password'])) {
            jsonError(401, 'invalid_credentials', 'Неверный email или пароль');
            return;
        }

        if (!(bool) $user['is_active']) {
            jsonError(401, 'invalid_credentials', 'Неверный email или пароль');
            return;
        }

        $token = bin2hex(random_bytes(32));
        $tokenExpiredAt = gmdate('Y-m-d H:i:s', time() + 7200);

        $stmt = $pdo->prepare(
            'UPDATE users SET api_token = ?, token_expired_at = ? WHERE id = ?'
        );

        $stmt->execute([
            $token,
            $tokenExpiredAt,
            $user['id']
        ]);

        response([
            'data' => [
                'token' => $token,
                'user' => publicUser($user)
            ]
        ], 200);
    }
}
