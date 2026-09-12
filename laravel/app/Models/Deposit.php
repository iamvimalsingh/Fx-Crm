<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deposit extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'transaction_id',
        'payment_method_id',
        'amount',
        'request_channel',
        'credit_reason',
        'source_reference',
        'client_notes',
        'admin_notes',
        'requested_by_user_id',
        'approved_by_user_id',
        'status',
        'proof_path',
    ];

    protected $hidden = [
        'admin_notes',
    ];

    protected $casts = [
        'amount' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function requestedByUser(): BelongsTo
    {
        return $this->requestedBy();
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->approvedBy();
    }

    /**
     * Zero-float formatted monetary amount accessor.
     */
    public function getFormattedAmountAttribute(): string
    {
        return \App\Services\Financial\MoneyFormatter::format($this->amount);
    }
}
