<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'instructions',
        'min_amount',
        'max_amount',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'min_amount' => 'string',
        'max_amount' => 'string',
    ];

    /**
     * Zero-float formatted minimum amount accessor.
     */
    public function getFormattedMinAmountAttribute(): string
    {
        return \App\Services\Financial\MoneyFormatter::format($this->min_amount);
    }

    /**
     * Zero-float formatted maximum amount accessor.
     */
    public function getFormattedMaxAmountAttribute(): string
    {
        return \App\Services\Financial\MoneyFormatter::format($this->max_amount);
    }
}
