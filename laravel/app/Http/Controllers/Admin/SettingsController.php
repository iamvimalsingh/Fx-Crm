<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Audit\AuditLoggerService;
use App\Services\Financial\WalletService;
use InvalidArgumentException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    /**
     * Display the Broker CRM system settings view.
     */
    public function index(): View
    {
        $config = config('broker');
        $settings = Setting::allMap();

        return view('admin.settings.index', compact('config', 'settings'));
    }

    /**
     * Update Central Default Test/Demo Trading Account configuration.
     */
    public function updateTestAccount(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'in:0,1'],
            'name' => ['nullable', 'string', 'max:128'],
            'platform' => ['nullable', 'string', 'max:64'],
            'server' => ['nullable', 'string', 'max:128'],
            'login' => ['nullable', 'string', 'max:64'],
            'password' => ['nullable', 'string', 'max:128'],
            'account_type' => ['nullable', 'string', 'max:64'],
            'currency' => ['nullable', 'string', 'size:3'],
            'leverage' => ['nullable', 'string', 'max:32'],
            'web_url' => ['nullable', 'string', 'max:255'],
            'desktop_url' => ['nullable', 'string', 'max:255'],
            'mobile_url' => ['nullable', 'string', 'max:255'],
        ]);

        Setting::set('TRADING_TEST_ACCOUNT_ENABLED', $validated['enabled']);
        Setting::set('TRADING_TEST_ACCOUNT_NAME', $validated['name'] ?? 'Broker Demo Account');
        Setting::set('TRADING_TEST_ACCOUNT_PLATFORM', $validated['platform'] ?? 'ArrowTrader MT5');
        Setting::set('TRADING_TEST_ACCOUNT_SERVER', $validated['server'] ?? 'ArrowTrader-Demo01');
        Setting::set('TRADING_TEST_ACCOUNT_LOGIN', $validated['login'] ?? '100001');

        if (!empty($validated['password'])) {
            Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', $validated['password']);
        }

        Setting::set('TRADING_TEST_ACCOUNT_TYPE', $validated['account_type'] ?? 'Demo Standard');
        Setting::set('TRADING_TEST_ACCOUNT_CURRENCY', strtoupper($validated['currency'] ?? 'USD'));
        Setting::set('TRADING_TEST_ACCOUNT_LEVERAGE', $validated['leverage'] ?? '1:100');
        Setting::set('TRADING_TEST_ACCOUNT_WEB_URL', $validated['web_url'] ?? '');
        Setting::set('TRADING_TEST_ACCOUNT_DESKTOP_URL', $validated['desktop_url'] ?? '');
        Setting::set('TRADING_TEST_ACCOUNT_MOBILE_URL', $validated['mobile_url'] ?? '');

        AuditLoggerService::log(
            'settings_test_account_updated',
            auth()->user(),
            Setting::class,
            null,
            "Admin updated Central Default Test Account configuration (Enabled: {$validated['enabled']}, Login: " . ($validated['login'] ?? 'N/A') . ')'
        );

        return back()->with('success', 'Central Default Test Account settings updated successfully.');
    }

    /**
     * Securely reveal Central Demo Trading Account password for administrator.
     */
    public function revealDemoPassword(Request $request): JsonResponse
    {
        $password = Setting::getEncrypted('TRADING_TEST_ACCOUNT_PASSWORD', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD', ''));

        AuditLoggerService::log(
            'admin_demo_trading_password_revealed',
            auth()->user(),
            Setting::class,
            null,
            'Admin viewed Central Default Test Account password'
        );

        return response()->json([
            'success' => true,
            'password' => $password ?? '',
            'has_password' => !empty($password),
        ]);
    }

    /**
     * Update Trading Account Return & Wallet rules using BCMath decimal normalization.
     */
    public function updateTradingWalletRules(Request $request, WalletService $walletService): RedirectResponse
    {
        $validated = $request->validate([
            'trading_to_wallet_enabled' => ['required', 'in:0,1'],
            'min_amount' => ['required', 'string'],
            'max_amount' => ['required', 'string'],
        ]);

        try {
            $minNormalized = $walletService->normalizeAmount($validated['min_amount']);
            $maxNormalized = $walletService->normalizeAmount($validated['max_amount']);
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['min_amount' => 'Invalid monetary format: ' . $e->getMessage()])->withInput();
        }

        if ($walletService->compare($minNormalized, '0.00') <= 0) {
            return back()->withErrors(['min_amount' => 'Minimum amount must be greater than zero.'])->withInput();
        }

        if ($walletService->compare($maxNormalized, $minNormalized) < 0) {
            return back()->withErrors(['max_amount' => 'Maximum amount must be greater than or equal to minimum amount.'])->withInput();
        }

        Setting::set('TRADING_TO_WALLET_ENABLED', $validated['trading_to_wallet_enabled']);
        Setting::set('TRADING_TO_WALLET_MIN_AMOUNT', $minNormalized);
        Setting::set('TRADING_TO_WALLET_MAX_AMOUNT', $maxNormalized);

        AuditLoggerService::log(
            'settings_trading_rules_updated',
            auth()->user(),
            Setting::class,
            null,
            "Admin updated Trading Return to Wallet rules (Enabled: {$validated['trading_to_wallet_enabled']}, Min: \${$minNormalized}, Max: \${$maxNormalized})"
        );

        return back()->with('success', 'Trading Return to Wallet configuration updated successfully.');
    }

    /**
     * Update Support Center contact and help desk configuration.
     */
    public function updateSupportSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'support_email' => ['required', 'email', 'max:128'],
            'support_phone' => ['nullable', 'string', 'max:64'],
            'support_whatsapp' => ['nullable', 'string', 'max:64'],
            'support_hours' => ['nullable', 'string', 'max:128'],
            'support_timezone' => ['nullable', 'string', 'max:64'],
            'support_instructions' => ['nullable', 'string', 'max:1000'],
            'support_emergency' => ['nullable', 'string', 'max:500'],
        ]);

        Setting::set('SUPPORT_EMAIL', $validated['support_email']);
        Setting::set('SUPPORT_PHONE', $validated['support_phone'] ?? '');
        Setting::set('SUPPORT_WHATSAPP', $validated['support_whatsapp'] ?? '');
        Setting::set('SUPPORT_HOURS', $validated['support_hours'] ?? '');
        Setting::set('SUPPORT_TIMEZONE', $validated['support_timezone'] ?? '');
        Setting::set('SUPPORT_INSTRUCTIONS', $validated['support_instructions'] ?? '');
        Setting::set('SUPPORT_EMERGENCY_CONTACT', $validated['support_emergency'] ?? '');

        AuditLoggerService::log(
            'settings_support_updated',
            auth()->user(),
            Setting::class,
            null,
            "Admin updated Support Center contact information (Email: {$validated['support_email']})"
        );

        return back()->with('success', 'Support Center configuration updated successfully.');
    }
}

