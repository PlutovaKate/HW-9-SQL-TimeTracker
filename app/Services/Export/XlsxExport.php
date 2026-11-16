<?php

namespace App\Services\Export;

use App\Services\Export\Contracts\Export;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

class XlsxExport implements Export
{

    public function contentType(): string
    {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    public function extension(): string
    {
        return 'xlsx';
    }

    public function write(iterable $rows, string $target = 'php://output'): void
    {
        $writer = new Writer();
        $writer->openToFile($target);
        $isFirst = true;

        foreach ($rows as $row) {
            if ($isFirst) {
                $writer->addRow(Row::fromValues(array_keys($row)));
                $isFirst = false;
            }

            $writer->addRow(Row::fromValues(array_values($row)));
        }
        $writer->close();
    }
}
