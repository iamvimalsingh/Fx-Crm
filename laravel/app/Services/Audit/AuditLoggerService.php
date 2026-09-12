<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;

class AuditLoggerService
{
    public static function log(
        string $action,
        ?User $user = null,
        ?string $targetType = null,
        ?int $targetId = null,
        ?string $description = null
    ): AuditLog {
        return AuditLog::create([
            'user_id' => $user?->id ?? auth()->id(),
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'description' => $description,
        ]);
    }
}
