<?php

namespace App\Attributes;

use Attribute;
use App\Enums\Role;
use Core\HttpException;

#[Attribute(Attribute::TARGET_METHOD)]
class Auth implements Middleware
{
    public function __construct(
        private ?Role $role = null
    ) {}

    public function __invoke(): void
    {
        $user = auth();

        if ($user === null) {
            throw new HttpException(
                401,
                'unauthorized',
                'Unauthenticated'
            );
        }

        if ($this->role !== null && $user->role !== $this->role) {
            throw new HttpException(
                403,
                'forbidden',
                'Forbidden'
            );
        }
    }
}
