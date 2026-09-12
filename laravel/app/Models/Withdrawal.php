<?php

namespace App\Models;

use App\Services\Financial\MoneyFormatter;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Withdrawal extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'transaction_id',
        'refund_transaction_id',
        'amount',
        'withdrawal_method',
        'destination_details',
        'client_notes',
        'admin_notes',
        'requested_by_user_id',
        'processed_by_user_id',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    /**
     * Hide admin notes from serialization in client contexts.
     */
    protected $hidden = [
        'admin_notes',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function refundTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'refund_transaction_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }

    /**
     * Safely format monetary amount with zero float.
     */
    public function getFormattedAmountAttribute(): string
    {
        return MoneyFormatter::format($this->amount);
    }
}
