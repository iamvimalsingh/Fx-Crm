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
        if (!Schema::hasTable('trading_account_funding_requests')) {
            Schema::create('trading_account_funding_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('trading_account_id')->constrained('trading_accounts')->onDelete('cascade');
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->onDelete('set null');
                $table->decimal('amount', 15, 2);
                $table->string('currency', 3)->default('USD');
                $table->enum('status', ['pending', 'completed', 'rejected', 'cancelled'])->default('pending');
                $table->text('notes')->nullable();
                $table->text('admin_notes')->nullable();
                $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();

                // Indexes
                $table->index('user_id');
                $table->index('trading_account_id');
                $table->index('status');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trading_account_funding_requests');
    }
};
