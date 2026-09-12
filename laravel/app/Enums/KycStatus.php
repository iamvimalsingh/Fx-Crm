<?php

namespace App\Enums;

enum KycStatus: string
{
    case NOT_SUBMITTED = 'not_submitted';
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';
}
