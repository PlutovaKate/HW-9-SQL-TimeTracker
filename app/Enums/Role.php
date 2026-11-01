<?php

namespace App\Enums;

enum Role: string
{
    case ADMIN = 'admin';
    case EMPLOYEE = 'employee';

    public function label(): string
    {
        return match ($this) {
            self::ADMIN => 'Адміністратор',
            self::EMPLOYEE => 'Працівник',
        };
    }
}
