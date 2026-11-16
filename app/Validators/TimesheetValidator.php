<?php

namespace App\Validators;

use Core\Validator;

class TimesheetValidator extends Validator
{
    static protected array $rules = [
        'month' => ['regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        'user_id' => ['integer'],
        'format' => ['in:csv,md,xlsx'],
    ];

    static protected array $messages = [
        'month.regex' => 'Must be in format YYYY-MM',
        'user_id.integer' => 'Must be an integer',
    ];
}
