<?php

namespace App\Http\Controllers\Setup;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class NeonInitController extends Controller
{
    /**
     * Temporary, strongly protected one-time database initialization endpoint
     * for running existing migrations and DatabaseSeeder on empty Neon PostgreSQL.
     */
    public function __invoke(Request $request): JsonResponse
    {
        // 1. Guard: Check if NEON_INIT_SECRET environment variable is configured
        $configuredSecret = env('NEON_INIT_SECRET');
        if (empty($configuredSecret) || !is_string($configuredSecret)) {
            // Return 404 rather than exposing a setup endpoint exists
            throw new NotFoundHttpException();
        }

        // 2. Secret authentication via secure header (X-Neon-Init-Secret or Authorization Bearer)
        $providedSecret = $request->header('X-Neon-Init-Secret');
        if (empty($providedSecret)) {
            $authHeader = $request->header('Authorization', '');
            if (str_starts_with($authHeader, 'Bearer ')) {
                $providedSecret = substr($authHeader, 7);
            }
        }

        if (!is_string($providedSecret) || !hash_equals($configuredSecret, $providedSecret)) {
            // Timing-safe comparison failed
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized.',
            ], 403);
        }

        // 3. Idempotency Guard: Check if migrations table exists and core tables already present
        try {
            if (Schema::hasTable('migrations') && Schema::hasTable('sessions') && Schema::hasTable('users')) {
                return response()->json([
                    'status' => 'already_initialized',
                    'message' => 'Database schema already initialized. Destructive operations blocked.',
                    'migrations_table' => true,
                    'sessions_table' => true,
                    'users_table' => true,
                ], 200);
            }
        } catch (Throwable $e) {
            // If schema inspection fails, continue to migration attempt
            Log::warning('NeonInit schema inspection warning: ' . $e->getMessage());
        }

        try {
            // 4. Execute existing migrations programmatically using Artisan::call('migrate', ['--force' => true])
            $migrateExitCode = Artisan::call('migrate', [
                '--force' => true,
            ]);
            $migrateOutput = Artisan::output();

            if ($migrateExitCode !== 0) {
                Log::error('NeonInit migration error: ' . $migrateOutput);
                return response()->json([
                    'status' => 'error',
                    'step' => 'migration',
                    'message' => 'Migration execution failed.',
                ], 500);
            }

            // 5. Execute existing DatabaseSeeder programmatically using Artisan::call('db:seed', ['--force' => true])
            $seedExitCode = Artisan::call('db:seed', [
                '--force' => true,
            ]);
            $seedOutput = Artisan::output();

            if ($seedExitCode !== 0) {
                Log::error('NeonInit seeding error: ' . $seedOutput);
                return response()->json([
                    'status' => 'error',
                    'step' => 'seeding',
                    'message' => 'Database seeding failed.',
                ], 500);
            }

            // 6. Safe verification of core tables without exposing credentials or secrets
            $tablesVerified = [
                'migrations' => Schema::hasTable('migrations'),
                'sessions' => Schema::hasTable('sessions'),
                'cache' => Schema::hasTable('cache'),
                'users' => Schema::hasTable('users'),
                'wallets' => Schema::hasTable('wallets'),
                'transactions' => Schema::hasTable('transactions'),
                'payment_methods' => Schema::hasTable('payment_methods'),
                'settings' => Schema::hasTable('settings'),
            ];

            return response()->json([
                'status' => 'success',
                'message' => 'Neon PostgreSQL database initialized successfully.',
                'migration' => 'completed',
                'seeding' => 'completed',
                'tables' => $tablesVerified,
            ], 200);

        } catch (Throwable $e) {
            Log::error('NeonInit unexpected failure: ' . $e->getMessage(), [
                'exception' => get_class($e),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Initialization failed due to an internal error.',
            ], 500);
        }
    }
}
