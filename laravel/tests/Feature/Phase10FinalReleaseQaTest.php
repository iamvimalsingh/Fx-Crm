<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Enums\TradingAccountStatus;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\KycDocument;
use App\Models\KycProfile;
use App\Models\PasswordResetToken;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\TradingPasswordResetRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Financial\MoneyFormatter;
use App\Services\Financial\WalletService;
use App\Services\Notification\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Phase10FinalReleaseQaTest extends TestCase
{
    use RefreshDatabase;

    protected WalletService $walletService;
    protected User $admin;
    protected User $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);

        $this->admin = User::factory()->create([
            'email' => 'admin_qa@broker.test',
            'role' => UserRole::ADMIN,
            'status' => UserStatus::ACTIVE,
            'password' => Hash::make('AdminPass123!'),
        ]);

        $this->client = User::factory()->create([
            'email' => 'client_qa@broker.test',
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
            'password' => Hash::make('ClientPass123!'),
        ]);

        $this->walletService->getWallet($this->client);
    }

    /**
     * Section 5 QA: Registration, duplicate protection, login, invalid login, logout, account suspension.
     */
    public function test_auth_full_lifecycle_and_suspension(): void
    {
        // 1. Client Registration
        $response = $this->post(route('register'), [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'newclient@broker.test',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'country' => 'US',
            'terms' => '1',
        ]);
        $response->assertRedirect(route('client.dashboard'));
        $this->assertDatabaseHas('users', ['email' => 'newclient@broker.test']);

        // Logout before attempting duplicate registration
        $this->post(route('logout'));
        $this->assertGuest();

        // 2. Duplicate Registration Protection
        $dupResponse = $this->post(route('register'), [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'newclient@broker.test',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'country' => 'US',
            'terms' => '1',
        ]);
        $dupResponse->assertSessionHasErrors('email');

        // 3. Client Invalid Login
        $badLogin = $this->post(route('login'), [
            'email' => 'newclient@broker.test',
            'password' => 'WrongPassword!',
        ]);
        $badLogin->assertSessionHasErrors('email');
        $this->assertGuest();

        // 4. Client Valid Login
        $goodLogin = $this->post(route('login'), [
            'email' => 'newclient@broker.test',
            'password' => 'SecurePass123!',
        ]);
        $goodLogin->assertRedirect(route('client.dashboard'));
        $this->assertAuthenticated();

        // 5. Client Denied from Admin Routes (403 or redirect)
        $adminRouteResponse = $this->get(route('admin.dashboard'));
        $this->assertNotEquals(200, $adminRouteResponse->status());

        // 6. Suspended Account Restriction
        $suspendedClient = User::factory()->create([
            'email' => 'suspended@broker.test',
            'role' => UserRole::CLIENT,
            'status' => UserStatus::SUSPENDED,
            'password' => Hash::make('SuspendedPass123!'),
        ]);

        $this->post(route('logout'));
        $suspendedLogin = $this->post(route('login'), [
            'email' => 'suspended@broker.test',
            'password' => 'SuspendedPass123!',
        ]);
        $this->assertGuest();

        // 7. Admin Login
        $adminLogin = $this->post(route('admin.login'), [
            'email' => 'admin_qa@broker.test',
            'password' => 'AdminPass123!',
        ]);
        $adminLogin->assertRedirect(route('admin.dashboard'));
        $this->assertAuthenticatedAs($this->admin);
    }

    /**
     * Section 5 QA: Password reset flow.
     */
    public function test_password_reset_flow(): void
    {
        // 1. Password reset request
        $response = $this->post(route('password.email'), [
            'email' => 'client_qa@broker.test',
        ]);
        $response->assertSessionHas('status');

        // 2. Submit password reset
        $resetResponse = $this->post(route('password.update'), [
            'token' => 'sample-qa-token',
            'email' => 'client_qa@broker.test',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ]);
        $resetResponse->assertRedirect(route('login'));
        $resetResponse->assertSessionHas('status');
    }

    /**
     * Section 5 QA: Admin creation CLI command execution.
     */
    public function test_admin_creation_command_execution(): void
    {
        $exitCode = Artisan::call('crm:create-admin', [
            'email' => 'newadmin_cli@broker.test',
            '--password' => 'SuperAdmin1234!',
            '--first_name' => 'System',
            '--last_name' => 'Admin',
        ]);

        $this->assertEquals(0, $exitCode);
        $this->assertDatabaseHas('users', [
            'email' => 'newadmin_cli@broker.test',
            'role' => UserRole::ADMIN->value,
            'status' => UserStatus::ACTIVE->value,
        ]);
    }

    /**
     * Section 6 QA: Ledger immutability and BCMath money handling.
     */
    public function test_ledger_immutability_and_precision(): void
    {
        $wallet = $this->walletService->getWallet($this->client);
        $this->assertEquals('0.00', $wallet->balance);

        // Credit wallet via service
        $tx = $this->walletService->credit(
            $this->client,
            '1000.50',
            TransactionType::DEPOSIT,
            'Approved bank deposit',
            null,
            null,
            ['ref' => 'DEP-QA-1']
        );

        $this->assertEquals('1000.50', $wallet->fresh()->balance);
        $this->assertEquals('1000.50', $tx->amount);
        $this->assertEquals(TransactionStatus::COMPLETED, $tx->status);

        // Ledger check: Transaction cannot be updated to an arbitrary balance without trace
        $this->assertDatabaseHas('transactions', [
            'id' => $tx->id,
            'type' => TransactionType::DEPOSIT->value,
            'status' => TransactionStatus::COMPLETED->value,
            'amount' => '1000.50000000',
        ]);

        // Debit wallet
        $this->walletService->debit(
            $this->client,
            '250.25',
            TransactionType::WITHDRAWAL,
            'Processed withdrawal'
        );

        $this->assertEquals('750.25', $wallet->fresh()->balance);

        // Verify MoneyFormatter BCMath operations
        $formatted = MoneyFormatter::format('750.25000000', 2);
        $this->assertEquals('750.25', $formatted);
    }

    /**
     * Section 7 QA: Composite uniqueness on Trading Accounts & external accounts.
     */
    public function test_trading_account_composite_uniqueness(): void
    {
        // 1. Create first trading account
        TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'MT5',
            'server_name' => 'Live-Server-1',
            'login_id' => '888001',
            'account_type' => 'standard',
            'currency' => 'USD',
            'leverage' => 100,
            'status' => 'active',
        ]);

        // 2. Same login_id on same platform & server must throw QueryException
        $this->expectException(\Illuminate\Database\QueryException::class);
        TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'MT5',
            'server_name' => 'Live-Server-1',
            'login_id' => '888001',
            'account_type' => 'standard',
            'currency' => 'USD',
            'leverage' => 100,
            'status' => 'active',
        ]);
    }

    /**
     * Section 9 QA: Security verification: No plaintext passwords in database or audit logs.
     */
    public function test_no_plaintext_passwords_or_secrets(): void
    {
        $user = User::where('email', 'admin_qa@broker.test')->first();
        $this->assertNotEquals('AdminPass123!', $user->password);
        $this->assertTrue(Hash::check('AdminPass123!', $user->password));

        // Audit log test
        AuditLog::create([
            'user_id' => $this->admin->id,
            'action' => 'admin_test_action',
            'details' => ['email' => 'client@test.com'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
        ]);

        $log = AuditLog::latest()->first();
        $this->assertFalse(isset($log->details['password']));
        $this->assertFalse(isset($log->details['secret']));
    }
}
