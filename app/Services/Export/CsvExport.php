<?php

namespace App\Services\Export;

use App\Services\Export\Contracts\Export;

class CsvExport implements Export
{
    public function contentType(): string
    {
        return 'text/csv; charset=utf-8';
    }

    public function extension(): string
    {
        return 'csv';
    }

    public function write(iterable $rows, string $target = 'php://output'): void
    {
        $out = fopen($target, 'w');

        // UTF-8 BOM для корректного отображения кириллицы в Excel.
        fwrite($out, "\xEF\xBB\xBF");

        $isFirst = true;

        foreach ($rows as $row) {
            if ($isFirst) {
                // Заголовки столбцов.
                fputcsv($out, array_keys($row), ';', '"', '', "\r\n");
                $isFirst = false;
            }

            // Преобразуем и защищаем значения.
            $values = array_map(
                fn($value) => $this->cell($value),
                array_values($row)
            );

            fputcsv($out, $values, ';', '"', '', "\r\n");
        }

        fclose($out);
    }

    private function cell(mixed $value): string|int|float
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 1 : 0;
        }

        if (is_int($value) || is_float($value)) {
            return $value;
        }

        $value = (string) $value;

        // Защита от CSV-инъекций.
        if (preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'" . $value;
        }

        return $value;
    }
}
