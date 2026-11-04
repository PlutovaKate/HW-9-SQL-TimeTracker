<?php

namespace App\Validators;

class ChangePasswordValidator
{
    private static array $errors = [];

    public static function validate(array $data): bool
    {
        self::$errors = [];

        foreach (['current_password', 'new_password'] as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                self::$errors[$field] = "The {$field} field is required.";
                continue;
            }

            if (!is_string($data[$field])) {
                self::$errors[$field] = "The {$field} field must be a string.";
                continue;
            }

            $length = mb_strlen($data[$field]);

            if ($field === 'current_password' && $length > 255) {
                self::$errors[$field] = "The {$field} field may not be greater than 255 characters.";
            }

            if ($field === 'new_password') {
                if ($length < 8) {
                    self::$errors[$field] = "The {$field} field must be at least 8 characters.";
                } elseif ($length > 72) {
                    self::$errors[$field] = "The {$field} field may not be greater than 72 characters.";
                }
            }
        }

        return empty(self::$errors);
    }

    public static function errors(): array
    {
        return self::$errors;
    }
}
