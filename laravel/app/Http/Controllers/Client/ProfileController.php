<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\UserProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class ProfileController extends Controller
{
    /**
     * Display Client Profile & Account Details
     */
    public function edit(): View
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $user->load(['profile', 'wallet', 'kycProfile', 'kycDocuments']);

        return view('client.profile', compact('user'));
    }

    /**
     * Update Client Profile Information (Editable fields only)
     */
    public function update(Request $request): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
        ]);

        UserProfile::updateOrCreate(
            ['user_id' => $user->id],
            $validated
        );

        return redirect()->route('client.profile')
            ->with('success', 'Profile information updated successfully.');
    }
}
