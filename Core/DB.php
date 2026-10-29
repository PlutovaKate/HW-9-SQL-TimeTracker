<?php

namespace Core;

use PDO;

class DB
{
    static protected ?PDO $pdo = null;

    // 1. $pdo === null => create PDO and return
    // 2. $pdo !== null => return
    static public function getInstance(): PDO
    {
        if (static::$pdo === null) {
            $dsn = "mysql:host=" . getenv('DB_HOST') . ";dbname=" . getenv('DATABASE');
            static::$pdo = new PDO(
                $dsn,
                getenv('DB_USER'),
                getenv('DB_PASS'),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
        }

        return static::$pdo;
    }
}
