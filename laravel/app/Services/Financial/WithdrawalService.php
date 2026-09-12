<?php

namespace App\Services\Financial;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\InsufficientFundsException;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class WithdrawalService
{
    public function __construct(
        protected WalletService $walletService
    ) {}

    /**
     * Create client withdrawal request with immediate fund reservation.
     */
    public function createClientRequest(
        User $client,
        string $amount,
        string $method,
        string $destinationDetails,
        ?string $clientNotes = null
    ): Withdrawal {
        $roleVal = $client->role instanceof UserRole ? $client->role->value : (string) $client->role;
        $statusVal = $client->status instanceof UserStatus ? $client->status->value : (string) $client->status;

        if ($roleVal !== 'client' || $statusVal !== 'active') {
            throw new InvalidArgumentException('Withdrawals can only be requested by active client accounts.');
        }

        $trimmedDetails = trim($destinationDetails);
        if ($trimmedDetails === '') {
            throw new InvalidArgumentException('Destination details cannot be empty.');
        }

        $allowedMethods = array_keys(config('broker.withdrawal_methods', []));
        if (!in_array($method, $allowedMethods, true)) {
            throw new InvalidArgumentException('Invalid withdrawal method selected.');
        }

        $normalizedAmount = $this->walletService->normalizeAmount($amount);

        if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
            throw new InvalidArgumentException('Withdrawal amount must be greater than zero.');
        }

        $minWithdrawal = (string) config('broker.wallet.min_withdrawal', '20.00');
        $maxWithdrawal = (string) config('broker.wallet.max_withdrawal', '25000.00');

        if ($this->walletService->compare($normalizedAmount, $minWithdrawal) < 0) {
            throw new InvalidArgumentException("Withdrawal amount must be at least \${$minWithdrawal}.");
        }

        if ($this->walletService->compare($normalizedAmount, $maxWithdrawal) > 0) {
            throw new InvalidArgumentException("Withdrawal amount must not exceed \${$maxWithdrawal}.");
        }

