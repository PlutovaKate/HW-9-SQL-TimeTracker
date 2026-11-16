<?php

namespace Core;

use Exception;

class HttpException extends Exception
{
    public function __construct(
        public int $status,
        public string $errorCode,
        string $message,
        public array $fields = []
    ) {
        parent::__construct($message);
    }

    public static function validation(array $fields): self
    {
        return new self(
            422,
            'VALIDATION_ERROR',
            'Validation failed',
            $fields
        );
    }

    public static function forbidden(): self
    {
        return new self(403, 'forbidden', 'Forbidden');
    }
}
