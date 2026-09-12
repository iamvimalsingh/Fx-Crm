<?php

namespace App\Services\Trading;

use App\Enums\TransactionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Setting;
use App\Models\TradingAccount;
use App\Models\TradingAccountReturnRequest;
use App\Models\User;
use App\Services\Audit\AuditLoggerService;
use App\Services\Financial\MoneyFormatter;
use App\Services\Financial\WalletService;
use App\Services\Notification\NotificationService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class TradingReturnService
{
    public function __construct(
        protected WalletService $walletService
    ) {}

    /**
     * Client requests a return transfer from their external trading account to their CRM wallet.
     */
    public function createRequest(
        User $user,
        TradingAccount $account,
        mixed $amount,
        ?string $notes = null
    ): TradingAccountReturnRequest {
        // Check if feature enabled in settings
        $enabled = Setting::get('TRADING_TO_WALLET_ENABLED', '1');
        if ($enabled === '0' || $enabled === false || $enabled === 'false') {
            throw new InvalidArgumentException('Trading account to CRM wallet transfers are currently disabled by administration.');
        }

        $roleVal = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;
        $statusVal = $user->status instanceof UserStatus ? $user->status->value : (string) $user->status;

        if ($roleVal !== 'client' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active clients can request trading returns.');
        }

        if ($account->user_id !== $user->id) {
            throw new InvalidArgumentException('Trading account does not belong to the requesting client.');
        }

        if ($account->status !== 'active') {
            throw new InvalidArgumentException('Returns are only permitted for active trading accounts.');
        }

        $normalizedAmount = $this->walletService->normalizeAmount($amount);

        if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
            throw new InvalidArgumentException('Transfer amount must be greater than zero.');
        }

        $minAmount = Setting::get('TRADING_TO_WALLET_MIN_AMOUNT', '10.00');
        if ($this->walletService->compare($normalizedAmount, $minAmount) < 0) {
            throw new InvalidArgumentException("Transfer amount must be at least \${$minAmount}.");
        }

        $maxAmount = Setting::get('TRADING_TO_WALLET_MAX_AMOUNT', '50000.00');
        if ($this->walletService->compare($normalizedAmount, $maxAmount) > 0) {
            throw new InvalidArgumentException("Transfer amount cannot exceed \${$maxAmount}.");
        }

        return DB::transaction(function () use ($user, $account, $normalizedAmount, $notes) {
            $returnRequest = TradingAccountReturnRequest::create([
                'user_id' => $user->id,
                'trading_account_id' => $account->id,
                'transaction_id' => null,
                'amount' => $normalizedAmount,
                'currency' => config('broker.base_currency', 'USD'),
                'status' => 'pending',
                'notes' => $notes,
            ]);

            AuditLoggerService::log(
                'trading_return_requested',
                $user,
                TradingAccountReturnRequest::class,
                $returnRequest->id,
                "Client requested trading return of \${$normalizedAmount} from account #{$account->login_id} to CRM wallet"
            );

            NotificationService::notify(
                $user,
                'Trading Return Requested',
                "Your request to transfer \${$normalizedAmount} from trading account #{$account->login_id} to your CRM wallet has been received and is pending review.",
                'trading_return_requested',
                route('client.trading-accounts.index')
            );

            return $returnRequest->load(['tradingAccount', 'user']);
        });
    }

    /**
     * Admin completes the trading return after confirming deduction on external platform.
     * Credits the client's CRM wallet atomically.
     */
    public function complete(
        TradingAccountReturnRequest $returnRequest,
        User $admin,
        ?string $adminNotes = null
    ): TradingAccountReturnRequest {
        $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
        $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

        if ($roleVal !== 'admin' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active administrators can complete return requests.');
        }

        return DB::transaction(function () use ($returnRequest, $admin, $adminNotes) {
            $locked = TradingAccountReturnRequest::where('id', $returnRequest->id)
                ->lockForUpdate()
                ->first();

            if (!$locked) {
                throw new InvalidArgumentException('Return request record not found.');
            }

            if ($locked->status !== 'pending') {
                throw new LogicException('Return request is not pending or has already been processed.');
            }

            $client = $locked->user;
            $account = $locked->tradingAccount;

            // Credit CRM wallet
            $formattedAmount = MoneyFormatter::format($locked->amount);
            $description = "Trading return from {$account->platform_name} (#{$account->login_id})";

            $transaction = $this->walletService->credit(
                $client,
                $locked->amount,
                TransactionType::MANUAL_CREDIT,
                $description
            );

            $locked->update([
                'transaction_id' => $transaction->id,
                'status' => 'completed',
                'admin_notes' => $adminNotes,
                'processed_by_user_id' => $admin->id,
                'processed_at' => now(),
            ]);

            AuditLoggerService::log(
                'trading_return_completed',
                $admin,
                TradingAccountReturnRequest::class,
                $locked->id,
                "Admin confirmed return of \${$formattedAmount} from trading account #{$account->login_id} to user #{$client->id} CRM wallet"
            );

            NotificationService::notify(
                $client,
                'Trading Return Completed',
                "Your transfer request #{$locked->id} for \${$formattedAmount} from trading account #{$account->login_id} has been credited to your CRM wallet.",
                'trading_return_completed',
                route('client.wallet')
            );

            return $locked->fresh(['tradingAccount', 'transaction', 'user', 'processor']);
        });
    }

    /**
     * Admin rejects the trading return request.
     */
    public function reject(
        TradingAccountReturnRequest $returnRequest,
        User $admin,
        string $rejectionReason
    ): TradingAccountReturnRequest {
        $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
        $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

        if ($roleVal !== 'admin' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active administrators can reject return requests.');
        }

        if (trim($rejectionReason) === '') {
            throw new InvalidArgumentException('Rejection reason is required.');
        }

        return DB::transaction(function () use ($returnRequest, $admin, $rejectionReason) {
            $locked = TradingAccountReturnRequest::where('id', $returnRequest->id)
                ->lockForUpdate()
                ->first();

            if (!$locked) {
                throw new InvalidArgumentException('Return request record not found.');
            }

            if ($locked->status !== 'pending') {
                throw new LogicException('Return request is not pending or has already been processed.');
            }

            $locked->update([
                'status' => 'rejected',
                'admin_notes' => $rejectionReason,
                'processed_by_user_id' => $admin->id,
                'processed_at' => now(),
            ]);

            AuditLoggerService::log(
                'trading_return_rejected',
                $admin,
                TradingAccountReturnRequest::class,
                $locked->id,
                "Admin rejected return request #{$locked->id} for account #{$locked->tradingAccount?->login_id}: {$rejectionReason}"
            );

            NotificationService::notify(
                $locked->user,
                'Trading Return Rejected',
                "Your transfer request #{$locked->id} for trading account #{$locked->tradingAccount?->login_id} was rejected. Reason: {$rejectionReason}",
                'trading_return_rejected',
                route('client.trading-accounts.index')
            );

            return $locked->fresh(['tradingAccount', 'user', 'processor']);
        });
    }

    /**
     * Client cancels their own pending return request.
     */
    public function cancel(
        TradingAccountReturnRequest $returnRequest,
        User $client,
        ?string $reason = null
    ): TradingAccountReturnRequest {
        if ($returnRequest->user_id !== $client->id) {
            throw new InvalidArgumentException('Unauthorized: You can only cancel your own return requests.');
        }

        return DB::transaction(function () use ($returnRequest, $client, $reason) {
            $locked = TradingAccountReturnRequest::where('id', $returnRequest->id)
                ->lockForUpdate()
                ->first();

            if (!$locked) {
                throw new InvalidArgumentException('Return request record not found.');
            }

            if ($locked->status !== 'pending') {
                throw new LogicException('Only pending return requests can be cancelled.');
            }

            $locked->update([
                'status' => 'cancelled',
                'admin_notes' => $reason ? "Cancelled by client: {$reason}" : 'Cancelled by client',
                'processed_at' => now(),
            ]);

            AuditLoggerService::log(
                'trading_return_cancelled',
                $client,
                TradingAccountReturnRequest::class,
                $locked->id,
                "Client cancelled trading return request #{$locked->id}"
            );

            return $locked->fresh(['tradingAccount', 'user']);
        });
    }
}
