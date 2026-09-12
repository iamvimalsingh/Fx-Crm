@extends('layouts.admin')

@section('title', 'Trading Password Resets')
@section('header_title', 'Trading Password Reset Operations')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Trading Password Reset Requests</h4>
        <p class="text-muted small mb-0">Process manual trading password resets. Reset credentials on your trading server and confirm here. <strong>No passwords are stored in CRM.</strong></p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.trading-accounts.password-resets.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <select name="status" class="form-select bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending Reset</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.trading-accounts.password-resets.index') }}" class="btn btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Password Resets Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Password Reset Requests ({{ $requests->total() }})</h6>
    </div>

    @if($requests->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No password reset requests found matching the filter.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Trading Account</th>
                        <th>Platform</th>
                        <th>Server</th>
                        <th>Client Notes</th>
                        <th>Status</th>
                        <th>Admin Notes</th>
                        <th>Date</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($requests as $req)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $req->id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $req->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $req->user->email }}
                                </a>
                            </td>
                            <td>
                                <span class="font-monospace text-info fw-bold fs-6">
                                    #{{ $req->tradingAccount?->login_id ?? 'Unknown' }}
                                </span>
                            </td>
                            <td><span class="badge bg-secondary">{{ $req->tradingAccount?->platform_name ?? '—' }}</span></td>
                            <td class="text-muted">{{ $req->tradingAccount?->server_name ?? '—' }}</td>
                            <td class="text-muted small">{{ $req->notes ?? '—' }}</td>
                            <td>
                                @if($req->status === 'completed')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($req->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending</span>
                                @elseif($req->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($req->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">{{ $req->admin_notes ?? '—' }}</td>
                            <td class="text-muted small">{{ $req->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($req->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Complete button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#completePwModal{{ $req->id }}">
                                            <i class="bi bi-check-circle me-1"></i> Confirm Reset
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectPwModal{{ $req->id }}">
                                            <i class="bi bi-x-circle"></i>
                                        </button>
                                    </div>

                                    <!-- Complete Modal -->
                                    <div class="modal fade" id="completePwModal{{ $req->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.trading-accounts.password-resets.complete', $req->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Confirm External Password Reset #{{ $req->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2">Confirm that you have manually generated a new master/investor password on your trading platform for account <strong>#{{ $req->tradingAccount?->login_id }}</strong> and delivered it directly to the client.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Admin Confirmation Notes (Optional)</label>
                                                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="e.g., Temporary password dispatched via secure server notification"></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Mark As Reset Completed</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectPwModal{{ $req->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.trading-accounts.password-resets.reject', $req->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Password Reset #{{ $req->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="2" required placeholder="Specify why this reset request cannot be completed..."></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-danger">Reject Request</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                @else
                                    <span class="text-muted small">Processed</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $requests->links() }}
        </div>
    @endif
</div>
@endsection
