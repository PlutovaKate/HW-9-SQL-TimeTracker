<?php

namespace App\Validators;

use Core\Validator;

class TeamReportValidator extends Validator
{
    static protected array $rules = [
        'from' => ['required', 'date'],
        'to' => ['required', 'date'],
        'format' => ['in:csv,md,xlsx'],
    ];
}
