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
        Schema::table('withdrawals', function (Blueprint $table) {
            if (!Schema::hasColumn('withdrawals', 'refund_transaction_id')) {
                $table->foreignId('refund_transaction_id')->nullable()->after('transaction_id')->constrained('transactions')->nullOnDelete();
            }

            if (!Schema::hasColumn('withdrawals', 'client_notes')) {
                if (Schema::hasColumn('withdrawals', 'notes')) {
                    $table->renameColumn('notes', 'client_notes');
                } else {
                    $table->text('client_notes')->nullable()->after('destination_details');
                }
            }

            if (!Schema::hasColumn('withdrawals', 'admin_notes')) {
                $table->text('admin_notes')->nullable()->after('client_notes');
            }

            if (!Schema::hasColumn('withdrawals', 'requested_by_user_id')) {
                $table->foreignId('requested_by_user_id')->nullable()->after('admin_notes')->constrained('users')->nullOnDelete();
            }

            if (!Schema::hasColumn('withdrawals', 'processed_by_user_id')) {
                $table->foreignId('processed_by_user_id')->nullable()->after('requested_by_user_id')->constrained('users')->nullOnDelete();
            }

            if (!Schema::hasColumn('withdrawals', 'status')) {
                $table->string('status')->default('pending')->after('processed_by_user_id');
            }

            // Indexes
            if (!Schema::hasIndex('withdrawals', ['user_id', 'status'])) {
                $table->index(['user_id', 'status']);
            }
            if (!Schema::hasIndex('withdrawals', 'withdrawals_refund_transaction_id_index') && !Schema::hasIndex('withdrawals', ['refund_transaction_id'])) {
                $table->index('refund_transaction_id');
            }
            if (!Schema::hasIndex('withdrawals', 'withdrawals_created_at_index') && !Schema::hasIndex('withdrawals', ['created_at'])) {
                $table->index('created_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            if (Schema::hasIndex('withdrawals', ['user_id', 'status'])) {
                $table->dropIndex(['user_id', 'status']);
            }
            if (Schema::hasIndex('withdrawals', 'withdrawals_refund_transaction_id_index') || Schema::hasIndex('withdrawals', ['refund_transaction_id'])) {
                $table->dropIndex(['refund_transaction_id']);
            }

            if (Schema::hasColumn('withdrawals', 'refund_transaction_id')) {
                $table->dropConstrainedForeignId('refund_transaction_id');
            }
            if (Schema::hasColumn('withdrawals', 'requested_by_user_id')) {
                $table->dropConstrainedForeignId('requested_by_user_id');
            }
            if (Schema::hasColumn('withdrawals', 'processed_by_user_id')) {
                $table->dropConstrainedForeignId('processed_by_user_id');
            }
            if (Schema::hasColumn('withdrawals', 'admin_notes')) {
                $table->dropColumn('admin_notes');
            }
            if (Schema::hasColumn('withdrawals', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
