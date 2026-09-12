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
        $middleware->alias([
            'client' => EnsureClientRole::class,
            'admin' => EnsureAdminRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

if (isset($_ENV['APP_STORAGE_PATH']) || getenv('APP_STORAGE_PATH')) {
    $storagePath = getenv('APP_STORAGE_PATH') ?: $_ENV['APP_STORAGE_PATH'];
    $app->useStoragePath($storagePath);
}

if (isset($_ENV['APP_BOOTSTRAP_CACHE_PATH']) || getenv('APP_BOOTSTRAP_CACHE_PATH')) {
    $bootstrapCachePath = getenv('APP_BOOTSTRAP_CACHE_PATH') ?: $_ENV['APP_BOOTSTRAP_CACHE_PATH'];
    if (method_exists($app, 'useBootstrapCachePath')) {
        $app->useBootstrapCachePath($bootstrapCachePath);
    }
}

return $app;
