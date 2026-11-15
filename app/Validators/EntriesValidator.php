<?php

namespace App\Validators;

use Core\Validator;

class EntriesValidator extends Validator
{
    protected static array $rules = [
        'from' => ['required', 'date'],
        'to' => ['required', 'date'],
    ];
}
