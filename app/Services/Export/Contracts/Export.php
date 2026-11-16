<?php

namespace App\Services\Export\Contracts;

interface Export
{
    public function contentType(): string;
    public function extension(): string;

    public function write(iterable $rows, string $target = 'php://output'): void;
}
