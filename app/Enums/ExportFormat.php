<?php

namespace App\Enums;

use App\Services\Export\Contracts\Export;
use App\Services\Export\CsvExport;
use App\Services\Export\MarkdownExporter;
use App\Services\Export\XlsxExport;

enum ExportFormat: string
{
    case CSV = 'csv';
    case XLSX = 'xlsx';
    case MD = 'md';

    public function exporter(): Export
    {
        return match ($this) {
            self::CSV => new CsvExport(),
            self::MD => new MarkdownExporter(),
            self::XLSX => new XlsxExport(),
        };
    }
}
