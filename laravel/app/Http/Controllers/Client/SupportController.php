<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Deposit;
use App\Models\KycProfile;
use App\Models\Setting;
use App\Models\SupportAttachment;
use App\Models\SupportTicket;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\Withdrawal;
use App\Services\Support\SupportTicketService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupportController extends Controller
{
    /**
     * Display client's support tickets and support contact details.
     */
    public function index(Request $request): View
    {
        $user = auth()->user();

        $query = SupportTicket::where('user_id', $user->id)
            ->with(['assignedTo'])
            ->latest('updated_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $tickets = $query->paginate(10)->withQueryString();

        $supportSettings = [
            'email' => Setting::get('SUPPORT_EMAIL', config('broker.support_email', 'support@broker.com')),
            'phone' => Setting::get('SUPPORT_PHONE', '+1 (555) 019-2834'),
            'whatsapp' => Setting::get('SUPPORT_WHATSAPP', '+1 (555) 019-2834'),
            'hours' => Setting::get('SUPPORT_HOURS', '24/5 Monday – Friday'),
            'timezone' => Setting::get('SUPPORT_TIMEZONE', 'UTC / GMT'),
            'instructions' => Setting::get('SUPPORT_INSTRUCTIONS', 'Submit a ticket for account, deposit, or trading inquiries. Our dedicated support team reviews requests within 1-2 business hours.'),
            'emergency' => Setting::get('SUPPORT_EMERGENCY_CONTACT', 'For urgent trade issues, reach out immediately via our priority phone line.'),
        ];

        return view('client.support.index', compact('tickets', 'supportSettings'));
    }

    /**
     * Show form to create a new support ticket.
     */
    public function create(Request $request): View
    {
        $user = auth()->user();

        // Load user's own records for optional quick linking
        $userDeposits = Deposit::where('user_id', $user->id)->latest()->take(10)->get();
        $userWithdrawals = Withdrawal::where('user_id', $user->id)->latest()->take(10)->get();
        $userTradingAccounts = TradingAccount::where('user_id', $user->id)->get();
        $userAccountRequests = TradingAccountRequest::where('user_id', $user->id)->latest()->take(5)->get();
        $userFundingRequests = TradingAccountFundingRequest::where('user_id', $user->id)->latest()->take(5)->get();
        $userKyc = KycProfile::where('user_id', $user->id)->first();

        $prefillType = $request->query('link_type');
        $prefillId = $request->query('link_id');

        return view('client.support.create', compact(
            'userDeposits',
            'userWithdrawals',
            'userTradingAccounts',
            'userAccountRequests',
            'userFundingRequests',
            'userKyc',
            'prefillType',
            'prefillId'
        ));
    }

    /**
     * Store a new support ticket.
     */
    public function store(Request $request, SupportTicketService $ticketService): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'in:' . implode(',', SupportTicket::CATEGORIES)],
            'priority' => ['required', 'string', 'in:' . implode(',', array_keys(SupportTicket::PRIORITIES))],
            'message' => ['required', 'string', 'max:5000'],
            'linked_record_type' => ['nullable', 'string', 'in:' . implode(',', array_keys(SupportTicket::LINKED_TYPES))],
            'linked_record_id' => ['nullable', 'integer'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpeg,jpg,png,pdf,doc,docx,txt,zip'],
        ]);

        try {
            $ticket = $ticketService->createTicket(
                auth()->user(),
                $validated,
                $request->file('attachment')
            );

            return redirect()->route('client.support.show', $ticket)
                ->with('success', "Support ticket #{$ticket->ticket_number} created successfully.");
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return back()->withInput()->withErrors(['linked_record_id' => $e->getMessage()]);
        }
    }

    /**
     * Display a specific support ticket thread.
     */
    public function show(SupportTicket $ticket): View
    {
        abort_if($ticket->user_id !== auth()->id(), 403, 'Unauthorized access to support ticket.');

        // Eager load only client-visible messages (internal notes are strictly excluded)
        $ticket->load([
            'clientVisibleMessages' => function ($query) {
                $query->with(['user.profile', 'attachments']);
            },
            'assignedTo.profile',
        ]);

        return view('client.support.show', compact('ticket'));
    }

    /**
     * Submit a client reply to a ticket.
     */
    public function reply(Request $request, SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        abort_if($ticket->user_id !== auth()->id(), 403, 'Unauthorized access to support ticket.');

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpeg,jpg,png,pdf,doc,docx,txt,zip'],
        ]);

        $ticketService->replyFromClient(
            $ticket,
            auth()->user(),
            $validated['message'],
            $request->file('attachment')
        );

        return redirect()->route('client.support.show', $ticket)
            ->with('success', 'Your reply has been submitted to support.');
    }

    /**
     * Reopen a closed or resolved ticket.
     */
    public function reopen(SupportTicket $ticket, SupportTicketService $ticketService): RedirectResponse
    {
        abort_if($ticket->user_id !== auth()->id(), 403, 'Unauthorized access to support ticket.');

        $ticketService->updateStatus($ticket, auth()->user(), 'open');

        return redirect()->route('client.support.show', $ticket)
            ->with('success', 'Ticket reopened successfully.');
    }

    /**
     * Securely download a support attachment ensuring user authorization.
     */
    public function downloadAttachment(SupportAttachment $attachment): StreamedResponse
    {
        $user = auth()->user();

        // Authorization check: client must own the ticket, or must be admin
        if (!$user->isAdmin() && $attachment->ticket->user_id !== $user->id) {
            abort(403, 'Unauthorized access to support attachment.');
        }

        // If client, ensure the attachment does NOT belong to an internal note!
        if (!$user->isAdmin() && $attachment->message?->is_internal_note) {
            abort(403, 'Unauthorized access to internal attachment.');
        }

        if (!Storage::disk($attachment->disk)->exists($attachment->file_path)) {
            abort(404, 'Attachment file not found.');
        }

        return Storage::disk($attachment->disk)->download(
            $attachment->file_path,
            $attachment->file_name,
            ['Content-Type' => $attachment->mime_type]
        );
    }
}
