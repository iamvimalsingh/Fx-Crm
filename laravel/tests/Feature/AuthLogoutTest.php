<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthLogoutTest extends TestCase
{
    use RefreshDatabase;

    private User $client;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create([
            'role' => 'client',
            'status' => 'active',
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
            'status' => 'active',
        ]);
        UserProfile::create([
            'user_id' => $this->admin->id,
            'first_name' => 'System',
            'last_name' => 'Admin',
        ]);
    }

    public function test_client_portal_visibly_renders_logout_in_sidebar_and_header(): void
    {
        $response = $this->actingAs($this->client)->get(route('client.dashboard'));

        $response->assertOk();
        // Verifies sidebar and header logout buttons are in rendered HTML
        $response->assertSee('id="clientSidebarLogoutForm"', false);
        $response->assertSee('id="clientHeaderLogoutForm"', false);
        $response->assertSee('Log Out');
    }

    public function test_admin_portal_visibly_renders_logout_in_sidebar_and_header(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.dashboard'));

        $response->assertOk();
        $response->assertSee('id="adminSidebarLogoutForm"', false);
        $response->assertSee('Log Out');
    }

    public function test_client_logout_via_post_invalidates_session_and_redirects_to_login(): void
    {
        $this->actingAs($this->client);
        $this->assertAuthenticatedAs($this->client);

        $response = $this->post(route('logout'));

        $response->assertRedirect(route('login'));
        $this->assertGuest();

        // Ensure protected client routes are inaccessible after logout
        $protectedResponse = $this->get(route('client.dashboard'));
        $protectedResponse->assertRedirect(route('login'));
    }

    public function test_admin_logout_via_post_invalidates_session_and_redirects_to_admin_login(): void
    {
        $this->actingAs($this->admin);
        $this->assertAuthenticatedAs($this->admin);

        $response = $this->post(route('admin.logout'));

        $response->assertRedirect(route('admin.login'));
        $this->assertGuest();

        // Ensure protected admin routes are inaccessible after logout
        $protectedResponse = $this->get(route('admin.dashboard'));
        $protectedResponse->assertRedirect(route('login'));
    }

    public function test_get_request_to_logout_is_not_allowed(): void
    {
        $this->actingAs($this->client);

        $response = $this->get(route('logout'));
        // GET on POST route returns 405 Method Not Allowed
        $response->assertStatus(405);
    }
}
