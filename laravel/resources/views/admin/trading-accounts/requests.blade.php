@extends('layouts.admin')

@section('title', 'Trading Account Requests')
@section('header_title', 'Trading Account Provisioning Requests')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Trading Account Requests</h4>
        <p class="text-muted small mb-0">Manual account provisioning workflow. Provision the account on your trading server then record credentials here.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.trading-accounts.requests.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <select name="status" class="form-select bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending Manual Provisioning</option>
                <option value="approved" {{ request('status') === 'approved' ? 'selected' : '' }}>Approved</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.trading-accounts.requests.index') }}" class="btn btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Requests Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Provisioning Requests ({{ $requests->total() }})</h6>
    </div>

    @if($requests->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No trading account requests found matching the filter.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>ID</th>
                        <th>Client</th>
                        <th>Platform</th>
                        <th>Account Type</th>
                        <th>Leverage</th>
                        <th>Currency</th>
                        <th>Client Notes</th>
                        <th>Status</th>
                        <th>Provisioned Account</th>
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
                            <td class="fw-bold text-white">{{ $req->platform }}</td>
                            <td><span class="badge bg-secondary text-capitalize">{{ $req->account_type }}</span></td>
                            <td class="text-muted">{{ $req->leverage }}</td>
                            <td class="text-muted">{{ $req->currency }}</td>
                            <td class="text-muted small">{{ $req->notes ?? '—' }}</td>
                            <td>
                                @if($req->status === 'approved')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Approved</span>
                                @elseif($req->status === 'pending')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending</span>
                                @elseif($req->status === 'rejected')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($req->status) }}</span>
                                @endif
                            </td>
                            <td>
                                @if($req->tradingAccount)
                                    <span class="font-monospace text-info fw-bold">#{{ $req->tradingAccount->login_id }}</span>
                                @else
                                    <span class="text-muted">—</span>
                                @endif
                            </td>
                            <td class="text-muted small">{{ $req->created_at->format('M d, Y H:i') }}</td>
                            <td class="text-end">
                                @if($req->status === 'pending')
                                    <div class="btn-group btn-group-sm">
                                        <!-- Approve button -->
                                        <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#approveReqModal{{ $req->id }}">
                                            <i class="bi bi-check-lg me-1"></i> Register Account
                                        </button>
                                        <!-- Reject button -->
                                        <button type="button" class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#rejectReqModal{{ $req->id }}">
                                            <i class="bi bi-x-lg"></i>
                                        </button>
                                    </div>

                                    <!-- Approve Modal -->
                                    <div class="modal fade" id="approveReqModal{{ $req->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-lg modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.trading-accounts.requests.approve', $req->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title">Record Provisioned Account for Request #{{ $req->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <div class="alert alert-info bg-info bg-opacity-10 text-info border-info border-opacity-25 small mb-3">
                                                            <i class="bi bi-info-circle me-1"></i>
                                                            Enter the login ID and server details created on your trading platform. <strong>Do not enter passwords</strong> (credentials are securely delivered directly to client by the trading platform).
                                                        </div>

                                                        <div class="row g-3">
                                                            <div class="col-12 col-md-6">
                                                                <label class="form-label small text-muted">Platform <span class="text-danger">*</span></label>
                                                                <select name="platform_name" class="form-select bg-black border-secondary text-white" required>
                                                                    @foreach($platforms as $pKey => $pCfg)
                                                                        <option value="{{ $pKey }}" {{ strtolower($req->platform) === strtolower($pKey) ? 'selected' : '' }}>{{ is_array($pCfg) ? ($pCfg['name'] ?? $pKey) : $pCfg }}</option>
                                                                    @endforeach
                                                                </select>
                                                            </div>

                                                            <div class="col-12 col-md-6">
                                                                <label class="form-label small text-muted">Server Name <span class="text-danger">*</span></label>
                                                                @php
                                                                    $defaultServer = is_array($platforms[$req->platform] ?? null) ? ($platforms[$req->platform]['servers'][0] ?? 'Live-01') : 'Live-01';
                                                                @endphp
                                                                <input type="text" name="server_name" class="form-control bg-black border-secondary text-white" value="{{ $defaultServer }}" required>
                                                            </div>

                                                            <div class="col-12 col-md-6">
                                                                <label class="form-label small text-muted">Trading Account Login ID <span class="text-danger">*</span></label>
                                                                <input type="text" name="login_id" class="form-control bg-black border-secondary text-white font-monospace" placeholder="e.g., 1002345" required>
                                                            </div>

                                                            <div class="col-12 col-md-6">
                                                                <label class="form-label small text-muted">Account Type <span class="text-danger">*</span></label>
                                                                <select name="account_type" class="form-select bg-black border-secondary text-white" required>
                                                                    @foreach($accountTypes as $at)
                                                                        <option value="{{ $at }}" {{ $req->account_type === $at ? 'selected' : '' }}>{{ ucfirst($at) }}</option>
                                                                    @endforeach
                                                                </select>
                                                            </div>

                                                            <div class="col-12 col-md-4">
                                                                <label class="form-label small text-muted">Currency <span class="text-danger">*</span></label>
                                                                <input type="text" name="currency" class="form-control bg-black border-secondary text-white" value="{{ $req->currency ?: 'USD' }}" required maxlength="3">
                                                            </div>

                                                            <div class="col-12 col-md-4">
                                                                <label class="form-label small text-muted">Leverage <span class="text-danger">*</span></label>
                                                                <select name="leverage" class="form-select bg-black border-secondary text-white" required>
                                                                    @foreach($leverages as $lev)
                                                                        <option value="{{ $lev }}" {{ $req->leverage === $lev ? 'selected' : '' }}>{{ $lev }}</option>
                                                                    @endforeach
                                                                </select>
                                                            </div>

                                                            <div class="col-12 col-md-4">
                                                                <label class="form-label small text-muted">Account Status <span class="text-danger">*</span></label>
                                                                <select name="status" class="form-select bg-black border-secondary text-white" required>
                                                                    <option value="active">Active</option>
                                                                    <option value="suspended">Suspended</option>
                                                                    <option value="disabled">Disabled</option>
                                                                </select>
                                                            </div>

                                                            <div class="col-12">
                                                                <label class="form-label small text-muted">Admin Notes (Optional)</label>
                                                                <textarea name="admin_notes" class="form-control bg-black border-secondary text-white" rows="2" placeholder="Internal provisioning notes"></textarea>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-secondary">
                                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-success">Save & Approve Request</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Reject Modal -->
                                    <div class="modal fade" id="rejectReqModal{{ $req->id }}" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content bg-dark border-secondary text-white">
                                                <form method="POST" action="{{ route('admin.trading-accounts.requests.reject', $req->id) }}">
                                                    @csrf
                                                    <div class="modal-header border-secondary">
                                                        <h5 class="modal-title text-danger">Reject Request #{{ $req->id }}</h5>
                                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                                    </div>
                                                    <div class="modal-body text-start">
                                                        <div class="mb-3">
                                                            <label class="form-label small text-muted">Rejection Reason <span class="text-danger">*</span></label>
                                                            <textarea name="rejection_reason" class="form-control bg-black border-secondary text-white" rows="2" required placeholder="Specify why this account cannot be provisioned..."></textarea>
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
