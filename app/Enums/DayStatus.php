<?php

namespace App\Enums;

enum DayStatus: string
{
    case WORKING = 'working';
    case WEEKEND = 'weekend';
    case HOLIDAY = 'holiday';
    case VACATION = 'vacation';
    case SICK = 'sick';
    case DAY_OFF = 'day_off';

    static public function fromLeave(LeaveType $type): self
    {
        return self::from($type->value);
    }
}
