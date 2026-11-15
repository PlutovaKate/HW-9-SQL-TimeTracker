<?php

namespace App\Validators;

use Core\Validator;

/**
 * Проверка данных при редактировании записи рабочего времени администратором.
 * / Validate time entry data when edited by an administrator.
 */
class UpdateTimeEntryValidator extends Validator
{
    // Правила проверки полей запроса PATCH. / Validation rules for PATCH request fields.
    protected static array $rules = [
        'started_at' => ['required', 'datetime'],
        'ended_at' => ['nullable', 'datetime'],
        'note' => ['nullable', 'string', 'max:255'],
    ];
}
