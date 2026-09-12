@extends('layouts.admin')

@section('title', 'Support Tickets')
@section('header_title', 'Support Center & Helpdesk Management')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-1">
            <i class="bi bi-headset me-2 text-primary"></i> Support Tickets & Helpdesk
        </h4>
        <p class="text-muted small mb-0">Manage incoming client inquiries, technical tickets, and back-office customer communications.</p>
    </div>
</div>

<!-- Stats Row -->
<div class="row g-3 mb-4">
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 d-flex align-items-center gap-3">
            <div class="bg-primary bg-opacity-20 text-primary rounded-3 p-3">
                <i class="bi bi-inbox fs-4"></i>
            </div>
            <div>
                <div class="text-muted small">Total Tickets</div>
                <div class="text-white fw-bold fs-4">{{ $stats['total'] }}</div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 d-flex align-items-center gap-3">
            <div class="bg-primary bg-opacity-20 text-primary rounded-3 p-3">
                <i class="bi bi-envelope-open fs-4"></i>
            </div>
            <div>
                <div class="text-muted small">Open Tickets</div>
                <div class="text-primary fw-bold fs-4">{{ $stats['open'] }}</div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 d-flex align-items-center gap-3">
            <div class="bg-warning bg-opacity-20 text-warning rounded-3 p-3">
                <i class="bi bi-clock-history fs-4"></i>
            </div>
            <div>
                <div class="text-muted small">Pending Response</div>
                <div class="text-warning fw-bold fs-4">{{ $stats['pending'] }}</div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 d-flex align-items-center gap-3">
            <div class="bg-danger bg-opacity-20 text-danger rounded-3 p-3">
                <i class="bi bi-exclamation-triangle fs-4"></i>
            </div>
            <div>
                <div class="text-muted small">High Priority</div>
                <div class="text-danger fw-bold fs-4">{{ $stats['high_priority'] }}</div>
            </div>
        </div>
    </div>
</div>

<!-- Filters & Search -->
<div class="fx-admin-card mb-4 p-3">
    <form method="GET" action="{{ route('admin.support.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-black border-secondary text-muted"><i class="bi bi-search"></i></span>
                <input type="text" name="search" class="form-control bg-black border-secondary text-white" placeholder="Search ticket #, subject, client..." value="{{ request('search') }}">
            </div>
        </div>
        <div class="col-6 col-md-2">
            <select name="status" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="open" {{ request('status') === 'open' ? 'selected' : '' }}>Open</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending</option>
                <option value="resolved" {{ request('status') === 'resolved' ? 'selected' : '' }}>Resolved</option>
                <option value="closed" {{ request('status') === 'closed' ? 'selected' : '' }}>Closed</option>
            </select>
        </div>
        <div class="col-6 col-md-2">
            <select name="category" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Categories</option>
                @foreach(\App\Models\SupportTicket::CATEGORIES as $cat)
                    <option value="{{ $cat }}" {{ request('category') === $cat ? 'selected' : '' }}>{{ $cat }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-6 col-md-2">
            <select name="priority" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Priorities</option>
                <option value="high" {{ request('priority') === 'high' ? 'selected' : '' }}>High</option>
                <option value="normal" {{ request('priority') === 'normal' ? 'selected' : '' }}>Normal</option>
                <option value="low" {{ request('priority') === 'low' ? 'selected' : '' }}>Low</option>
            </select>
        </div>
        <div class="col-6 col-md-2 d-flex gap-2">
            <select name="assigned_to" class="form-select form-select-sm bg-black border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Assignees</option>
                <option value="unassigned" {{ request('assigned_to') === 'unassigned' ? 'selected' : '' }}>Unassigned</option>
                @foreach($admins as $adm)
                    <option value="{{ $adm->id }}" {{ request('assigned_to') == $adm->id ? 'selected' : '' }}>
                        {{ $adm->name }}
                    </option>
                @endforeach
            </select>
            <a href="{{ route('admin.support.index') }}" class="btn btn-sm btn-outline-secondary" title="Reset Filters">
                <i class="bi bi-arrow-counterclockwise"></i>
            </a>
        </div>
    </form>
</div>

<!-- Tickets Table -->
<div class="fx-admin-card">
    @if($tickets->count() > 0)
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead>
                    <tr class="text-muted border-secondary border-opacity-25" style="font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;">
                        <th>Ticket</th>
                        <th>Client</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Last Activity</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($tickets as $ticket)
                        <tr>
                            <td>
                                <a href="{{ route('admin.support.show', $ticket) }}" class="text-white fw-semibold text-decoration-none d-block text-truncate" style="max-width: 250px;">
                                    {{ $ticket->subject }}
                                </a>
                                <span class="font-monospace text-muted small" style="font-size: 0.75rem;">
                                    {{ $ticket->ticket_number }}
                                </span>
                            </td>
                            <td>
                                @if($ticket->user)
                                    <a href="{{ route('admin.clients.show', $ticket->user) }}" class="text-info text-decoration-none fw-semibold">
                                        {{ $ticket->user->name }}
                                    </a>
                                    <div class="text-muted small" style="font-size: 0.75rem;">
                                        {{ $ticket->user->email }}
                                    </div>
                                @else
                                    <span class="text-muted">Unknown User</span>
                                @endif
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
                                @if($ticket->assignedTo)
                                    <span class="text-white small">
                                        <i class="bi bi-person-check text-success me-1"></i> {{ $ticket->assignedTo->name }}
                                    </span>
                                @else
                                    <span class="text-muted small fst-italic">Unassigned</span>
                                @endif
                            </td>
                            <td>
                                <span class="text-muted small" title="{{ $ticket->updated_at }}">
                                    {{ $ticket->updated_at->diffForHumans() }}
                                </span>
                                @if($ticket->last_reply_by_role === 'client')
                                    <div><span class="badge bg-primary bg-opacity-20 text-primary" style="font-size: 0.65rem;">Client Waiting</span></div>
                                @endif
                            </td>
                            <td class="text-end">
                                <a href="{{ route('admin.support.show', $ticket) }}" class="btn btn-sm btn-primary py-1 px-3">
                                    Manage
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
            <h6 class="text-white fw-bold mb-1">No Tickets Found</h6>
            <p class="text-muted small mb-0">No support tickets match the selected filter criteria.</p>
        </div>
    @endif
</div>
@endsection
