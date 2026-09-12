<?php

namespace App\Http\Controllers\Client;

use App\Exceptions\InsufficientFundsException;
use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Models\Withdrawal;
use App\Services\Financial\DepositService;
use App\Services\Financial\WalletService;
use App\Services\Financial\WithdrawalService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use LogicException;

class WalletController extends Controller
{
    public function __construct(
        protected DepositService $depositService,
        protected WithdrawalService $withdrawalService,
        protected WalletService $walletService
    ) {}

    /**
     * Handle client deposit request submission.
     */
    public function storeDeposit(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'string', 'regex:/^\d+(\.\d{1,2})?$/'],
            'payment_method_id' => [
                'nullable',
                Rule::exists('payment_methods', 'id')->where('is_active', true),
            ],
            'source_reference' => ['nullable', 'string', 'max:255'],
            'client_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();

        try {
            $normalizedAmount = $this->walletService->normalizeAmount($validated['amount']);

            if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
                return back()->withErrors(['amount' => 'Deposit amount must be greater than zero.'])->withInput();
            }

            $paymentMethodId = !empty($validated['payment_method_id']) ? (int) $validated['payment_method_id'] : null;
            $paymentMethod = $paymentMethodId
                ? PaymentMethod::where('id', $paymentMethodId)->where('is_active', true)->first()
                : null;

            $minAmount = ($paymentMethod && $paymentMethod->min_amount !== null && bccomp((string) $paymentMethod->min_amount, '0.00', 2) > 0)
                ? (string) $paymentMethod->min_amount
                : (string) config('broker.wallet.min_deposit', '10.00');

            $maxAmount = ($paymentMethod && $paymentMethod->max_amount !== null && bccomp((string) $paymentMethod->max_amount, '0.00', 2) > 0)
                ? (string) $paymentMethod->max_amount
                : (string) config('broker.wallet.max_deposit', '50000.00');

            if (bccomp($normalizedAmount, $minAmount, 2) < 0) {
                return back()->withErrors(['amount' => "Deposit amount must be at least \${$minAmount}."])->withInput();
            }

            if (bccomp($normalizedAmount, $maxAmount, 2) > 0) {
                return back()->withErrors(['amount' => "Deposit amount must not exceed \${$maxAmount}."])->withInput();
            }

            $this->depositService->createClientRequest(
                client: $user,
                amount: $normalizedAmount,
                paymentMethodId: $paymentMethodId,
                sourceReference: $validated['source_reference'] ?? null,
                clientNotes: $validated['client_notes'] ?? null
            );

            return redirect()->route('client.wallet')->with('success', 'Your CRM wallet deposit request has been submitted successfully and is pending administrator review. Funds will be credited upon approval.');
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['amount' => $e->getMessage()])->withInput();
        }
    }

    /**
     * Handle client withdrawal request submission.
     */
    public function storeWithdrawal(Request $request): RedirectResponse
    {
        $allowedMethods = array_keys(config('broker.withdrawal_methods', []));

        $validated = $request->validate([
            'amount' => ['required', 'string', 'regex:/^\d+(\.\d{1,2})?$/'],
            'withdrawal_method' => ['required', 'string', Rule::in($allowedMethods)],
            'destination_details' => ['required', 'string', 'max:1000'],
            'client_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();

        try {
            $normalizedAmount = $this->walletService->normalizeAmount($validated['amount']);

            if ($this->walletService->compare($normalizedAmount, '0.00') <= 0) {
                return back()->withErrors(['amount' => 'Withdrawal amount must be greater than zero.'])->withInput();
            }

            $minWithdrawal = (string) config('broker.wallet.min_withdrawal', '20.00');
            $maxWithdrawal = (string) config('broker.wallet.max_withdrawal', '25000.00');

            if ($this->walletService->compare($normalizedAmount, $minWithdrawal) < 0) {
                return back()->withErrors(['amount' => "Withdrawal amount must be at least \${$minWithdrawal}."])->withInput();
            }

            if ($this->walletService->compare($normalizedAmount, $maxWithdrawal) > 0) {
                return back()->withErrors(['amount' => "Withdrawal amount must not exceed \${$maxWithdrawal}."])->withInput();
            }

            $this->withdrawalService->createClientRequest(
                client: $user,
                amount: $normalizedAmount,
                method: $validated['withdrawal_method'],
                destinationDetails: $validated['destination_details'],
                clientNotes: $validated['client_notes'] ?? null
            );

            return redirect()->route('client.wallet')->with('success', 'Withdrawal request submitted successfully. The requested funds have been reserved from your available wallet balance.');
        } catch (InsufficientFundsException $e) {
            return back()->withErrors(['amount' => 'Insufficient wallet balance for this withdrawal request.'])->withInput();
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['amount' => $e->getMessage()])->withInput();
        }
    }

    /**
     * Handle client cancellation of their pending withdrawal request.
     */
    public function cancelWithdrawal(Request $request, Withdrawal $withdrawal): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        try {
            $reason = $request->input('reason', 'Cancelled by client from wallet panel');
            $this->withdrawalService->cancel($withdrawal, $user, $reason);

            return redirect()->route('client.wallet')->with('success', 'Withdrawal request cancelled successfully and funds have been refunded to your wallet.');
        } catch (InvalidArgumentException|LogicException $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
