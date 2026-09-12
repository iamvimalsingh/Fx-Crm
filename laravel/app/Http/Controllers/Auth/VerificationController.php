<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class VerificationController extends Controller
{
    public function notice(): View
    {
        return view('auth.verify-email');
    }

    public function verify(Request $request): RedirectResponse
    {
        if ($user = $request->user()) {
            if (! $user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }
        }

        return redirect()->route('client.dashboard')->with('verified', true);
    }

    public function resend(Request $request): RedirectResponse
    {
        return back()->with('status', 'verification-link-sent');
    }
}
