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
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->onDelete('set null');
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->onDelete('set null');
            $table->decimal('amount', 15, 2);
            $table->string('request_channel')->default('client_panel'); // client_panel, phone, whatsapp, admin
            $table->string('credit_reason')->default('deposit'); // deposit, bonus, manual_credit
            $table->string('source_reference')->nullable();
            $table->text('client_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('status')->default('pending'); // pending, completed, rejected, cancelled
            $table->string('proof_path')->nullable();
            $table->timestamps();

            // Indexes
            $table->index(['user_id', 'status']);
            $table->index('transaction_id');
            $table->index('payment_method_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deposits');
    }
};
