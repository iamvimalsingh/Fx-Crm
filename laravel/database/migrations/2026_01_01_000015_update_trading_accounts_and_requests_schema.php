<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('trading_accounts')) {
            Schema::table('trading_accounts', function (Blueprint $table) {
                if (Schema::hasColumn('trading_accounts', 'platform') && !Schema::hasColumn('trading_accounts', 'platform_name')) {
                    $table->renameColumn('platform', 'platform_name');
                }
                if (Schema::hasColumn('trading_accounts', 'server') && !Schema::hasColumn('trading_accounts', 'server_name')) {
                    $table->renameColumn('server', 'server_name');
                }
            });

            // Drop old unique constraint on login_id if it exists
            try {
                Schema::table('trading_accounts', function (Blueprint $table) {
                    $table->dropUnique('trading_accounts_login_id_unique');
                });
            } catch (\Throwable $e) {
                // Ignore if constraint name differs or does not exist
            }

            // Add composite unique index if not present
            try {
                Schema::table('trading_accounts', function (Blueprint $table) {
                    $table->unique(['platform_name', 'server_name', 'login_id'], 'unique_platform_server_login');
                });
            } catch (\Throwable $e) {
                // Ignore if unique index already exists
            }
        }

        if (Schema::hasTable('trading_account_requests')) {
            Schema::table('trading_account_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('trading_account_requests', 'trading_account_id')) {
                    $table->foreignId('trading_account_id')->nullable()->after('user_id')->constrained('trading_accounts')->nullOnDelete();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('trading_account_requests')) {
            Schema::table('trading_account_requests', function (Blueprint $table) {
                if (Schema::hasColumn('trading_account_requests', 'trading_account_id')) {
                    $table->dropForeign(['trading_account_id']);
                    $table->dropColumn('trading_account_id');
                }
            });
        }

        if (Schema::hasTable('trading_accounts')) {
            Schema::table('trading_accounts', function (Blueprint $table) {
                try {
                    $table->dropUnique('unique_platform_server_login');
                } catch (\Throwable $e) {
                    // Ignore
                }
            });
        }
    }
};
