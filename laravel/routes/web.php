<?php

use App\Http\Controllers\Auth\AdminLoginController;
use App\Http\Controllers\Auth\ClientLoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\VerificationController;
use App\Http\Controllers\Client\DashboardController;
use App\Http\Controllers\Client\ProfileController;
use App\Http\Controllers\Client\TradingAccountController;
use App\Http\Controllers\Client\WalletController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes — Forex Broker Client CRM
|--------------------------------------------------------------------------
*/

// Root redirect
Route::get('/', function () {
    return redirect()->route('login');
});

/*
|--------------------------------------------------------------------------
| Guest Auth Routes (Client Portal)
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function () {
    // Client Registration
    Route::get('/register', [RegisterController::class, 'showRegistrationForm'])->name('register');
    Route::post('/register', [RegisterController::class, 'register']);

    // Client Login
    Route::get('/login', [ClientLoginController::class, 'showLoginForm'])->name('login');
    Route::post('/login', [ClientLoginController::class, 'login']);

    // Admin Login
    Route::get('/admin/login', [AdminLoginController::class, 'showLoginForm'])->name('admin.login');
    Route::post('/admin/login', [AdminLoginController::class, 'login']);

    // Password Reset
    Route::get('/forgot-password', [PasswordResetController::class, 'showLinkRequestForm'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLinkEmail'])->name('password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'showResetForm'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->name('password.update');
});

/*
|--------------------------------------------------------------------------
| Authenticated Client Routes (Protected by 'client' Middleware)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'client'])->group(function () {
    // Email Verification Notice & signed handling
    Route::get('/email/verify', [VerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/email/verify/{id}/{hash}', [VerificationController::class, 'verify'])->middleware('signed')->name('verification.verify');
    Route::post('/email/verification-notification', [VerificationController::class, 'resend'])->middleware('throttle:6,1')->name('verification.send');

    // Client Module Routes
    Route::get('/dashboard', [DashboardController::class, 'dashboard'])->name('client.dashboard');
    Route::get('/wallet', [DashboardController::class, 'wallet'])->name('client.wallet');
    Route::post('/client/wallet/deposit', [WalletController::class, 'storeDeposit'])->name('client.wallet.deposit');
    Route::post('/client/wallet/withdraw', [WalletController::class, 'storeWithdrawal'])->name('client.wallet.withdraw');
    Route::post('/client/wallet/withdraw/{withdrawal}/cancel', [WalletController::class, 'cancelWithdrawal'])->name('client.wallet.withdraw.cancel');
    Route::get('/activity', [DashboardController::class, 'activity'])->name('client.activity');
    Route::get('/trade', [DashboardController::class, 'trade'])->name('client.trade');

    // Profile Routes
    Route::get('/profile', [ProfileController::class, 'edit'])->name('client.profile');
    Route::post('/profile', [ProfileController::class, 'update'])->name('client.profile.update');

    // KYC Verification Routes
    Route::get('/kyc', [\App\Http\Controllers\Client\KycController::class, 'index'])->name('client.kyc.index');
    Route::post('/kyc/document', [\App\Http\Controllers\Client\KycController::class, 'uploadDocument'])->name('client.kyc.document.upload');
    Route::post('/kyc/submit', [\App\Http\Controllers\Client\KycController::class, 'submit'])->name('client.kyc.submit');
    Route::get('/kyc/documents/{document}', [\App\Http\Controllers\Client\KycController::class, 'viewDocument'])->name('client.kyc.document.view');

    // Trading Account Management Routes
    Route::get('/client/trading-accounts', [TradingAccountController::class, 'index'])->name('client.trading-accounts.index');
    Route::post('/client/trading-accounts/request', [TradingAccountController::class, 'storeRequest'])->name('client.trading-accounts.request');
    Route::post('/client/trading-accounts/reveal-demo-password', [TradingAccountController::class, 'revealDemoPassword'])->name('client.trading-accounts.reveal-demo-password');
    Route::post('/client/trading-accounts/{tradingAccount}/reset-password-request', [TradingAccountController::class, 'storePasswordResetRequest'])->name('client.trading-accounts.reset-password');
    Route::post('/client/trading-accounts/{tradingAccount}/reveal-password', [TradingAccountController::class, 'revealPassword'])->name('client.trading-accounts.reveal-password');
    Route::post('/client/trading-accounts/{tradingAccount}/fund', [TradingAccountController::class, 'storeFundingRequest'])->name('client.trading-accounts.fund');
    Route::post('/client/trading-accounts/fundings/{funding}/cancel', [TradingAccountController::class, 'cancelFundingRequest'])->name('client.trading-accounts.fund.cancel');
    Route::post('/client/trading-accounts/{tradingAccount}/return', [TradingAccountController::class, 'storeReturnRequest'])->name('client.trading-accounts.return');
    Route::post('/client/trading-accounts/returns/{returnRequest}/cancel', [TradingAccountController::class, 'cancelReturnRequest'])->name('client.trading-accounts.return.cancel');

    // In-App Notification Center
    Route::get('/notifications', [\App\Http\Controllers\Client\NotificationController::class, 'index'])->name('client.notifications');
    Route::post('/notifications/{id}/read', [\App\Http\Controllers\Client\NotificationController::class, 'markAsRead'])->name('client.notifications.read');
    Route::post('/notifications/read-all', [\App\Http\Controllers\Client\NotificationController::class, 'markAllAsRead'])->name('client.notifications.readAll');

    // In-App Support Center
    Route::get('/support', [\App\Http\Controllers\Client\SupportController::class, 'index'])->name('client.support.index');
    Route::get('/support/create', [\App\Http\Controllers\Client\SupportController::class, 'create'])->name('client.support.create');
    Route::post('/support', [\App\Http\Controllers\Client\SupportController::class, 'store'])->name('client.support.store');
    Route::get('/support/{ticket}', [\App\Http\Controllers\Client\SupportController::class, 'show'])->name('client.support.show');
    Route::post('/support/{ticket}/reply', [\App\Http\Controllers\Client\SupportController::class, 'reply'])->name('client.support.reply');
    Route::post('/support/{ticket}/reopen', [\App\Http\Controllers\Client\SupportController::class, 'reopen'])->name('client.support.reopen');
});

Route::middleware(['auth'])->group(function () {
    // Secure Logout for all authenticated users
    Route::post('/logout', [LogoutController::class, 'logout'])->name('logout');

    Route::get('/support/attachments/{attachment}', [\App\Http\Controllers\Client\SupportController::class, 'downloadAttachment'])->name('client.support.attachments.download');
});

/*
|--------------------------------------------------------------------------
| Authenticated Admin Routes (Protected by 'admin' Middleware)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::post('/logout', [LogoutController::class, 'adminLogout'])->name('logout');

    // Dashboard
    Route::get('/dashboard', [\App\Http\Controllers\Admin\DashboardController::class, 'index'])->name('dashboard');

    // Clients
    Route::get('/clients', [\App\Http\Controllers\Admin\ClientController::class, 'index'])->name('clients.index');
    Route::get('/clients/{client}', [\App\Http\Controllers\Admin\ClientController::class, 'show'])->name('clients.show');
    Route::post('/clients/{client}/status', [\App\Http\Controllers\Admin\ClientController::class, 'updateStatus'])->name('clients.status');
    Route::post('/clients/{client}/reset-password', [\App\Http\Controllers\Admin\ClientController::class, 'resetPassword'])->name('clients.reset-password');

    // Deposits
    Route::get('/deposits', [\App\Http\Controllers\Admin\DepositController::class, 'index'])->name('deposits.index');
    Route::post('/deposits/{deposit}/approve', [\App\Http\Controllers\Admin\DepositController::class, 'approve'])->name('deposits.approve');
    Route::post('/deposits/{deposit}/reject', [\App\Http\Controllers\Admin\DepositController::class, 'reject'])->name('deposits.reject');
    Route::post('/deposits/manual', [\App\Http\Controllers\Admin\DepositController::class, 'storeManual'])->name('deposits.manual');

    // Withdrawals
    Route::get('/withdrawals', [\App\Http\Controllers\Admin\WithdrawalController::class, 'index'])->name('withdrawals.index');
    Route::post('/withdrawals/{withdrawal}/complete', [\App\Http\Controllers\Admin\WithdrawalController::class, 'complete'])->name('withdrawals.complete');
    Route::post('/withdrawals/{withdrawal}/reject', [\App\Http\Controllers\Admin\WithdrawalController::class, 'reject'])->name('withdrawals.reject');

    // Trading Account Requests
    Route::get('/trading-accounts/requests', [\App\Http\Controllers\Admin\TradingAccountRequestController::class, 'index'])->name('trading-accounts.requests.index');
    Route::post('/trading-accounts/requests/{accountRequest}/approve', [\App\Http\Controllers\Admin\TradingAccountRequestController::class, 'approve'])->name('trading-accounts.requests.approve');
    Route::post('/trading-accounts/requests/{accountRequest}/reject', [\App\Http\Controllers\Admin\TradingAccountRequestController::class, 'reject'])->name('trading-accounts.requests.reject');

    // Trading Password Resets
    Route::get('/trading-accounts/password-resets', [\App\Http\Controllers\Admin\TradingPasswordResetController::class, 'index'])->name('trading-accounts.password-resets.index');
    Route::post('/trading-accounts/password-resets/{resetRequest}/complete', [\App\Http\Controllers\Admin\TradingPasswordResetController::class, 'complete'])->name('trading-accounts.password-resets.complete');
    Route::post('/trading-accounts/password-resets/{resetRequest}/reject', [\App\Http\Controllers\Admin\TradingPasswordResetController::class, 'reject'])->name('trading-accounts.password-resets.reject');

    // Trading Accounts
    Route::get('/trading-accounts', [\App\Http\Controllers\Admin\TradingAccountController::class, 'index'])->name('trading-accounts.index');
    Route::post('/trading-accounts/{tradingAccount}/status', [\App\Http\Controllers\Admin\TradingAccountController::class, 'updateStatus'])->name('trading-accounts.status');
    Route::post('/trading-accounts/{tradingAccount}/reveal-password', [\App\Http\Controllers\Admin\TradingAccountController::class, 'revealPassword'])->name('trading-accounts.reveal-password');
    Route::post('/trading-accounts/{tradingAccount}/set-password', [\App\Http\Controllers\Admin\TradingAccountController::class, 'setPassword'])->name('trading-accounts.set-password');

    // Trading Fundings
    Route::get('/fundings', [\App\Http\Controllers\Admin\TradingFundingController::class, 'index'])->name('fundings.index');
    Route::post('/fundings/{funding}/complete', [\App\Http\Controllers\Admin\TradingFundingController::class, 'complete'])->name('fundings.complete');
    Route::post('/fundings/{funding}/reject', [\App\Http\Controllers\Admin\TradingFundingController::class, 'reject'])->name('fundings.reject');

    // Trading Returns (External to CRM Wallet)
    Route::get('/trading-returns', [\App\Http\Controllers\Admin\TradingReturnController::class, 'index'])->name('returns.index');
    Route::post('/trading-returns/{returnRequest}/complete', [\App\Http\Controllers\Admin\TradingReturnController::class, 'complete'])->name('returns.complete');
    Route::post('/trading-returns/{returnRequest}/reject', [\App\Http\Controllers\Admin\TradingReturnController::class, 'reject'])->name('returns.reject');

    // Transactions
    Route::get('/transactions', [\App\Http\Controllers\Admin\TransactionController::class, 'index'])->name('transactions.index');

    // Audit Logs
    Route::get('/audit-logs', [\App\Http\Controllers\Admin\AuditLogController::class, 'index'])->name('audit-logs.index');

    // KYC Management
    Route::get('/kyc', [\App\Http\Controllers\Admin\KycController::class, 'index'])->name('kyc.index');
    Route::get('/kyc/{client}', [\App\Http\Controllers\Admin\KycController::class, 'show'])->name('kyc.show');
    Route::post('/kyc/{client}/approve', [\App\Http\Controllers\Admin\KycController::class, 'approveProfile'])->name('kyc.profiles.approve');
    Route::post('/kyc/{client}/reject', [\App\Http\Controllers\Admin\KycController::class, 'rejectProfile'])->name('kyc.profiles.reject');
    Route::post('/kyc/documents/{document}/approve', [\App\Http\Controllers\Admin\KycController::class, 'approveDocument'])->name('kyc.documents.approve');
    Route::post('/kyc/documents/{document}/reject', [\App\Http\Controllers\Admin\KycController::class, 'rejectDocument'])->name('kyc.documents.reject');
    Route::get('/kyc/documents/{document}/view', [\App\Http\Controllers\Admin\KycController::class, 'viewDocument'])->name('kyc.documents.view');

    // Settings
    Route::get('/settings', [\App\Http\Controllers\Admin\SettingsController::class, 'index'])->name('settings');
    Route::post('/settings/reveal-demo-password', [\App\Http\Controllers\Admin\SettingsController::class, 'revealDemoPassword'])->name('settings.reveal-demo-password');
    Route::post('/settings/test-account', [\App\Http\Controllers\Admin\SettingsController::class, 'updateTestAccount'])->name('settings.test-account');
    Route::post('/settings/trading-wallet-rules', [\App\Http\Controllers\Admin\SettingsController::class, 'updateTradingWalletRules'])->name('settings.trading-wallet-rules');
    Route::post('/settings/support', [\App\Http\Controllers\Admin\SettingsController::class, 'updateSupportSettings'])->name('settings.support');

    // Support Center
    Route::get('/support', [\App\Http\Controllers\Admin\SupportController::class, 'index'])->name('support.index');
    Route::get('/support/{ticket}', [\App\Http\Controllers\Admin\SupportController::class, 'show'])->name('support.show');
    Route::post('/support/{ticket}/reply', [\App\Http\Controllers\Admin\SupportController::class, 'reply'])->name('support.reply');
    Route::post('/support/{ticket}/note', [\App\Http\Controllers\Admin\SupportController::class, 'addNote'])->name('support.note');
    Route::post('/support/{ticket}/status', [\App\Http\Controllers\Admin\SupportController::class, 'updateStatus'])->name('support.status');
    Route::post('/support/{ticket}/priority', [\App\Http\Controllers\Admin\SupportController::class, 'updatePriority'])->name('support.priority');
    Route::post('/support/{ticket}/assign', [\App\Http\Controllers\Admin\SupportController::class, 'assign'])->name('support.assign');

    // Navigation and backward-compatible route aliases
    Route::get('/kyc-alias', function () { return redirect()->route('admin.kyc.index'); })->name('kyc');
    Route::get('/payment-methods', function () { return redirect()->route('admin.deposits.index'); })->name('payment-methods');
    Route::get('/clients-alias', function() { return redirect()->route('admin.clients.index'); })->name('clients');
    Route::get('/deposits-alias', function() { return redirect()->route('admin.deposits.index'); })->name('deposits');
    Route::get('/withdrawals-alias', function() { return redirect()->route('admin.withdrawals.index'); })->name('withdrawals');
    Route::get('/transactions-alias', function() { return redirect()->route('admin.transactions.index'); })->name('transactions');
    Route::get('/audit-logs-alias', function() { return redirect()->route('admin.audit-logs.index'); })->name('audit-logs');
});
