<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TradingAccount;
use App\Models\TradingAccountRequest;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TradingAccountRequestController extends Controller
{
    /**
     * Display a listing of trading account provisioning requests.
     */
    public function index(Request $request): View
    {
        $query = TradingAccountRequest::with(['user.profile', 'tradingAccount']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
                $query->where('status', $status);
            }
        }

        $requests = $query->latest()->paginate(15)->withQueryString();
        $platforms = config('broker.supported_platforms', []);
        $accountTypes = config('broker.supported_account_types', []);
        $leverages = config('broker.supported_leverages', []);

        return view('admin.trading-accounts.requests', compact(
            'requests',
            'platforms',
            'accountTypes',
            'leverages'
        ));
    }

    /**
     * Approve a trading account request by recording the manually provisioned external trading account details.
     * NO password input or storage.
     */
    public function approve(Request $request, TradingAccountRequest $accountRequest): RedirectResponse
    {
        if ($accountRequest->status !== 'pending') {
            return back()->with('error', 'Only pending account requests can be approved.');
        }

        $platforms = array_keys(config('broker.supported_platforms', []));
        $accountTypes = config('broker.supported_account_types', []);
        $leverages = config('broker.supported_leverages', []);

        $validated = $request->validate([
            'platform_name' => ['required', 'string', Rule::in($platforms)],
            'login_id' => [
                'required',
                'string',
                'max:64',
                Rule::unique('trading_accounts')->where(function ($query) use ($request) {
                    return $query->where('platform_name', $request->input('platform_name'))
                        ->where('server_name', $request->input('server_name'));
                }),
            ],
            'server_name' => ['required', 'string', 'max:128'],
            'account_type' => ['required', 'string', Rule::in($accountTypes)],
            'currency' => ['required', 'string', 'size:3'],
            'leverage' => ['required', 'string', Rule::in($leverages)],
            'status' => ['required', Rule::in(['active', 'suspended', 'disabled'])],
            'trading_password' => ['nullable', 'string', 'min:4', 'max:128'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            DB::transaction(function () use ($accountRequest, $validated) {
                // 1. Create TradingAccount
                $tradingAccount = TradingAccount::create([
                    'user_id' => $accountRequest->user_id,
                    'platform_name' => $validated['platform_name'],
                    'server_name' => $validated['server_name'],
                    'login_id' => $validated['login_id'],
                    'account_type' => $validated['account_type'],
                    'currency' => strtoupper($validated['currency']),
                    'leverage' => $validated['leverage'],
                    'status' => $validated['status'],
                    'trading_password' => $validated['trading_password'] ?? null,
                ]);

                // 2. Update TradingAccountRequest
                $accountRequest->update([
                    'trading_account_id' => $tradingAccount->id,
                    'status' => 'approved',
                    'admin_notes' => $validated['admin_notes'] ?? null,
                ]);

                // 3. Log Audit
                AuditLoggerService::log(
                    'trading_account_request_approved',
                    auth()->user(),
                    TradingAccountRequest::class,
                    $accountRequest->id,
                    "Admin manually registered {$validated['platform_name']} account #{$validated['login_id']} on server {$validated['server_name']} for user #{$accountRequest->user_id}"
                );

                if ($accountRequest->user) {
                    NotificationService::notify(
                        $accountRequest->user,
                        'Trading Account Request Approved',
                        "Your request for a {$validated['platform_name']} trading account has been approved! Login ID: {$validated['login_id']}.",
                        'trading_account_approved',
                        route('client.trading-accounts.index')
                    );
                }
            });

            return back()->with('success', "Trading account request #{$accountRequest->id} approved and trading account #{$validated['login_id']} registered successfully.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Reject a trading account request.
     */
    public function reject(Request $request, TradingAccountRequest $accountRequest): RedirectResponse
    {
        if ($accountRequest->status !== 'pending') {
            return back()->with('error', 'Only pending account requests can be rejected.');
        }

        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $accountRequest->update([
            'status' => 'rejected',
            'admin_notes' => $validated['rejection_reason'],
        ]);

        AuditLoggerService::log(
            'trading_account_request_rejected',
            auth()->user(),
            TradingAccountRequest::class,
            $accountRequest->id,
            "Admin rejected trading account request #{$accountRequest->id}: {$validated['rejection_reason']}"
        );

        if ($accountRequest->user) {
            NotificationService::notify(
                $accountRequest->user,
                'Trading Account Request Rejected',
                "Your request for a {$accountRequest->platform_name} trading account was rejected. Reason: {$validated['rejection_reason']}",
                'trading_account_rejected',
                route('client.trading-accounts.index')
            );
        }

        return back()->with('success', "Trading account request #{$accountRequest->id} rejected.");
    }
}
