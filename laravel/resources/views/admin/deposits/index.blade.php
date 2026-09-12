@extends('layouts.admin')

@section('title', 'Deposit Operations')
@section('header_title', 'Deposit & Credit Operations')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Deposit Management</h4>
        <p class="text-muted small mb-0">Review client payment requests and initiate offline deposit or bonus credits.</p>
    </div>
    <div>
        <button type="button" class="btn btn-success d-flex align-items-center gap-2" data-bs-toggle="modal" data-bs-target="#manualDepositModal">
            <i class="bi bi-plus-circle"></i>
            <span>Create Pending Deposit / Bonus</span>
        </button>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.deposits.index') }}" class="row g-2 align-items-center">
        <div class="col-6 col-md-3">
            <label class="form-label text-muted small mb-1">Status</label>
            <select name="status" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected</option>
            </select>
        </div>

        <div class="col-6 col-md-3">
            <label class="form-label text-muted small mb-1">Request Channel</label>
            <select name="request_channel" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Channels</option>
                <option value="client_panel" {{ request('request_channel') === 'client_panel' ? 'selected' : '' }}>Client Portal</option>
                <option value="phone" {{ request('request_channel') === 'phone' ? 'selected' : '' }}>Phone</option>
                <option value="whatsapp" {{ request('request_channel') === 'whatsapp' ? 'selected' : '' }}>WhatsApp</option>
                <option value="admin" {{ request('request_channel') === 'admin' ? 'selected' : '' }}>Admin Backoffice</option>
            </select>
        </div>

        <div class="col-6 col-md-3">
            <label class="form-label text-muted small mb-1">Credit Reason</label>
            <select name="credit_reason" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Reasons</option>
                <option value="deposit" {{ request('credit_reason') === 'deposit' ? 'selected' : '' }}>Deposit</option>
                <option value="bonus" {{ request('credit_reason') === 'bonus' ? 'selected' : '' }}>Bonus</option>
                <option value="manual_credit" {{ request('credit_reason') === 'manual_credit' ? 'selected' : '' }}>Manual Credit</option>
            </select>
        </div>

        <div class="col-6 col-md-3 d-flex align-items-end">
            <a href="{{ route('admin.deposits.index') }}" class="btn btn-sm btn-outline-secondary w-100">Reset Filters</a>
        </div>
    </form>
</div>

