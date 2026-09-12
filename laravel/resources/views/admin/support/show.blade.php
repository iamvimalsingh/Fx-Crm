@extends('layouts.admin')

@section('title', 'Ticket ' . $ticket->ticket_number)
@section('header_title', 'Support Ticket Management')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <a href="{{ route('admin.support.index') }}" class="btn btn-sm btn-outline-secondary mb-2">
            <i class="bi bi-arrow-left me-1"></i> Back to All Tickets
        </a>
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <h4 class="text-white fw-bold mb-0">{{ $ticket->subject }}</h4>
            <span class="{{ $ticket->status_badge }}">{{ ucfirst($ticket->status) }}</span>
            <span class="{{ $ticket->priority_badge }}">{{ ucfirst($ticket->priority) }} Priority</span>
            <span class="badge bg-dark border border-secondary text-light">{{ $ticket->category }}</span>
        </div>
        <div class="text-muted small mt-1 font-monospace">
            Ticket ID: {{ $ticket->ticket_number }} • Created {{ $ticket->created_at->format('M d, Y H:i') }} • Last Reply: {{ $ticket->last_reply_at ? $ticket->last_reply_at->diffForHumans() : 'Never' }}
        </div>
    </div>
</div>

<div class="row g-4">
    <!-- Main Thread & Response Area -->
    <div class="col-12 col-lg-8">
        <!-- Linked CRM Record Alert if any -->
        @if($ticket->linked_record_type && $ticket->linked_record)
            <div class="alert alert-dark bg-black bg-opacity-40 border-secondary border-opacity-50 p-3 mb-4 rounded d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-link-45deg text-info fs-4"></i>
                    <div>
                        <div class="text-white fw-semibold small">Linked CRM Record:</div>
                        <div class="text-muted small">{{ $ticket->linked_record_label }}</div>
                    </div>
                </div>
                <span class="badge bg-info bg-opacity-20 text-info border border-info border-opacity-25">
                    {{ ucfirst(str_replace('_', ' ', $ticket->linked_record_type)) }}
                </span>
            </div>
        @endif

        <!-- Message Thread -->
        <div class="d-flex flex-column gap-3 mb-4">
            @foreach($ticket->messages as $msg)
                @if($msg->is_internal_note)
                    <!-- Internal Staff Note -->
                    <div class="p-3 rounded-3 border border-warning border-opacity-50 bg-warning bg-opacity-10">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-warning text-dark fw-bold">
                                    <i class="bi bi-lock-fill me-1"></i> INTERNAL NOTE
                                </span>
                                <span class="text-warning fw-semibold small">{{ $msg->user->name ?? 'Admin Staff' }}</span>
                            </div>
                            <span class="text-muted small" style="font-size: 0.75rem;">{{ $msg->created_at->format('M d, Y H:i') }}</span>
                        </div>
                        <div class="text-light" style="white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">{{ $msg->message }}</div>

                        @if($msg->attachments->count() > 0)
                            <div class="mt-2 d-flex flex-wrap gap-2">
                                @foreach($msg->attachments as $att)
                                    <a href="{{ route('client.support.attachments.download', $att) }}" class="btn btn-sm btn-outline-warning border-opacity-50 text-white d-inline-flex align-items-center gap-2" style="font-size: 0.8rem;">
                                        <i class="bi bi-paperclip text-warning"></i>
                                        <span class="text-truncate" style="max-width: 200px;">{{ $att->file_name }}</span>
                                        <span class="text-muted small">({{ $att->formatted_size }})</span>
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                @elseif($msg->isFromClient())
                    <!-- Client Message -->
                    <div class="d-flex flex-column align-items-start">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <div class="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; font-size: 0.75rem;">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <span class="text-white fw-semibold small">{{ $ticket->user->name ?? 'Client' }} (Client)</span>
                            <span class="text-muted small" style="font-size: 0.75rem;">{{ $msg->created_at->format('M d, Y H:i') }}</span>
                        </div>
                        <div class="p-3 rounded-3 text-white border border-primary border-opacity-30" style="background-color: #1e293b; max-width: 90%; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">{{ $msg->message }}</div>

                        @if($msg->attachments->count() > 0)
                            <div class="mt-2 d-flex flex-wrap gap-2">
                                @foreach($msg->attachments as $att)
                                    <a href="{{ route('client.support.attachments.download', $att) }}" class="btn btn-sm btn-outline-secondary border-opacity-50 text-white d-inline-flex align-items-center gap-2" style="font-size: 0.8rem;">
                                        <i class="bi bi-paperclip text-primary"></i>
                                        <span class="text-truncate" style="max-width: 200px;">{{ $att->file_name }}</span>
                                        <span class="text-muted small">({{ $att->formatted_size }})</span>
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                @else
                    <!-- Admin Official Response -->
                    <div class="d-flex flex-column align-items-end">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="text-muted small" style="font-size: 0.75rem;">{{ $msg->created_at->format('M d, Y H:i') }}</span>
                            <span class="text-info fw-semibold small">{{ $msg->user->name ?? 'Support Agent' }} (Official Response)</span>
                            <div class="bg-info bg-opacity-25 text-info rounded-circle d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; font-size: 0.75rem;">
                                <i class="bi bi-shield-fill-check"></i>
                            </div>
                        </div>
                        <div class="p-3 rounded-3 text-white border border-info border-opacity-30" style="background-color: #0f172a; max-width: 90%; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">{{ $msg->message }}</div>

                        @if($msg->attachments->count() > 0)
                            <div class="mt-2 d-flex flex-wrap gap-2 justify-content-end">
                                @foreach($msg->attachments as $att)
                                    <a href="{{ route('client.support.attachments.download', $att) }}" class="btn btn-sm btn-outline-secondary border-opacity-50 text-white d-inline-flex align-items-center gap-2" style="font-size: 0.8rem;">
                                        <i class="bi bi-paperclip text-info"></i>
                                        <span class="text-truncate" style="max-width: 200px;">{{ $att->file_name }}</span>
                                        <span class="text-muted small">({{ $att->formatted_size }})</span>
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                @endif
            @endforeach
        </div>

        <!-- Action Box: Public Reply OR Internal Note -->
        <div class="fx-admin-card p-4">
            <ul class="nav nav-pills mb-3" id="pills-tab" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active btn-sm" id="pills-reply-tab" data-bs-toggle="pill" data-bs-target="#pills-reply" type="button" role="tab">
                        <i class="bi bi-reply-fill me-1"></i> Public Reply to Client
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link btn-sm text-warning" id="pills-note-tab" data-bs-toggle="pill" data-bs-target="#pills-note" type="button" role="tab">
                        <i class="bi bi-lock-fill me-1"></i> Internal Staff Note
                    </button>
                </li>
            </ul>

            <div class="tab-content" id="pills-tabContent">
                <!-- Tab 1: Official Reply -->
                <div class="tab-pane fade show active" id="pills-reply" role="tabpanel">
                    <form method="POST" action="{{ route('admin.support.reply', $ticket) }}" enctype="multipart/form-data">
                        @csrf
                        <div class="mb-3">
                            <textarea name="message" rows="4" class="form-control bg-black border-secondary text-white" placeholder="Compose public response to client..." required maxlength="5000"></textarea>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-12 col-md-6">
                                <label class="form-label text-muted small">Update Status On Reply</label>
                                <select name="new_status" class="form-select form-select-sm bg-black border-secondary text-white">
                                    <option value="pending" {{ $ticket->status === 'open' ? 'selected' : '' }}>Pending (Waiting for client response)</option>
                                    <option value="open">Keep Open (Needs internal follow-up)</option>
                                    <option value="resolved">Mark as Resolved</option>
                                    <option value="closed">Mark as Closed</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label text-muted small">Attach File (Optional, max 5MB)</label>
                                <input type="file" name="attachment" class="form-control form-control-sm bg-black border-secondary text-white" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip">
                            </div>
                        </div>

                        <div class="d-flex justify-content-end">
                            <button type="submit" class="btn btn-primary px-4">
                                <i class="bi bi-send-fill me-1"></i> Send Reply to Client
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Tab 2: Internal Note -->
                <div class="tab-pane fade" id="pills-note" role="tabpanel">
                    <form method="POST" action="{{ route('admin.support.note', $ticket) }}" enctype="multipart/form-data">
                        @csrf
                        <div class="alert alert-warning bg-warning bg-opacity-10 border-warning border-opacity-25 p-2 small mb-3">
                            <i class="bi bi-shield-lock-fill me-1"></i> <strong>Internal notes are strictly confidential</strong> and will NEVER be seen by the client.
                        </div>

                        <div class="mb-3">
                            <textarea name="note" rows="4" class="form-control bg-black border-warning border-opacity-50 text-white" placeholder="Add confidential notes, troubleshooting logs, or handoff instructions..." required maxlength="5000"></textarea>
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-muted small">Attach Internal Document (Optional)</label>
                            <input type="file" name="attachment" class="form-control form-control-sm bg-black border-secondary text-white" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip">
                        </div>

                        <div class="d-flex justify-content-end">
                            <button type="submit" class="btn btn-warning px-4 text-dark fw-semibold">
                                <i class="bi bi-lock-fill me-1"></i> Save Internal Note
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Sidebar: Controls & Client Context -->
    <div class="col-12 col-lg-4">
        <!-- Ticket Controls Card -->
        <div class="fx-admin-card mb-4">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-sliders me-2 text-primary"></i> Ticket Management Controls
            </h6>

            <!-- Status Control -->
            <form method="POST" action="{{ route('admin.support.status', $ticket) }}" class="mb-3">
                @csrf
                <label class="form-label text-muted small">Change Lifecycle Status</label>
                <div class="input-group input-group-sm">
                    <select name="status" class="form-select bg-black border-secondary text-white">
                        <option value="open" {{ $ticket->status === 'open' ? 'selected' : '' }}>Open</option>
                        <option value="pending" {{ $ticket->status === 'pending' ? 'selected' : '' }}>Pending</option>
                        <option value="resolved" {{ $ticket->status === 'resolved' ? 'selected' : '' }}>Resolved</option>
                        <option value="closed" {{ $ticket->status === 'closed' ? 'selected' : '' }}>Closed</option>
                    </select>
                    <button type="submit" class="btn btn-outline-primary">Update</button>
                </div>
            </form>

            <!-- Priority Control -->
            <form method="POST" action="{{ route('admin.support.priority', $ticket) }}" class="mb-3">
                @csrf
                <label class="form-label text-muted small">Update Priority</label>
                <div class="input-group input-group-sm">
                    <select name="priority" class="form-select bg-black border-secondary text-white">
                        <option value="low" {{ $ticket->priority === 'low' ? 'selected' : '' }}>Low</option>
                        <option value="normal" {{ $ticket->priority === 'normal' ? 'selected' : '' }}>Normal</option>
                        <option value="high" {{ $ticket->priority === 'high' ? 'selected' : '' }}>High</option>
                    </select>
                    <button type="submit" class="btn btn-outline-warning">Set</button>
                </div>
            </form>

            <!-- Assignment Control -->
            <form method="POST" action="{{ route('admin.support.assign', $ticket) }}">
                @csrf
                <label class="form-label text-muted small">Assign Support Agent</label>
                <div class="input-group input-group-sm">
                    <select name="assigned_to_user_id" class="form-select bg-black border-secondary text-white">
                        <option value="">Unassigned</option>
                        @foreach($admins as $adm)
                            <option value="{{ $adm->id }}" {{ $ticket->assigned_to_user_id == $adm->id ? 'selected' : '' }}>
                                {{ $adm->name }} ({{ $adm->email }})
                            </option>
                        @endforeach
                    </select>
                    <button type="submit" class="btn btn-outline-success">Assign</button>
                </div>
            </form>
        </div>

        <!-- Client 360 Context Card -->
        <div class="fx-admin-card">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-person-lines-fill me-2 text-info"></i> Client Profile & Overview
            </h6>

            @if($ticket->user)
                <div class="mb-3">
                    <div class="text-white fw-bold fs-6">
                        <a href="{{ route('admin.clients.show', $ticket->user) }}" class="text-info text-decoration-none">
                            {{ $ticket->user->name }}
                        </a>
                    </div>
                    <div class="text-muted small">{{ $ticket->user->email }}</div>
                    <div class="text-muted small">Client UID: #ACC-{{ str_pad($ticket->user->id, 4, '0', STR_PAD_LEFT) }}</div>
                </div>

                <table class="table table-dark table-borderless table-sm mb-0" style="font-size: 0.85rem;">
                    <tr>
                        <td class="text-muted" style="width: 45%;">CRM Wallet:</td>
                        <td class="text-success fw-bold font-monospace">
                            ${{ $ticket->user->wallet?->formatted_balance ?? '0.00' }}
                        </td>
                    </tr>
                    <tr>
                        <td class="text-muted">KYC Status:</td>
                        <td>
                            @php
                                $rawKycStatus = $ticket->user->kycProfile?->status;
                                $kycStatusVal = $rawKycStatus instanceof \BackedEnum ? $rawKycStatus->value : (string) ($rawKycStatus ?? 'unverified');
                            @endphp
                            <span class="badge {{ $kycStatusVal === 'verified' || $kycStatusVal === 'approved' ? 'bg-success' : 'bg-warning text-dark' }}">
                                {{ \App\Models\SupportTicket::formatStatusLabel($rawKycStatus ?? 'unverified') }}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td class="text-muted">Trading Accounts:</td>
                        <td class="text-white fw-semibold">
                            {{ $ticket->user->tradingAccounts->count() }} active
                        </td>
                    </tr>
                </table>

                <div class="mt-3 pt-3 border-top border-secondary border-opacity-25">
                    <a href="{{ route('admin.clients.show', $ticket->user) }}" class="btn btn-sm btn-outline-info w-100">
                        <i class="bi bi-arrow-up-right-square me-1"></i> Open Client Dossier
                    </a>
                </div>
            @else
                <p class="text-muted small mb-0">Client record is no longer available.</p>
            @endif
        </div>
    </div>
</div>
@endsection
