<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Deposit;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\Financial\DepositService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class DepositController extends Controller
{
    public function __construct(
        protected DepositService $depositService
    ) {}

    /**
     * Display a listing of deposits with filters and manual deposit capability.
     */
    public function index(Request $request): View
    {
        $query = Deposit::with(['user.profile', 'paymentMethod', 'approvedBy', 'requestedBy']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'completed', 'rejected', 'cancelled'], true)) {
                $query->where('status', $status);
            }
        }

        if ($channel = $request->input('request_channel')) {
            if (in_array($channel, ['client_panel', 'phone', 'whatsapp', 'admin'], true)) {
                $query->where('request_channel', $channel);
            }
        }

        if ($reason = $request->input('credit_reason')) {
            if (in_array($reason, ['deposit', 'bonus', 'manual_credit'], true)) {
                $query->where('credit_reason', $reason);
            }
        }

        $deposits = $query->latest()->paginate(15)->withQueryString();

        $activePaymentMethods = PaymentMethod::where('is_active', true)->get();
        $activeClients = User::where('role', 'client')
            ->where('status', 'active')
            ->with('profile')
            ->get();

        return view('admin.deposits.index', compact(
            'deposits',
            'activePaymentMethods',
            'activeClients'
        ));
    }

    /**
     * Approve a pending deposit and credit the client's wallet.
     */
    public function approve(Request $request, Deposit $deposit): RedirectResponse
    {
        try {
            $this->depositService->approve(
                $deposit,
                auth()->user(),
                $request->input('admin_notes')
            );

            return back()->with('success', "Deposit #{$deposit->id} for \${$deposit->amount} approved successfully.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Reject a pending deposit with reason.
     */
    public function reject(Request $request, Deposit $deposit): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        try {
            $this->depositService->reject(
                $deposit,
                auth()->user(),
                $validated['rejection_reason']
            );

            return back()->with('success', "Deposit #{$deposit->id} rejected.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Create a pending deposit or bonus entry initiated by administrator.
     */
    public function storeManual(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'amount' => ['required', 'string'],
            'request_channel' => ['required', Rule::in(['phone', 'whatsapp', 'admin'])],
            'credit_reason' => ['required', Rule::in(['deposit', 'bonus', 'manual_credit'])],
            'payment_method_id' => ['nullable', 'exists:payment_methods,id'],
            'source_reference' => ['nullable', 'string', 'max:255'],
            'client_notes' => ['nullable', 'string', 'max:1000'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $client = User::findOrFail($validated['user_id']);

        try {
            $deposit = $this->depositService->createAdminEntry(
                admin: auth()->user(),
                client: $client,
                amount: $validated['amount'],
                requestChannel: $validated['request_channel'],
                creditReason: $validated['credit_reason'],
                paymentMethodId: !empty($validated['payment_method_id']) ? (int) $validated['payment_method_id'] : null,
                sourceReference: $validated['source_reference'] ?? null,
                clientNotes: $validated['client_notes'] ?? null,
                adminNotes: $validated['admin_notes'] ?? null
            );

            return back()->with('success', "Pending {$validated['credit_reason']} entry #{$deposit->id} created successfully for {$client->email}. Ready for approval.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
