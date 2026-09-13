<?php

use App\Http\Controllers\Setup\NeonInitController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Stateless API Routes
|--------------------------------------------------------------------------
|
| These routes run completely stateless without StartSession middleware.
| Used for health checks, webhooks, and one-time environment bootstrap.
|
*/

Route::post('/neon-init', NeonInitController::class);
