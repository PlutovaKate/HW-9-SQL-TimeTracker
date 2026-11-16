<?php

namespace App\Enums;

enum LeaveType: string
{
    case VACATION = 'vacation';
    case SICK = 'sick';
    case DAY_OFF = 'day_off';

    public function label(): string
    {
        return match ($this) {
            self::VACATION => 'Відпустка',
            self::SICK => 'Лікарняний',
            self::DAY_OFF => 'Відгул',
        };
    }
}
