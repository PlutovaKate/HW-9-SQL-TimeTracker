<?php

const BASE_DIR = __DIR__;

require_once BASE_DIR . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createUnsafeImmutable(BASE_DIR);
$dotenv->load();


\Core\Router::dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
