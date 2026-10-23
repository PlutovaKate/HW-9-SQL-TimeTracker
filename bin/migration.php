<?php

define('BASE_DIR', dirname(__DIR__));

class Migration
{
    private const MIGRATION_FOLDER = '/database/migrations';

    public function run(): void
    {
        $folderPath = BASE_DIR . self::MIGRATION_FOLDER;

        $files = scandir($folderPath);

        $sqlFiles = array_filter($files, function ($file) {
            return str_ends_with($file, '.sql');
        });

        // Сортируем миграции, чтобы таблицы создавались в правильном порядке.
        // Это важно из-за зависимостей внешних ключей (Foreign Keys).
        sort($sqlFiles);

        $totalStatements = 0;

        foreach ($sqlFiles as $file) {
            $sql = file_get_contents($folderPath . '/' . $file);

            $statements = $this->splitStatements($sql);

            $totalStatements += count($statements);

            echo $file . ': ' . count($statements) . " запрос(ов)\n";

            foreach ($statements as $statement) {
                $lines = explode("\n", $statement);

                foreach ($lines as $line) {
                    $line = trim($line);

                    if ($line === '' || str_starts_with($line, '--')) {
                        continue;
                    }

                    echo "  • " . $line . "\n";
                    break;
                }
            }
        }

        echo "Разом: $totalStatements запит(ів) у " . count($sqlFiles) . " файлах\n";
    }

    private function splitStatements(string $sql): array
    {
        $statements = explode(';', $sql);

        $statements = array_map('trim', $statements);

        $statements = array_filter($statements, function ($statement) {
            $lines = explode("\n", $statement);

            foreach ($lines as $line) {
                $line = trim($line);

                if ($line !== '' && !str_starts_with($line, '--')) {
                    return true;
                }
            }

            return false;
        });

        return array_values($statements);
    }
}

$migration = new Migration();
$migration->run();
