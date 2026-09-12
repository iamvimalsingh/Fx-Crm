<?php

namespace App\Services\Notification;

use App\Models\User;
use App\Notifications\AppNotification;

class NotificationService
{
    /**
     * Send an in-app database notification to a user.
     */
    public static function notify(
        User $user,
        string $title,
        string $message,
        string $type = 'info',
        ?string $actionUrl = null
    ): void {
        $user->notify(new AppNotification($title, $message, $type, $actionUrl));
    }
}
