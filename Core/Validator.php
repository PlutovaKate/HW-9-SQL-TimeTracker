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
                    !in_array($rule, ['required', 'string', 'email'], true)
                    && !str_starts_with($rule, 'min:')
                    && !str_starts_with($rule, 'max:')
                ) {
                    throw new \InvalidArgumentException("Неизвестное правило: $rule");
                }

                if ($rule === 'required' && ($value === null || $value === '')) {
                    static::$errors[$field][] = 'Поле обязательно для заполнения';
                }

                if ($rule === 'string' && $value !== null && !is_string($value)) {
                    static::$errors[$field][] = 'Поле должно быть строкой';
                }

                if ($rule === 'email' && $value !== null && is_string($value) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    static::$errors[$field][] = 'Некорректный email';
                }

                if (str_starts_with($rule, 'min:') && $value !== null) {
                    $min = (int) substr($rule, 4);

                    if (is_string($value) && mb_strlen($value) < $min) {
                        static::$errors[$field][] = "Минимальная длина — $min символов";
                    }

                    if ((is_int($value) || is_float($value)) && $value < $min) {
                        static::$errors[$field][] = "Минимальное значение — $min";
                    }
                }

                if (str_starts_with($rule, 'max:') && $value !== null) {
                    $max = (int) substr($rule, 4);

                    if (is_string($value) && mb_strlen($value) > $max) {
                        static::$errors[$field][] = "Максимальная длина — $max символов";
                    }

                    if ((is_int($value) || is_float($value)) && $value > $max) {
                        static::$errors[$field][] = "Максимальное значение — $max";
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
}
