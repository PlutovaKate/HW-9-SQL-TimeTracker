<?php

namespace App\Attributes;

interface Middleware
{
    public function __invoke(): void;
}
