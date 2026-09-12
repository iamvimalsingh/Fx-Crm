<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'email',
        'password',
        'role',
        'status',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'role' => UserRole::class,
        'status' => UserStatus::class,
    ];

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function kycProfile(): HasOne
    {
        return $this->hasOne(KycProfile::class);
    }

    public function kycDocuments(): HasMany
    {
        return $this->hasMany(KycDocument::class);
    }

    public function tradingAccounts(): HasMany
    {
        return $this->hasMany(TradingAccount::class);
    }

    public function tradingAccountRequests(): HasMany
    {
        return $this->hasMany(TradingAccountRequest::class);
    }

    public function tradingPasswordResetRequests(): HasMany
    {
        return $this->hasMany(TradingPasswordResetRequest::class);
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(Deposit::class);
    }

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class);
    }

    public function tradingAccountFundingRequests(): HasMany
    {
        return $this->hasMany(TradingAccountFundingRequest::class);
    }

    public function requestedDeposits(): HasMany
    {
        return $this->hasMany(Deposit::class, 'requested_by_user_id');
    }

    public function approvedDeposits(): HasMany
    {
        return $this->hasMany(Deposit::class, 'approved_by_user_id');
    }

    public function tradingAccountReturnRequests(): HasMany
    {
        return $this->hasMany(TradingAccountReturnRequest::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class, 'user_id');
    }

    public function assignedSupportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class, 'assigned_to_user_id');
    }

    public function isAdmin(): bool
    {
        $role = $this->role instanceof UserRole ? $this->role->value : $this->role;
        return in_array($role, [UserRole::ADMIN->value, UserRole::SUPER_ADMIN->value], true);
    }

    public function isClient(): bool
    {
        $role = $this->role instanceof UserRole ? $this->role->value : $this->role;
        return $role === UserRole::CLIENT->value;
    }

    public function getNameAttribute(): string
    {
        if ($this->relationLoaded('profile') && $this->profile && ($this->profile->first_name || $this->profile->last_name)) {
            return trim("{$this->profile->first_name} {$this->profile->last_name}");
        }
        return explode('@', $this->email)[0] ?? 'User';
    }
}
