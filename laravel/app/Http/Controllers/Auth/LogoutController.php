<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LogoutController extends Controller
{
    public function logout(Request $request): RedirectResponse
    {
        $isAdmin = false;
        if ($user = Auth::guard('web')->user()) {
            $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : $user->role;
            $isAdmin = in_array($role, ['admin', 'super_admin'], true);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $isAdmin ? redirect()->route('admin.login') : redirect()->route('login');
    }

    public function adminLogout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
