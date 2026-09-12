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
        if (!Schema::hasTable('trading_account_return_requests')) {
            Schema::create('trading_account_return_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('trading_account_id')->constrained()->cascadeOnDelete();
                $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
                $table->decimal('amount', 15, 2);
                $table->string('currency', 3)->default('USD');
                $table->enum('status', ['pending', 'completed', 'rejected', 'cancelled'])->default('pending');
                $table->text('notes')->nullable();
                $table->text('admin_notes')->nullable();
                $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'status']);
                $table->index(['trading_account_id', 'status']);
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
        Schema::dropIfExists('trading_account_return_requests');
    }
};