<!-- Deposits List -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Deposit Records ({{ $deposits->total() }})</h6>
    </div>

    @if($deposits->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No deposit records found matching the current filters.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Channel</th>
                        <th>Reason</th>
                        <th>Source Ref</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($deposits as $dep)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $dep->id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $dep->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $dep->user->email }}
                                </a>
                                @if($dep->user->profile)
                                    <div class="text-muted small" style="font-size: 0.75rem;">{{ $dep->user->profile->first_name }} {{ $dep->user->profile->last_name }}</div>
                                @endif
                            </td>
                            <td class="fw-bold text-success font-monospace fs-6">
                                ${{ \App\Services\Financial\MoneyFormatter::format($dep->amount) }}
                            </td>
                            <td>{{ $dep->paymentMethod?->name ?? '—' }}</td>
                            <td><span class="badge bg-secondary text-capitalize">{{ str_replace('_', ' ', $dep->request_channel) }}</span></td>
                            <td>
                                @if($dep->credit_reason === 'bonus')
                                    <span class="badge bg-info bg-opacity-20 text-info">Bonus</span>
                                @elseif($dep->credit_reason === 'manual_credit')
                                    <span class="badge bg-purple bg-opacity-20 text-light">Manual Credit</span>
                                @else
                                    <span class="badge bg-secondary">Deposit</span>
                                @endif
                            </td>
                            <td class="font-monospace text-muted small">{{ $dep->source_reference ?? '—' }}</td>
                            <td>
                                @if($dep->status === 'completed')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($dep->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending</span>
                                @elseif($dep->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($dep->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">{{ $dep->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($dep->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Approve button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#approveModal{{ $dep->id }}">
                                            <i class="bi bi-check-lg me-1"></i> Approve
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectModal{{ $dep->id }}">
                                            <i class="bi bi-x-lg"></i>
                                        </button>
                                    </div>

                                    <!-- Approve Modal -->
                                    <div class="modal fade" id="approveModal{{ $dep->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.deposits.approve', $dep->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Approve Deposit #{{ $dep->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2">Are you sure you want to approve this deposit and credit <strong>${{ \App\Services\Financial\MoneyFormatter::format($dep->amount) }}</strong> to <strong>{{ $dep->user->email }}</strong>'s CRM Wallet?</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Admin Approval Notes (Optional)</label>
                                                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="e.g., Bank wire reference confirmed"></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Confirm & Credit Wallet</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectModal{{ $dep->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.deposits.reject', $dep->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Deposit #{{ $dep->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <p class="mb-2 text-muted">This deposit will be rejected and no funds will be credited to the client's wallet.</p>
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="2" required placeholder="Specify why this deposit is being rejected..."></textarea>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-danger">Reject Deposit</button>
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
            {{ $deposits->links() }}
        </div>
    @endif
</div>

<!-- Manual Deposit / Bonus Modal -->
<div class="modal fade" id="manualDepositModal" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary text-white">
            <form method="POST" action="{{ route('admin.deposits.manual') }}">
                @csrf
                <div class="modal-header border-secondary">
                    <h5 class="modal-title"><i class="bi bi-pencil-square me-2 text-success"></i> Create Pending Offline Deposit / Bonus Entry</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info bg-info bg-opacity-10 text-info border-info border-opacity-25 small mb-3">
                        <i class="bi bi-info-circle me-1"></i>
                        <strong>Workflow:</strong> Creating an entry creates a <em>Pending</em> deposit record. The wallet is credited only after the standard administrative approval step.
                    </div>

                    <div class="row g-3">
                        <div class="col-12 col-md-6">
                            <label class="form-label small text-muted">Target Client <span class="text-danger">*</span></label>
                            <select name="user_id" class="form-select bg-black border-secondary text-white" required>
                                <option value="">Select active client...</option>
                                @foreach($activeClients as $cl)
                                    <option value="{{ $cl->id }}">{{ $cl->email }} ({{ $cl->profile ? $cl->profile->first_name . ' ' . $cl->profile->last_name : 'No profile' }})</option>
                                @endforeach
                            </select>
                        </div>

                        <div class="col-12 col-md-6">
                            <label class="form-label small text-muted">Amount (USD) <span class="text-danger">*</span></label>
                            <input type="text" name="amount" class="form-control bg-black border-secondary text-white font-monospace" placeholder="100.00" required>
                        </div>

                        <div class="col-12 col-md-4">
                            <label class="form-label small text-muted">Request Channel <span class="text-danger">*</span></label>
                            <select name="request_channel" class="form-select bg-black border-secondary text-white" required>
                                <option value="admin">Admin Backoffice</option>
                                <option value="phone">Phone Request</option>
                                <option value="whatsapp">WhatsApp Request</option>
                            </select>
                        </div>

                        <div class="col-12 col-md-4">
                            <label class="form-label small text-muted">Credit Reason <span class="text-danger">*</span></label>
                            <select name="credit_reason" class="form-select bg-black border-secondary text-white" required>
                                <option value="deposit">Deposit (Standard)</option>
                                <option value="bonus">Promotional Bonus</option>
                                <option value="manual_credit">Manual Adjustment / Credit</option>
                            </select>
                        </div>

                        <div class="col-12 col-md-4">
                            <label class="form-label small text-muted">Payment Method (Optional)</label>
                            <select name="payment_method_id" class="form-select bg-black border-secondary text-white">
                                <option value="">None / Direct</option>
                                @foreach($activePaymentMethods as $pm)
                                    <option value="{{ $pm->id }}">{{ $pm->name }} ({{ $pm->type }})</option>
                                @endforeach
                            </select>
                        </div>

                        <div class="col-12">
                            <label class="form-label small text-muted">Source Reference / Transaction ID (Optional)</label>
                            <input type="text" name="source_reference" class="form-control bg-black border-secondary text-white" placeholder="e.g., Bank Wire MT103 Ref or Cash Voucher #">
                        </div>

                        <div class="col-12 col-md-6">
                            <label class="form-label small text-muted">Client Note (Optional)</label>
                            <textarea name="client_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="Note visible to client"></textarea>
                        </div>

                        <div class="col-12 col-md-6">
                            <label class="form-label small text-muted">Admin Note / Justification</label>
                            <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="Internal audit note"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-success">Create Pending Entry</button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection
