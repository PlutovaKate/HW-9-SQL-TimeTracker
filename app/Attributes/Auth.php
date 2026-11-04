<?php

namespace App\Attributes;

use Attribute;
use Core\HttpException;

#[Attribute(Attribute::TARGET_METHOD)]
class Auth implements Middleware
{
    public function __invoke(): void
    {
        if (auth() === null) {
            throw new HttpException(
                401,
                'unauthorized',
                'Unauthenticated'
            );
        }
    }
}
