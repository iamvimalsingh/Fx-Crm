<?php

namespace App\Services\Financial;

class MoneyFormatter
{
    /**
     * Safely formats a monetary decimal value into a standard 2-decimal string
     * with comma thousands-separators, without casting to float or using float arithmetic.
     *
     * Examples:
     * - '1234567.89'       -> '1,234,567.89'
     * - '10'               -> '10.00'
     * - '0.00'             -> '0.00'
     * - '9999999999999.99' -> '9,999,999,999,999.99'
     * - '-1234.50'         -> '-1,234.50'
     */
    public static function format(mixed $amount, string $default = '0.00'): string
    {
        if ($amount === null || $amount === '') {
            return $default;
        }

        $str = trim((string) $amount);
        if ($str === '') {
            return $default;
        }

        $isNegative = str_starts_with($str, '-');
        if ($isNegative) {
            $str = substr($str, 1);
        }

        $parts = explode('.', $str, 2);
        $intPart = preg_replace('/\D/', '', $parts[0] !== '' ? $parts[0] : '0');
        if ($intPart === '') {
            $intPart = '0';
        }

        // Add thousands separators using string chunking (no float conversion)
        $len = strlen($intPart);
        if ($len > 3) {
            $remainder = $len % 3;
            $formattedInt = $remainder > 0 ? substr($intPart, 0, $remainder) . ',' : '';
            $formattedInt .= implode(',', str_split(substr($intPart, $remainder), 3));
        } else {
            $formattedInt = $intPart;
        }

        // Preserve exact 2 decimal places: up to 2 digits, padded with zeroes to guarantee 2 digits
        $decPart = isset($parts[1]) ? preg_replace('/\D/', '', $parts[1]) : '00';
        $decPart = str_pad(substr($decPart, 0, 2), 2, '0');

        return ($isNegative ? '-' : '') . $formattedInt . '.' . $decPart;
    }
}
