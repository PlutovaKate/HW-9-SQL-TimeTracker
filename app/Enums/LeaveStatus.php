<?php

namespace App\Enums;

enum LeaveStatus: string
{
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'На розгляді',
            self::APPROVED => 'Затверджено',
            self::REJECTED => 'Відхилено',
        };
    }
}
