<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\KycProfile;
use App\Models\TradingAccount;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UiContrastAndButtonVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_and_admin_layouts_contain_high_contrast_css_rules(): void
    {
        $clientLayout = file_get_contents(resource_path('views/layouts/client.blade.php'));
        $adminLayout = file_get_contents(resource_path('views/layouts/admin.blade.php'));

        // Client layout assertions
        $this->assertStringContainsString('data-bs-theme="dark"', $clientLayout);
        $this->assertStringContainsString('GLOBAL UI CONTRAST & VISIBILITY OVERRIDES', $clientLayout);
        $this->assertStringContainsString('.text-muted,', $clientLayout);
        $this->assertStringContainsString('color: #94a3b8 !important;', $clientLayout);
        $this->assertStringContainsString('color: #cbd5e1 !important;', $clientLayout);
        $this->assertStringContainsString('.nav-tabs .nav-link.active', $clientLayout);
        $this->assertStringContainsString('.badge.bg-info:not([class*="bg-opacity-"])', $clientLayout);
        $this->assertStringContainsString('.badge.bg-warning:not([class*="bg-opacity-"])', $clientLayout);
        $this->assertStringContainsString('.badge.bg-info[class*="bg-opacity-"]', $clientLayout);
        $this->assertStringContainsString('.btn-outline-secondary', $clientLayout);
        $this->assertStringContainsString('.page-item.active .page-link', $clientLayout);

        // Admin layout assertions
        $this->assertStringContainsString('data-bs-theme="dark"', $adminLayout);
        $this->assertStringContainsString('GLOBAL UI CONTRAST & VISIBILITY OVERRIDES', $adminLayout);
        $this->assertStringContainsString('.text-muted,', $adminLayout);
        $this->assertStringContainsString('color: #8b949e !important;', $adminLayout);
        $this->assertStringContainsString('color: #c9d1d9 !important;', $adminLayout);
        $this->assertStringContainsString('.nav-tabs .nav-link.active', $adminLayout);
        $this->assertStringContainsString('.badge.bg-info:not([class*="bg-opacity-"])', $adminLayout);
        $this->assertStringContainsString('.badge.bg-warning:not([class*="bg-opacity-"])', $adminLayout);
        $this->assertStringContainsString('.badge.bg-info[class*="bg-opacity-"]', $adminLayout);
        $this->assertStringContainsString('.btn-outline-secondary', $adminLayout);
        $this->assertStringContainsString('.page-item.active .page-link', $adminLayout);
    }

    public function test_client_portal_pages_render_with_high_contrast_elements(): void
    {
        $user = User::factory()->create(['role' => 'client', 'email_verified_at' => now()]);
        Wallet::create(['user_id' => $user->id, 'balance' => '2500.00', 'currency' => 'USD']);
        UserProfile::create([
            'user_id' => $user->id,
            'first_name' => 'Alice',
            'last_name' => 'Trader',
        ]);
        KycProfile::create([
            'user_id' => $user->id,
            'status' => 'approved',
        ]);

        // Dashboard
        $response = $this->actingAs($user)->get(route('client.dashboard'));
        $response->assertStatus(200);
        $response->assertSee('CRM WALLET BALANCE');
        $response->assertSee('KYC VERIFICATION STATUS');
        $response->assertSee('PENDING CRM REQUESTS');

        // Wallet
        $response = $this->actingAs($user)->get(route('client.wallet'));
        $response->assertStatus(200);
        $response->assertSee('CRM INTERNAL WALLET');

        // Profile
        $response = $this->actingAs($user)->get(route('client.profile'));
        $response->assertStatus(200);
        $response->assertSee('Account Role');
        $response->assertSee('Account Status');

        // Activity
        $response = $this->actingAs($user)->get(route('client.activity'));
        $response->assertStatus(200);
        $response->assertSee('CRM Activity History');

        // Trade Terminals
        $response = $this->actingAs($user)->get(route('client.trade'));
        $response->assertStatus(200);
        $response->assertSee('Trading Terminals');
    }

    public function test_admin_portal_pages_render_with_high_contrast_elements(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);

        // Dashboard
        $response = $this->actingAs($admin)->get(route('admin.dashboard'));
        $response->assertStatus(200);
        $response->assertSee('Active Clients');
        $response->assertSee('Total CRM Wallet Funds');

        // Clients
        $response = $this->actingAs($admin)->get(route('admin.clients.index'));
        $response->assertStatus(200);
        $response->assertSee('Registered Clients');

        // Deposits
        $response = $this->actingAs($admin)->get(route('admin.deposits.index'));
        $response->assertStatus(200);

        // Withdrawals
        $response = $this->actingAs($admin)->get(route('admin.withdrawals.index'));
        $response->assertStatus(200);

        // Transactions
        $response = $this->actingAs($admin)->get(route('admin.transactions.index'));
        $response->assertStatus(200);

        // KYC
        $response = $this->actingAs($admin)->get(route('admin.kyc.index'));
        $response->assertStatus(200);

        // Trading Accounts
        $response = $this->actingAs($admin)->get(route('admin.trading-accounts.index'));
        $response->assertStatus(200);

        // Trading Account Requests
        $response = $this->actingAs($admin)->get(route('admin.trading-accounts.requests.index'));
        $response->assertStatus(200);

        // Trading Account Password Resets
        $response = $this->actingAs($admin)->get(route('admin.trading-accounts.password-resets.index'));
        $response->assertStatus(200);

        // Fundings
        $response = $this->actingAs($admin)->get(route('admin.fundings.index'));
        $response->assertStatus(200);

        // Settings
        $response = $this->actingAs($admin)->get(route('admin.settings'));
        $response->assertStatus(200);
        $response->assertSee('System & Trading Account Settings', false);
    }

    public function test_client_trading_accounts_screen_renders_without_conflicting_tab_classes(): void
    {
        $user = User::factory()->create(['role' => 'client', 'email_verified_at' => now()]);
        Wallet::create(['user_id' => $user->id, 'balance' => '1000.00', 'currency' => 'USD']);
        TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '100201',
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $response = $this->actingAs($user)->get(route('client.trading-accounts.index'));
        $response->assertStatus(200);

        $content = $response->getContent();
        // Ensure nav-link does not contain conflicting text-white overriding active tabs
        $this->assertStringContainsString('id="tradingTabs"', $content);
        $this->assertStringNotContainsString('id="req-tab" class="nav-link active text-white"', $content);
        $this->assertStringContainsString('id="req-tab"', $content);
    }

    public function test_admin_client_360_renders_without_conflicting_tab_classes(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);
        $client = User::factory()->create(['role' => 'client', 'email_verified_at' => now()]);
        Wallet::create(['user_id' => $client->id, 'balance' => '500.00', 'currency' => 'USD']);
        UserProfile::create([
            'user_id' => $client->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'phone' => '+123456789',
            'country' => 'United States',
            'address' => '123 Wall St',
        ]);
        KycProfile::create([
            'user_id' => $client->id,
            'status' => 'approved',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.clients.show', $client->id));
        $response->assertStatus(200);

        $content = $response->getContent();
        $this->assertStringContainsString('id="clientRequestsTab"', $content);
        $this->assertStringNotContainsString('id="deposits-tab" class="nav-link active text-white"', $content);
        $this->assertStringContainsString('id="deposits-tab"', $content);
    }

    public function test_admin_audit_logs_screen_renders_high_contrast_badges(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);
        AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'admin.login',
            'target_type' => User::class,
            'target_id' => $admin->id,
            'ip_address' => '127.0.0.1',
            'description' => 'Admin logged in',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.audit-logs.index'));
        $response->assertStatus(200);
        $response->assertSee('admin.login');
        $response->assertSee('badge bg-info bg-opacity-20 text-info', false);
    }
}
