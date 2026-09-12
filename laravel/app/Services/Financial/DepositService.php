<?php

namespace App\Services\Financial;

use App\Enums\TransactionType;
use App\Models\Deposit;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class DepositService
{
    public function __construct(
        protected WalletService $walletService
    ) {}

    /**
     * Create a pending deposit request initiated by a client via client portal.
     */
    public function createClientRequest(
        User $client,
        mixed $amount,
        ?int $paymentMethodId = null,
        ?string $sourceReference = null,
        ?string $clientNotes = null
    ): Deposit {
        $roleVal = $client->role instanceof \App\Enums\UserRole ? $client->role->value : (string) $client->role;
        $statusVal = $client->status instanceof \App\Enums\UserStatus ? $client->status->value : (string) $client->status;

        if ($roleVal !== 'client' || $statusVal !== 'active') {
            throw new InvalidArgumentException("Deposit records can only be created for active client accounts.");
        }

        $paymentMethod = null;
        if ($paymentMethodId !== null) {
            $paymentMethod = PaymentMethod::find($paymentMethodId);
            if (!$paymentMethod || !$paymentMethod->is_active) {
                throw new InvalidArgumentException('The selected payment method is invalid or inactive.');
            }
        }

        $normalizedAmount = $this->walletService->normalizeAmount($amount);

        if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
            throw new InvalidArgumentException('Deposit amount must be greater than zero.');
        }

        $minAmount = ($paymentMethod && $paymentMethod->min_amount !== null && bccomp((string) $paymentMethod->min_amount, '0.00', 2) > 0)
            ? $this->walletService->normalizeAmount($paymentMethod->min_amount)
            : $this->walletService->normalizeAmount(config('broker.wallet.min_deposit', '10.00'));

        $maxAmount = ($paymentMethod && $paymentMethod->max_amount !== null && bccomp((string) $paymentMethod->max_amount, '0.00', 2) > 0)
            ? $this->walletService->normalizeAmount($paymentMethod->max_amount)
            : $this->walletService->normalizeAmount(config('broker.wallet.max_deposit', '50000.00'));

        if (bccomp($normalizedAmount, $minAmount, 2) < 0) {
            throw new InvalidArgumentException("Deposit amount must be at least {$minAmount}.");
        }

        if (bccomp($normalizedAmount, $maxAmount, 2) > 0) {
            throw new InvalidArgumentException("Deposit amount must not exceed {$maxAmount}.");
        }

        $deposit = Deposit::create([
            'user_id' => $client->id,
            'payment_method_id' => $paymentMethodId,
            'amount' => $normalizedAmount,
            'request_channel' => 'client_panel',
            'credit_reason' => 'deposit',
            'source_reference' => $sourceReference,
            'client_notes' => $clientNotes,
            'requested_by_user_id' => $client->id,
            'status' => 'pending',
        ]);

        AuditLoggerService::log(
            'deposit_request_created',
            $client,
            Deposit::class,
            $deposit->id,
            "Client deposit request created for {$normalizedAmount}"
        );

        return $deposit;
    }

    /**
     * Create a pending deposit/credit entry initiated by an admin via offline channels.
     */
    public function createAdminEntry(
        User $admin,
        User $client,
        mixed $amount,
        string $requestChannel,
        string $creditReason,
        ?int $paymentMethodId = null,
        ?string $sourceReference = null,
        ?string $clientNotes = null,
        ?string $adminNotes = null
    ): Deposit {
        $roleVal = $client->role instanceof \App\Enums\UserRole ? $client->role->value : (string) $client->role;
        $statusVal = $client->status instanceof \App\Enums\UserStatus ? $client->status->value : (string) $client->status;

        if ($roleVal !== 'client' || $statusVal !== 'active') {
            throw new InvalidArgumentException("Deposit records can only be created for active client accounts.");
        }

        $paymentMethod = null;
        if ($paymentMethodId !== null) {
            $paymentMethod = PaymentMethod::find($paymentMethodId);
            if (!$paymentMethod || !$paymentMethod->is_active) {
                throw new InvalidArgumentException('The selected payment method is invalid or inactive.');
            }
        }

        $allowedChannels = ['phone', 'whatsapp', 'admin'];
        if (!in_array($requestChannel, $allowedChannels, true)) {
            throw new InvalidArgumentException('Invalid request channel for admin deposit entry.');
        }

        $allowedReasons = ['deposit', 'bonus', 'manual_credit'];
        if (!in_array($creditReason, $allowedReasons, true)) {
            throw new InvalidArgumentException('Invalid credit reason for admin deposit entry.');
        }

        if (in_array($creditReason, ['bonus', 'manual_credit'], true)) {
            if (empty(trim($adminNotes ?? '')) && empty(trim($clientNotes ?? ''))) {
                throw new InvalidArgumentException("A note is required when creating a {$creditReason}.");
            }
        }

        $normalizedAmount = $this->walletService->normalizeAmount($amount);

        if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
            throw new InvalidArgumentException('Credit amount must be greater than zero.');
        }

        if ($creditReason === 'deposit') {
            $minAmount = ($paymentMethod && $paymentMethod->min_amount !== null && bccomp((string) $paymentMethod->min_amount, '0.00', 2) > 0)
                ? (string) $paymentMethod->min_amount
                : (string) config('broker.wallet.min_deposit', '10.00');

            $maxAmount = ($paymentMethod && $paymentMethod->max_amount !== null && bccomp((string) $paymentMethod->max_amount, '0.00', 2) > 0)
                ? (string) $paymentMethod->max_amount
                : (string) config('broker.wallet.max_deposit', '50000.00');

            if (bccomp($normalizedAmount, $minAmount, 2) < 0) {
                throw new InvalidArgumentException("Credit amount must be at least {$minAmount}.");
            }

            if (bccomp($normalizedAmount, $maxAmount, 2) > 0) {
                throw new InvalidArgumentException("Credit amount must not exceed {$maxAmount}.");
            }
        }

        $deposit = Deposit::create([
            'user_id' => $client->id,
            'payment_method_id' => $paymentMethodId,
            'amount' => $normalizedAmount,
            'request_channel' => $requestChannel,
            'credit_reason' => $creditReason,
            'source_reference' => $sourceReference,
            'client_notes' => $clientNotes,
            'admin_notes' => $adminNotes,
            'requested_by_user_id' => $admin->id,
            'status' => 'pending',
        ]);

        $auditAction = ($creditReason === 'bonus') ? 'bonus_created' : 'manual_deposit_created';

        AuditLoggerService::log(
            $auditAction,
            $admin,
            Deposit::class,
            $deposit->id,
            "Admin created {$creditReason} entry of {$normalizedAmount} via {$requestChannel}"
        );

        return $deposit;
    }

    /**
     * Approve a pending deposit request and execute wallet credit.
     */
    public function approve(Deposit $deposit, User $approver): Deposit
    {
        return DB::transaction(function () use ($deposit, $approver) {
            /** @var Deposit|null $lockedDeposit */
            $lockedDeposit = Deposit::where('id', $deposit->id)->lockForUpdate()->first();

            if (!$lockedDeposit) {
                throw new InvalidArgumentException('Deposit record not found.');
            }

            if ($lockedDeposit->status !== 'pending') {
                throw new LogicException('Deposit request is not pending or has already been processed.');
            }

            $client = User::where('id', $lockedDeposit->user_id)->first();
            if (!$client) {
                throw new InvalidArgumentException('Associated client user not found.');
            }

            $txType = match ($lockedDeposit->credit_reason) {
                'deposit' => TransactionType::DEPOSIT,
                'bonus', 'manual_credit' => TransactionType::MANUAL_CREDIT,
                default => TransactionType::DEPOSIT,
            };

            $description = ucfirst(str_replace('_', ' ', $lockedDeposit->credit_reason)) . " approved by administrator";
            if ($lockedDeposit->source_reference) {
                $description .= " (Ref: {$lockedDeposit->source_reference})";
            }

            // Perform atomic credit using WalletService
            $transaction = $this->walletService->credit(
                $client,
                $lockedDeposit->amount,
                $txType,
                $description
            );

            $lockedDeposit->update([
                'transaction_id' => $transaction->id,
                'approved_by_user_id' => $approver->id,
                'status' => 'completed',
            ]);

            AuditLoggerService::log(
                'deposit_approved',
                $approver,
                Deposit::class,
                $lockedDeposit->id,
                "Deposit #{$lockedDeposit->id} approved and credited via Transaction #{$transaction->id}"
            );

            NotificationService::notify(
                $client,
                'Deposit Approved',
                "Your deposit #{$lockedDeposit->id} of \${$lockedDeposit->amount} has been approved and credited to your CRM wallet.",
                'deposit_approved',
                route('client.wallet')
            );

            return $lockedDeposit->fresh(['transaction', 'user', 'approvedBy']);
        });
    }

    /**
     * Reject a pending deposit request without modifying wallet balance.
     */
    public function reject(Deposit $deposit, User $reviewer, string $rejectionReason): Deposit
    {
        if (trim($rejectionReason) === '') {
            throw new InvalidArgumentException('A rejection reason must be provided.');
        }

        return DB::transaction(function () use ($deposit, $reviewer, $rejectionReason) {
            /** @var Deposit|null $lockedDeposit */
            $lockedDeposit = Deposit::where('id', $deposit->id)->lockForUpdate()->first();

            if (!$lockedDeposit) {
                throw new InvalidArgumentException('Deposit record not found.');
            }

            if ($lockedDeposit->status !== 'pending') {
                throw new LogicException('Deposit request is not pending or has already been processed.');
            }

            $adminNotes = $lockedDeposit->admin_notes
                ? $lockedDeposit->admin_notes . ' | Rejection Reason: ' . $rejectionReason
                : 'Rejection Reason: ' . $rejectionReason;

            $lockedDeposit->update([
                'approved_by_user_id' => $reviewer->id,
                'status' => 'rejected',
                'admin_notes' => $adminNotes,
            ]);

            AuditLoggerService::log(
                'deposit_rejected',
                $reviewer,
                Deposit::class,
                $lockedDeposit->id,
                "Deposit #{$lockedDeposit->id} rejected. Reason: {$rejectionReason}"
            );

            if ($lockedDeposit->user) {
                NotificationService::notify(
                    $lockedDeposit->user,
                    'Deposit Rejected',
                    "Your deposit #{$lockedDeposit->id} of \${$lockedDeposit->amount} was rejected. Reason: {$rejectionReason}",
                    'deposit_rejected',
                    route('client.wallet')
                );
            }

            return $lockedDeposit->fresh(['user', 'approvedBy']);
        });
    }
}
