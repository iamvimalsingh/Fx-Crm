<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TradingAccount;
use App\Services\Audit\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TradingAccountController extends Controller
{
    /**
     * Display a listing of all registered trading accounts.
     */
    public function index(Request $request): View
    {
        $query = TradingAccount::with(['user.profile']);

        if ($platform = $request->input('platform')) {
            $query->where('platform_name', $platform);
        }

        if ($status = $request->input('status')) {
            if (in_array($status, ['active', 'suspended', 'disabled'], true)) {
                $query->where('status', $status);
            }
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('login_id', 'like', "%{$search}%")
                    ->orWhere('server_name', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('email', 'like', "%{$search}%");
                    });
            });
        }

        $tradingAccounts = $query->latest()->paginate(15)->withQueryString();
        $platforms = config('broker.supported_platforms', []);

        return view('admin.trading-accounts.index', compact('tradingAccounts', 'platforms'));
    }

    /**
     * Update trading account status (active / suspended / disabled).
     */
    public function updateStatus(Request $request, TradingAccount $tradingAccount): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended', 'disabled'])],
        ]);

        $oldStatus = $tradingAccount->status;
        $tradingAccount->update(['status' => $validated['status']]);

        AuditLoggerService::log(
            'trading_account_status_updated',
            auth()->user(),
            TradingAccount::class,
            $tradingAccount->id,
            "Trading account #{$tradingAccount->login_id} status changed from {$oldStatus} to {$validated['status']}"
        );

        return back()->with('success', "Trading account #{$tradingAccount->login_id} status updated to {$validated['status']}.");
    }

    /**
     * Securely reveal trading account password for administrator.
     */
    public function revealPassword(Request $request, TradingAccount $tradingAccount): JsonResponse
    {
        AuditLoggerService::log(
            'trading_password_revealed_by_admin',
            auth()->user(),
            TradingAccount::class,
            $tradingAccount->id,
            "Admin viewed trading password for account #{$tradingAccount->login_id} (user #{$tradingAccount->user_id})"
        );

        return response()->json([
            'success' => true,
            'password' => $tradingAccount->trading_password ?? '',
            'has_password' => !empty($tradingAccount->trading_password),
        ]);
    }

    /**
     * Set or reset trading account password by administrator.
     */
    public function setPassword(Request $request, TradingAccount $tradingAccount): RedirectResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'string', Rule::in(['generate', 'custom'])],
            'password' => ['nullable', 'string', 'min:4', 'max:128', 'required_if:mode,custom'],
        ]);

        $mode = $validated['mode'] ?? 'custom';
        if ($mode === 'generate' || empty($validated['password'])) {
            $newPassword = \Illuminate\Support\Str::password(12, true, true, false, false);
        } else {
            $newPassword = $validated['password'];
        }

        $tradingAccount->update([
            'trading_password' => $newPassword,
        ]);

        AuditLoggerService::log(
            'trading_password_set',
            auth()->user(),
            TradingAccount::class,
            $tradingAccount->id,
            "Admin updated trading password for account #{$tradingAccount->login_id}"
        );

        AuditLoggerService::log(
            'trading_account_password_reset_by_admin',
            auth()->user(),
            TradingAccount::class,
            $tradingAccount->id,
            "Admin updated trading password for account #{$tradingAccount->login_id}"
        );

        if ($tradingAccount->user) {
            \App\Services\Notification\NotificationService::notify(
                $tradingAccount->user,
                'Trading Account Password Updated',
                "The trading password for account #{$tradingAccount->login_id} ({$tradingAccount->platform_name}) has been reset by an administrator.",
                'info'
            );
        }

        session()->flash('generated_trading_password', $newPassword);
        session()->flash('trading_account_reset_login_id', $tradingAccount->login_id);

        return back()->with('success', "Trading password for account #{$tradingAccount->login_id} updated successfully.");
    }
}
