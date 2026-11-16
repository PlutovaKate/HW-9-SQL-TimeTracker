<?php

namespace App\Services\Export;

use App\Services\Export\Contracts\Export;

class MarkdownExporter implements Contracts\Export
{

    public function contentType(): string
    {
        return 'text/markdown; charset=utf-8';
    }

    public function extension(): string
    {
        return 'md';
    }

    public function write(iterable $rows, string $target = 'php://output'): void
    {
        $out = fopen($target, 'w');
        $isFirst = true;

        foreach ($rows as $row) {
            if ($isFirst) {
                # | date | start_work | end_work | ... |
                # |------|------------------------------|

                fwrite(
                    $out,
                    '| ' . implode(
                        ' | ',
                        array_map($this->cell(...), array_keys($row))
                    ) . " |\n"
                );

                fwrite(
                    $out,
                    '| ' . implode(' | ', array_fill(0, count($row), '---')) . " |\n"
                );

                $isFirst = false;
            }
            fwrite(
                $out,
                '| ' . implode(
                    ' | ',
                    array_map($this->cell(...), array_values($row))
                ) . " |\n"
            );
        }
        fclose($out);
    }

    private function cell(mixed $value): string
    {
        return match (true) {
            $value === null => '',
            is_bool($value) => $value ? 'так' : 'ні',
            default => str_replace(['|', "\r\n", "\n"], ['\|', ' ', ' '], (string) $value),
        };
    }
}
