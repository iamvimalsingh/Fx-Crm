<?php

namespace App\Services\Trading;

use App\Contracts\TradingPlatformAdapterInterface;
use App\Models\TradingAccountRequest;

class ManualTradingAdapter implements TradingPlatformAdapterInterface
{
    public function isManual(): bool
    {
        return true;
    }

    public function getProviderName(): string
    {
        return 'Manual Broker Administration';
    }

    /**
     * Process trading account creation request.
     * Does NOT create, edit, or persist Eloquent models.
     * Makes NO external API/HTTP calls.
     */
    public function processAccountCreation(TradingAccountRequest $request): array
    {
        return [
            'success' => true,
            'mode' => 'manual',
            'provider' => $this->getProviderName(),
            'message' => 'Trading account request logged for manual administrator provisioning.',
        ];
    }
}
