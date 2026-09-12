<?php

namespace App\Services\Financial;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;
use RuntimeException;

class WalletService
{
    /**
     * Get or initialize base currency wallet for user.
     */
    public function getWallet(User $user): Wallet
    {
        return Wallet::firstOrCreate(
            [
                'user_id' => $user->id,
                'currency' => config('broker.base_currency', 'USD'),
            ],
            [
                'balance' => '0.00',
            ]
        );
    }

    /**
     * Credit funds to wallet and create a completed ledger record.
     */
    public function credit(
        User $user,
        string $amount,
        string|TransactionType $type = TransactionType::DEPOSIT,
        ?string $description = null,
        ?string $referenceId = null
    ): Transaction {
        $amountStr = $this->normalizeAmount($amount);

        if ($this->compare($amountStr, '0.00') <= 0) {
            throw new InvalidArgumentException('Credit amount must be greater than zero.');
        }

        $typeEnum = $type instanceof TransactionType ? $type : TransactionType::from($type);

        return DB::transaction(function () use ($user, $amountStr, $typeEnum, $description, $referenceId) {
            $wallet = Wallet::where('user_id', $user->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                $wallet = Wallet::create([
                    'user_id' => $user->id,
                    'currency' => config('broker.base_currency', 'USD'),
                    'balance' => '0.00',
                ]);
                $wallet = Wallet::where('id', $wallet->id)->lockForUpdate()->first();
            }

            $newBalance = $this->add($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            return Transaction::create([
                'user_id' => $user->id,
                'type' => $typeEnum->value,
                'amount' => $amountStr,
                'currency' => $wallet->currency,
                'status' => TransactionStatus::COMPLETED->value,
                'reference_id' => $referenceId ?? ReferenceGenerator::generate('TXN'),
                'description' => $description ?? 'Wallet credit operation',
            ]);
        });
    }

    /**
     * Debit funds from wallet and create a completed ledger record.
     */
    public function debit(
        User $user,
        string $amount,
        string|TransactionType $type = TransactionType::WITHDRAWAL,
        ?string $description = null,
        ?string $referenceId = null
    ): Transaction {
        $amountStr = $this->normalizeAmount($amount);

        if ($this->compare($amountStr, '0.00') <= 0) {
            throw new InvalidArgumentException('Debit amount must be greater than zero.');
        }

        $typeEnum = $type instanceof TransactionType ? $type : TransactionType::from($type);

        return DB::transaction(function () use ($user, $amountStr, $typeEnum, $description, $referenceId) {
            $wallet = Wallet::where('user_id', $user->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new InsufficientFundsException('Wallet not found for this account.');
            }

            if ($this->compare($wallet->balance, $amountStr) < 0) {
                throw new InsufficientFundsException();
            }

            $newBalance = $this->sub($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            return Transaction::create([
                'user_id' => $user->id,
                'type' => $typeEnum->value,
                'amount' => $amountStr,
                'currency' => $wallet->currency,
                'status' => TransactionStatus::COMPLETED->value,
                'reference_id' => $referenceId ?? ReferenceGenerator::generate('TXN'),
                'description' => $description ?? 'Wallet debit operation',
            ]);
        });
    }

    /**
     * Reserve funds for pending withdrawal immediately.
     */
    public function reserveForWithdrawal(
        User $user,
        string $amount,
        string $withdrawalMethod,
        string $destinationDetails,
        ?string $notes = null
    ): Transaction {
        $amountStr = $this->normalizeAmount($amount);

        if ($this->compare($amountStr, '0.00') <= 0) {
            throw new InvalidArgumentException('Withdrawal amount must be greater than zero.');
        }

        return DB::transaction(function () use ($user, $amountStr, $withdrawalMethod, $destinationDetails, $notes) {
            $wallet = Wallet::where('user_id', $user->id)
                ->where('currency', config('broker.base_currency', 'USD'))
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new InsufficientFundsException('Wallet not found.');
            }

            if ($this->compare($wallet->balance, $amountStr) < 0) {
                throw new InsufficientFundsException();
            }

            // Immediately deduct from available balance
            $newBalance = $this->sub($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            // Create pending transaction
            $transaction = Transaction::create([
                'user_id' => $user->id,
                'type' => TransactionType::WITHDRAWAL->value,
                'amount' => $amountStr,
                'currency' => $wallet->currency,
                'status' => TransactionStatus::PENDING->value,
                'reference_id' => ReferenceGenerator::generate('WD'),
                'description' => 'Pending withdrawal request',
            ]);

            // Record withdrawal metadata
            Withdrawal::create([
                'user_id' => $user->id,
                'transaction_id' => $transaction->id,
                'amount' => $amountStr,
                'withdrawal_method' => $withdrawalMethod,
                'destination_details' => $destinationDetails,
                'notes' => $notes,
            ]);

            return $transaction->load('withdrawal');
        });
    }

    /**
     * Refund a rejected or cancelled pending withdrawal back to available wallet balance.
     */
    public function refundWithdrawal(Transaction $transaction, string $reason): Transaction
    {
        return DB::transaction(function () use ($transaction, $reason) {
            // Lock transaction
            $lockedTx = Transaction::where('id', $transaction->id)->lockForUpdate()->first();

            if (!$lockedTx) {
                throw new InvalidArgumentException('Transaction not found.');
            }

            $txType = $lockedTx->type instanceof TransactionType ? $lockedTx->type->value : $lockedTx->type;
            $txStatus = $lockedTx->status instanceof TransactionStatus ? $lockedTx->status->value : $lockedTx->status;

            if ($txType !== TransactionType::WITHDRAWAL->value) {
                throw new InvalidArgumentException('Only withdrawal transactions can be refunded.');
            }

            if ($txStatus !== TransactionStatus::PENDING->value) {
                throw new LogicException('Withdrawal request is not pending or has already been processed.');
            }

            // Lock wallet
            $wallet = Wallet::where('user_id', $lockedTx->user_id)
                ->where('currency', $lockedTx->currency)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw new LogicException('Wallet associated with this transaction was not found.');
            }

            $amountStr = $this->normalizeAmount($lockedTx->amount);
            $newBalance = $this->add($wallet->balance, $amountStr);
            $wallet->update(['balance' => $newBalance]);

            $reasonText = 'Rejection Reason: ' . $reason;
            $description = $lockedTx->description ? $lockedTx->description . ' | ' . $reasonText : $reasonText;

            $lockedTx->update([
                'status' => TransactionStatus::REJECTED->value,
                'description' => $description,
            ]);

            return $lockedTx;
        });
    }

    /**
     * Audit wallet ledger against immutable transaction history.
     * Uses explicit direction: DEPOSIT and MANUAL_CREDIT are credits; WITHDRAWAL and MANUAL_DEBIT are debits.
     */
    public function recalculateBalance(User $user): array
    {
        $wallet = $this->getWallet($user);

        // Sum completed credits using BCMath
        $creditAmounts = Transaction::where('user_id', $user->id)
            ->whereIn('type', [TransactionType::DEPOSIT->value, TransactionType::MANUAL_CREDIT->value])
            ->where('status', TransactionStatus::COMPLETED->value)
            ->pluck('amount');

        $completedCredits = '0.00';
        foreach ($creditAmounts as $amt) {
            $completedCredits = $this->add($completedCredits, $this->normalizeAmount($amt));
        }

        // Sum completed debits using BCMath
        $debitAmounts = Transaction::where('user_id', $user->id)
            ->whereIn('type', [TransactionType::WITHDRAWAL->value, TransactionType::MANUAL_DEBIT->value])
            ->where('status', TransactionStatus::COMPLETED->value)
            ->pluck('amount');

        $completedDebits = '0.00';
        foreach ($debitAmounts as $amt) {
            $completedDebits = $this->add($completedDebits, $this->normalizeAmount($amt));
        }

        // Net completed ledger balance = credits - debits
        $ledgerBalance = $this->sub($completedCredits, $completedDebits);

        // Sum pending reserved debits (withdrawals and funding requests) using BCMath
        $pendingAmounts = Transaction::where('user_id', $user->id)
            ->whereIn('type', [TransactionType::WITHDRAWAL->value, TransactionType::MANUAL_DEBIT->value])
            ->where('status', TransactionStatus::PENDING->value)
            ->pluck('amount');

        $pendingReserved = '0.00';
        foreach ($pendingAmounts as $amt) {
            $pendingReserved = $this->add($pendingReserved, $this->normalizeAmount($amt));
        }

        // Expected available balance = ledger balance - pending reserved withdrawals
        $expectedAvailableBalance = $this->sub($ledgerBalance, $pendingReserved);

        $cachedBalance = $this->normalizeAmount($wallet->balance);

        $isSynchronized = $this->compare($cachedBalance, $expectedAvailableBalance) === 0;

        return [
            'user_id' => $user->id,
            'currency' => $wallet->currency,
            'cached_balance' => $cachedBalance,
            'ledger_balance' => $ledgerBalance,
            'pending_reserved' => $pendingReserved,
            'expected_available_balance' => $expectedAvailableBalance,
            'is_synchronized' => $isSynchronized,
        ];
    }

    /**
     * Decimal string normalizer: validates format with regex /^\d+(\.\d{1,2})?$/ and normalizes using BCMath.
     * Throws InvalidArgumentException for negative, empty, scientific notation, or malformed decimals.
     */
    public function normalizeAmount(string $amount): string
    {
        if (!extension_loaded('bcmath')) {
            throw new RuntimeException('BCMath extension is required for financial calculations.');
        }

        if (trim($amount) === '') {
            throw new InvalidArgumentException('Monetary amount must be a non-empty value.');
        }

        $trimmed = trim($amount);

        if (!preg_match('/^\d+(\.\d{1,2})?$/', $trimmed)) {
            throw new InvalidArgumentException('Invalid monetary amount format: ' . $amount);
        }

        return bcadd($trimmed, '0.00', 2);
    }

    /**
     * High precision addition using bcadd with scale 2.
     */
    public function add(string $a, string $b): string
    {
        if (!extension_loaded('bcmath')) {
            throw new RuntimeException('BCMath extension is required for financial calculations.');
        }

        return bcadd($a, $b, 2);
    }

    /**
     * High precision subtraction using bcsub with scale 2.
     */
    public function sub(string $a, string $b): string
    {
        if (!extension_loaded('bcmath')) {
            throw new RuntimeException('BCMath extension is required for financial calculations.');
        }

        return bcsub($a, $b, 2);
    }

    /**
     * High precision comparison using bccomp with scale 2.
     */
    public function compare(string $a, string $b): int
    {
        if (!extension_loaded('bcmath')) {
            throw new RuntimeException('BCMath extension is required for financial calculations.');
        }

        return bccomp($a, $b, 2);
    }
}
