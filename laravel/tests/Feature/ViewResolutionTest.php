<?php

namespace Tests\Feature;

use Illuminate\Contracts\View\Factory as ViewFactory;
use Tests\TestCase;

class ViewResolutionTest extends TestCase
{
    /**
     * Test that the view container binding resolves correctly and is bound.
     */
    public function test_view_container_binding_resolves_view_factory(): void
    {
        $this->assertTrue($this->app->bound('view'));

        $view = app('view');
        $this->assertNotNull($view);
        $this->assertInstanceOf(ViewFactory::class, $view);
    }

    /**
     * Test that standard auth views can be rendered.
     */
    public function test_auth_views_render_successfully(): void
    {
        $loginView = view('auth.login')->render();
        $this->assertNotEmpty($loginView);

        $adminLoginView = view('auth.admin-login')->render();
        $this->assertNotEmpty($adminLoginView);
    }

    /**
     * Test that GET /login returns HTTP 200 and renders the login page.
     */
    public function test_get_login_route_returns_ok(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
        $response->assertSee('Log In');
    }

    /**
     * Test that GET /admin/login returns HTTP 200 and renders the admin login page.
     */
    public function test_get_admin_login_route_returns_ok(): void
    {
        $response = $this->get('/admin/login');

        $response->assertStatus(200);
        $response->assertSee('Admin Login');
    }

    /**
     * Test that GET / redirects to /login.
     */
    public function test_get_root_route_redirects_to_login(): void
    {
        $response = $this->get('/');

        $response->assertStatus(302);
        $response->assertRedirect('/login');
    }

    /**
     * Test that GET /register returns HTTP 200 and renders registration form.
     */
    public function test_get_register_route_returns_ok(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
        $response->assertSee('Register');
    }

    /**
     * Test that GET /up returns HTTP 200 health check response.
     */
    public function test_get_health_check_up_route_returns_ok(): void
    {
        $response = $this->get('/up');

        $response->assertStatus(200);
    }

    /**
     * Test that temporary neon-init route returns 404 when NEON_INIT_SECRET is not configured.
     */
    public function test_neon_init_returns_404_when_secret_not_set(): void
    {
        $response = $this->post('/neon-init');

        $this->assertEquals(404, $response->getStatusCode());
    }

    /**
     * Test that temporary neon-init route bypasses session middleware and returns 403 when secret is configured but header is invalid.
     */
    public function test_neon_init_bypasses_session_middleware_and_validates_secret(): void
    {
        putenv('NEON_INIT_SECRET=test_super_secret_key_12345');
        $_ENV['NEON_INIT_SECRET'] = 'test_super_secret_key_12345';

        // Request with invalid secret header
        $response = $this->postJson('/neon-init', [], [
            'X-Neon-Init-Secret' => 'invalid_secret',
        ]);

        $response->assertStatus(403);
        $response->assertJson([
            'status' => 'error',
            'message' => 'Unauthorized.',
        ]);

        // Clean up environment
        putenv('NEON_INIT_SECRET');
        unset($_ENV['NEON_INIT_SECRET']);
    }
}
