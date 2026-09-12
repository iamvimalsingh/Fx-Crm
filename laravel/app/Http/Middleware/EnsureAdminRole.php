<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('admin.login');
        }

        $role = $user->role instanceof UserRole ? $user->role->value : $user->role;

        if ($role !== UserRole::ADMIN->value && $role !== UserRole::SUPER_ADMIN->value) {
            abort(403, 'Unauthorized admin access.');
        }

        return $next($request);
    }
}
