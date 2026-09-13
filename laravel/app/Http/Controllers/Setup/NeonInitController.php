<?php

namespace App\Http\Controllers\Setup;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NeonInitController extends Controller
{
    /**
     * One-time secure initializer for fresh Neon PostgreSQL database on Vercel.
     * Operates purely statelessly without StartSession middleware dependency.
     */
    public function __invoke(Request $request): JsonResponse
    {
        // 1. Verify Secret Header
        $expectedSecret = env('NEON_INIT_SECRET');
        if (empty($expectedSecret) || strlen($expectedSecret) < 16) {
            return response()->json([
                'status' => 'error',
                'message' => 'NEON_INIT_SECRET environment variable is missing or insecure.',
            ], 500);
        }

        $authHeader = $request->header('Authorization', '');
        $token = '';
        if (str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
        } else {
            $token = $request->header('X-Neon-Init-Secret', '');
        }

        if (!hash_equals($expectedSecret, $token)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized initialization request.',
            ], 403);
        }

        // 2. Guard: Refuse if already initialized with existing core tables and admin users
        if (Schema::hasTable('users') && Schema::hasTable('sessions')) {
            $adminCount = DB::table('users')->where('role', 'admin')->count();
            if ($adminCount > 0) {
                return response()->json([
                    'status' => 'blocked',
                    'message' => 'Database is already initialized and active. This endpoint is locked.',
                ], 400);
            }
        }

        // 3. Step 1: Run Migrations
        $migrateExitCode = Artisan::call('migrate', ['--force' => true]);
        $migrateOutput = Artisan::output();

        if ($migrateExitCode !== 0) {
            return response()->json([
                'status' => 'error',
                'step' => 'migrate',
                'exit_code' => $migrateExitCode,
                'message' => 'Migration failed.',
                'output' => $migrateOutput,
            ], 500);
        }

        // 4. Step 2: Run Database Seeder
        $seedExitCode = Artisan::call('db:seed', ['--force' => true]);
        $seedOutput = Artisan::output();

        if ($seedExitCode !== 0) {
            return response()->json([
                'status' => 'error',
                'step' => 'seed',
                'exit_code' => $seedExitCode,
                'message' => 'Database seeding failed.',
                'output' => $seedOutput,
            ], 500);
        }

        // 5. Step 3: Create Initial Admin Account from Environment Variables
        $adminEmail = env('INITIAL_ADMIN_EMAIL', 'admin@broker.local');
        $adminPassword = env('INITIAL_ADMIN_PASSWORD');
        $adminFirstName = env('INITIAL_ADMIN_FIRST_NAME', 'System');
        $adminLastName = env('INITIAL_ADMIN_LAST_NAME', 'Administrator');

        if (empty($adminPassword)) {
            return response()->json([
                'status' => 'error',
                'step' => 'admin_creation',
                'message' => 'INITIAL_ADMIN_PASSWORD environment variable is required to create the administrator.',
            ], 400);
        }

        $adminExitCode = Artisan::call('crm:create-admin', [
            'email' => $adminEmail,
            '--password' => $adminPassword,
            '--first_name' => $adminFirstName,
            '--last_name' => $adminLastName,
        ]);
        $adminOutput = Artisan::output();

        if ($adminExitCode !== 0) {
            return response()->json([
                'status' => 'error',
                'step' => 'admin_creation',
                'exit_code' => $adminExitCode,
                'message' => 'Administrator provisioning failed.',
                'output' => $adminOutput,
            ], 500);
        }

        // 6. Verify core table existence
        $coreTables = [
            'sessions',
            'cache',
            'cache_locks',
            'users',
            'user_profiles',
            'wallets',
            'transactions',
            'payment_methods',
            'deposits',
            'withdrawals',
            'kyc_profiles',
            'kyc_documents',
            'trading_accounts',
            'trading_account_requests',
            'trading_password_reset_requests',
            'trading_account_funding_requests',
            'trading_account_return_requests',
            'support_tickets',
            'support_messages',
            'support_attachments',
            'audit_logs',
            'settings',
            'notifications',
        ];

        $tableStatus = [];
        $allPassed = true;
        foreach ($coreTables as $tableName) {
            $exists = Schema::hasTable($tableName);
            $tableStatus[$tableName] = $exists;
            if (!$exists) {
                $allPassed = false;
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Neon PostgreSQL database successfully initialized.',
            'schema_verified' => $allPassed,
            'tables_checked' => count($tableStatus),
            'admin_email_configured' => $adminEmail,
            'tables' => $tableStatus,
        ]);
    }
}
