<?php

namespace Core;

class Validator
{
    protected static array $rules = [];
    protected static array $errors = [];




    public static function validate(array $data): bool
    {
        static::$errors = [];

        foreach (static::$rules as $field => $rules) {
            $value = $data[$field] ?? null;

            foreach ($rules as $rule) {
                if (
                    !in_array($rule, [
                        'required',
                        'nullable',
                        'string',
                        'email',
                        'integer',
                        'date',
                        'datetime',
                    ], true)
                    && !str_starts_with($rule, 'min:')
                    && !str_starts_with($rule, 'max:')
                    && !str_starts_with($rule, 'in:')
                    && !str_starts_with($rule, 'regex:')
                ) {
                    throw new \InvalidArgumentException(
                        "Неизвестное правило: $rule"
                    );
                }
            }

            if (
                in_array('required', $rules, true)
                && ($value === null || $value === '')
            ) {
                static::$errors[$field][] = 'Поле обязательно для заполнения';
                continue;
            }

            if ($value === null) {
                continue;
            }

            if (in_array('string', $rules, true) && !is_string($value)) {
                static::$errors[$field][] = 'Поле должно быть строкой';
            }

            if (
                in_array('integer', $rules, true)
                && filter_var($value, FILTER_VALIDATE_INT) === false
            ) {
                static::$errors[$field][] = 'Поле должно быть целым числом';
            }

            if (
                in_array('email', $rules, true)
                && (!is_string($value)
                    || !filter_var($value, FILTER_VALIDATE_EMAIL))
            ) {
                static::$errors[$field][] = 'Некорректный email';
            }

            if (in_array('date', $rules, true)) {
                $date = is_string($value)
                    ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value)
                    : false;

                if (!$date || $date->format('Y-m-d') !== $value) {
                    static::$errors[$field][] = 'Некорректная дата';
                }
            }

            if (in_array('datetime', $rules, true)) {
                $date = is_string($value)
                    ? \DateTimeImmutable::createFromFormat(
                        '!Y-m-d\TH:i:s\Z',
                        $value,
                        new \DateTimeZone('UTC')
                    )
                    : false;

                if (!$date || $date->format('Y-m-d\TH:i:s\Z') !== $value) {
                    static::$errors[$field][] = 'Некорректная дата и время';
                }
            }

            foreach ($rules as $rule) {
                if (str_starts_with($rule, 'regex:')) {
                    $pattern = substr($rule, 6);

                    if (!is_string($value) || preg_match($pattern, $value) !== 1) {
                        static::$errors[$field][] = 'Invalid format';
                    }
                }

                if (str_starts_with($rule, 'in:')) {
                    $allowed = explode(',', substr($rule, 3));

                    if (!is_string($value) || !in_array($value, $allowed, true)) {
                        static::$errors[$field][] =
                            'Must be one of: ' . implode(',', $allowed);
                    }
                }

                if (str_starts_with($rule, 'min:')) {
                    $min = (int) substr($rule, 4);

                    if (is_string($value) && mb_strlen($value) < $min) {
                        static::$errors[$field][] =
                            "Минимальная длина — $min символов";
                    } elseif (
                        is_numeric($value) && !is_string($value)
                        && $value < $min
                    ) {
                        static::$errors[$field][] =
                            "Минимальное значение — $min";
                    }
                }

                if (str_starts_with($rule, 'max:')) {
                    $max = (int) substr($rule, 4);

                    if (is_string($value) && mb_strlen($value) > $max) {
                        static::$errors[$field][] =
                            "Максимальная длина — $max символов";
                    } elseif (
                        is_numeric($value) && !is_string($value)
                        && $value > $max
                    ) {
                        static::$errors[$field][] =
                            "Максимальное значение — $max";
                    }
                }
            }
        }

        return empty(static::$errors);
    }

    public static function errors(): array
    {
        return static::$errors;
    }


    public static function validateOrFail(array $data): void
    {
        if (!static::validate($data)) {
            $errors = [];

            foreach (static::errors() as $field => $messages) {
                $errors[$field] = $messages[0];
            }

            throw HttpException::validation($errors);
        }
    }
}
