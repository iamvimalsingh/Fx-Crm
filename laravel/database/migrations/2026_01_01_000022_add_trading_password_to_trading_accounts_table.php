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
                if (!Schema::hasColumn('trading_accounts', 'trading_password')) {
                    $table->text('trading_password')->nullable()->after('leverage');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('trading_accounts')) {
            Schema::table('trading_accounts', function (Blueprint $table) {
                if (Schema::hasColumn('trading_accounts', 'trading_password')) {
                    $table->dropColumn('trading_password');
                }
            });
        }
    }
};
