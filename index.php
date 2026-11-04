<?php

const BASE_DIR = __DIR__;

require_once BASE_DIR . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createUnsafeImmutable(BASE_DIR);
$dotenv->load();

require_once BASE_DIR . '/boot/eloquent.php';



try {
    \Core\Router::dispatch(
        $_SERVER['REQUEST_METHOD'],
        $_SERVER['REQUEST_URI']
    );
} catch (\Core\HttpException $e) {
    jsonError(
        $e->status,
        $e->errorCode,
        $e->getMessage(),
        $e->fields
    );
}
