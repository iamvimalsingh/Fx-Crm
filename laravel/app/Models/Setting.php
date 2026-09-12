<?php

namespace App\Models;

use Exception;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
    ];

    /**
     * List of setting keys that must always be encrypted at rest.
     */
    protected static array $sensitiveKeys = [
        'TRADING_TEST_ACCOUNT_PASSWORD',
    ];

    /**
     * Check if a setting key is sensitive and must be encrypted.
     */
    public static function isSensitive(string $key): bool
    {
        return in_array($key, static::$sensitiveKeys, true);
    }

    /**
     * Determine if a stored string is legacy plaintext rather than an encrypted payload structure.
     */
    public static function isLegacyPlaintextPayload(string $value): bool
    {
        if ($value === '') {
            return false;
        }

        // Try decoding as base64
        $b64Decoded = base64_decode($value, true);
        if ($b64Decoded === false) {
            // Not valid base64, so it is legacy plaintext
            return true;
        }

        // Check if decoded base64 is a JSON structure containing encrypted payload signature
        $json = json_decode($b64Decoded, true);
        if (is_array($json) && isset($json['iv'], $json['value'], $json['mac'])) {
            // Matches encrypted payload structure, so it is an encrypted payload (or corrupt ciphertext)
            return false;
        }

        // Otherwise it is legacy plaintext
        return true;
    }

    /**
     * Get a setting by key with a default fallback.
     * Automatically decrypts if the key is designated as sensitive.
     * NEVER returns raw database value for sensitive keys if decryption/migration fails.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();
        if (!$setting || $setting->value === null) {
            return $default;
        }

        if (static::isSensitive($key)) {
            if ($setting->value === '') {
                return $default;
            }

            try {
                return Crypt::decryptString($setting->value);
            } catch (\Throwable $e) {
                // If it is legacy plaintext, securely auto-migrate to encrypted ciphertext
                if (static::isLegacyPlaintextPayload($setting->value)) {
                    try {
                        $plain = $setting->value;
                        $encrypted = Crypt::encryptString($plain);
                        $setting->update(['value' => $encrypted]);
                        return Crypt::decryptString($encrypted);
                    } catch (\Throwable $ex) {
                        return $default;
                    }
                }

                // If corrupted or invalid ciphertext, NEVER expose raw value
                return $default;
            }
        }

        return $setting->value;
    }

    /**
     * Get the raw database value of a setting without decryption.
     */
    public static function getRaw(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();
        return $setting ? $setting->value : $default;
    }

    /**
     * Get and decrypt an encrypted setting explicitly.
     * NEVER returns raw database content on decrypt failure.
     */
    public static function getEncrypted(string $key, mixed $default = null): ?string
    {
        return static::get($key, $default);
    }

    /**
     * Migrate all sensitive settings stored in legacy plaintext into encrypted ciphertext.
     */
    public static function migrateLegacySensitiveSettings(): int
    {
        $migrated = 0;
        foreach (static::$sensitiveKeys as $key) {
            $setting = static::where('key', $key)->first();
            if ($setting && $setting->value !== null && $setting->value !== '') {
                $isEncrypted = false;
                try {
                    Crypt::decryptString($setting->value);
                    $isEncrypted = true;
                } catch (\Throwable $e) {
                    $isEncrypted = false;
                }

                if (!$isEncrypted && static::isLegacyPlaintextPayload($setting->value)) {
                    $setting->update(['value' => Crypt::encryptString($setting->value)]);
                    $migrated++;
                }
            }
        }
        return $migrated;
    }

    /**
     * Set/update a setting by key.
     * Automatically encrypts the value at rest if designated as sensitive.
     */
    public static function set(string $key, mixed $value): static
    {
        $valStr = is_bool($value) ? ($value ? '1' : '0') : (string) $value;

        if (static::isSensitive($key) && $valStr !== '') {
            $valStr = Crypt::encryptString($valStr);
        }

        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $valStr]
        );
    }

    /**
     * Explicitly set an encrypted setting.
     */
    public static function setEncrypted(string $key, string $value): static
    {
        return static::updateOrCreate(
            ['key' => $key],
            ['value' => Crypt::encryptString($value)]
        );
    }

    /**
     * Get all settings as key-value associative array.
     * Sensitive keys are masked to prevent accidental leakage in views or logs.
     */
    public static function allMap(): array
    {
        $all = static::pluck('value', 'key')->toArray();
        foreach (static::$sensitiveKeys as $sensitiveKey) {
            if (isset($all[$sensitiveKey])) {
                $all[$sensitiveKey] = '••••••••';
            }
        }
        return $all;
    }
}

