@extends('layouts.admin')

@section('title', 'Trading Account Returns Operations')
@section('header_title', 'Trading Account Returns to CRM Wallet')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Trading Account Return Requests</h4>
        <p class="text-muted small mb-0">Clients requesting transfer of funds from their external trading account back to their CRM Wallet. Once you manually deduct the balance on the trading platform server, confirm the credit here.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.returns.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <input type="text" name="search" class="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Search account ID or client email..." value="{{ request('search') }}">
        </div>

        <div class="col-12 col-md-3">
            <select name="status" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending Review</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed (Credited to Wallet)</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected</option>
                <option value="cancelled" {{ request('status') === 'cancelled' ? 'selected' : '' }}>Cancelled</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <button type="submit" class="btn btn-sm btn-primary w-100">Filter</button>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.returns.index') }}" class="btn btn-sm btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Returns Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Return Requests ({{ $returns->total() }})</h6>
    </div>

    @if($returns->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No trading return requests found matching the criteria.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Source Trading Account</th>
                        <th>Amount</th>
                        <th>Client Notes</th>
                        <th>Status</th>
                        <th>Processed By</th>
                        <th>Date</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($returns as $ret)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $ret->id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $ret->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $ret->user->email }}
                                </a>
                            </td>
                            <td>
                                <span class="font-monospace text-info fw-bold fs-6">
                                    #{{ $ret->tradingAccount?->login_id ?? 'Unknown' }}
                                </span>
                                <div class="text-muted small" style="font-size: 0.75rem;">{{ $ret->tradingAccount?->platform_name }} ({{ $ret->tradingAccount?->server_name }})</div>
                            </td>
                            <td class="fw-bold text-success font-monospace fs-6">
                                ${{ \App\Services\Financial\MoneyFormatter::format($ret->amount) }} {{ $ret->currency }}
                            </td>
                            <td class="text-muted small">{{ $ret->notes ?? '—' }}</td>
                            <td>
                                @if($ret->status === 'completed')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($ret->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending Review</span>
                                @elseif($ret->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @elseif($ret->status === 'cancelled')
                                    <span class="badge bg-secondary">Cancelled</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($ret->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">
                                {{ $ret->processor ? $ret->processor->email : '—' }}
                            </td>
                            <td class="text-muted small">{{ $ret->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($ret->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Complete button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#completeReturnModal{{ $ret->id }}">
                                            <i class="bi bi-check-circle me-1"></i> Confirm & Credit Wallet
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectReturnModal{{ $ret->id }}">
                                            <i class="bi bi-x-circle"></i>
                                        </button>
                                    </div>

                                    <!-- Complete Modal -->
                                    <div class="modal fade" id="completeReturnModal{{ $ret->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.returns.complete', $ret->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Confirm Return & Credit Wallet #{{ $ret->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2">Confirm that you have deducted <strong>${{ \App\Services\Financial\MoneyFormatter::format($ret->amount) }}</strong> from trading account <strong>#{{ $ret->tradingAccount?->login_id }}</strong> and wish to credit the client's CRM wallet immediately.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Admin Notes (Optional)</label>
                                                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="e.g., Deducted from MT5 terminal ticket #98765"></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Credit CRM Wallet</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectReturnModal{{ $ret->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.returns.reject', $ret->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Return Request #{{ $ret->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2 text-muted small">Please provide the reason for rejecting this return request. This reason will be logged and notified to the client.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="3" required placeholder="e.g., Insufficient free margin on external trading account..."></textarea>
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
                                    <span class="text-muted small">—</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $returns->links() }}
        </div>
    @endif
</div>
@endsection
