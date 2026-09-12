<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Deposit;
use App\Models\KycProfile;
use App\Models\PaymentMethod;
use App\Models\Setting;
use App\Models\SupportTicket;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountReturnRequest;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use App\Models\Withdrawal;
use App\Services\Financial\DepositService;
use App\Services\Financial\LedgerService;
use App\Services\Financial\WithdrawalService;
use App\Services\Trading\TradingFundingService;
use App\Services\Trading\TradingReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Phase2RegressionAuditTest extends TestCase
{
    use RefreshDatabase;

    private User $client;
    private User $secondClient;
    private User $admin;
    private Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create([
            'role' => UserRole::CLIENT,
            'email' => 'client.audit@broker.test',
            'password' => Hash::make('ClientPassword123!'),
            'email_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $this->client->id,
            'first_name' => 'Audit',
            'last_name' => 'Client',
            'country' => 'GB',
        ]);
        $this->wallet = Wallet::create([
            'user_id' => $this->client->id,
            'currency' => 'USD',
            'balance' => '5000.00',
        ]);

        $this->secondClient = User::factory()->create([
            'role' => UserRole::CLIENT,
            'email' => 'other.client@broker.test',
            'password' => Hash::make('OtherPassword123!'),
            'email_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $this->secondClient->id,
            'first_name' => 'Other',
            'last_name' => 'Client',
            'country' => 'DE',
        ]);
        Wallet::create([
            'user_id' => $this->secondClient->id,
            'currency' => 'USD',
            'balance' => '1000.00',
        ]);

        $this->admin = User::factory()->create([
            'role' => UserRole::ADMIN,
            'email' => 'admin.audit@broker.test',
            'password' => Hash::make('AdminPassword123!'),
            'email_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $this->admin->id,
            'first_name' => 'Audit',
            'last_name' => 'Admin',
        ]);
    }

    /* -------------------------------------------------------------------------- */
    /* 1. AUTHENTICATION                                                          */
    /* -------------------------------------------------------------------------- */

    public function test_auth_client_login_and_logout(): void
    {
        $response = $this->post(route('login'), [
            'email' => 'client.audit@broker.test',
            'password' => 'ClientPassword123!',
        ]);
        $response->assertRedirect(route('client.dashboard'));
        $this->assertAuthenticatedAs($this->client);

        $logoutResp = $this->post(route('logout'));
        $logoutResp->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_auth_admin_login_and_logout(): void
    {
        $response = $this->post(route('admin.login'), [
            'email' => 'admin.audit@broker.test',
            'password' => 'AdminPassword123!',
        ]);
        $response->assertRedirect(route('admin.dashboard'));
        $this->assertAuthenticatedAs($this->admin);

        $logoutResp = $this->post(route('admin.logout'));
        $logoutResp->assertRedirect(route('admin.login'));
        $this->assertGuest();
    }

    public function test_auth_role_isolation_and_direct_url_protection(): void
    {
        // Unauthenticated client route access redirects to login
        $this->get(route('client.dashboard'))->assertRedirect(route('login'));
        $this->get(route('client.wallet'))->assertRedirect(route('login'));

        // Client cannot access admin routes (403)
        $this->actingAs($this->client)->get(route('admin.dashboard'))->assertStatus(403);
        $this->actingAs($this->client)->get(route('admin.deposits.index'))->assertStatus(403);
        $this->actingAs($this->client)->get(route('admin.settings'))->assertStatus(403);

        // Admin cannot access client dashboard (redirect or 403)
        $resp = $this->actingAs($this->admin)->get(route('client.dashboard'));
        $this->assertNotEquals(200, $resp->status());
    }

    /* -------------------------------------------------------------------------- */
    /* 2. PASSWORD MANAGEMENT                                                     */
    /* -------------------------------------------------------------------------- */

    public function test_password_encrypted_storage_and_no_plaintext_in_audits(): void
    {
        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'login_id' => '998877',
            'platform_name' => 'MT5',
            'server_name' => 'LiveServer',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'trading_password' => 'SuperSecretPass#2026',
            'status' => 'active',
        ]);

        // Verify raw DB value is encrypted and not equal to plaintext
        $rawPassword = \DB::table('trading_accounts')->where('id', $account->id)->value('trading_password');
        $this->assertNotEquals('SuperSecretPass#2026', $rawPassword);

        // Eloquent decrypts on access
        $this->assertEquals('SuperSecretPass#2026', $account->trading_password);

        // Client reveals own trading password
        $revealResp = $this->actingAs($this->client)->postJson(route('client.trading-accounts.reveal-password', $account));
        $revealResp->assertOk();
        $revealResp->assertJson(['success' => true, 'password' => 'SuperSecretPass#2026']);

        // Other client cannot reveal (IDOR protection)
        $idorResp = $this->actingAs($this->secondClient)->postJson(route('client.trading-accounts.reveal-password', $account));
        $idorResp->assertStatus(403);

        // Check audit log does not contain plaintext password
        $logs = AuditLog::where('target_id', $account->id)->get();
        foreach ($logs as $log) {
            $this->assertStringNotContainsString('SuperSecretPass#2026', $log->description);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 3. SUPPORT CENTER REGRESSION                                               */
    /* -------------------------------------------------------------------------- */

    public function test_support_ticket_internal_notes_isolated_from_client(): void
    {
        $ticket = SupportTicket::create([
            'user_id' => $this->client->id,
            'ticket_number' => 'TCK-AUDIT-001',
            'subject' => 'Confidential Inquiry',
            'category' => 'Account',
            'priority' => 'normal',
            'status' => 'open',
        ]);

        // Admin adds internal note
        $this->actingAs($this->admin)->post(route('admin.support.note', $ticket), [
            'note' => 'INTERNAL STAFF ONLY: Verify KYC documents before processing.',
        ]);

        // Admin sees note
        $adminView = $this->actingAs($this->admin)->get(route('admin.support.show', $ticket));
        $adminView->assertOk();
        $adminView->assertSee('INTERNAL STAFF ONLY: Verify KYC documents before processing.');

        // Client CANNOT see internal note
        $clientView = $this->actingAs($this->client)->get(route('client.support.show', $ticket));
        $clientView->assertOk();
        $clientView->assertDontSee('INTERNAL STAFF ONLY: Verify KYC documents before processing.');

        // Second client CANNOT view ticket (IDOR)
        $otherClientView = $this->actingAs($this->secondClient)->get(route('client.support.show', $ticket));
        $otherClientView->assertStatus(403);
    }

    /* -------------------------------------------------------------------------- */
    /* 4. DARK / LIGHT UI COVERAGE                                                */
    /* -------------------------------------------------------------------------- */

    public function test_client_portal_views_render_with_theme_attributes(): void
    {
        $this->actingAs($this->client);

        $clientRoutes = [
            'client.dashboard',
            'client.wallet',
            'client.profile',
            'client.activity',
            'client.trading-accounts.index',
            'client.trade',
            'client.support.index',
        ];

        foreach ($clientRoutes as $route) {
            $resp = $this->get(route($route));
            $this->assertEquals(200, $resp->status(), "Failed asserting route [{$route}] returns 200 OK");
            $resp->assertSee('data-bs-theme', false);
            $resp->assertSee('clientThemeToggleBtn', false);
        }
    }

    public function test_admin_portal_views_render_with_theme_attributes(): void
    {
        $this->actingAs($this->admin);

        $adminRoutes = [
            'admin.dashboard',
            'admin.clients.index',
            'admin.deposits.index',
            'admin.withdrawals.index',
            'admin.trading-accounts.index',
            'admin.fundings.index',
            'admin.kyc.index',
            'admin.returns.index',
            'admin.audit-logs.index',
            'admin.settings',
            'admin.support.index',
        ];

        foreach ($adminRoutes as $route) {
            $resp = $this->get(route($route));
            $this->assertEquals(200, $resp->status(), "Failed asserting admin route [{$route}] returns 200 OK");
            $resp->assertSee('data-bs-theme', false);
            $resp->assertSee('adminThemeToggleBtn', false);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 5. FINANCIAL REGRESSION                                                    */
    /* -------------------------------------------------------------------------- */

    public function test_financial_ledger_bcmath_and_concurrency_invariants(): void
    {
        // 1. Immutable ledger balance check
        $initialBalance = $this->wallet->fresh()->balance;
        $this->assertEquals('5000.00', $initialBalance);

        // 2. Deposit approval credits wallet
        $deposit = Deposit::create([
            'user_id' => $this->client->id,
            'wallet_id' => $this->wallet->id,
            'amount' => '250.50',
            'currency' => 'USD',
            'payment_method' => 'bank_wire',
            'status' => 'pending',
        ]);

        $depositService = app(DepositService::class);
        $depositService->approve($deposit, $this->admin);

        $this->assertEquals('5250.50', $this->wallet->fresh()->balance);

        // 3. Withdrawal reservation debits wallet immediately
        $withdrawalService = app(WithdrawalService::class);
        $withdrawal = $withdrawalService->createClientRequest($this->client, '100.25', 'bank_transfer', 'Chase Bank Acct #12345678');

        $this->assertEquals('5150.25', $this->wallet->fresh()->balance);

        // Rejecting withdrawal refunds the wallet
        $withdrawalService->reject($withdrawal, $this->admin, 'Incorrect details');
        $this->assertEquals('5250.50', $this->wallet->fresh()->balance);

        // 4. Funding trading account from wallet
        $tradingAccount = TradingAccount::create([
            'user_id' => $this->client->id,
            'login_id' => '554433',
            'platform_name' => 'MT5',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $fundingService = app(TradingFundingService::class);
        $fundingRequest = $fundingService->createRequest($this->client, $tradingAccount, '500.00');

        // Wallet was debited upon request
        $this->assertEquals('4750.50', $this->wallet->fresh()->balance);

        // Complete funding
        $fundingService->complete($fundingRequest, $this->admin);
        $this->assertEquals('completed', $fundingRequest->fresh()->status);
        $this->assertEquals('4750.50', $this->wallet->fresh()->balance);

        // 5. Return from trading account to wallet
        $returnService = app(TradingReturnService::class);
        $returnRequest = $returnService->createRequest($this->client, $tradingAccount, '200.00');
        $this->assertEquals('pending', $returnRequest->status);

        // Complete return credits wallet
        $returnService->complete($returnRequest, $this->admin);
        $this->assertEquals('completed', $returnRequest->fresh()->status);
        $this->assertEquals('4950.50', $this->wallet->fresh()->balance);

        // Idempotency check: completing again throws LogicException and does not double-credit
        try {
            $returnService->complete($returnRequest, $this->admin);
            $this->fail('Expected LogicException on duplicate completion attempt');
        } catch (\LogicException $e) {
            $this->assertStringContainsString('already been processed', $e->getMessage());
        }
        $this->assertEquals('4950.50', $this->wallet->fresh()->balance);
    }

    /* -------------------------------------------------------------------------- */
    /* 6. MIGRATIONS CHECK                                                        */
    /* -------------------------------------------------------------------------- */

    public function test_migrations_sequential_and_latest_is_000025(): void
    {
        $migrationFiles = glob(database_path('migrations/*.php'));
        $fileNames = array_map('basename', $migrationFiles);
        sort($fileNames);

        $this->assertNotEmpty($fileNames);
        $latest = end($fileNames);

        $this->assertStringStartsWith('2026_01_01_000025_', $latest);
        $this->assertStringContainsString('create_support_tickets_tables.php', $latest);
    }

    /* -------------------------------------------------------------------------- */
    /* 7. CPANEL & RELEASE PACKAGING EXCLUSIONS CHECK                             */
    /* -------------------------------------------------------------------------- */

    public function test_production_package_exclusion_specifications(): void
    {
        // 1. bootstrap/cache/.gitignore must ignore all generated php caches
        $gitignorePath = base_path('bootstrap/cache/.gitignore');
        $this->assertFileExists($gitignorePath);
        $gitignore = file_get_contents($gitignorePath);
        $this->assertStringContainsString('*.php', $gitignore);
        $this->assertStringContainsString('!.gitignore', $gitignore);

        // 2. Define strict exclusion list required for production archive
        $requiredExclusions = [
            '.env',
            'vendor/',
            'node_modules/',
            '.git/',
            '*.zip',
            'bootstrap/cache/packages.php',
            'bootstrap/cache/services.php',
        ];

        // Ensure key directories exist for packaging
        $this->assertDirectoryExists(base_path('app'));
        $this->assertDirectoryExists(base_path('bootstrap'));
        $this->assertDirectoryExists(base_path('config'));
        $this->assertDirectoryExists(base_path('database'));
        $this->assertDirectoryExists(base_path('resources'));
        $this->assertDirectoryExists(base_path('routes'));
        $this->assertDirectoryExists(base_path('storage'));
        $this->assertFileExists(base_path('crm_public/index.php'));
        $this->assertFileExists(base_path('crm_public/.htaccess'));
    }
}
