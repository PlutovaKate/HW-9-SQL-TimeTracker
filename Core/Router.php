<?php

namespace Core;

class Router
{
    public static function dispatch(string $method, string $uri): void
    {
        $path = parse_url($uri, PHP_URL_PATH);
        $path = rtrim($path, '/') ?: '/';

        $routes = require BASE_DIR . '/helpers/routes.php';

        foreach ($routes as $route) {
            [$routeMethod, $routePath, $handler] = $route;

            if ($method !== $routeMethod) {
                continue;
            }

            $pattern = preg_replace('/\{[^}]+\}/', '(\d+)', $routePath);
            $pattern = '#^' . $pattern . '$#';

            if (!preg_match($pattern, $path, $matches)) {
                continue;
            }

            array_shift($matches);

            [$controllerClass, $controllerMethod] = $handler;

            $controller = new $controllerClass();

            $controller->$controllerMethod(...$matches);

            return;
        }

        jsonError(404, 'not_found', 'Route not found');
    }
}
