<?php

namespace Tests\Feature;

use Illuminate\Contracts\View\Factory as ViewFactory;
use Tests\TestCase;

class ViewResolutionTest extends TestCase
{
    /**
     * Test that the view container binding resolves correctly.
     */
    public function test_view_container_binding_resolves_view_factory(): void
    {
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
}
