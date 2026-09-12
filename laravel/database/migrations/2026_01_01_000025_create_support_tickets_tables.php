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
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 64)->unique()->index();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject', 255);
            $table->string('category', 64)->index();
            $table->string('priority', 32)->default('normal')->index(); // low, normal, high
            $table->string('status', 32)->default('open')->index();     // open, pending, resolved, closed
            $table->string('linked_record_type', 64)->nullable();
            $table->unsignedBigInteger('linked_record_id')->nullable();
            $table->timestamp('last_reply_at')->nullable()->index();
            $table->string('last_reply_by_role', 32)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['status', 'priority']);
            $table->index(['category', 'status']);
            $table->index(['linked_record_type', 'linked_record_id']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('sender_role', 32); // client, admin
            $table->boolean('is_internal_note')->default(false)->index();
            $table->text('message');
            $table->timestamps();

            $table->index(['ticket_id', 'is_internal_note']);
            $table->index(['ticket_id', 'created_at']);
        });

        Schema::create('support_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('message_id')->constrained('support_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('disk', 32)->default('local');
            $table->string('file_path', 512);
            $table->string('file_name', 255);
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('file_size');
            $table->timestamps();

            $table->index(['ticket_id']);
            $table->index(['message_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('support_attachments');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
    }
};
