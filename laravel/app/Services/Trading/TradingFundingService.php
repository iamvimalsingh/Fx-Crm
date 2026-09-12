<?php

namespace App\Services\Trading;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\InsufficientFundsException;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use App\Services\Financial\ReferenceGenerator;
use App\Services\Financial\WalletService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class TradingFundingService
{
    public function __construct(
        protected WalletService $walletService
    ) {}

    /**
     * Client requests funding for their existing active trading account from CRM Wallet.
     * Atomically reserves (debits) the available CRM wallet balance immediately.
     */
    public function createRequest(
        User $user,
        TradingAccount $account,
        mixed $amount,
        ?string $notes = null
    ): TradingAccountFundingRequest {
        $roleVal = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;
        $statusVal = $user->status instanceof UserStatus ? $user->status->value : (string) $user->status;

        if ($roleVal !== 'client' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active clients can request trading account funding.');
        }

        if ($account->user_id !== $user->id) {
            throw new InvalidArgumentException('Trading account does not belong to the requesting client.');
        }

        if ($account->status !== 'active') {
            throw new InvalidArgumentException('Funding is only permitted for active trading accounts.');
        }

        $normalizedAmount = $this->walletService->normalizeAmount($amount);

        if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
            throw new InvalidArgumentException('Funding amount must be greater than zero.');
        }

        return DB::transaction(function () use ($user, $account, $normalizedAmount, $notes) {
            $wallet = Wallet::where('user_id', $user->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new InsufficientFundsException('Wallet not found.');
            }

            if ($this->walletService->compare($wallet->balance, $normalizedAmount) < 0) {
                throw new InsufficientFundsException('Insufficient wallet balance for trading account funding.');
            }

            // Immediately reserve funds from available balance
            $newBalance = $this->walletService->sub($wallet->balance, $normalizedAmount);
            $wallet->update(['balance' => $newBalance]);

            // Create pending transaction ledger entry
            $transaction = Transaction::create([
                'user_id' => $user->id,
                'type' => TransactionType::MANUAL_DEBIT->value,
                'amount' => $normalizedAmount,
                'currency' => $wallet->currency,
                'status' => TransactionStatus::PENDING->value,
                'reference_id' => ReferenceGenerator::generate('FND'),
                'description' => "Trading account funding request for {$account->platform_name} (#{$account->login_id})",
            ]);

            $funding = TradingAccountFundingRequest::create([
                'user_id' => $user->id,
                'trading_account_id' => $account->id,
                'transaction_id' => $transaction->id,
                'amount' => $normalizedAmount,
                'currency' => $wallet->currency,
                'status' => 'pending',
                'notes' => $notes,
            ]);

            AuditLoggerService::log(
                'trading_funding_requested',
                $user,
                TradingAccountFundingRequest::class,
                $funding->id,
                "Client requested trading funding of \${$normalizedAmount} for account #{$account->login_id}"
            );

            return $funding->load(['tradingAccount', 'transaction']);
        });
    }

    /**
     * Admin completes the trading account funding after manually adding the funds to the external platform.
     * Does NOT debit the wallet again.
     */
    public function complete(
        TradingAccountFundingRequest $funding,
        User $admin,
        ?string $adminNotes = null
    ): TradingAccountFundingRequest {
        $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
        $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

        if ($roleVal !== 'admin' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active administrators can complete funding requests.');
        }

        return DB::transaction(function () use ($funding, $admin, $adminNotes) {
            $lockedFunding = TradingAccountFundingRequest::where('id', $funding->id)->lockForUpdate()->first();

            if (!$lockedFunding) {
                throw new InvalidArgumentException('Funding record not found.');
            }

            if ($lockedFunding->status !== 'pending') {
                throw new LogicException('Funding request is not pending or has already been processed.');
            }

            if (!$lockedFunding->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedFunding->transaction_id)
                ->lockForUpdate()
                ->first();

            if (!$reservationTx) {
                throw new LogicException('Linked reservation transaction not found.');
            }

            $txStatus = $reservationTx->status instanceof TransactionStatus ? $reservationTx->status->value : $reservationTx->status;
            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Linked reservation transaction is not in pending state.');
            }

            $reservationTx->update([
                'status' => TransactionStatus::COMPLETED->value,
            ]);

            $lockedFunding->update([
                'status' => 'completed',
                'processed_by_user_id' => $admin->id,
                'processed_at' => now(),
                'admin_notes' => $adminNotes,
            ]);

            AuditLoggerService::log(
                'trading_funding_completed',
                $admin,
                TradingAccountFundingRequest::class,
                $lockedFunding->id,
                "Admin completed trading funding #{$lockedFunding->id} for \${$lockedFunding->amount}"
            );

            if ($lockedFunding->user) {
                NotificationService::notify(
                    $lockedFunding->user,
                    'Trading Funding Completed',
                    "Your funding request #{$lockedFunding->id} for \${$lockedFunding->amount} to trading account #{$lockedFunding->tradingAccount?->login_id} has been completed.",
                    'trading_funding_completed',
                    route('client.trading-accounts.index')
                );
            }

            return $lockedFunding->fresh(['tradingAccount', 'transaction', 'user']);
        });
    }

    /**
     * Admin rejects the funding request and refunds the reserved amount back to the client's wallet.
     */
    public function reject(
        TradingAccountFundingRequest $funding,
        User $admin,
        string $rejectionReason
    ): TradingAccountFundingRequest {
        if (trim($rejectionReason) === '') {
            throw new InvalidArgumentException('Rejection reason is required.');
        }

        $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
        $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

        if ($roleVal !== 'admin' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Only active administrators can reject funding requests.');
        }

        return DB::transaction(function () use ($funding, $admin, $rejectionReason) {
            $lockedFunding = TradingAccountFundingRequest::where('id', $funding->id)->lockForUpdate()->first();

            if (!$lockedFunding) {
                throw new InvalidArgumentException('Funding record not found.');
            }

            if ($lockedFunding->status !== 'pending') {
                throw new LogicException('Funding request is not pending or has already been processed.');
            }

            if (!$lockedFunding->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedFunding->transaction_id)
                ->lockForUpdate()
                ->first();

            if (!$reservationTx) {
                throw new LogicException('Linked reservation transaction not found.');
            }

            $txStatus = $reservationTx->status instanceof TransactionStatus ? $reservationTx->status->value : $reservationTx->status;
            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Linked reservation transaction is not in pending state.');
            }

            // Lock and refund wallet balance
            $wallet = Wallet::where('user_id', $lockedFunding->user_id)
                ->where('currency', $reservationTx->currency)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new LogicException('Wallet for this client could not be located.');
            }

            $refundAmount = $this->walletService->normalizeAmount($lockedFunding->amount);
            $newBalance = $this->walletService->add($wallet->balance, $refundAmount);
            $wallet->update(['balance' => $newBalance]);

            $reasonText = 'Rejection Reason: ' . $rejectionReason;
            $description = $reservationTx->description ? $reservationTx->description . ' | ' . $reasonText : $reasonText;

            $reservationTx->update([
                'status' => TransactionStatus::REJECTED->value,
                'description' => $description,
            ]);

            $lockedFunding->update([
                'status' => 'rejected',
                'processed_by_user_id' => $admin->id,
                'processed_at' => now(),
                'admin_notes' => $rejectionReason,
            ]);

            AuditLoggerService::log(
                'trading_funding_rejected',
                $admin,
                TradingAccountFundingRequest::class,
                $lockedFunding->id,
                "Admin rejected funding #{$lockedFunding->id}: {$rejectionReason}"
            );

            if ($lockedFunding->user) {
                NotificationService::notify(
                    $lockedFunding->user,
                    'Trading Funding Rejected',
                    "Your funding request #{$lockedFunding->id} for \${$lockedFunding->amount} was rejected and refunded to your wallet. Reason: {$rejectionReason}",
                    'trading_funding_rejected',
                    route('client.wallet')
                );
            }

            return $lockedFunding->fresh(['tradingAccount', 'transaction', 'user']);
        });
    }

    /**
     * Client cancels their own pending funding request.
     */
    public function cancel(
        TradingAccountFundingRequest $funding,
        User $client,
        ?string $reason = null
    ): TradingAccountFundingRequest {
        if ($funding->user_id !== $client->id) {
            throw new InvalidArgumentException('You are not authorized to cancel this funding request.');
        }

        return DB::transaction(function () use ($funding, $client, $reason) {
            $lockedFunding = TradingAccountFundingRequest::where('id', $funding->id)->lockForUpdate()->first();

            if (!$lockedFunding) {
                throw new InvalidArgumentException('Funding record not found.');
            }

            if ($lockedFunding->status !== 'pending') {
                throw new LogicException('Only pending funding requests can be cancelled.');
            }

            if (!$lockedFunding->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedFunding->transaction_id)
                ->lockForUpdate()
                ->first();

            if (!$reservationTx) {
                throw new LogicException('Linked reservation transaction not found.');
            }

            $txStatus = $reservationTx->status instanceof TransactionStatus ? $reservationTx->status->value : $reservationTx->status;
            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Linked reservation transaction is not in pending state.');
            }

            // Lock and refund wallet balance
            $wallet = Wallet::where('user_id', $lockedFunding->user_id)
                ->where('currency', $reservationTx->currency)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new LogicException('Wallet for this client could not be located.');
            }

            $refundAmount = $this->walletService->normalizeAmount($lockedFunding->amount);
            $newBalance = $this->walletService->add($wallet->balance, $refundAmount);
            $wallet->update(['balance' => $newBalance]);

            $reservationTx->update([
                'status' => TransactionStatus::CANCELLED->value,
                'description' => $reservationTx->description ? $reservationTx->description . ' | Cancelled by client' : 'Cancelled by client',
            ]);

            $lockedFunding->update([
                'status' => 'cancelled',
                'processed_at' => now(),
                'admin_notes' => $reason ? 'Client cancellation: ' . $reason : 'Cancelled by client',
            ]);

            AuditLoggerService::log(
                'trading_funding_cancelled',
                $client,
                TradingAccountFundingRequest::class,
                $lockedFunding->id,
                "Client cancelled trading funding request #{$lockedFunding->id}"
            );

            return $lockedFunding->fresh(['tradingAccount', 'transaction', 'user']);
        });
    }
}
