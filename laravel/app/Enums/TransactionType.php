<?php

namespace App\Enums;

enum TransactionType: string
{
    case DEPOSIT = 'deposit';
    case WITHDRAWAL = 'withdrawal';
    case MANUAL_CREDIT = 'manual_credit';
    case MANUAL_DEBIT = 'manual_debit';
    case ADJUSTMENT = 'adjustment';
}
