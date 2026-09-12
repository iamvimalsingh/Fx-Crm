@extends('layouts.admin')

@section('title', 'Trading Account Funding Operations')
@section('header_title', 'Trading Account Funding Operations')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Trading Account Funding Requests</h4>
        <p class="text-muted small mb-0">Clients who requested transferring funds from their CRM Wallet into their external trading account. Once you manually credit the trading account on your trading server, confirm the operation here.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.fundings.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <select name="status" class="form-select bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending Trading Platform Credit</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected (Refunded to Wallet)</option>
                <option value="cancelled" {{ request('status') === 'cancelled' ? 'selected' : '' }}>Cancelled</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.fundings.index') }}" class="btn btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Fundings Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Funding Requests ({{ $fundings->total() }})</h6>
    </div>

    @if($fundings->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No trading account funding requests found matching the filter.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Target Trading Account</th>
                        <th>Amount (USD)</th>
                        <th>Client Notes</th>
                        <th>Status</th>
                        <th>Processed By</th>
                        <th>Date</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($fundings as $fnd)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $fnd->id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $fnd->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $fnd->user->email }}
                                </a>
                            </td>
                            <td>
                                <span class="font-monospace text-info fw-bold fs-6">
                                    #{{ $fnd->tradingAccount?->login_id ?? 'Unknown' }}
                                </span>
                                <div class="text-muted small" style="font-size: 0.75rem;">{{ $fnd->tradingAccount?->platform_name }} ({{ $fnd->tradingAccount?->server_name }})</div>
                            </td>
                            <td class="fw-bold text-success font-monospace fs-6">
                                ${{ \App\Services\Financial\MoneyFormatter::format($fnd->amount) }}
                            </td>
                            <td class="text-muted small">{{ $fnd->client_notes ?? '—' }}</td>
                            <td>
                                @if($fnd->status === 'completed')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($fnd->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending Credit</span>
                                @elseif($fnd->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($fnd->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">
                                {{ $fnd->processor ? $fnd->processor->email : '—' }}
                            </td>
                            <td class="text-muted small">{{ $fnd->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($fnd->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Complete button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#completeFundingModal{{ $fnd->id }}">
                                            <i class="bi bi-check-circle me-1"></i> Mark Credited
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectFundingModal{{ $fnd->id }}">
                                            <i class="bi bi-x-circle"></i>
                                        </button>
                                    </div>

                                    <!-- Complete Modal -->
                                    <div class="modal fade" id="completeFundingModal{{ $fnd->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.fundings.complete', $fnd->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Confirm External Account Credit #{{ $fnd->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2">Confirm that you have manually credited <strong>${{ \App\Services\Financial\MoneyFormatter::format($fnd->amount) }}</strong> to external trading account <strong>#{{ $fnd->tradingAccount?->login_id }}</strong> ({{ $fnd->tradingAccount?->platform_name }}).</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Admin Payout/Credit Notes (Optional)</label>
                                                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="e.g., Deposited via MT manager terminal ticket #54321"></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Mark As Credited</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectFundingModal{{ $fnd->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.fundings.reject', $fnd->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Funding Request #{{ $fnd->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2 text-warning">Rejecting this funding request will <strong>automatically refund ${{ \App\Services\Financial\MoneyFormatter::format($fnd->amount) }}</strong> back to the client's CRM wallet balance.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="2" required placeholder="Specify why this account cannot be funded..."></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-danger">Reject & Refund Wallet</button>
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
            {{ $fundings->links() }}
        </div>
    @endif
</div>
@endsection
