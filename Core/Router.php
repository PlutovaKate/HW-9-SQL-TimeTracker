<?php

namespace Core;

use App\Attributes\Middleware;
use ReflectionAttribute;
use ReflectionMethod;

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


            self::runAction($controllerClass, $controllerMethod, $matches);
            return;
        }

        jsonError(404, 'not_found', 'Route not found');
    }


    private static function runAction(
        string $controllerClass,
        string $controllerMethod,
        array $params
    ): void {
        $controller = new $controllerClass();

        $reflection = new ReflectionMethod($controller, $controllerMethod);


        foreach (
            $reflection->getAttributes(
                Middleware::class,
                ReflectionAttribute::IS_INSTANCEOF
            ) as $attribute
        ) {
            $attrObject = $attribute->newInstance();
            $attrObject();
        }


        $controller->$controllerMethod(...$params);
    }
}
