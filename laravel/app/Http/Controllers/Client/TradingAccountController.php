<?php

namespace App\Http\Controllers\Client;

use App\Contracts\TradingPlatformAdapterInterface;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\TradingAccountReturnRequest;
use App\Models\TradingPasswordResetRequest;
use App\Services\Audit\AuditLoggerService;
use App\Services\Trading\ManualTradingAdapter;
use App\Services\Trading\TradingFundingService;
use App\Services\Trading\TradingReturnService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TradingAccountController extends Controller
{
    protected TradingPlatformAdapterInterface $tradingAdapter;

    public function __construct(?TradingPlatformAdapterInterface $tradingAdapter = null)
    {
        $this->tradingAdapter = $tradingAdapter ?? new ManualTradingAdapter();
    }

    /**
     * Display client trading accounts and account requests.
     */
    public function index(): View
    {
        $user = auth()->user();

        $tradingAccounts = $user->tradingAccounts()->latest()->get();
        $accountRequests = $user->tradingAccountRequests()->latest()->get();
        $passwordResetRequests = $user->tradingPasswordResetRequests()
            ->with('tradingAccount')
            ->latest()
            ->get();
        $fundingRequests = $user->tradingAccountFundingRequests()
            ->with(['tradingAccount', 'transaction'])
            ->latest()
            ->get();
        $returnRequests = $user->tradingAccountReturnRequests()
            ->with(['tradingAccount', 'transaction'])
            ->latest()
            ->get();

        $platforms = config('broker.supported_platforms', []);
        $accountTypes = config('broker.supported_account_types', []);
        $leverages = config('broker.supported_leverages', []);

        // Central Demo/Test Trading Account Settings
        $testAccountEnabled = Setting::get('TRADING_TEST_ACCOUNT_ENABLED', '0') === '1';
        $testAccount = null;
        if ($testAccountEnabled) {
            $testAccount = [
                'name' => Setting::get('TRADING_TEST_ACCOUNT_NAME', 'Broker Demo Account'),
                'platform_name' => Setting::get('TRADING_TEST_ACCOUNT_PLATFORM', 'ArrowTrader MT5'),
                'server_name' => Setting::get('TRADING_TEST_ACCOUNT_SERVER', 'ArrowTrader-Demo01'),
                'login_id' => Setting::get('TRADING_TEST_ACCOUNT_LOGIN', '100001'),
                'account_type' => Setting::get('TRADING_TEST_ACCOUNT_TYPE', 'Demo Standard'),
                'currency' => Setting::get('TRADING_TEST_ACCOUNT_CURRENCY', 'USD'),
                'leverage' => Setting::get('TRADING_TEST_ACCOUNT_LEVERAGE', '1:100'),
                'web_url' => Setting::get('TRADING_TEST_ACCOUNT_WEB_URL', config('broker.platforms.web_trader', '#')),
                'desktop_url' => Setting::get('TRADING_TEST_ACCOUNT_DESKTOP_URL', ''),
                'mobile_url' => Setting::get('TRADING_TEST_ACCOUNT_MOBILE_URL', ''),
            ];
        }

        // Trading Return Rules
        $tradingToWalletEnabled = Setting::get('TRADING_TO_WALLET_ENABLED', '1') !== '0';
        $minReturnAmount = Setting::get('TRADING_TO_WALLET_MIN_AMOUNT', '10.00');
        $maxReturnAmount = Setting::get('TRADING_TO_WALLET_MAX_AMOUNT', '50000.00');

        return view('client.trading-accounts.index', compact(
            'tradingAccounts',
            'accountRequests',
            'passwordResetRequests',
            'fundingRequests',
            'returnRequests',
            'platforms',
            'accountTypes',
            'leverages',
            'testAccountEnabled',
            'testAccount',
            'tradingToWalletEnabled',
            'minReturnAmount',
            'maxReturnAmount'
        ));
    }

    /**
     * Reveal central demo trading account password for authorized client.
     */
    public function revealDemoPassword(Request $request): JsonResponse
    {
        $testAccountEnabled = Setting::get('TRADING_TEST_ACCOUNT_ENABLED', '0') === '1';
        if (!$testAccountEnabled) {
            return response()->json([
                'success' => false,
                'message' => 'Demo trading account is not currently enabled.',
            ], 404);
        }

        $password = Setting::getEncrypted('TRADING_TEST_ACCOUNT_PASSWORD', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD', ''));

        AuditLoggerService::log(
            'demo_trading_password_revealed',
            auth()->user(),
            Setting::class,
            null,
            'Client viewed central test/demo trading password'
        );

        return response()->json([
            'success' => true,
            'password' => $password ?? '',
            'has_password' => !empty($password),
        ]);
    }

    /**
     * Reveal trading account password for authorized client.
     */
    public function revealPassword(Request $request, TradingAccount $tradingAccount): JsonResponse
    {
        if ($tradingAccount->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to trading account credentials.');
        }

        AuditLoggerService::log(
            'trading_password_revealed',
            auth()->user(),
            TradingAccount::class,
            $tradingAccount->id,
            "Client viewed trading password for account #{$tradingAccount->login_id}"
        );

        return response()->json([
            'success' => true,
            'password' => $tradingAccount->trading_password ?? '',
            'has_password' => !empty($tradingAccount->trading_password),
        ]);
    }

    /**
     * Submit a request for a new trading account.
     */
    public function storeRequest(Request $request): RedirectResponse
    {
        $platforms = array_keys(config('broker.supported_platforms', []));
        $accountTypes = config('broker.supported_account_types', []);
        $leverages = config('broker.supported_leverages', []);

        $validated = $request->validate([
            'platform' => ['required', 'string', Rule::in($platforms)],
            'account_type' => ['required', 'string', Rule::in($accountTypes)],
            'leverage' => ['required', 'string', Rule::in($leverages)],
            'currency' => ['required', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $accountRequest = TradingAccountRequest::create([
            'user_id' => auth()->id(),
            'platform' => $validated['platform'],
            'account_type' => $validated['account_type'],
            'leverage' => $validated['leverage'],
            'currency' => strtoupper($validated['currency']),
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->tradingAdapter->processAccountCreation($accountRequest);

        return redirect()->route('client.trading-accounts.index')
            ->with('success', $result['message'] ?? 'Trading account request submitted successfully.');
    }

    /**
     * Submit a trading password reset request for an existing trading account.
     */
    public function storePasswordResetRequest(Request $request, TradingAccount $tradingAccount): RedirectResponse
    {
        if ($tradingAccount->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to trading account.');
        }

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        TradingPasswordResetRequest::create([
            'user_id' => auth()->id(),
            'trading_account_id' => $tradingAccount->id,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
        ]);

        return redirect()->route('client.trading-accounts.index')
            ->with('success', 'Password reset request submitted successfully for administrator review.');
    }

    /**
     * Request trading account funding from CRM wallet balance.
     */
    public function storeFundingRequest(Request $request, TradingAccount $tradingAccount, TradingFundingService $fundingService): RedirectResponse
    {
        if ($tradingAccount->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to trading account.');
        }

        $validated = $request->validate([
            'amount' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $funding = $fundingService->createRequest(
                auth()->user(),
                $tradingAccount,
                $validated['amount'],
                $validated['notes'] ?? null
            );

            return redirect()->route('client.trading-accounts.index')
                ->with('success', "Trading funding request #{$funding->id} for \${$funding->amount} submitted successfully. Funds have been reserved from your wallet.");
        } catch (Exception $e) {
            return redirect()->route('client.trading-accounts.index')
                ->with('error', $e->getMessage());
        }
    }

    /**
     * Cancel a pending trading account funding request.
     */
    public function cancelFundingRequest(Request $request, TradingAccountFundingRequest $funding, TradingFundingService $fundingService): RedirectResponse
    {
        if ($funding->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to funding request.');
        }

        try {
            $fundingService->cancel(
                $funding,
                auth()->user(),
                $request->input('reason')
            );

            return redirect()->route('client.trading-accounts.index')
                ->with('success', "Trading funding request #{$funding->id} cancelled. Reserved funds have been refunded to your wallet.");
        } catch (Exception $e) {
            return redirect()->route('client.trading-accounts.index')
                ->with('error', $e->getMessage());
        }
    }

    /**
     * Client requests return/transfer from trading account to CRM wallet.
     */
    public function storeReturnRequest(Request $request, TradingAccount $tradingAccount, TradingReturnService $returnService): RedirectResponse
    {
        if ($tradingAccount->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to trading account.');
        }

        $validated = $request->validate([
            'amount' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $returnReq = $returnService->createRequest(
                auth()->user(),
                $tradingAccount,
                $validated['amount'],
                $validated['notes'] ?? null
            );

            return redirect()->route('client.trading-accounts.index')
                ->with('success', "Transfer request #{$returnReq->id} for \${$returnReq->amount} to your CRM wallet submitted successfully for administrator review.");
        } catch (Exception $e) {
            return redirect()->route('client.trading-accounts.index')
                ->with('error', $e->getMessage());
        }
    }

    /**
     * Cancel a pending trading account return request.
     */
    public function cancelReturnRequest(Request $request, TradingAccountReturnRequest $returnRequest, TradingReturnService $returnService): RedirectResponse
    {
        if ($returnRequest->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to return request.');
        }

        try {
            $returnService->cancel(
                $returnRequest,
                auth()->user(),
                $request->input('reason')
            );

            return redirect()->route('client.trading-accounts.index')
                ->with('success', "Trading return request #{$returnRequest->id} cancelled successfully.");
        } catch (Exception $e) {
            return redirect()->route('client.trading-accounts.index')
                ->with('error', $e->getMessage());
        }
    }
}
