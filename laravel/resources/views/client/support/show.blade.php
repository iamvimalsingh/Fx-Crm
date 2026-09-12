@extends('layouts.client')

@section('title', 'Support Ticket #' . $ticket->ticket_number)
@section('header_title', 'Support Ticket Thread')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <a href="{{ route('client.support.index') }}" class="btn btn-sm btn-outline-secondary mb-2">
            <i class="bi bi-arrow-left me-1"></i> Back to Support Center
        </a>
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <h4 class="text-white fw-bold mb-0">{{ $ticket->subject }}</h4>
            <span class="{{ $ticket->status_badge }}">{{ ucfirst($ticket->status) }}</span>
            <span class="{{ $ticket->priority_badge }}">{{ ucfirst($ticket->priority) }} Priority</span>
            <span class="badge bg-dark border border-secondary text-light">{{ $ticket->category }}</span>
        </div>
        <div class="text-muted small mt-1 font-monospace">
            Ticket ID: {{ $ticket->ticket_number }} • Opened {{ $ticket->created_at->format('M d, Y H:i') }}
        </div>
    </div>

    @if($ticket->status === 'closed' || $ticket->status === 'resolved')
        <div>
            <form method="POST" action="{{ route('client.support.reopen', $ticket) }}" onsubmit="return confirm('Do you want to reopen this support ticket?')">
                @csrf
                <button type="submit" class="btn btn-warning btn-sm">
                    <i class="bi bi-arrow-counterclockwise me-1"></i> Reopen Ticket
                </button>
            </form>
        </div>
    @endif
</div>

