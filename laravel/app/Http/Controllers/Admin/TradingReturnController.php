<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TradingAccountReturnRequest;
use App\Services\Trading\TradingReturnService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TradingReturnController extends Controller
{
    public function __construct(
        protected TradingReturnService $returnService
    ) {}

    /**
     * Display a listing of trading account to CRM wallet return requests.
     */
    public function index(Request $request): View
    {
        $query = TradingAccountReturnRequest::with([
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

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('tradingAccount', function ($aq) use ($search) {
                    $aq->where('login_id', 'like', "%{$search}%");
                })->orWhereHas('user', function ($uq) use ($search) {
                    $uq->where('email', 'like', "%{$search}%");
                });
            });
        }

        $returns = $query->latest()->paginate(15)->withQueryString();

        return view('admin.returns.index', compact('returns'));
    }

    /**
     * Admin completes trading account return and credits client CRM wallet.
     */
    public function complete(Request $request, TradingAccountReturnRequest $returnRequest): RedirectResponse
    {
        try {
            $this->returnService->complete(
                $returnRequest,
                auth()->user(),
                $request->input('admin_notes')
            );

            return back()->with('success', "Return request #{$returnRequest->id} for \${$returnRequest->amount} marked as completed and credited to client wallet.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Admin rejects trading account return request.
     */
    public function reject(Request $request, TradingAccountReturnRequest $returnRequest): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        try {
            $this->returnService->reject(
                $returnRequest,
                auth()->user(),
                $validated['rejection_reason']
            );

            return back()->with('success', "Return request #{$returnRequest->id} rejected.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
