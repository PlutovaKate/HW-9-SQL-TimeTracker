<?php

namespace App\Validators;

use Core\Validator;

class AdminEntriesValidator extends Validator
{
    protected static array $rules = [
        'user_id' => ['required', 'integer'],
        'from' => ['required', 'date'],
        'to' => ['required', 'date'],
    ];
}
