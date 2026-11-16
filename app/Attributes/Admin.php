<?php

namespace App\Attributes;

use App\Enums\Role;
use Attribute;
use Core\HttpException;

#[Attribute(Attribute::TARGET_METHOD)]
class Admin implements Middleware
{
    public function __invoke(): void
    {
        // Сначала проверяем авторизацию (401)
        (new Auth())();

        // Затем проверяем права администратора (403)
        if (auth()->role !== Role::ADMIN) {
            throw HttpException::forbidden();
        }
    }
}
