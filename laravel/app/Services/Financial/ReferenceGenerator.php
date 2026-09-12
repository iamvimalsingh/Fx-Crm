<?php

namespace App\Services\Financial;

use Illuminate\Support\Str;

class ReferenceGenerator
{
    /**
     * Generate a collision-resistant, unique transaction reference.
     * Format: TXN-YYYYMMDD-XXXXXXXX (e.g., TXN-20260910-A1B2C3D4)
     */
    public static function generate(string $prefix = 'TXN'): string
    {
        $dateStr = date('Ymd');
        $randomHex = strtoupper(Str::random(8));

        return "{$prefix}-{$dateStr}-{$randomHex}";
    }
}
