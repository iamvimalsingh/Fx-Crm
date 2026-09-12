<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AuditLogController extends Controller
{
    /**
     * Display a read-only listing of CRM audit logs.
     */
    public function index(Request $request): View
    {
        $query = AuditLog::with(['user.profile']);

        if ($action = $request->input('action')) {
            $query->where('action', 'like', "%{$action}%");
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('email', 'like', "%{$search}%");
                    });
            });
        }

        if ($date = $request->input('date')) {
            $query->whereDate('created_at', $date);
        }

        $auditLogs = $query->latest('created_at')->paginate(25)->withQueryString();

        return view('admin.audit-logs.index', compact('auditLogs'));
    }
}
