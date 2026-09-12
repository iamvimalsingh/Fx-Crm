<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TransactionController extends Controller
{
    /**
     * Display a read-only listing of CRM ledger transactions.
     */
    public function index(Request $request): View
    {
        $query = Transaction::with(['user.profile']);

        if ($type = $request->input('type')) {
            if (in_array($type, ['deposit', 'withdrawal', 'manual_credit', 'manual_debit', 'adjustment'], true)) {
                $query->where('type', $type);
            }
        }

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'completed', 'rejected', 'cancelled'], true)) {
                $query->where('status', $status);
            }
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference_id', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('email', 'like', "%{$search}%")
                            ->orWhereHas('profile', function ($pq) use ($search) {
                                $pq->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%");
                            });
                    });
            });
        }

        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $transactions = $query->latest()->paginate(20)->withQueryString();

        return view('admin.transactions.index', compact('transactions'));
    }
}
