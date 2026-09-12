<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Models\AuditLog;
use App\Models\KycProfile;
use App\Models\Setting;
use App\Models\SupportTicket;
use App\Models\TradingAccount;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostDeploymentFixPhase1Test extends TestCase
{
    use RefreshDatabase;

    private User $client;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create([
            'role' => 'client',
            'email' => 'client.test@example.com',
        ]);
        UserProfile::create([
            'user_id' => $this->client->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
        ]);
        Wallet::create([
            'user_id' => $this->client->id,
            'currency' => 'USD',
            'balance' => '1000.00',
        ]);

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin.ops@broker.com',
        ]);
        UserProfile::create([
            'user_id' => $this->admin->id,
            'first_name' => 'Ops',
            'last_name' => 'Admin',
        ]);
    }

    /**
     * 1. Client login UI verification.
     */
    public function test_client_login_screen_renders_properly(): void
    {
        $response = $this->get(route('login'));

        $response->assertOk();
        $response->assertSee('Client Portal Sign In');
        $response->assertSee('togglePasswordBtn');
        $response->assertSee('passwordEyeIcon');
        $response->assertSee('Open Client Account');
        $response->assertDontSee('Admin Operations Terminal');
    }

    /**
     * 2. Admin login UI verification.
     */
    public function test_admin_login_screen_renders_identifiable_admin_terminal(): void
    {
        $response = $this->get(route('admin.login'));

        $response->assertOk();
        $response->assertSee('Admin Operations Terminal');
        $response->assertSee('Authorized Administrative Personnel Only');
        $response->assertSee('toggleAdminPasswordBtn');
        $response->assertSee('adminPasswordEyeIcon');
        $response->assertDontSee('Client Portal Sign In');
    }

    /**
     * 3. Global Dark/Light mode elements in Client and Admin layouts.
     */
    public function test_layouts_contain_dark_light_theme_toggle_and_scripts(): void
    {
        // Client layout
        $clientResp = $this->actingAs($this->client)->get(route('client.dashboard'));
        $clientResp->assertOk();
        $clientResp->assertSee('clientThemeToggleBtn');
        $clientResp->assertSee('data-bs-theme');
        $clientResp->assertSee('forex_theme');

        // Admin layout
        $adminResp = $this->actingAs($this->admin)->get(route('admin.dashboard'));
        $adminResp->assertOk();
        $adminResp->assertSee('adminThemeToggleBtn');
        $adminResp->assertSee('data-bs-theme');
        $adminResp->assertSee('forex_theme');
    }

    /**
     * 4. Support Ticket with linked KYC profile does NOT trigger HTTP 500 TypeError.
     */
    public function test_support_ticket_creation_with_linked_kyc_record_succeeds(): void
    {
        $kyc = KycProfile::create([
            'user_id' => $this->client->id,
            'status' => KycStatus::PENDING,
        ]);

        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'KYC Verification Question',
            'category' => 'KYC',
            'priority' => 'normal',
            'linked_record_type' => 'kyc',
            'linked_record_id' => $kyc->id,
            'message' => 'Hello support, please check my KYC document.',
        ]);

        $ticket = SupportTicket::where('user_id', $this->client->id)->latest()->first();
        $this->assertNotNull($ticket);
        $response->assertRedirect(route('client.support.show', $ticket));
        $this->assertEquals('kyc', $ticket->linked_record_type);
        $this->assertEquals($kyc->id, $ticket->linked_record_id);

        // Explicitly test the accessor that previously threw a TypeError
        $label = $ticket->linked_record_label;
        $this->assertNotNull($label);
        $this->assertStringContainsString('KYC Profile (Status: Pending)', $label);

        // Verify ticket detail page loads with HTTP 200 without TypeError
        $viewResp = $this->actingAs($this->client)->get(route('client.support.show', $ticket));
        $viewResp->assertOk();
        $viewResp->assertSee('KYC Profile (Status: Pending)');

        // Verify admin ticket detail page also loads with HTTP 200
        $adminViewResp = $this->actingAs($this->admin)->get(route('admin.support.show', $ticket));
        $adminViewResp->assertOk();
        $adminViewResp->assertSee('KYC Profile (Status: Pending)');
    }

    /**
     * 5. Demo password reveal endpoint and UI attributes.
     */
    public function test_demo_password_reveal_returns_password_and_logs_audit(): void
    {
        Setting::set('TRADING_TEST_ACCOUNT_ENABLED', '1');
        Setting::set('TRADING_TEST_ACCOUNT_PASSWORD', 'SecureDemoSecretPass99#');

        // Check index view contains the fixed toggleDemoPassword script and elements
        $viewResp = $this->actingAs($this->client)->get(route('client.trading-accounts.index'));
        $viewResp->assertOk();
        $viewResp->assertSee('btnRevealDemo');
        $viewResp->assertSee('demoPasswordMask');
        $viewResp->assertSee('demoPasswordVal');

        // Reveal demo password
        $revealResp = $this->actingAs($this->client)
            ->postJson(route('client.trading-accounts.reveal-demo-password'));

        $revealResp->assertOk();
        $revealResp->assertJson([
            'success' => true,
            'password' => 'SecureDemoSecretPass99#',
            'has_password' => true,
        ]);

        $audit = AuditLog::where('action', 'demo_trading_password_revealed')
            ->where('user_id', $this->client->id)
            ->latest()
            ->first();

        $this->assertNotNull($audit);
    }

    /**
     * 6. Client ticket create form with existing KYC profile does not error on enum.
     */
    public function test_client_create_ticket_view_with_existing_kyc_renders_properly(): void
    {
        KycProfile::create([
            'user_id' => $this->client->id,
            'status' => KycStatus::PENDING,
        ]);

        $response = $this->actingAs($this->client)->get(route('client.support.create'));
        $response->assertOk();
        $response->assertSee('KYC Profile — Status: Pending');
    }

    /**
     * 7. Admin can reset client portal password.
     */
    public function test_admin_can_reset_client_portal_password(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.clients.reset-password', $this->client->id), [
            'mode' => 'custom',
            'password' => 'CustomSecurePass2026!',
            'password_confirmation' => 'CustomSecurePass2026!',
            'reason' => 'Client lost access',
        ]);

        $response->assertRedirect();
        $this->client->refresh();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('CustomSecurePass2026!', $this->client->password));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'client_password_reset_by_admin',
            'user_id' => $this->admin->id,
            'target_id' => $this->client->id,
        ]);
    }

    /**
     * 8. Admin can set trading account password.
     */
    public function test_admin_can_set_trading_account_password(): void
    {
        $account = TradingAccount::create([
            'user_id' => $this->client->id,
            'login_id' => '200100',
            'platform_name' => 'MetaTrader 5',
            'server_name' => 'LiveServer-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'trading_password' => 'OldPass123!',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.trading-accounts.set-password', $account->id), [
            'mode' => 'custom',
            'password' => 'NewTradingPass2026#',
        ]);

        $response->assertRedirect();
        $account->refresh();
        $this->assertEquals('NewTradingPass2026#', $account->trading_password);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'trading_account_password_reset_by_admin',
            'user_id' => $this->admin->id,
            'target_id' => $account->id,
        ]);
    }
}
