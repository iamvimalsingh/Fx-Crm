@extends('layouts.client')

@section('title', 'Support Center')
@section('header_title', 'Support Center & Helpdesk')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-1">
            <i class="bi bi-headset me-2 text-primary"></i> Client Support Center
        </h4>
        <p class="text-muted small mb-0">Open direct inquiry tickets, track operational requests, or contact our dedicated help desk.</p>
    </div>
    <div>
        <a href="{{ route('client.support.create') }}" class="btn btn-primary">
            <i class="bi bi-plus-lg me-1"></i> Open Support Ticket
        </a>
    </div>
</div>

<div class="row g-4">
    <!-- Main Tickets Column -->
    <div class="col-12 col-lg-8">
        <!-- Filter Bar -->
        <div class="fx-card mb-3 p-3">
            <form method="GET" action="{{ route('client.support.index') }}" class="row g-2 align-items-center">
                <div class="col-12 col-md-5">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-black border-secondary text-muted"><i class="bi bi-search"></i></span>
                        <input type="text" name="search" class="form-control bg-black border-secondary text-white" placeholder="Search ticket # or subject..." value="{{ request('search') }}">
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <select name="status" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                        <option value="">All Statuses</option>
                        <option value="open" {{ request('status') === 'open' ? 'selected' : '' }}>Open</option>
                        <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending</option>
                        <option value="resolved" {{ request('status') === 'resolved' ? 'selected' : '' }}>Resolved</option>
                        <option value="closed" {{ request('status') === 'closed' ? 'selected' : '' }}>Closed</option>
                    </select>
                </div>
                <div class="col-6 col-md-3">
                    <select name="category" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                        <option value="">All Categories</option>
                        @foreach(\App\Models\SupportTicket::CATEGORIES as $cat)
                            <option value="{{ $cat }}" {{ request('category') === $cat ? 'selected' : '' }}>{{ $cat }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-12 col-md-1 d-flex">
                    <a href="{{ route('client.support.index') }}" class="btn btn-sm btn-outline-secondary w-100" title="Clear Filters">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </a>
                </div>
            </form>
        </div>

        <!-- Tickets List -->
        <div class="fx-card">
            @if($tickets->count() > 0)
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                        <thead>
                            <tr class="text-muted border-secondary border-opacity-25" style="font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;">
                                <th style="width: 25%;">Ticket</th>
                                <th style="width: 20%;">Category</th>
                                <th style="width: 15%;">Priority</th>
                                <th style="width: 15%;">Status</th>
                                <th style="width: 15%;">Last Activity</th>
                                <th style="width: 10%;" class="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($tickets as $ticket)
                                <tr>
                                    <td>
                                        <a href="{{ route('client.support.show', $ticket) }}" class="text-white fw-semibold text-decoration-none d-block text-truncate" style="max-width: 220px;">
                                            {{ $ticket->subject }}
                                        </a>
                                        <div class="font-monospace text-muted small" style="font-size: 0.75rem;">
                                            {{ $ticket->ticket_number }}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge bg-dark border border-secondary text-light">
                                            {{ $ticket->category }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="{{ $ticket->priority_badge }}">
                                            {{ ucfirst($ticket->priority) }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="{{ $ticket->status_badge }}">
                                            {{ ucfirst($ticket->status) }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="text-muted small" title="{{ $ticket->updated_at }}">
                                            {{ $ticket->updated_at->diffForHumans() }}
                                        </span>
                                    </td>
                                    <td class="text-end">
                                        <a href="{{ route('client.support.show', $ticket) }}" class="btn btn-sm btn-outline-primary py-1 px-2">
                                            View
                                        </a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                <div class="p-3 border-top border-secondary border-opacity-25 d-flex justify-content-end">
                    {{ $tickets->links() }}
                </div>
            @else
                <div class="text-center py-5">
                    <div class="display-6 text-muted mb-3">
                        <i class="bi bi-inbox"></i>
                    </div>
                    <h6 class="text-white fw-bold mb-1">No Support Tickets Found</h6>
                    <p class="text-muted small mb-3">You do not have any support inquiries matching the current criteria.</p>
                    <a href="{{ route('client.support.create') }}" class="btn btn-primary btn-sm">
                        <i class="bi bi-plus-lg me-1"></i> Open Your First Ticket
                    </a>
                </div>
            @endif
        </div>
    </div>

    <!-- Support Helpdesk Sidebar -->
    <div class="col-12 col-lg-4">
        <!-- Direct Help Desk Channels -->
        <div class="fx-card mb-4">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-info-circle me-2 text-info"></i> Support Desk Information
            </h6>
            
            <p class="text-muted small mb-3">
                {{ $supportSettings['instructions'] }}
            </p>

            <div class="d-flex flex-column gap-3">
                <div class="d-flex align-items-center gap-3 p-2 rounded bg-black bg-opacity-30 border border-secondary border-opacity-25">
                    <div class="bg-primary bg-opacity-20 text-primary rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                        <i class="bi bi-envelope-fill"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="text-muted small" style="font-size: 0.75rem;">Official Support Email</div>
                        <a href="mailto:{{ $supportSettings['email'] }}" class="text-white text-decoration-none fw-semibold text-truncate d-block" style="font-size: 0.875rem;">
                            {{ $supportSettings['email'] }}
                        </a>
                    </div>
                </div>

                @if(!empty($supportSettings['phone']))
                    <div class="d-flex align-items-center gap-3 p-2 rounded bg-black bg-opacity-30 border border-secondary border-opacity-25">
                        <div class="bg-success bg-opacity-20 text-success rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                            <i class="bi bi-telephone-fill"></i>
                        </div>
                        <div class="overflow-hidden">
                            <div class="text-muted small" style="font-size: 0.75rem;">Phone Desk</div>
                            <span class="text-white fw-semibold font-monospace" style="font-size: 0.875rem;">
                                {{ $supportSettings['phone'] }}
                            </span>
                        </div>
                    </div>
                @endif

                @if(!empty($supportSettings['whatsapp']))
                    <div class="d-flex align-items-center gap-3 p-2 rounded bg-black bg-opacity-30 border border-secondary border-opacity-25">
                        <div class="bg-success bg-opacity-20 text-success rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                            <i class="bi bi-whatsapp"></i>
                        </div>
                        <div class="overflow-hidden">
                            <div class="text-muted small" style="font-size: 0.75rem;">WhatsApp Hotline</div>
                            <span class="text-white fw-semibold font-monospace" style="font-size: 0.875rem;">
                                {{ $supportSettings['whatsapp'] }}
                            </span>
                        </div>
                    </div>
                @endif

                <div class="d-flex align-items-center gap-3 p-2 rounded bg-black bg-opacity-30 border border-secondary border-opacity-25">
                    <div class="bg-warning bg-opacity-20 text-warning rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                        <i class="bi bi-clock-fill"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="text-muted small" style="font-size: 0.75rem;">Operating Hours & Timezone</div>
                        <div class="text-white fw-semibold" style="font-size: 0.85rem;">
                            {{ $supportSettings['hours'] }}
                        </div>
                        <div class="text-muted small" style="font-size: 0.75rem;">
                            Timezone: {{ $supportSettings['timezone'] }}
                        </div>
                    </div>
                </div>

                @if(!empty($supportSettings['emergency']))
                    <div class="p-3 rounded bg-danger bg-opacity-10 border border-danger border-opacity-25">
                        <div class="d-flex align-items-center gap-2 text-danger fw-bold small mb-1">
                            <i class="bi bi-exclamation-octagon-fill"></i> Trading Desk Emergency
                        </div>
                        <div class="text-muted small" style="font-size: 0.8rem;">
                            {{ $supportSettings['emergency'] }}
                        </div>
                    </div>
                @endif
            </div>
        </div>

        <!-- Quick Help Card -->
        <div class="fx-card">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-question-circle me-2 text-primary"></i> Support Guidelines
            </h6>
            <ul class="text-muted small ps-3 mb-0" style="line-height: 1.6;">
                <li>For faster processing, link your inquiry directly to the relevant Deposit, Withdrawal, or Trading Account.</li>
                <li>Support attachments accept images (.jpg, .png) and documents (.pdf, .docx, .zip) up to 5MB.</li>
                <li>Replies from broker agents will trigger real-time notifications in your client notification bell.</li>
            </ul>
        </div>
    </div>
</div>
@endsection
