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
     * Test that session, cache, log, filesystem, and database drivers are configured and resolve cleanly.
     */
    public function test_vercel_runtime_drivers_resolve(): void
    {
        $this->assertNotNull(config('session.driver'));
        $this->assertNotNull(config('cache.default'));
        $this->assertNotNull(config('logging.default'));
        $this->assertNotNull(config('filesystems.default'));
        $this->assertArrayHasKey('s3', config('filesystems.disks'));
        $this->assertArrayHasKey('pgsql', config('database.connections'));
        $this->assertArrayHasKey('mysql', config('database.connections'));
        $this->assertEquals(env('DB_SSLMODE', 'prefer'), config('database.connections.pgsql.sslmode'));
    }
}
