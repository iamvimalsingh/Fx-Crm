<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class AdminLoginController extends Controller
{
    public function showLoginForm(): View
    {
        return view('auth.admin-login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $remember = $request->boolean('remember');

        $user = User::where('email', $credentials['email'])->first();

        if ($user && in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN], true) && $user->status === UserStatus::ACTIVE) {
            if (Auth::attempt([
                'email' => $credentials['email'],
                'password' => $credentials['password'],
            ], $remember)) {
                $request->session()->regenerate();

                return redirect()->intended(route('admin.dashboard'));
            }
        }

        return back()->withInput($request->only('email', 'remember'))->withErrors([
            'email' => 'Invalid administrator credentials or account disabled.',
        ]);
    }
}
