<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TradingPasswordResetRequest;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TradingPasswordResetController extends Controller
{
    /**
     * Display a listing of trading password reset requests.
     */
    public function index(Request $request): View
    {
        $query = TradingPasswordResetRequest::with(['user.profile', 'tradingAccount']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'completed', 'rejected'], true)) {
                $query->where('status', $status);
            }
        }

        $requests = $query->latest()->paginate(15)->withQueryString();

        return view('admin.trading-accounts.password-resets', compact('requests'));
    }

    /**
     * Complete the password reset request after manual reset on external platform.
     * NO password input or storage.
     */
    public function complete(Request $request, TradingPasswordResetRequest $resetRequest): RedirectResponse
    {
        if ($resetRequest->status !== 'pending') {
            return back()->with('error', 'Only pending password reset requests can be completed.');
        }

        $resetRequest->update([
            'status' => 'completed',
            'admin_notes' => $request->input('admin_notes'),
        ]);

        AuditLoggerService::log(
            'trading_password_reset_completed',
            auth()->user(),
            TradingPasswordResetRequest::class,
            $resetRequest->id,
            "Admin confirmed external password reset completed for account #{$resetRequest->tradingAccount?->login_id}"
        );

        if ($resetRequest->user) {
            NotificationService::notify(
                $resetRequest->user,
                'Trading Password Reset Completed',
                "Your password reset request for trading account #{$resetRequest->tradingAccount?->login_id} has been completed.",
                'trading_password_reset_completed',
                route('client.trading-accounts.index')
            );
        }

        return back()->with('success', "Password reset request #{$resetRequest->id} marked as completed.");
    }

    /**
     * Reject the password reset request.
     */
    public function reject(Request $request, TradingPasswordResetRequest $resetRequest): RedirectResponse
    {
        if ($resetRequest->status !== 'pending') {
            return back()->with('error', 'Only pending password reset requests can be rejected.');
        }

        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $resetRequest->update([
            'status' => 'rejected',
            'admin_notes' => $validated['rejection_reason'],
        ]);

        AuditLoggerService::log(
            'trading_password_reset_rejected',
            auth()->user(),
            TradingPasswordResetRequest::class,
            $resetRequest->id,
            "Admin rejected password reset request #{$resetRequest->id}: {$validated['rejection_reason']}"
        );

        if ($resetRequest->user) {
            NotificationService::notify(
                $resetRequest->user,
                'Trading Password Reset Rejected',
                "Your password reset request for trading account #{$resetRequest->tradingAccount?->login_id} was rejected. Reason: {$validated['rejection_reason']}",
                'trading_password_reset_rejected',
                route('client.trading-accounts.index')
            );
        }

        return back()->with('success', "Password reset request #{$resetRequest->id} rejected.");
    }
}
