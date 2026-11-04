<?php

namespace App\Controllers;

use App\Validators\AuthValidator;
use App\Models\User;
use App\Attributes\Auth;
use App\Validators\ChangePasswordValidator;

class AuthController
{
    public function login(): void
    {
        $data = requestBody();

        if (!AuthValidator::validate($data)) {
            jsonError(422, 'validation_error', 'Ошибка валидации', AuthValidator::errors());
            return;
        }


        $user = User::where('email', $data['email'])->first();

        if (!$user || !password_verify($data['password'], $user->password)) {
            jsonError(401, 'invalid_credentials', 'Неверный email или пароль');
            return;
        }

        if (!(bool) $user->is_active) {
            jsonError(401, 'invalid_credentials', 'Неверный email или пароль');
            return;
        }

        $token = bin2hex(random_bytes(32));
        $tokenExpiredAt = gmdate('Y-m-d H:i:s', time() + 7200);

        $user->api_token = $token;
        $user->token_expired_at = $tokenExpiredAt;
        $user->save();

        response([
            'token' => $token,
            'user' => $user->toArray()
        ], 200);
    }



    #[Auth]
    public function me(): void
    {
        $user = auth();

        response($user->toArray());
    }



    #[Auth]
    public function logout(): void
    {
        $user = auth();

        $user->api_token = null;
        $user->token_expired_at = null;
        $user->save();

        noContent();
    }


    #[Auth]
    public function changePassword(): void
    {
        $data = requestBody();

        if (!ChangePasswordValidator::validate($data)) {
            jsonError(
                422,
                'validation_error',
                'Validation failed',
                ChangePasswordValidator::errors()
            );
            return;
        }

        $user = auth();

        if (!password_verify($data['current_password'], $user->password)) {
            jsonError(
                422,
                'validation_error',
                'Validation failed',
                ['current_password' => 'Current password is incorrect']
            );
            return;
        }

        if (password_verify($data['new_password'], $user->password)) {
            jsonError(
                422,
                'validation_error',
                'Validation failed',
                ['new_password' => 'New password must differ from the current one']
            );
            return;
        }

        $user->password = password_hash(
            $data['new_password'],
            PASSWORD_DEFAULT
        );

        $user->save();

        noContent();
    }
}
