<?php

namespace App\Contracts;

use App\Models\TradingAccountRequest;

interface TradingPlatformAdapterInterface
{
    public function isManual(): bool;

    public function getProviderName(): string;

    /**
     * Process trading account creation request.
     * In V1 Manual Adapter, makes no external API calls and returns manual queue acknowledgement.
     */
    public function processAccountCreation(TradingAccountRequest $request): array;
}
