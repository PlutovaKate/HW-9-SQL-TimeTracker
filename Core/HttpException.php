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
}
