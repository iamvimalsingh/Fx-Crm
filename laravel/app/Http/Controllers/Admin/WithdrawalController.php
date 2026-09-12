<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Withdrawal;
use App\Services\Financial\WithdrawalService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class WithdrawalController extends Controller
{
    public function __construct(
        protected WithdrawalService $withdrawalService
    ) {}

    /**
     * Display a listing of client withdrawal requests.
     */
    public function index(Request $request): View
    {
        $query = Withdrawal::with(['user.profile', 'processedByUser', 'transaction']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'completed', 'rejected', 'cancelled'], true)) {
                $query->where('status', $status);
            }
        }

        $withdrawals = $query->latest()->paginate(15)->withQueryString();

        return view('admin.withdrawals.index', compact('withdrawals'));
    }

    /**
     * Admin completes the withdrawal (confirms external manual payout).
     */
    public function complete(Request $request, Withdrawal $withdrawal): RedirectResponse
    {
        try {
            $this->withdrawalService->complete(
                $withdrawal,
                auth()->user(),
                $request->input('admin_notes')
            );

            return back()->with('success', "Withdrawal #{$withdrawal->id} marked as completed.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Admin rejects the withdrawal and refunds the reserved amount back to client wallet.
     */
    public function reject(Request $request, Withdrawal $withdrawal): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        try {
            $this->withdrawalService->reject(
                $withdrawal,
                auth()->user(),
                $validated['rejection_reason']
            );

            return back()->with('success', "Withdrawal #{$withdrawal->id} rejected and funds refunded to client wallet.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
