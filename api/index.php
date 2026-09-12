<?php

// Vercel Serverless Function Bridge for Laravel Application
$tmpStorage = '/tmp/storage';
$tmpBootstrapCache = '/tmp/bootstrap/cache';

$dirs = [
    $tmpStorage,
    $tmpStorage . '/framework',
    $tmpStorage . '/framework/views',
    $tmpStorage . '/framework/cache',
    $tmpStorage . '/framework/cache/data',
    $tmpStorage . '/framework/sessions',
    $tmpStorage . '/logs',
    $tmpStorage . '/app',
    $tmpStorage . '/app/public',
    '/tmp/bootstrap',
    $tmpBootstrapCache,
];

foreach ($dirs as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
}

// Storage paths
putenv('APP_STORAGE_PATH=' . $tmpStorage);
$_ENV['APP_STORAGE_PATH'] = $tmpStorage;
$_SERVER['APP_STORAGE_PATH'] = $tmpStorage;

putenv('LARAVEL_STORAGE_PATH=' . $tmpStorage);
$_ENV['LARAVEL_STORAGE_PATH'] = $tmpStorage;
$_SERVER['LARAVEL_STORAGE_PATH'] = $tmpStorage;

putenv('VIEW_COMPILED_PATH=' . $tmpStorage . '/framework/views');
$_ENV['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';
$_SERVER['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';

// Cache file paths (pointing directly to writable /tmp/bootstrap/cache/)
putenv('APP_SERVICES_CACHE=' . $tmpBootstrapCache . '/services.php');
$_ENV['APP_SERVICES_CACHE'] = $tmpBootstrapCache . '/services.php';
$_SERVER['APP_SERVICES_CACHE'] = $tmpBootstrapCache . '/services.php';

putenv('APP_PACKAGES_CACHE=' . $tmpBootstrapCache . '/packages.php');
$_ENV['APP_PACKAGES_CACHE'] = $tmpBootstrapCache . '/packages.php';
$_SERVER['APP_PACKAGES_CACHE'] = $tmpBootstrapCache . '/packages.php';

putenv('APP_CONFIG_CACHE=' . $tmpBootstrapCache . '/config.php');
$_ENV['APP_CONFIG_CACHE'] = $tmpBootstrapCache . '/config.php';
$_SERVER['APP_CONFIG_CACHE'] = $tmpBootstrapCache . '/config.php';

putenv('APP_ROUTES_CACHE=' . $tmpBootstrapCache . '/routes.php');
$_ENV['APP_ROUTES_CACHE'] = $tmpBootstrapCache . '/routes.php';
$_SERVER['APP_ROUTES_CACHE'] = $tmpBootstrapCache . '/routes.php';

putenv('APP_EVENTS_CACHE=' . $tmpBootstrapCache . '/events.php');
$_ENV['APP_EVENTS_CACHE'] = $tmpBootstrapCache . '/events.php';
$_SERVER['APP_EVENTS_CACHE'] = $tmpBootstrapCache . '/events.php';

require __DIR__ . '/../laravel/public/index.php';
