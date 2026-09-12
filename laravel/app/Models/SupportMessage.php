<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SupportMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_id',
        'user_id',
        'sender_role',
        'is_internal_note',
        'message',
    ];

    protected $casts = [
        'is_internal_note' => 'boolean',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SupportAttachment::class, 'message_id');
    }

    public function attachment(): HasOne
    {
        return $this->hasOne(SupportAttachment::class, 'message_id');
    }

    public function isFromClient(): bool
    {
        return $this->sender_role === 'client';
    }

    public function isFromAdmin(): bool
    {
        return $this->sender_role === 'admin';
    }
}
