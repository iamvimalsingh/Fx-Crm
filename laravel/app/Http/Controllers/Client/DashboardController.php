<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Deposit;
use App\Models\PaymentMethod;
use App\Models\Transaction;
use App\Models\Withdrawal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Display Client Home Dashboard
     */
    public function dashboard(): View
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $user->load(['profile', 'wallet', 'kycProfile']);

        $pendingDepositsCount = Deposit::where('user_id', $user->id)
            ->where('status', 'pending')
            ->count();

        $pendingDepositsSum = Deposit::where('user_id', $user->id)
            ->where('status', 'pending')
            ->get()
            ->reduce(fn($carry, $item) => bcadd($carry, (string) $item->amount, 2), '0.00');

        $pendingWithdrawalsCount = Withdrawal::where('user_id', $user->id)
            ->where('status', 'pending')
            ->count();

        $pendingWithdrawalsSum = Withdrawal::where('user_id', $user->id)
            ->where('status', 'pending')
            ->get()
            ->reduce(fn($carry, $item) => bcadd($carry, (string) $item->amount, 2), '0.00');

        $recentTransactions = Transaction::where('user_id', $user->id)
            ->latest()
            ->take(5)
            ->get();

        return view('client.dashboard', compact(
            'user',
            'pendingDepositsCount',
            'pendingDepositsSum',
            'pendingWithdrawalsCount',
            'pendingWithdrawalsSum',
            'recentTransactions'
        ));
    }

    /**
     * Display Client Wallet Overview
     */
    public function wallet(): View
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $user->load(['wallet', 'profile']);

        $paymentMethods = PaymentMethod::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $withdrawalMethods = config('broker.withdrawal_methods', []);

        $pendingDeposits = Deposit::where('user_id', $user->id)
            ->where('status', 'pending')
            ->latest()
            ->get();

        $pendingWithdrawals = Withdrawal::where('user_id', $user->id)
            ->where('status', 'pending')
            ->latest()
            ->get();

        $recentTransactions = Transaction::where('user_id', $user->id)
            ->latest()
            ->take(5)
            ->get();

        return view('client.wallet', compact(
            'user',
            'paymentMethods',
            'withdrawalMethods',
            'pendingDeposits',
            'pendingWithdrawals',
            'recentTransactions'
        ));
    }

    /**
     * Display Client Activity Log & Transactions with Filtering & Pagination
     */
    public function activity(Request $request): View
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        $type = $request->query('type'); // 'all', 'deposit', 'withdrawal'

        $depositsQuery = Deposit::where('user_id', $user->id)->with(['paymentMethod', 'transaction']);
        $withdrawalsQuery = Withdrawal::where('user_id', $user->id)->with(['transaction', 'refundTransaction']);

        if ($type === 'deposit') {
            $deposits = $depositsQuery->latest()->paginate(15)->withQueryString();
            $withdrawals = null;
            $transactions = null;
        } elseif ($type === 'withdrawal') {
            $deposits = null;
            $withdrawals = $withdrawalsQuery->latest()->paginate(15)->withQueryString();
            $transactions = null;
        } else {
            $deposits = $depositsQuery->latest()->get();
            $withdrawals = $withdrawalsQuery->latest()->get();
            $transactions = Transaction::where('user_id', $user->id)->latest()->paginate(15)->withQueryString();
        }

        return view('client.activity', compact('user', 'deposits', 'withdrawals', 'transactions', 'type'));
    }

    /**
     * Display Client Trading Platform Links Placeholder
     */
    public function trade(): View
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $platforms = config('broker.platforms', []);

        return view('client.trade', compact('user', 'platforms'));
    }
}
