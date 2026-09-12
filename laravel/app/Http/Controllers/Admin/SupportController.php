<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\SupportTicketService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SupportController extends Controller
{
    /**
     * Display Support Tickets listing for administrators with filters & counters.
     */
    public function index(Request $request): View
    {
        $query = SupportTicket::with(['user.profile', 'assignedTo.profile'])
            ->latest('updated_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->query('priority'));
        }

        if ($request->filled('assigned_to')) {
            if ($request->query('assigned_to') === 'unassigned') {
                $query->whereNull('assigned_to_user_id');
            } else {
                $query->where('assigned_to_user_id', $request->query('assigned_to'));
            }
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('email', 'like', "%{$search}%")
                         ->orWhereHas('profile', function ($pq) use ($search) {
                             $pq->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                         });
                  });
            });
        }

        $tickets = $query->paginate(15)->withQueryString();

        // Metrics for summary bar
        $stats = [
            'total' => SupportTicket::count(),
            'open' => SupportTicket::where('status', 'open')->count(),
            'pending' => SupportTicket::where('status', 'pending')->count(),
            'high_priority' => SupportTicket::where('priority', 'high')->whereIn('status', ['open', 'pending'])->count(),
            'resolved' => SupportTicket::where('status', 'resolved')->count(),
        ];

        $admins = User::where('role', 'admin')->with('profile')->get();

        return view('admin.support.index', compact('tickets', 'stats', 'admins'));
    }

    /**
     * Display complete ticket details including internal notes and client context.
     */
    public function show(SupportTicket $ticket): View
    {
        $ticket->load([
            'messages' => function ($q) {
                $q->with(['user.profile', 'attachments'])->orderBy('created_at', 'asc');
            },
            'user.profile',
            'user.wallet',
            'user.kycProfile',
            'user.tradingAccounts',
            'assignedTo.profile',
        ]);

        $admins = User::where('role', 'admin')->with('profile')->get();

        return view('admin.support.show', compact('ticket', 'admins'));
    }

    /**
     * Post an official support reply from the administrator.
     */
    public function reply(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'new_status' => ['nullable', 'string', 'in:' . implode(',', array_keys(SupportTicket::STATUSES))],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpeg,jpg,png,pdf,doc,docx,txt,zip'],
        ]);

        $ticketService->replyFromAdmin(
            $ticket,
            auth()->user(),
            $validated['message'],
            $request->file('attachment'),
            $validated['new_status'] ?? null
        );

        return redirect()->route('admin.support.show', $ticket)
            ->with('success', 'Support reply sent to client successfully.');
    }

    /**
     * Add an internal note visible only to administrators.
     */
    public function addNote(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'note' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpeg,jpg,png,pdf,doc,docx,txt,zip'],
        ]);

        $ticketService->addInternalNote(
            $ticket,
            auth()->user(),
            $validated['note'],
            $request->file('attachment')
        );

        return redirect()->route('admin.support.show', $ticket)
            ->with('success', 'Internal note recorded successfully.');
    }

    /**
     * Update ticket lifecycle status.
     */
    public function updateStatus(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', array_keys(SupportTicket::STATUSES))],
        ]);

        $ticketService->updateStatus($ticket, auth()->user(), $validated['status']);

        return redirect()->route('admin.support.show', $ticket)
            ->with('success', "Ticket status updated to " . ucfirst($validated['status']) . ".");
    }

    /**
     * Update ticket priority.
     */
    public function updatePriority(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'priority' => ['required', 'string', 'in:' . implode(',', array_keys(SupportTicket::PRIORITIES))],
        ]);

        $ticketService->updatePriority($ticket, auth()->user(), $validated['priority']);

        return redirect()->route('admin.support.show', $ticket)
            ->with('success', "Ticket priority updated to " . ucfirst($validated['priority']) . ".");
    }

    /**
     * Assign ticket to a specific administrator or unassign.
     */
    public function assign(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'assigned_to_user_id' => ['nullable', 'integer'],
        ]);

        $ticketService->assignTicket(
            $ticket,
            auth()->user(),
            $validated['assigned_to_user_id'] ? (int) $validated['assigned_to_user_id'] : null
        );

        return redirect()->route('admin.support.show', $ticket)
            ->with('success', 'Ticket assignment updated successfully.');
    }
}
