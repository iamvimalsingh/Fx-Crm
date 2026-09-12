<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TradingAccountFundingRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'trading_account_id',
        'transaction_id',
        'amount',
        'currency',
        'status',
        'notes',
        'admin_notes',
        'processed_by_user_id',
        'processed_at',
    ];

    protected $casts = [
        'amount' => 'string',
        'processed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tradingAccount(): BelongsTo
    {
        return $this->belongsTo(TradingAccount::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }
}
