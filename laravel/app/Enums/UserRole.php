<?php

namespace App\Enums;

enum UserRole: string
{
    case CLIENT = 'client';
    case ADMIN = 'admin';
    case SUPER_ADMIN = 'super_admin';
}
