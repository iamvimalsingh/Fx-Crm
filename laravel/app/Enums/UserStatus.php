<?php

namespace App\Enums;

enum UserStatus: string
{
    case ACTIVE = 'active';
    case DISABLED = 'disabled';
    case SUSPENDED = 'suspended';
}
