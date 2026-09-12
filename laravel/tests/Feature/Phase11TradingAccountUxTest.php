<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\TradingAccount;
use App\Models\TradingAccountReturnRequest;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase11TradingAccountUxTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $client;
    protected User $otherClient;
    protected TradingAccount $clientAccount;
    protected WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);

        $this->admin = User::factory()->create([
            'email' => 'admin@broker.test',
            'role' => UserRole::ADMIN,
            'status' => UserStatus::ACTIVE,
        ]);
        UserProfile::create([
            'user_id' => $this->admin->id,
            'first_name' => 'Admin',
            'last_name' => 'User',
            'country' => 'US',
        ]);

        $this->client = User::factory()->create([
            'email' => 'client@broker.test',
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
        ]);
        UserProfile::create([
            'user_id' => $this->client->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'country' => 'US',
        ]);
        Wallet::create([
            'user_id' => $this->client->id,
            'currency' => 'USD',
            'balance' => '500.0000',
            'locked_balance' => '0.0000',
        ]);

        $this->otherClient = User::factory()->create([
            'email' => 'other@broker.test',
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
        ]);
        UserProfile::create([
            'user_id' => $this->otherClient->id,
            'first_name' => 'Jane',
            'last_name' => 'Smith',
            'country' => 'GB',
        ]);

        $this->clientAccount = TradingAccount::create([
            'user_id' => $this->client->id,
            'platform_name' => 'ArrowTrader MT5',
            'server_name' => 'ArrowTrader-Live01',
            'login_id' => '200101',
            'account_type' => 'standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
            'trading_password' => 'SecurePass123!',
        ]);

        Setting::set('TRADING_TEST_ACCOUNT_ENABLED', '1');
        Setting::set('TRADING_TEST_ACCOUNT_NAME', 'ArrowTrader Demo Account');
        Setting::set('TRADING_TEST_ACCOUNT_PLATFORM', 'ArrowTrader MT5');
        Setting::set('TRADING_TEST_ACCOUNT_SERVER', 'ArrowTrader-Demo01');
        Setting::set('TRADING_TEST_ACCOUNT_LOGIN', '100001');
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'Demo@2026');
        Setting::set('TRADING_TO_WALLET_ENABLED', '1');
        Setting::set('TRADING_TO_WALLET_MIN_AMOUNT', '10.00');
        Setting::set('TRADING_TO_WALLET_MAX_AMOUNT', '50000.00');
    }

    public function test_client_can_reveal_their_own_trading_password(): void
    {
        $response = $this->actingAs($this->client)
            ->postJson(route('client.trading-accounts.reveal-password', $this->clientAccount->id));

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'password' => 'SecurePass123!',
            'has_password' => true,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_password_revealed',
            'user_id' => $this->client->id,
            'target_id' => $this->clientAccount->id,
        ]);
    }

    public function test_other_client_cannot_reveal_trading_password(): void
    {
        $response = $this->actingAs($this->otherClient)
            ->postJson(route('client.trading-accounts.reveal-password', $this->clientAccount->id));

        $response->assertForbidden();
    }

    public function test_admin_can_reveal_and_set_trading_password(): void
    {
        // Reveal
        $revealResp = $this->actingAs($this->admin)
            ->postJson(route('admin.trading-accounts.reveal-password', $this->clientAccount->id));

        $revealResp->assertOk();
        $revealResp->assertJson([
            'success' => true,
            'password' => 'SecurePass123!',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_password_revealed_by_admin',
            'user_id' => $this->admin->id,
        ]);

        // Set new password
        $setResp = $this->actingAs($this->admin)
            ->post(route('admin.trading-accounts.set-password', $this->clientAccount->id), [
                'password' => 'NewAdminPass2026#',
            ]);

        $setResp->assertRedirect();
        $this->clientAccount->refresh();
        $this->assertEquals('NewAdminPass2026#', $this->clientAccount->trading_password);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_password_set',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_client_trading_page_renders_demo_account_and_live_accounts(): void
    {
        $response = $this->actingAs($this->client)
            ->get(route('client.trading-accounts.index'));

        $response->assertOk();
        $response->assertSee('ArrowTrader Demo Account');
        $response->assertSee('#100001');
        $response->assertSee('#200101');
        $response->assertSee('To Wallet');
    }

    public function test_trading_return_workflow_creation_and_admin_completion(): void
    {
        // 1. Client creates return request
        $response = $this->actingAs($this->client)
            ->post(route('client.trading-accounts.return', $this->clientAccount->id), [
                'amount' => '150.00',
                'notes' => 'Profit return from MT5',
            ]);

        $response->assertRedirect();
        $returnReq = TradingAccountReturnRequest::where('trading_account_id', $this->clientAccount->id)->first();
        $this->assertNotNull($returnReq);
        $this->assertEquals('150.00', $returnReq->amount);
        $this->assertEquals('pending', $returnReq->status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_return_requested',
            'user_id' => $this->client->id,
        ]);

        // Initial wallet balance is 500.00
        $this->assertEquals('500.00', $this->client->wallet->fresh()->balance);

        // 2. Admin completes return request
        $adminResp = $this->actingAs($this->admin)
            ->post(route('admin.returns.complete', $returnReq->id), [
                'admin_notes' => 'Deducted from MT5 ticket #12345',
            ]);

        $adminResp->assertRedirect();
        $returnReq->refresh();
        $this->assertEquals('completed', $returnReq->status);
        $this->assertEquals($this->admin->id, $returnReq->processed_by_user_id);
        $this->assertNotNull($returnReq->transaction_id);

        // Wallet balance credited by 150.00 -> 650.00
        $this->assertEquals('650.00', $this->client->wallet->fresh()->balance);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_return_completed',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_trading_return_rejection(): void
    {
        $returnReq = TradingAccountReturnRequest::create([
            'user_id' => $this->client->id,
            'trading_account_id' => $this->clientAccount->id,
            'amount' => '75.00',
            'currency' => 'USD',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.returns.reject', $returnReq->id), [
                'rejection_reason' => 'Insufficient free margin on live account',
            ]);

        $response->assertRedirect();
        $returnReq->refresh();
        $this->assertEquals('rejected', $returnReq->status);
        $this->assertEquals('Insufficient free margin on live account', $returnReq->admin_notes);
        $this->assertEquals($this->admin->id, $returnReq->processed_by_user_id);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_return_rejected',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_central_demo_trading_password_is_encrypted_at_rest(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'SuperSecretDemo2026!');

        // 1. Direct database check - raw value must NOT be plaintext
        $rawDbValue = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->value('value');

        $this->assertNotNull($rawDbValue);
        $this->assertNotEquals('SuperSecretDemo2026!', $rawDbValue);
        $this->assertStringNotContainsString('SuperSecretDemo2026!', $rawDbValue);

        // 2. Setting::getRaw() returns encrypted ciphertext
        $this->assertEquals($rawDbValue, Setting::getRaw('TRADING_TEST_ACCOUNT_PASSWORD'));

        // 3. Setting::get() and Setting::getEncrypted() decrypt properly
        $this->assertEquals('SuperSecretDemo2026!', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD'));
        $this->assertEquals('SuperSecretDemo2026!', Setting::getEncrypted('TRADING_TEST_ACCOUNT_PASSWORD'));

        // 4. Setting::allMap() masks sensitive keys
        $map = Setting::allMap();
        $this->assertEquals('••••••••', $map['TRADING_TEST_ACCOUNT_PASSWORD']);
    }

    public function test_client_trading_page_html_does_not_contain_demo_password(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'HiddenSecretDemoPass#123');

        $response = $this->actingAs($this->client)
            ->get(route('client.trading-accounts.index'));

        $response->assertOk();
        $response->assertSee('ArrowTrader Demo Account');
        $response->assertDontSee('HiddenSecretDemoPass#123');
    }

    public function test_admin_settings_page_html_does_not_contain_demo_password(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'AdminHiddenDemoPass#999');

        $response = $this->actingAs($this->admin)
            ->get(route('admin.settings'));

        $response->assertOk();
        $response->assertDontSee('AdminHiddenDemoPass#999');
    }

    public function test_authenticated_client_can_reveal_demo_trading_password(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'RevealedDemoPass2026!');

        $response = $this->actingAs($this->client)
            ->postJson(route('client.trading-accounts.reveal-demo-password'));

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'password' => 'RevealedDemoPass2026!',
            'has_password' => true,
        ]);

        // Assert audit log created
        $audit = AuditLog::where('action', 'demo_trading_password_revealed')
            ->where('user_id', $this->client->id)
            ->latest()
            ->first();

        $this->assertNotNull($audit);
        // Password must NEVER be inside audit log description or body
        $this->assertStringNotContainsString('RevealedDemoPass2026!', $audit->description ?? '');
    }

    public function test_guest_cannot_reveal_demo_trading_password(): void
    {
        $response = $this->postJson(route('client.trading-accounts.reveal-demo-password'));
        $response->assertUnauthorized();
    }

    public function test_admin_can_reveal_central_demo_password(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'AdminDemoSecret2026');

        $response = $this->actingAs($this->admin)
            ->postJson(route('admin.settings.reveal-demo-password'));

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'password' => 'AdminDemoSecret2026',
            'has_password' => true,
        ]);

        $audit = AuditLog::where('action', 'admin_demo_trading_password_revealed')
            ->where('user_id', $this->admin->id)
            ->latest()
            ->first();

        $this->assertNotNull($audit);
        $this->assertStringNotContainsString('AdminDemoSecret2026', $audit->description ?? '');
    }

    public function test_admin_settings_can_update_test_account_and_return_rules(): void
    {
        $testAccResp = $this->actingAs($this->admin)
            ->post(route('admin.settings.test-account'), [
                'enabled' => '1',
                'name' => 'Custom Pro Demo Account',
                'platform' => 'ArrowTrader cTrader',
                'server' => 'cTrader-Demo01',
                'login' => '999888',
                'password' => 'CTrader@2026',
                'account_type' => 'Raw Spread',
                'currency' => 'USD',
                'leverage' => '1:500',
                'web_url' => 'https://ctrader.broker.com',
            ]);

        $testAccResp->assertRedirect();
        $this->assertEquals('Custom Pro Demo Account', Setting::get('TRADING_TEST_ACCOUNT_NAME'));
        $this->assertEquals('999888', Setting::get('TRADING_TEST_ACCOUNT_LOGIN'));
        $this->assertEquals('CTrader@2026', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD'));

        // Database value must be encrypted
        $rawPassword = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->value('value');
        $this->assertNotEquals('CTrader@2026', $rawPassword);

        // Test BCMath decimal normalization on return rules: 10.10, 0.01, and large amounts
        $rulesResp = $this->actingAs($this->admin)
            ->post(route('admin.settings.trading-wallet-rules'), [
                'trading_to_wallet_enabled' => '1',
                'min_amount' => '10.10',
                'max_amount' => '9999999.99',
            ]);

        $rulesResp->assertRedirect();
        $this->assertEquals('10.10', Setting::get('TRADING_TO_WALLET_MIN_AMOUNT'));
        $this->assertEquals('9999999.99', Setting::get('TRADING_TO_WALLET_MAX_AMOUNT'));

        // Test minimum boundary 0.01
        $rulesResp2 = $this->actingAs($this->admin)
            ->post(route('admin.settings.trading-wallet-rules'), [
                'trading_to_wallet_enabled' => '1',
                'min_amount' => '0.01',
                'max_amount' => '500.00',
            ]);

        $rulesResp2->assertRedirect();
        $this->assertEquals('0.01', Setting::get('TRADING_TO_WALLET_MIN_AMOUNT'));
        $this->assertEquals('500.00', Setting::get('TRADING_TO_WALLET_MAX_AMOUNT'));

        // Test invalid amounts rejected
        $invalidResp = $this->actingAs($this->admin)
            ->post(route('admin.settings.trading-wallet-rules'), [
                'trading_to_wallet_enabled' => '1',
                'min_amount' => '100.00',
                'max_amount' => '50.00', // max < min
            ]);

        $invalidResp->assertSessionHasErrors(['max_amount']);
    }

    public function test_legacy_plaintext_demo_password_is_migrated_and_encrypted_on_read(): void
    {
        // 1. Manually force legacy plaintext in database
        \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->delete();

        \Illuminate\Support\Facades\DB::table('settings')->insert([
            'key' => 'TRADING_TEST_ACCOUNT_PASSWORD',
            'value' => 'OldLegacyPlainPass123!',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $rawBefore = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->value('value');
        $this->assertEquals('OldLegacyPlainPass123!', $rawBefore);

        // 2. Reading via Setting::get() returns the password and auto-encrypts the stored value
        $retrieved = Setting::get('TRADING_TEST_ACCOUNT_PASSWORD');
        $this->assertEquals('OldLegacyPlainPass123!', $retrieved);

        // 3. Database is now encrypted at rest
        $rawAfter = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->value('value');
        $this->assertNotEquals('OldLegacyPlainPass123!', $rawAfter);
        $this->assertStringNotContainsString('OldLegacyPlainPass123!', $rawAfter);

        // 4. Subsequent reads retrieve the decrypted value
        $this->assertEquals('OldLegacyPlainPass123!', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD'));
        $this->assertEquals('OldLegacyPlainPass123!', Setting::getEncrypted('TRADING_TEST_ACCOUNT_PASSWORD'));
    }

    public function test_migration_routine_converts_legacy_plaintext_to_encrypted(): void
    {
        // Insert legacy plaintext
        \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->delete();

        \Illuminate\Support\Facades\DB::table('settings')->insert([
            'key' => 'TRADING_TEST_ACCOUNT_PASSWORD',
            'value' => 'PlaintextDemo@2026',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Run migration routine
        $migratedCount = Setting::migrateLegacySensitiveSettings();
        $this->assertEquals(1, $migratedCount);

        // DB is now encrypted
        $rawDb = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->value('value');
        $this->assertNotEquals('PlaintextDemo@2026', $rawDb);

        // Reads return decrypted password
        $this->assertEquals('PlaintextDemo@2026', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD'));
    }

    public function test_corrupt_or_invalid_encrypted_setting_returns_default_and_never_exposes_raw_content(): void
    {
        // Insert invalid / corrupted payload with encrypted signature
        $corruptPayload = base64_encode(json_encode([
            'iv' => base64_encode('fake_iv_12345678'),
            'value' => base64_encode('fake_corrupted_value'),
            'mac' => 'invalid_tampered_mac_hash',
        ]));

        \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'TRADING_TEST_ACCOUNT_PASSWORD')
            ->delete();

        \Illuminate\Support\Facades\DB::table('settings')->insert([
            'key' => 'TRADING_TEST_ACCOUNT_PASSWORD',
            'value' => $corruptPayload,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Setting::get() and getEncrypted() MUST return null / default, NEVER corrupt ciphertext
        $this->assertNull(Setting::get('TRADING_TEST_ACCOUNT_PASSWORD'));
        $this->assertNull(Setting::getEncrypted('TRADING_TEST_ACCOUNT_PASSWORD'));
        $this->assertEquals('safe_default', Setting::get('TRADING_TEST_ACCOUNT_PASSWORD', 'safe_default'));

        // Client reveal endpoint returns has_password: false and does not expose ciphertext
        $response = $this->actingAs($this->client)
            ->postJson(route('client.trading-accounts.reveal-demo-password'));

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'has_password' => false,
        ]);
        $response->assertDontSee($corruptPayload);

        // Admin reveal endpoint returns has_password: false and does not expose ciphertext
        $adminResp = $this->actingAs($this->admin)
            ->postJson(route('admin.settings.reveal-demo-password'));

        $adminResp->assertOk();
        $adminResp->assertJson([
            'success' => true,
            'has_password' => false,
        ]);
        $adminResp->assertDontSee($corruptPayload);
    }
}

