<?php

namespace Tests\Feature;

use App\Enums\TransactionType;
use App\Models\AuditLog;
use App\Models\Deposit;
use App\Models\PaymentMethod;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\TradingPasswordResetRequest;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Financial\WalletService;
use App\Services\Financial\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOperationsTerminalTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $client;
    protected WalletService $walletService;
    protected WithdrawalService $withdrawalService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);
        $this->withdrawalService = app(WithdrawalService::class);

        $this->admin = User::factory()->create([
            'email' => 'admin@broker.test',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->client = User::factory()->create([
            'email' => 'client@user.test',
            'role' => 'client',
            'status' => 'active',
        ]);
        $this->walletService->getWallet($this->client);
    }

    /**
     * Helper to get client balance.
     */
    protected function getClientBalance(User $user): string
    {
        return $this->walletService->getWallet($user->fresh())->balance;
    }

    /**
     * Test admin authentication and role authorization across terminal endpoints.
     */
    public function test_admin_routes_protected_by_auth_and_admin_middleware(): void
    {
        // 1. Unauthenticated redirect
        $res = $this->get(route('admin.dashboard'));
        $res->assertRedirect(route('login'));

        // 2. Client role receives 403 Forbidden
        $res = $this->actingAs($this->client)->get(route('admin.dashboard'));
        $res->assertForbidden();

        $res = $this->actingAs($this->client)->get(route('admin.clients.index'));
        $res->assertForbidden();

        // 3. Admin receives 200 OK on all operational terminal views
        $routes = [
            'admin.dashboard',
            'admin.clients.index',
            'admin.deposits.index',
            'admin.withdrawals.index',
            'admin.trading-accounts.index',
            'admin.trading-accounts.requests.index',
            'admin.trading-accounts.password-resets.index',
            'admin.fundings.index',
            'admin.transactions.index',
            'admin.audit-logs.index',
            'admin.settings',
        ];

        foreach ($routes as $route) {
            $response = $this->actingAs($this->admin)->get(route($route));
            $response->assertOk();
        }

        // Show single client 360
        $response = $this->actingAs($this->admin)->get(route('admin.clients.show', $this->client->id));
        $response->assertOk();
        $response->assertSee($this->client->email);
    }

    /**
     * Test Dashboard metric counters and aggregations.
     */
    public function test_admin_dashboard_metrics_aggregation(): void
    {
        // Add funds to client wallet
        $this->walletService->credit($this->client, '1500.00', TransactionType::DEPOSIT, 'Initial deposit');

        // Create pending deposit
        Deposit::create([
            'user_id' => $this->client->id,
            'amount' => '250.00',
            'status' => 'pending',
            'request_channel' => 'client_panel',
            'credit_reason' => 'deposit',
        ]);

        // Create pending withdrawal
        $this->withdrawalService->createClientRequest($this->client, '100.00', 'bank_transfer', 'IBAN: US991234');

        $response = $this->actingAs($this->admin)->get(route('admin.dashboard'));
        $response->assertOk();
        $response->assertSee('Total CRM Wallet Funds');
        $response->assertSee('$1,400.00'); // 1500 credited - 100 reserved for withdrawal
    }

    /**
     * Test Client 360 status enable/disable workflow.
     */
    public function test_admin_can_update_client_status(): void
    {
        $this->assertEquals('active', $this->client->status->value ?? $this->client->status);

        // Disable client
        $response = $this->actingAs($this->admin)->post(route('admin.clients.status', $this->client->id), [
            'status' => 'disabled',
            'reason' => 'Compliance review',
        ]);

        $response->assertRedirect();
        $this->client->refresh();
        $this->assertEquals('disabled', $this->client->status->value ?? $this->client->status);

        // Check audit log
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'target_id' => $this->client->id,
            'action' => 'client_status_updated',
        ]);

        // Re-enable client
        $response = $this->actingAs($this->admin)->post(route('admin.clients.status', $this->client->id), [
            'status' => 'active',
        ]);
        $this->client->refresh();
        $this->assertEquals('active', $this->client->status->value ?? $this->client->status);
    }

    /**
     * Test Deposit Approval and Rejection workflows.
     */
    public function test_admin_deposit_approval_and_rejection(): void
    {
        // 1. Approve workflow
        $deposit1 = Deposit::create([
            'user_id' => $this->client->id,
            'amount' => '500.00',
            'status' => 'pending',
            'request_channel' => 'client_panel',
            'credit_reason' => 'deposit',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.deposits.approve', $deposit1->id), [
            'admin_notes' => 'Confirmed via wire ref #12345',
        ]);

        $response->assertRedirect();
        $deposit1->refresh();
        $this->assertEquals('completed', $deposit1->status);
        $this->assertEquals('500.00', $this->getClientBalance($this->client));

        // 2. Reject workflow
        $deposit2 = Deposit::create([
            'user_id' => $this->client->id,
            'amount' => '300.00',
            'status' => 'pending',
            'request_channel' => 'client_panel',
            'credit_reason' => 'deposit',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.deposits.reject', $deposit2->id), [
            'rejection_reason' => 'Wire funds not received in bank',
        ]);

        $response->assertRedirect();
        $deposit2->refresh();
        $this->assertEquals('rejected', $deposit2->status);
        // Balance remains unchanged from deposit1 (500.00)
        $this->assertEquals('500.00', $this->getClientBalance($this->client));
    }

    /**
     * Test Manual Deposit / Bonus creation follows Pending -> Approve -> Credit workflow.
     */
    public function test_admin_manual_deposit_creation_and_approval_cycle(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.deposits.manual'), [
            'user_id' => $this->client->id,
            'amount' => '150.00',
            'request_channel' => 'phone',
            'credit_reason' => 'bonus',
            'client_notes' => 'Welcome trading credit',
            'admin_notes' => 'VIP onboarding bonus promo',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        // Must be in pending state in database
        $deposit = Deposit::where('user_id', $this->client->id)->where('credit_reason', 'bonus')->first();
        $this->assertNotNull($deposit);
        $this->assertEquals('pending', $deposit->status);
        $this->assertEquals('bonus', $deposit->credit_reason);
        $this->assertEquals('phone', $deposit->request_channel);

        // Wallet is NOT credited yet
        $this->assertEquals('0.00', $this->getClientBalance($this->client));

        // Now admin approves it
        $this->actingAs($this->admin)->post(route('admin.deposits.approve', $deposit->id));
        $this->assertEquals('150.00', $this->getClientBalance($this->client));
    }

    /**
     * Test Withdrawal completion and rejection workflows.
     */
    public function test_admin_withdrawal_completion_and_rejection(): void
    {
        $this->walletService->credit($this->client, '1000.00', TransactionType::DEPOSIT, 'Initial balance');

        // 1. Complete Withdrawal
        $wd1 = $this->withdrawalService->createClientRequest($this->client, '200.00', 'bank_transfer', 'Account: 987654');
        $this->assertEquals('800.00', $this->getClientBalance($this->client));

        $response = $this->actingAs($this->admin)->post(route('admin.withdrawals.complete', $wd1->id), [
            'admin_notes' => 'Wire MT103 dispatched',
        ]);
        $response->assertRedirect();
        $wd1->refresh();
        $this->assertEquals('completed', $wd1->status);
        $this->assertEquals('800.00', $this->getClientBalance($this->client));

        // 2. Reject Withdrawal (Refunds reserved funds)
        $wd2 = $this->withdrawalService->createClientRequest($this->client, '300.00', 'usdt_trc20', '0x123456789');
        $this->assertEquals('500.00', $this->getClientBalance($this->client));

        $response = $this->actingAs($this->admin)->post(route('admin.withdrawals.reject', $wd2->id), [
            'rejection_reason' => 'Invalid USDT ERC20 wallet address',
        ]);
        $response->assertRedirect();
        $wd2->refresh();
        $this->assertEquals('rejected', $wd2->status);
        // Wallet balance refunded back to 800.00
        $this->assertEquals('800.00', $this->getClientBalance($this->client));
    }

    /**
     * Test Trading Account Request approval creates account without password storage.
     */
    public function test_admin_trading_account_request_approval(): void
    {
        $req = TradingAccountRequest::create([
            'user_id' => $this->client->id,
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
            'status' => 'pending',
            'notes' => 'Client request for WebTrader standard',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.requests.approve', $req->id), [
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '998877',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
            'admin_notes' => 'Account setup on MT5 bridge server',
        ]);

        $response->assertRedirect();
        $req->refresh();
        $this->assertEquals('approved', $req->status);
        $this->assertNotNull($req->trading_account_id);

        $account = TradingAccount::where('login_id', '998877')->first();
        $this->assertNotNull($account);
        $this->assertEquals($this->client->id, $account->user_id);
        $this->assertEquals('active', $account->status);
    }

    /**
     * Test Trading Password Reset Request completion without password storage.
     */
    public function test_admin_trading_password_reset_completion(): void
    {
        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '112233',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $resetReq = TradingPasswordResetRequest::create([
            'user_id' => $this->client->id,
            'trading_account_id' => $account->id,
            'status' => 'pending',
            'notes' => 'Forgot password',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.password-resets.complete', $resetReq->id), [
            'admin_notes' => 'Password reset on platform server and dispatched via secure email.',
        ]);

        $response->assertRedirect();
        $resetReq->refresh();
        $this->assertEquals('completed', $resetReq->status);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->admin->id,
            'action' => 'trading_password_reset_completed',
        ]);
    }

    /**
     * Test Trading Funding request lifecycle (Request -> Reserve -> Complete & Reject/Refund).
     */
    public function test_trading_account_funding_lifecycle(): void
    {
        $fundingService = app(\App\Services\Trading\TradingFundingService::class);
        $this->walletService->credit($this->client, '1000.00', TransactionType::DEPOSIT, 'Deposit');

        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '554433',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        // 1. Client creates funding request -> 400 debited & reserved
        $funding1 = $fundingService->createRequest($this->client, $account, '400.00', 'Fund MT account');
        $this->assertEquals('600.00', $this->getClientBalance($this->client));

        // 2. Admin completes funding
        $response = $this->actingAs($this->admin)->post(route('admin.fundings.complete', $funding1->id), [
            'admin_notes' => 'Credited via trading server console ticket #9900',
        ]);
        $response->assertRedirect();
        $funding1->refresh();
        $this->assertEquals('completed', $funding1->status);
        $this->assertEquals('600.00', $this->getClientBalance($this->client));

        // 3. Client creates second funding request -> 300 debited & reserved -> Admin rejects
        $funding2 = $fundingService->createRequest($this->client, $account, '300.00', 'Second funding');
        $this->assertEquals('300.00', $this->getClientBalance($this->client));

        $response = $this->actingAs($this->admin)->post(route('admin.fundings.reject', $funding2->id), [
            'rejection_reason' => 'Trading account is currently suspended for audit',
        ]);
        $response->assertRedirect();
        $funding2->refresh();
        $this->assertEquals('rejected', $funding2->status);

        // Wallet refunded back to 600.00
        $this->assertEquals('600.00', $this->getClientBalance($this->client));
    }

    /**
     * Test Client can cancel pending trading account funding request and get refunded.
     */
    public function test_client_can_cancel_pending_funding_request(): void
    {
        $fundingService = app(\App\Services\Trading\TradingFundingService::class);
        $this->walletService->credit($this->client, '500.00', TransactionType::DEPOSIT, 'Deposit');

        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '776655',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $funding = $fundingService->createRequest($this->client, $account, '200.00', 'Request to cancel');
        $this->assertEquals('300.00', $this->getClientBalance($this->client));

        $response = $this->actingAs($this->client)->post(route('client.trading-accounts.fund.cancel', $funding->id));
        $response->assertRedirect();

        $funding->refresh();
        $this->assertEquals('cancelled', $funding->status);
        $this->assertEquals('500.00', $this->getClientBalance($this->client));
    }
}
