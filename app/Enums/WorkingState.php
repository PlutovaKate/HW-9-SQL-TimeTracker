<?php

namespace App\Enums;

enum WorkingState: string
{
    case OFF_DUTY = 'off_duty';
    case WORKING = 'working';
    case ON_LUNCH = 'on_lunch';

    public function label(): string
    {
        return match ($this) {
            self::OFF_DUTY => 'Не на роботі',
            self::WORKING => 'Працює',
            self::ON_LUNCH => 'На обіді',
        };
    }
}