        return DB::transaction(function () use ($client, $normalizedAmount, $method, $trimmedDetails, $clientNotes) {
            $wallet = Wallet::where('user_id', $client->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new InsufficientFundsException('Wallet not found.');
            }

            if ($this->walletService->compare($wallet->balance, $normalizedAmount) < 0) {
                throw new InsufficientFundsException();
            }

            // Immediately reserve funds by deducting from wallet balance
            $newBalance = $this->walletService->sub($wallet->balance, $normalizedAmount);
            $wallet->update(['balance' => $newBalance]);

            // Create pending ledger transaction for reservation
            $transaction = Transaction::create([
                'user_id' => $client->id,
                'type' => TransactionType::WITHDRAWAL->value,
                'amount' => $normalizedAmount,
                'currency' => $wallet->currency,
                'status' => TransactionStatus::PENDING->value,
                'reference_id' => ReferenceGenerator::generate('WD'),
                'description' => 'Withdrawal request fund reservation',
            ]);

            // Create Withdrawal record
            $withdrawal = Withdrawal::create([
                'user_id' => $client->id,
                'transaction_id' => $transaction->id,
                'refund_transaction_id' => null,
                'amount' => $normalizedAmount,
                'withdrawal_method' => $method,
                'destination_details' => $trimmedDetails,
                'client_notes' => $clientNotes,
                'admin_notes' => null,
                'requested_by_user_id' => $client->id,
                'processed_by_user_id' => null,
                'status' => 'pending',
            ]);

            AuditLoggerService::log(
                'withdrawal_request_created',
                $client,
                Withdrawal::class,
                $withdrawal->id,
                "Client withdrawal request created for \${$normalizedAmount} via {$method}"
            );

            return $withdrawal;
        });
    }

    /**
     * Admin completes the withdrawal (confirms external manual payout).
     * Does NOT debit the wallet again.
     */
    public function complete(Withdrawal $withdrawal, User $admin, ?string $adminNotes = null): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal, $admin, $adminNotes) {
            $lockedWithdrawal = Withdrawal::where('id', $withdrawal->id)->lockForUpdate()->first();

            if (!$lockedWithdrawal) {
                throw new InvalidArgumentException('Withdrawal record not found.');
            }

            $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
            $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

            if ($roleVal !== 'admin' || $statusVal !== 'active') {
                throw new InvalidArgumentException('Only active administrators can complete withdrawals.');
            }

            if ($lockedWithdrawal->status !== 'pending') {
                throw new LogicException('Withdrawal is not pending or has already been processed.');
            }

            if (!$lockedWithdrawal->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedWithdrawal->transaction_id)
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

            $lockedWithdrawal->update([
                'status' => 'completed',
                'processed_by_user_id' => $admin->id,
                'admin_notes' => $adminNotes,
            ]);

            AuditLoggerService::log(
                'withdrawal_completed',
                $admin,
                Withdrawal::class,
                $lockedWithdrawal->id,
                "Admin completed withdrawal request #{$lockedWithdrawal->id} for \${$lockedWithdrawal->amount}"
            );

            if ($lockedWithdrawal->user) {
                NotificationService::notify(
                    $lockedWithdrawal->user,
                    'Withdrawal Completed',
                    "Your withdrawal #{$lockedWithdrawal->id} of \${$lockedWithdrawal->amount} has been completed.",
                    'withdrawal_completed',
                    route('client.wallet')
                );
            }

            return $lockedWithdrawal->fresh();
        });
    }

    /**
     * Admin rejects the withdrawal and refunds the reserved amount to the wallet.
     */
    public function reject(Withdrawal $withdrawal, User $admin, string $rejectionReason): Withdrawal
    {
        if (trim($rejectionReason) === '') {
            throw new InvalidArgumentException('Rejection reason is required.');
        }

        return DB::transaction(function () use ($withdrawal, $admin, $rejectionReason) {
            $lockedWithdrawal = Withdrawal::where('id', $withdrawal->id)->lockForUpdate()->first();

            if (!$lockedWithdrawal) {
                throw new InvalidArgumentException('Withdrawal record not found.');
            }

            $roleVal = $admin->role instanceof UserRole ? $admin->role->value : (string) $admin->role;
            $statusVal = $admin->status instanceof UserStatus ? $admin->status->value : (string) $admin->status;

            if ($roleVal !== 'admin' || $statusVal !== 'active') {
                throw new InvalidArgumentException('Only active administrators can reject withdrawals.');
            }

            if ($lockedWithdrawal->status !== 'pending') {
                throw new LogicException('Withdrawal is not pending or has already been processed.');
            }

            if (!$lockedWithdrawal->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedWithdrawal->transaction_id)
                ->lockForUpdate()
                ->first();

            if (!$reservationTx) {
                throw new LogicException('Linked reservation transaction not found.');
            }

            $txStatus = $reservationTx->status instanceof TransactionStatus ? $reservationTx->status->value : $reservationTx->status;
            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Linked reservation transaction is not in pending state.');
            }

            $wallet = Wallet::where('user_id', $lockedWithdrawal->user_id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new LogicException('Client wallet not found.');
            }

            $amountStr = $this->walletService->normalizeAmount($lockedWithdrawal->amount);
            $newBalance = $this->walletService->add($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            // Mark reservation transaction REJECTED
            $reservationTx->update([
                'status' => TransactionStatus::REJECTED->value,
                'description' => $reservationTx->description . ' | Rejected: ' . trim($rejectionReason),
            ]);

            $lockedWithdrawal->update([
                'status' => 'rejected',
                'refund_transaction_id' => null,
                'processed_by_user_id' => $admin->id,
                'admin_notes' => trim($rejectionReason),
            ]);

            AuditLoggerService::log(
                'withdrawal_rejected',
                $admin,
                Withdrawal::class,
                $lockedWithdrawal->id,
                "Admin rejected withdrawal request #{$lockedWithdrawal->id}"
            );

            if ($lockedWithdrawal->user) {
                NotificationService::notify(
                    $lockedWithdrawal->user,
                    'Withdrawal Rejected',
                    "Your withdrawal #{$lockedWithdrawal->id} of \${$lockedWithdrawal->amount} was rejected and refunded to your wallet. Reason: {$rejectionReason}",
                    'withdrawal_rejected',
                    route('client.wallet')
                );
            }

            return $lockedWithdrawal->fresh();
        });
    }

    /**
     * Client cancels their own pending withdrawal and receives an immediate refund.
     */
    public function cancel(Withdrawal $withdrawal, User $client, ?string $reason = null): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal, $client, $reason) {
            $lockedWithdrawal = Withdrawal::where('id', $withdrawal->id)->lockForUpdate()->first();

            if (!$lockedWithdrawal) {
                throw new InvalidArgumentException('Withdrawal record not found.');
            }

            if ((int) $lockedWithdrawal->user_id !== (int) $client->id) {
                throw new InvalidArgumentException('You are not authorized to cancel this withdrawal.');
            }

            $roleVal = $client->role instanceof UserRole ? $client->role->value : (string) $client->role;
            $statusVal = $client->status instanceof UserStatus ? $client->status->value : (string) $client->status;

            if ($roleVal !== 'client' || $statusVal !== 'active') {
                throw new InvalidArgumentException('Only active clients can cancel their pending withdrawals.');
            }

            if ($lockedWithdrawal->status !== 'pending') {
                throw new LogicException('Withdrawal is not pending or has already been processed.');
            }

            if (!$lockedWithdrawal->transaction_id) {
                throw new LogicException('Linked reservation transaction ID is missing.');
            }

            $reservationTx = Transaction::where('id', $lockedWithdrawal->transaction_id)
                ->lockForUpdate()
                ->first();

            if (!$reservationTx) {
                throw new LogicException('Linked reservation transaction not found.');
            }

            $txStatus = $reservationTx->status instanceof TransactionStatus ? $reservationTx->status->value : $reservationTx->status;
            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Linked reservation transaction is not in pending state.');
            }

            $wallet = Wallet::where('user_id', $client->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new LogicException('Client wallet not found.');
            }

            $amountStr = $this->walletService->normalizeAmount($lockedWithdrawal->amount);
            $newBalance = $this->walletService->add($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            // Mark reservation transaction CANCELLED
            $reservationTx->update([
                'status' => TransactionStatus::CANCELLED->value,
                'description' => $reservationTx->description . ' | Cancelled by client' . ($reason ? ": {$reason}" : ''),
            ]);

            $lockedWithdrawal->update([
                'status' => 'cancelled',
                'refund_transaction_id' => null,
                'processed_by_user_id' => null,
            ]);

            AuditLoggerService::log(
                'withdrawal_cancelled',
                $client,
                Withdrawal::class,
                $lockedWithdrawal->id,
                "Client cancelled withdrawal request #{$lockedWithdrawal->id}"
            );

            return $lockedWithdrawal->fresh();
        });
    }
}
