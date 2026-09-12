<?php

namespace Tests\Feature;

use App\Models\TradingAccount;
use App\Models\TradingAccountRequest;
use App\Models\User;
use App\Services\Financial\MoneyFormatter;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;
use TypeError;

class Phase81HardeningTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $client;
    protected WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);

        $this->admin = User::factory()->create([
            'email' => 'admin81@broker.test',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->client = User::factory()->create([
            'email' => 'client81@user.test',
            'role' => 'client',
            'status' => 'active',
        ]);

        $this->walletService->getWallet($this->client);
    }

    /**
     * Test Task 2: Route ordering prevents hijacking of requests/resets by parameterized account show route.
     */
    public function test_admin_trading_account_routes_order_and_resolution(): void
    {
        // 1. Static route for requests
        $response = $this->actingAs($this->admin)->get(route('admin.trading-accounts.requests.index'));
        $response->assertOk();
        $response->assertSee('Trading Account Requests');

        // 2. Static route for password resets
        $response = $this->actingAs($this->admin)->get(route('admin.trading-accounts.password-resets.index'));
        $response->assertOk();
        $response->assertSee('Trading Password Reset Requests');

        // 3. Trading accounts index route
        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '888111',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->admin)->get(route('admin.trading-accounts.index'));
        $response->assertOk();
        $response->assertSee('888111');
    }

    /**
     * Test Task 3: Trading account status schema strictly accepts active, suspended, disabled (not archived).
     */
    public function test_trading_account_status_validation_and_update(): void
    {
        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '888222',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        // Suspended is valid
        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.status', $account->id), [
            'status' => 'suspended',
            'reason' => 'Temporary margin check',
        ]);
        $response->assertRedirect();
        $account->refresh();
        $this->assertEquals('suspended', $account->status);

        // Disabled is valid
        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.status', $account->id), [
            'status' => 'disabled',
            'reason' => 'Terminated by request',
        ]);
        $response->assertRedirect();
        $account->refresh();
        $this->assertEquals('disabled', $account->status);

        // Archived is rejected by validation
        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.status', $account->id), [
            'status' => 'archived',
        ]);
        $response->assertSessionHasErrors('status');
    }

    /**
     * Test Task 4: Composite uniqueness validation on (platform_name, server_name, login_id).
     */
    public function test_composite_uniqueness_on_trading_account_request_approval(): void
    {
        TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '999000',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $req1 = TradingAccountRequest::create([
            'user_id' => $this->client->id,
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
            'status' => 'pending',
        ]);

        // Attempting to approve with identical (WebTrader, Live-Server-01, 999000) MUST fail validation
        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.requests.approve', $req1->id), [
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-01',
            'login_id' => '999000',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);
        $response->assertSessionHasErrors('login_id');

        // But the SAME login_id on a DIFFERENT server (Live-Server-02) is allowed
        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.requests.approve', $req1->id), [
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-Server-02',
            'login_id' => '999000',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);
        $response->assertSessionHasNoErrors();
        $req1->refresh();
        $this->assertEquals('approved', $req1->status);
    }

    /**
     * Test Task 5 & 6: Strict string typing in normalizeAmount and MoneyFormatter.
     */
    public function test_strict_string_typing_in_wallet_service(): void
    {
        // Valid string amount works
        $result = $this->walletService->normalizeAmount('123.45');
        $this->assertEquals('123.45', $result);

        // String with 1 decimal is normalized to 2 decimals
        $result = $this->walletService->normalizeAmount('50.5');
        $this->assertEquals('50.50', $result);

        // Negative or invalid format throws InvalidArgumentException
        $this->expectException(InvalidArgumentException::class);
        $this->walletService->normalizeAmount('-10.00');
    }

    /**
     * Test MoneyFormatter produces correct currency string.
     */
    public function test_money_formatter_presentation(): void
    {
        $this->assertEquals('1,234.56', MoneyFormatter::format('1234.56'));
        $this->assertEquals('0.00', MoneyFormatter::format('0'));
        $this->assertEquals('100.00', MoneyFormatter::format('100'));
    }

    /**
     * Test Task 7: Deposit status filter and badges use completed instead of approved.
     */
    public function test_deposit_status_filter_completed(): void
    {
        $deposit = \App\Models\Deposit::create([
            'user_id' => $this->client->id,
            'amount' => '350.00',
            'status' => 'completed',
            'request_channel' => 'admin',
            'credit_reason' => 'deposit',
        ]);

        $response = $this->actingAs($this->admin)->get(route('admin.deposits.index', ['status' => 'completed']));
        $response->assertOk();
        $response->assertSee('#' . $deposit->id);
        $response->assertSee('Completed');
    }

    /**
     * Test Client and Admin Authentication endpoints.
     */
    public function test_auth_controllers_render_and_authenticate(): void
    {
        // 1. Client login view and successful login
        $res = $this->get(route('login'));
        $res->assertOk();

        $loginUser = User::factory()->create([
            'email' => 'trader1@broker.test',
            'password' => \Illuminate\Support\Facades\Hash::make('Secret123!'),
            'role' => 'client',
            'status' => 'active',
        ]);

        $postLogin = $this->post(route('login'), [
            'email' => 'trader1@broker.test',
            'password' => 'Secret123!',
        ]);
        $postLogin->assertRedirect(route('client.dashboard'));
        $this->assertAuthenticatedAs($loginUser);

        // 2. Client logout
        $logoutRes = $this->post(route('logout'));
        $logoutRes->assertRedirect(route('login'));
        $this->assertGuest();

        // 3. Admin login view and authentication
        $adminView = $this->get(route('admin.login'));
        $adminView->assertOk();

        $adminUser = User::factory()->create([
            'email' => 'superadmin@broker.test',
            'password' => \Illuminate\Support\Facades\Hash::make('AdminSecret123!'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $postAdmin = $this->post(route('admin.login'), [
            'email' => 'superadmin@broker.test',
            'password' => 'AdminSecret123!',
        ]);
        $postAdmin->assertRedirect(route('admin.dashboard'));
        $this->assertAuthenticatedAs($adminUser);

        // 4. Registration flow
        $this->post(route('admin.logout'));
        $this->assertGuest();

        $regRes = $this->post(route('register'), [
            'first_name' => 'John',
            'last_name' => 'Trader',
            'email' => 'newuser@domain.test',
            'country' => 'GB',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);
        $regRes->assertRedirect(route('client.dashboard'));
        $this->assertDatabaseHas('users', ['email' => 'newuser@domain.test']);
        $this->assertDatabaseHas('wallets', ['currency' => 'USD']);
    }
}
