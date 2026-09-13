<?php

use App\Http\Middleware\EnsureAdminRole;
use App\Http\Middleware\EnsureClientRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        __DIR__ . '/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->validateCsrfTokens(except: [
            'neon-init',
        ]);

        $middleware->alias([
            'client' => EnsureClientRole::class,
            'admin' => EnsureAdminRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->withProviders()
    ->create();

if (isset($_ENV['APP_STORAGE_PATH']) || getenv('APP_STORAGE_PATH') || isset($_ENV['LARAVEL_STORAGE_PATH']) || getenv('LARAVEL_STORAGE_PATH')) {
    $storagePath = getenv('LARAVEL_STORAGE_PATH') ?: ($_ENV['LARAVEL_STORAGE_PATH'] ?? (getenv('APP_STORAGE_PATH') ?: $_ENV['APP_STORAGE_PATH']));
    $app->useStoragePath($storagePath);
}

return $app;
