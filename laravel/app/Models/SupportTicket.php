<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'user_id',
        'assigned_to_user_id',
        'subject',
        'category',
        'priority',
        'status',
        'linked_record_type',
        'linked_record_id',
        'last_reply_at',
        'last_reply_by_role',
        'resolved_at',
        'closed_at',
    ];

    protected $casts = [
        'last_reply_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public const CATEGORIES = [
        'Deposit',
        'Withdrawal',
        'Trading Account',
        'Trading Funding',
        'Trading Password',
        'KYC',
        'Technical',
        'General',
    ];

    public const PRIORITIES = [
        'low' => 'Low',
        'normal' => 'Normal',
        'high' => 'High',
    ];

    public const STATUSES = [
        'open' => 'Open',
        'pending' => 'Pending',
        'resolved' => 'Resolved',
        'closed' => 'Closed',
    ];

    public const LINKED_TYPES = [
        'deposit' => 'Deposit Request',
        'withdrawal' => 'Withdrawal Request',
        'trading_account' => 'Trading Account',
        'trading_account_request' => 'Trading Account Request',
        'trading_password_reset' => 'Trading Password Reset',
        'trading_funding_request' => 'Trading Funding Request',
        'kyc' => 'KYC Profile',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id')->orderBy('created_at', 'asc');
    }

    public function clientVisibleMessages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id')
            ->where('is_internal_note', false)
            ->orderBy('created_at', 'asc');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SupportAttachment::class, 'ticket_id');
    }

    /**
     * Resolve the linked CRM record safely ensuring user authorization.
     */
    public function getLinkedRecordAttribute(): mixed
    {
        if (!$this->linked_record_type || !$this->linked_record_id) {
            return null;
        }

        return match ($this->linked_record_type) {
            'deposit' => Deposit::where('user_id', $this->user_id)->find($this->linked_record_id),
            'withdrawal' => Withdrawal::where('user_id', $this->user_id)->find($this->linked_record_id),
            'trading_account' => TradingAccount::where('user_id', $this->user_id)->find($this->linked_record_id),
            'trading_account_request' => TradingAccountRequest::where('user_id', $this->user_id)->find($this->linked_record_id),
            'trading_password_reset' => TradingPasswordResetRequest::where('user_id', $this->user_id)->find($this->linked_record_id),
            'trading_funding_request' => TradingAccountFundingRequest::where('user_id', $this->user_id)->find($this->linked_record_id),
            'kyc' => KycProfile::where('user_id', $this->user_id)->find($this->linked_record_id),
            default => null,
        };
    }

    /**
     * Safely format any status (scalar or BackedEnum) for display.
     */
    public static function formatStatusLabel(mixed $status): string
    {
        if ($status === null) {
            return 'None';
        }
        $val = $status instanceof \BackedEnum ? $status->value : (string) $status;
        return ucfirst(str_replace('_', ' ', $val));
    }

    /**
     * Descriptive label for the linked record.
     */
    public function getLinkedRecordLabelAttribute(): ?string
    {
        $record = $this->linked_record;
        if (!$record) {
            return null;
        }

        return match ($this->linked_record_type) {
            'deposit' => "Deposit #{$record->id} ({$record->currency} \${$record->amount})",
            'withdrawal' => "Withdrawal #{$record->id} ({$record->currency} \${$record->amount})",
            'trading_account' => "Trading Account #{$record->login_id} ({$record->platform_name})",
            'trading_account_request' => "Account Request #{$record->id} ({$record->platform_name} {$record->account_type})",
            'trading_password_reset' => "Password Reset #{$record->id} (Account {$record->tradingAccount?->login_id})",
            'trading_funding_request' => "Funding Request #{$record->id} (\${$record->amount})",
            'kyc' => "KYC Profile (Status: " . static::formatStatusLabel($record->status) . ")",
            default => null,
        };
    }

    public function getStatusBadgeAttribute(): string
    {
        return match ($this->status) {
            'open' => 'badge bg-primary',
            'pending' => 'badge bg-warning text-dark',
            'resolved' => 'badge bg-success',
            'closed' => 'badge bg-secondary',
            default => 'badge bg-secondary',
        };
    }

    public function getPriorityBadgeAttribute(): string
    {
        return match ($this->priority) {
            'high' => 'badge bg-danger',
            'normal' => 'badge bg-info text-dark',
            'low' => 'badge bg-secondary',
            default => 'badge bg-secondary',
        };
    }

    public static function generateTicketNumber(): string
    {
        $year = date('Y');
        $random = strtoupper(substr(uniqid(), -4));
        $count = static::whereYear('created_at', $year)->count() + 1;
        return sprintf('TKT-%s-%04d-%s', $year, $count, $random);
    }
}
