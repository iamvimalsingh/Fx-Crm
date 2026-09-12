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
        Schema::create('trading_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('platform_name', 64);
            $table->string('server_name', 64);
            $table->string('login_id', 64);
            $table->string('account_type', 64);
            $table->string('currency', 3)->default('USD');
            $table->string('leverage', 16);
            $table->enum('status', ['active', 'suspended', 'disabled'])->default('active');
            $table->timestamps();

            // Composite uniqueness constraint on platform_name + server_name + login_id
            $table->unique(['platform_name', 'server_name', 'login_id'], 'unique_platform_server_login');

            // Indexes
            $table->index('user_id');
            $table->index('platform_name');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trading_accounts');
    }
};
