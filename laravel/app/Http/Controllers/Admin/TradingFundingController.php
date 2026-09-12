<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TradingAccountFundingRequest;
use App\Services\Trading\TradingFundingService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TradingFundingController extends Controller
{
    public function __construct(
        protected TradingFundingService $fundingService
    ) {}

    /**
     * Display a listing of trading account funding requests.
     */
    public function index(Request $request): View
    {
        $query = TradingAccountFundingRequest::with([
            'user.profile',
            'tradingAccount',
            'transaction',
            'processor',
        ]);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'completed', 'rejected', 'cancelled'], true)) {
                $query->where('status', $status);
            }
        }

        $fundings = $query->latest()->paginate(15)->withQueryString();

        return view('admin.fundings.index', compact('fundings'));
    }

    /**
     * Admin completes trading account funding (confirms manual credit on external trading platform).
     */
    public function complete(Request $request, TradingAccountFundingRequest $funding): RedirectResponse
    {
        try {
            $this->fundingService->complete(
                $funding,
                auth()->user(),
                $request->input('admin_notes')
            );

            return back()->with('success', "Funding request #{$funding->id} for \${$funding->amount} marked as completed.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Admin rejects trading account funding and refunds reserved amount to client's CRM wallet.
     */
    public function reject(Request $request, TradingAccountFundingRequest $funding): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        try {
            $this->fundingService->reject(
                $funding,
                auth()->user(),
                $validated['rejection_reason']
            );

            return back()->with('success', "Funding request #{$funding->id} rejected and funds refunded to client wallet.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