<div class="row g-4">
    <!-- Conversation Thread Column -->
    <div class="col-12 col-lg-8">
        <!-- Linked CRM Record Notice if applicable -->
        @if($ticket->linked_record_type && $ticket->linked_record)
            <div class="alert alert-dark bg-black bg-opacity-40 border-secondary border-opacity-50 p-3 mb-4 rounded d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-link-45deg text-primary fs-5"></i>
                    <div>
                        <div class="text-white fw-semibold small">Linked CRM Record:</div>
                        <div class="text-muted small">{{ $ticket->linked_record_label }}</div>
                    </div>
                </div>
                <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25">
                    Verified Account Link
                </span>
            </div>
        @endif

        <!-- Message Thread -->
        <div class="d-flex flex-column gap-3 mb-4">
            @foreach($ticket->clientVisibleMessages as $message)
                @if($message->isFromClient())
                    <!-- Client's own message (aligned right / distinctive theme) -->
                    <div class="d-flex flex-column align-items-end">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="text-muted small" style="font-size: 0.75rem;">{{ $message->created_at->format('M d, Y H:i') }}</span>
                            <span class="text-white fw-semibold small">You (Client)</span>
                            <div class="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 24px; height: 24px; font-size: 0.75rem;">
                                <i class="bi bi-person-fill"></i>
                            </div>
                        </div>
                        <div class="p-3 rounded-3 text-white border border-primary border-opacity-30" style="background-color: #1e293b; max-width: 85%; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">{{ $message->message }}</div>
                        
                        @if($message->attachments->count() > 0)
                            <div class="mt-2 d-flex flex-wrap gap-2 justify-content-end">
                                @foreach($message->attachments as $att)
                                    <a href="{{ route('client.support.attachments.download', $att) }}" class="btn btn-sm btn-outline-secondary border-opacity-50 text-white d-inline-flex align-items-center gap-2" style="font-size: 0.8rem;">
                                        <i class="bi bi-paperclip text-primary"></i>
                                        <span class="text-truncate" style="max-width: 180px;">{{ $att->file_name }}</span>
                                        <span class="text-muted small">({{ $att->formatted_size }})</span>
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                @else
                    <!-- Admin / Broker Agent response (aligned left / distinct official badge) -->
                    <div class="d-flex flex-column align-items-start">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <div class="bg-info bg-opacity-25 text-info rounded-circle d-flex align-items-center justify-content-center" style="width: 24px; height: 24px; font-size: 0.75rem;">
                                <i class="bi bi-shield-fill-check"></i>
                            </div>
                            <span class="text-info fw-semibold small">Support Agent (Official Response)</span>
                            <span class="text-muted small" style="font-size: 0.75rem;">{{ $message->created_at->format('M d, Y H:i') }}</span>
                        </div>
                        <div class="p-3 rounded-3 text-white border border-info border-opacity-30" style="background-color: #0f172a; max-width: 85%; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">{{ $message->message }}</div>

                        @if($message->attachments->count() > 0)
                            <div class="mt-2 d-flex flex-wrap gap-2">
                                @foreach($message->attachments as $att)
                                    <a href="{{ route('client.support.attachments.download', $att) }}" class="btn btn-sm btn-outline-secondary border-opacity-50 text-white d-inline-flex align-items-center gap-2" style="font-size: 0.8rem;">
                                        <i class="bi bi-paperclip text-info"></i>
                                        <span class="text-truncate" style="max-width: 180px;">{{ $att->file_name }}</span>
                                        <span class="text-muted small">({{ $att->formatted_size }})</span>
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                @endif
            @endforeach
        </div>

        <!-- Reply Box -->
        @if($ticket->status !== 'closed')
            <div class="fx-card p-4">
                <h6 class="text-white fw-bold mb-3">
                    <i class="bi bi-reply-fill me-1 text-primary"></i> Post a Reply
                </h6>

                @if($errors->any())
                    <div class="alert alert-danger p-2 small mb-3">
                        <ul class="mb-0 ps-3">
                            @foreach($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <form method="POST" action="{{ route('client.support.reply', $ticket) }}" enctype="multipart/form-data">
                    @csrf
                    <div class="mb-3">
                        <textarea name="message" rows="4" class="form-control bg-black border-secondary text-white" placeholder="Type your reply here..." required maxlength="5000">{{ old('message') }}</textarea>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted small">Attach File (Optional, max 5MB)</label>
                        <input type="file" name="attachment" class="form-control form-control-sm bg-black border-secondary text-white" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip">
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small">
                            <i class="bi bi-info-circle me-1"></i> Submitting a reply will notify our assigned support team.
                        </span>
                        <button type="submit" class="btn btn-primary px-4">
                            <i class="bi bi-send-fill me-1"></i> Send Reply
                        </button>
                    </div>
                </form>
            </div>
        @else
            <div class="alert alert-secondary bg-black bg-opacity-40 border-secondary p-4 text-center rounded">
                <div class="text-muted mb-2"><i class="bi bi-lock-fill fs-3"></i></div>
                <h6 class="text-white fw-bold mb-1">This ticket is closed</h6>
                <p class="text-muted small mb-3">No further replies can be sent. If you have additional questions, you can reopen this ticket or create a new one.</p>
                <form method="POST" action="{{ route('client.support.reopen', $ticket) }}" class="d-inline">
                    @csrf
                    <button type="submit" class="btn btn-warning btn-sm">
                        <i class="bi bi-arrow-counterclockwise me-1"></i> Reopen Ticket
                    </button>
                </form>
            </div>
        @endif
    </div>

    <!-- Ticket Summary Sidebar -->
    <div class="col-12 col-lg-4">
        <div class="fx-card mb-4">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-ticket-detailed me-2 text-primary"></i> Ticket Information
            </h6>

            <table class="table table-dark table-borderless table-sm mb-0" style="font-size: 0.85rem;">
                <tr>
                    <td class="text-muted" style="width: 40%;">Ticket Number:</td>
                    <td class="text-white font-monospace fw-semibold">{{ $ticket->ticket_number }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Status:</td>
                    <td><span class="{{ $ticket->status_badge }}">{{ ucfirst($ticket->status) }}</span></td>
                </tr>
                <tr>
                    <td class="text-muted">Category:</td>
                    <td><span class="badge bg-dark border border-secondary text-light">{{ $ticket->category }}</span></td>
                </tr>
                <tr>
                    <td class="text-muted">Priority:</td>
                    <td><span class="{{ $ticket->priority_badge }}">{{ ucfirst($ticket->priority) }}</span></td>
                </tr>
                <tr>
                    <td class="text-muted">Created:</td>
                    <td class="text-white">{{ $ticket->created_at->format('M d, Y H:i') }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Last Updated:</td>
                    <td class="text-white">{{ $ticket->updated_at->format('M d, Y H:i') }}</td>
                </tr>
                @if($ticket->resolved_at)
                    <tr>
                        <td class="text-muted">Resolved At:</td>
                        <td class="text-success">{{ $ticket->resolved_at->format('M d, Y H:i') }}</td>
                    </tr>
                @endif
                @if($ticket->closed_at)
                    <tr>
                        <td class="text-muted">Closed At:</td>
                        <td class="text-secondary">{{ $ticket->closed_at->format('M d, Y H:i') }}</td>
                    </tr>
                @endif
                <tr>
                    <td class="text-muted">Assigned Team:</td>
                    <td class="text-white">
                        {{ $ticket->assignedTo?->profile?->first_name ? $ticket->assignedTo->profile->first_name . ' (Support)' : 'Central Helpdesk' }}
                    </td>
                </tr>
            </table>
        </div>
    </div>
</div>
@endsection
