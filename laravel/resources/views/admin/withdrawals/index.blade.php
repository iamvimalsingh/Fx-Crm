@extends('layouts.admin')

@section('title', 'Withdrawal Operations')
@section('header_title', 'Client Withdrawal & Payout Operations')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Withdrawal Operations</h4>
        <p class="text-muted small mb-0">Process manual payouts to client bank accounts, crypto wallets, or payment services.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.withdrawals.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <select name="status" class="form-select bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending Manual Payout</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected (Refunded)</option>
                <option value="cancelled" {{ request('status') === 'cancelled' ? 'selected' : '' }}>Cancelled</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.withdrawals.index') }}" class="btn btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Withdrawals Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Withdrawal Requests ({{ $withdrawals->total() }})</h6>
    </div>

    @if($withdrawals->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No withdrawal records found matching the specified filters.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Payout Method</th>
                        <th>Destination Details</th>
                        <th>Status</th>
                        <th>Processor</th>
                        <th>Date</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($withdrawals as $wd)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $wd->id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $wd->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $wd->user->email }}
                                </a>
                                @if($wd->user->profile)
                                    <div class="text-muted small" style="font-size: 0.75rem;">{{ $wd->user->profile->first_name }} {{ $wd->user->profile->last_name }}</div>
                                @endif
                            </td>
                            <td class="fw-bold text-warning font-monospace fs-6">
                                ${{ \App\Services\Financial\MoneyFormatter::format($wd->amount) }}
                            </td>
                            <td><span class="badge bg-secondary">{{ $wd->withdrawal_method }}</span></td>
                            <td>
                                <span class="font-monospace text-info small" title="{{ $wd->destination_details }}">
                                    {{ \Illuminate\Support\Str::limit($wd->destination_details, 40) }}
                                </span>
                            </td>
                            <td>
                                @if($wd->status === 'completed')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($wd->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending Payout</span>
                                @elseif($wd->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($wd->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">
                                {{ $wd->processedByUser ? $wd->processedByUser->email : '—' }}
                            </td>
                            <td class="text-muted small">{{ $wd->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($wd->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Complete button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#completeWdModal{{ $wd->id }}">
                                            <i class="bi bi-check-circle me-1"></i> Mark Paid
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectWdModal{{ $wd->id }}">
                                            <i class="bi bi-x-circle me-1"></i> Reject
                                        </button>
                                    </div>

                                    <!-- Complete Modal -->
                                    <div class="modal fade" id="completeWdModal{{ $wd->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.withdrawals.complete', $wd->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Confirm Manual Payout #{{ $wd->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2">Confirm that you have manually dispatched <strong>${{ \App\Services\Financial\MoneyFormatter::format($wd->amount) }}</strong> via <strong>{{ $wd->withdrawal_method }}</strong> to:</p>
                                                        <div class="p-2 bg-black rounded font-monospace small text-info mb-3">
                                                            {{ $wd->destination_details }}
                                                        </div>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Admin Payout Notes / Reference ID (Optional)</label>
                                                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="e.g., Bank transaction ref #987654"></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Mark As Paid & Completed</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectWdModal{{ $wd->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.withdrawals.reject', $wd->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Withdrawal #{{ $wd->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2 text-warning">Rejecting this withdrawal will <strong>automatically refund ${{ \App\Services\Financial\MoneyFormatter::format($wd->amount) }}</strong> back to the client's CRM wallet.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="2" required placeholder="Specify why this payout cannot be fulfilled..."></textarea>
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
            {{ $withdrawals->links() }}
        </div>
    @endif
</div>
@endsection
