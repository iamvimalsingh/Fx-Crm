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
        Schema::table('deposits', function (Blueprint $table) {
            if (!Schema::hasColumn('deposits', 'request_channel')) {
                $table->string('request_channel')->default('client_panel')->after('amount');
            }
            if (!Schema::hasColumn('deposits', 'credit_reason')) {
                $table->string('credit_reason')->default('deposit')->after('request_channel');
            }
            if (!Schema::hasColumn('deposits', 'source_reference')) {
                $table->string('source_reference')->nullable()->after('credit_reason');
            }
            if (!Schema::hasColumn('deposits', 'client_notes')) {
                $table->text('client_notes')->nullable()->after('source_reference');
            }
            if (!Schema::hasColumn('deposits', 'admin_notes')) {
                $table->text('admin_notes')->nullable()->after('client_notes');
            }
            if (!Schema::hasColumn('deposits', 'requested_by_user_id')) {
                $table->foreignId('requested_by_user_id')->nullable()->after('admin_notes')->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('deposits', 'approved_by_user_id')) {
                $table->foreignId('approved_by_user_id')->nullable()->after('requested_by_user_id')->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('deposits', 'status')) {
                $table->string('status')->default('pending')->after('approved_by_user_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deposits', function (Blueprint $table) {
            $columns = [
                'request_channel',
                'credit_reason',
                'source_reference',
                'client_notes',
                'admin_notes',
                'requested_by_user_id',
                'approved_by_user_id',
                'status',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('deposits', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
