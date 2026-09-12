<?php

namespace App\Exceptions;

use Exception;

class InsufficientFundsException extends Exception
{
    public function __construct(string $message = 'Insufficient available balance to complete this transaction.', int $code = 400, ?Exception $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
