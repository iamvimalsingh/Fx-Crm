<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Deposit;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\TradingPasswordResetRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Display the Admin Operations Dashboard with aggregate CRM metrics.
     */
    public function index(): View
    {
        $activeClientsCount = User::where('role', 'client')
            ->where('status', 'active')
            ->count();

        $pendingDepositsCount = Deposit::where('status', 'pending')->count();
        $pendingDepositsAmount = Deposit::where('status', 'pending')->sum('amount');

        $pendingWithdrawalsCount = Withdrawal::where('status', 'pending')->count();
        $pendingWithdrawalsAmount = Withdrawal::where('status', 'pending')->sum('amount');

        $pendingTradingAccountRequestsCount = TradingAccountRequest::where('status', 'pending')->count();
        $pendingFundingsCount = TradingAccountFundingRequest::where('status', 'pending')->count();
        $pendingPasswordResetsCount = TradingPasswordResetRequest::where('status', 'pending')->count();

        $totalCrmWalletFunds = Wallet::sum('balance');

        $recentTransactions = Transaction::with(['user.profile'])
            ->latest()
            ->take(8)
            ->get();

        $recentActivity = AuditLog::with(['user.profile'])
            ->latest('created_at')
            ->take(8)
            ->get();

        return view('admin.dashboard', compact(
            'activeClientsCount',
            'pendingDepositsCount',
            'pendingDepositsAmount',
            'pendingWithdrawalsCount',
            'pendingWithdrawalsAmount',
            'pendingTradingAccountRequestsCount',
            'pendingFundingsCount',
            'pendingPasswordResetsCount',
            'totalCrmWalletFunds',
            'recentTransactions',
            'recentActivity'
        ));
    }
}
