<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TradingAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'platform_name',
        'server_name',
        'login_id',
        'account_type',
        'currency',
        'leverage',
        'status',
        'trading_password',
    ];

    protected $casts = [
        'trading_password' => 'encrypted',
    ];

    protected $hidden = [
        'trading_password',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(TradingAccountRequest::class);
    }

    public function passwordResetRequests(): HasMany
    {
        return $this->hasMany(TradingPasswordResetRequest::class);
    }

    public function fundingRequests(): HasMany
    {
        return $this->hasMany(TradingAccountFundingRequest::class);
    }

    public function returnRequests(): HasMany
    {
        return $this->hasMany(TradingAccountReturnRequest::class);
    }
}
