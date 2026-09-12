<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'amount',
        'currency',
        'status',
        'reference_id',
        'description',
    ];

    protected $casts = [
        'type' => TransactionType::class,
        'status' => TransactionStatus::class,
        'amount' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function withdrawal(): HasOne
    {
        return $this->hasOne(Withdrawal::class);
    }

    /**
     * Scope for completed transactions
     */
    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', TransactionStatus::COMPLETED->value);
    }

    /**
     * Scope for pending transactions
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', TransactionStatus::PENDING->value);
    }

    /**
     * Scope for deposit/credit transactions
     */
    public function scopeDeposits(Builder $query): Builder
    {
        return $query->whereIn('type', [
            TransactionType::DEPOSIT->value,
            TransactionType::MANUAL_CREDIT->value,
        ]);
    }

    /**
     * Scope for withdrawal/debit transactions
     */
    public function scopeWithdrawals(Builder $query): Builder
    {
        return $query->whereIn('type', [
            TransactionType::WITHDRAWAL->value,
            TransactionType::MANUAL_DEBIT->value,
        ]);
    }

    /**
     * Zero-float formatted monetary amount accessor.
     */
    public function getFormattedAmountAttribute(): string
    {
        return \App\Services\Financial\MoneyFormatter::format($this->amount);
    }
}
