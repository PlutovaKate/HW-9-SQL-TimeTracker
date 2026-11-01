<?php

namespace App\Validators;

use Core\Validator;

class AuthValidator extends Validator
{
    protected static array $rules = [
        'email' => ['required', 'string', 'email', 'max:255'],
        'password' => ['required', 'string', 'min:8', 'max:255'],
    ];
}
