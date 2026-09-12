<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClientRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login');
        }

        $role = $user->role instanceof UserRole ? $user->role->value : $user->role;

        if ($role !== UserRole::CLIENT->value) {
            if ($role === UserRole::ADMIN->value || $role === UserRole::SUPER_ADMIN->value) {
                return redirect()->route('admin.dashboard');
            }
            abort(403, 'Unauthorized access.');
        }

        return $next($request);
    }
}
