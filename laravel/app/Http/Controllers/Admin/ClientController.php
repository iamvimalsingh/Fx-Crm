<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\Audit\AuditLoggerService;
use App\Services\Financial\WalletService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class ClientController extends Controller
{
    public function __construct(
        protected WalletService $walletService
    ) {}

    /**
     * Display a paginated list of client accounts with filtering and search.
     */
    public function index(Request $request): View
    {
        $query = User::where('role', 'client')
            ->with(['profile', 'wallet', 'kycProfile'])
            ->withCount('tradingAccounts');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('email', 'like', "%{$search}%")
                    ->orWhereHas('profile', function ($pq) use ($search) {
                        $pq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        if ($status = $request->input('status')) {
            if (in_array($status, ['active', 'disabled'], true)) {
                $query->where('status', $status);
            }
        }

        $clients = $query->latest()->paginate(15)->withQueryString();

        return view('admin.clients.index', compact('clients'));
    }

    /**
     * Display Client 360 overview.
     */
    public function show(User $client): View
    {
        if ($client->role !== 'client' && $client->role?->value !== 'client') {
            abort(404, 'Client not found.');
        }

        $client->load(['profile', 'wallet', 'kycProfile', 'kycDocuments']);

        $wallet = $this->walletService->getWallet($client);

        $tradingAccounts = $client->tradingAccounts()->latest()->get();
        $kycDocuments = $client->kycDocuments()->latest()->get();

        $recentTransactions = $client->transactions()
            ->latest()
            ->take(10)
            ->get();

        $deposits = $client->deposits()
            ->with(['paymentMethod', 'approvedByUser'])
            ->latest()
            ->take(10)
            ->get();

        $withdrawals = $client->withdrawals()
            ->with(['processedByUser'])
            ->latest()
            ->take(10)
            ->get();

        $tradingAccountRequests = $client->tradingAccountRequests()
            ->with('tradingAccount')
            ->latest()
            ->take(10)
            ->get();

        $tradingFundings = $client->tradingAccountFundingRequests()
            ->with(['tradingAccount', 'processor'])
            ->latest()
            ->take(10)
            ->get();

        $passwordResetRequests = $client->tradingPasswordResetRequests()
            ->with('tradingAccount')
            ->latest()
            ->take(10)
            ->get();

        $auditLogs = AuditLog::where('user_id', $client->id)
            ->orWhere(function ($q) use ($client) {
                $q->where('target_type', User::class)
                    ->where('target_id', $client->id);
            })
            ->latest('created_at')
            ->take(15)
            ->get();

        return view('admin.clients.show', compact(
            'client',
            'wallet',
            'tradingAccounts',
            'recentTransactions',
            'deposits',
            'withdrawals',
            'tradingAccountRequests',
            'tradingFundings',
            'passwordResetRequests',
            'kycDocuments',
            'auditLogs'
        ));
    }

    /**
     * Update client account status (enable / disable).
     */
    public function updateStatus(Request $request, User $client): RedirectResponse
    {
        if ($client->role !== 'client' && $client->role?->value !== 'client') {
            abort(404, 'Target is not a client.');
        }

        if ($client->id === auth()->id()) {
            return back()->with('error', 'You cannot modify your own administrative status.');
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'disabled'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $oldStatusVal = $client->status instanceof \App\Enums\UserStatus ? $client->status->value : (string) $client->status;
        $client->update(['status' => $validated['status']]);

        $reason = ! empty($validated['reason']) ? " | Reason: {$validated['reason']}" : '';

        AuditLoggerService::log(
            'client_status_updated',
            auth()->user(),
            User::class,
            $client->id,
            "Client #{$client->id} status changed from {$oldStatusVal} to {$validated['status']}{$reason}"
        );

        return back()->with('success', "Client status has been updated to {$validated['status']}.");
    }

    /**
     * Authorized, secure password reset for client account by administrator.
     */
    public function resetPassword(Request $request, User $client): RedirectResponse
    {
        $admin = auth()->user();
        $role = $admin->role instanceof \App\Enums\UserRole ? $admin->role->value : $admin->role;
        if (!in_array($role, ['admin', 'super_admin'], true)) {
            abort(403, 'Unauthorized access.');
        }

        if ($client->role !== 'client' && $client->role?->value !== 'client') {
            abort(404, 'Target is not a client.');
        }

        $validated = $request->validate([
            'mode' => ['required', 'string', Rule::in(['generate', 'custom'])],
            'password' => ['nullable', 'string', 'min:8', 'max:128', 'confirmed', 'required_if:mode,custom'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validated['mode'] === 'custom') {
            $newPassword = $validated['password'];
        } else {
            // Generate high-entropy secure random password
            $newPassword = \Illuminate\Support\Str::password(16);
        }

        $client->update([
            'password' => \Illuminate\Support\Facades\Hash::make($newPassword),
        ]);

        $reason = !empty($validated['reason']) ? " | Reason: {$validated['reason']}" : '';

        // Audit log WITHOUT plaintext password
        AuditLoggerService::log(
            'client_password_reset_by_admin',
            $admin,
            User::class,
            $client->id,
            "Admin #{$admin->id} reset password for client #{$client->id} ({$client->email}) [mode: {$validated['mode']}]{$reason}"
        );

        // Security notification to client
        \App\Services\Notification\NotificationService::notify(
            $client,
            'Security Alert: Password Reset by Administrator',
            'Your client portal password has been updated by an authorized system administrator. If you did not authorize this change, please contact support immediately.',
            'warning'
        );

        // Flash one-time password to admin session for immediate handoff
        session()->flash('generated_client_password', $newPassword);
        session()->flash('client_password_reset_client_id', $client->id);

        return back()->with('success', "Password for client #{$client->id} ({$client->email}) has been reset successfully.");
    }
}
