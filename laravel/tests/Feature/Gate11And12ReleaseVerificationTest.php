<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Gate11And12ReleaseVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected User $client;
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $walletService = app(WalletService::class);

        $this->client = User::factory()->create([
            'email' => 'smoke_client@broker.test',
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
            'password' => Hash::make('ClientPass123!'),
        ]);
        $walletService->getWallet($this->client);

        $this->admin = User::factory()->create([
            'email' => 'smoke_admin@broker.test',
            'role' => UserRole::ADMIN,
            'status' => UserStatus::ACTIVE,
            'password' => Hash::make('AdminPass123!'),
        ]);
    }

    /**
     * Gate 11: Smoke test public guest routes.
     */
    public function test_public_guest_routes_smoke(): void
    {
        $this->get('/')->assertRedirect(route('login'));
        $this->get(route('login'))->assertStatus(200);
        $this->get(route('register'))->assertStatus(200);
        $this->get(route('admin.login'))->assertStatus(200);
        $this->get('/up')->assertStatus(200);
        $this->get(route('password.request'))->assertStatus(200);
    }

    /**
     * Gate 11: Smoke test authenticated client routes.
     */
    public function test_authenticated_client_routes_smoke(): void
    {
        $this->actingAs($this->client);

        $this->get(route('client.dashboard'))->assertStatus(200);
        $this->get(route('client.wallet'))->assertStatus(200);
        $this->get(route('client.trading-accounts.index'))->assertStatus(200);
        $this->get(route('client.kyc.index'))->assertRedirect(route('client.profile') . '#kyc-section');
        $this->get(route('client.profile'))->assertStatus(200);
        $this->get(route('client.notifications'))->assertStatus(200);
        $this->get(route('client.activity'))->assertStatus(200);
        $this->get(route('client.trade'))->assertStatus(200);
    }

    /**
     * Gate 11: Smoke test authenticated admin routes.
     */
    public function test_authenticated_admin_routes_smoke(): void
    {
        $this->actingAs($this->admin);

        $this->get(route('admin.dashboard'))->assertStatus(200);
        $this->get(route('admin.clients.index'))->assertStatus(200);
        $this->get(route('admin.deposits.index'))->assertStatus(200);
        $this->get(route('admin.withdrawals.index'))->assertStatus(200);
        $this->get(route('admin.trading-accounts.index'))->assertStatus(200);
        $this->get(route('admin.trading-accounts.requests.index'))->assertStatus(200);
        $this->get(route('admin.trading-accounts.password-resets.index'))->assertStatus(200);
        $this->get(route('admin.fundings.index'))->assertStatus(200);
        $this->get(route('admin.kyc.index'))->assertStatus(200);
        $this->get(route('admin.transactions.index'))->assertStatus(200);
        $this->get(route('admin.audit-logs.index'))->assertStatus(200);
        $this->get(route('admin.settings'))->assertStatus(200);
    }

    /**
     * Gate 11: Route security & access control smoke test.
     */
    public function test_unauthenticated_and_unauthorized_access(): void
    {
        // Unauthenticated access to client dashboard redirects to login
        $this->get(route('client.dashboard'))->assertRedirect(route('login'));

        // Client cannot access admin dashboard (403 forbidden)
        $this->actingAs($this->client);
        $this->get(route('admin.dashboard'))->assertStatus(403);
        $this->get(route('admin.deposits.index'))->assertStatus(403);
        $this->get(route('admin.kyc.index'))->assertStatus(403);
    }

    /**
     * Gate 12: Verify cPanel deployment paths and entrypoint resolution.
     */
    public function test_cpanel_entrypoint_file_integrity(): void
    {
        $entrypoint = file_exists(base_path('crm_public/index.php'))
            ? base_path('crm_public/index.php')
            : base_path('../crm_public/index.php');
        $this->assertFileExists($entrypoint);

        $content = file_get_contents($entrypoint);
        $this->assertStringContainsString("require __DIR__.'/../crm_core/vendor/autoload.php';", $content);
        $this->assertStringContainsString("require_once __DIR__.'/../crm_core/bootstrap/app.php'", $content);
        $this->assertStringContainsString("__DIR__.'/../crm_core/storage/framework/maintenance.php'", $content);

        $htaccess = file_exists(base_path('crm_public/.htaccess'))
            ? base_path('crm_public/.htaccess')
            : base_path('../crm_public/.htaccess');
        $this->assertFileExists($htaccess);
        $htaccessContent = file_get_contents($htaccess);
        $this->assertStringContainsString('RewriteEngine On', $htaccessContent);
        $this->assertStringContainsString('RewriteRule ^ index.php [L]', $htaccessContent);
    }
}
