<?php

namespace App\Validators;

use Core\Validator;

class JournalValidator extends Validator
{
    # from=&to=&user_id=&format=csv|md|json
    protected static array $rules = [
        'from' => ['required', 'date'],
        'to' => ['required', 'date'],
        'user_id' => ['integer'],
        'format' => ['required', 'in:csv,md,xlsx'],
    ];
}
