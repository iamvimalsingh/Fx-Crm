@extends('layouts.admin')

@section('title', 'Client 360 - ' . ($client->profile?->first_name ?? $client->email))
@section('header_title', 'Client 360 Overview')

@section('content')
@if(session('generated_client_password'))
    <div class="alert alert-warning border-warning border-opacity-50 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
            <div class="fw-bold fs-6 text-warning"><i class="bi bi-shield-lock me-2"></i> Client Password Reset Successfully</div>
            <div class="small text-white opacity-75">Provide this temporary or new credential to the client. This will not be shown again:</div>
            <div class="mt-2 font-monospace fs-5 fw-bold text-warning bg-black p-2 rounded px-3 d-inline-block border border-warning border-opacity-25" id="oneTimeClientPasswordDisplay">
                {{ session('generated_client_password') }}
            </div>
        </div>
        <button type="button" class="btn btn-outline-warning btn-sm" onclick="navigator.clipboard.writeText('{{ session('generated_client_password') }}'); this.innerHTML='<i class=\'bi bi-check-lg\'></i> Copied';">
            <i class="bi bi-clipboard me-1"></i> Copy Password
        </button>
    </div>
@endif

@if(session('generated_trading_password'))
    <div class="alert alert-success border-success border-opacity-50 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
            <div class="fw-bold fs-6 text-success"><i class="bi bi-shield-check me-2"></i> Trading Account #{{ session('trading_account_reset_login_id') }} Password Updated</div>
            <div class="small text-white opacity-75">New encrypted trading password generated:</div>
            <div class="mt-2 font-monospace fs-5 fw-bold text-success bg-black p-2 rounded px-3 d-inline-block border border-success border-opacity-25">
                {{ session('generated_trading_password') }}
            </div>
        </div>
        <button type="button" class="btn btn-outline-success btn-sm" onclick="navigator.clipboard.writeText('{{ session('generated_trading_password') }}'); this.innerHTML='<i class=\'bi bi-check-lg\'></i> Copied';">
            <i class="bi bi-clipboard me-1"></i> Copy Password
        </button>
    </div>
@endif

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <a href="{{ route('admin.clients.index') }}" class="text-muted text-decoration-none small mb-1 d-inline-block">
            &larr; Back to Client Directory
        </a>
        <h4 class="text-white fw-bold mb-0">
            {{ $client->profile ? $client->profile->first_name . ' ' . $client->profile->last_name : 'Unnamed Client' }}
            <span class="fs-6 text-muted fw-normal">({{ $client->email }})</span>
        </h4>
    </div>

    <!-- Client Actions -->
    <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-sm btn-outline-warning" data-bs-toggle="modal" data-bs-target="#resetClientPasswordModal">
            <i class="bi bi-key-fill me-1"></i> Reset Password
        </button>

        <form method="POST" action="{{ route('admin.clients.status', $client->id) }}" class="d-inline">
            @csrf
            @if($client->status === 'active' || $client->status?->value === 'active')
                <input type="hidden" name="status" value="disabled">
                <button type="submit" class="btn btn-sm btn-outline-danger" onclick="return confirm('Are you sure you want to disable this client account?')">
                    <i class="bi bi-slash-circle me-1"></i> Disable Account
                </button>
            @else
                <input type="hidden" name="status" value="active">
                <button type="submit" class="btn btn-sm btn-success">
                    <i class="bi bi-check-circle me-1"></i> Activate Account
                </button>
            @endif
        </form>
    </div>
</div>

<div class="row g-3 mb-4">
    <!-- Profile Card -->
    <div class="col-12 col-lg-4">
        <div class="fx-admin-card h-100">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">Client Profile</h6>
            <table class="table table-dark table-borderless table-sm mb-0" style="font-size: 0.85rem;">
                <tr>
                    <td class="text-muted" style="width: 40%;">Full Name:</td>
                    <td class="text-white fw-semibold">{{ $client->profile ? $client->profile->first_name . ' ' . $client->profile->last_name : '—' }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Email:</td>
                    <td class="text-white">{{ $client->email }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Phone:</td>
                    <td class="text-white">{{ $client->profile?->phone ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Country:</td>
                    <td class="text-white">{{ $client->profile?->country ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Address:</td>
                    <td class="text-white">{{ $client->profile?->address_line1 ?? '—' }} {{ $client->profile?->city ? ', ' . $client->profile->city : '' }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Status:</td>
                    <td>
                        @if($client->status === 'active' || $client->status?->value === 'active')
                            <span class="badge bg-success bg-opacity-20 text-success">Active</span>
                        @else
                            <span class="badge bg-danger bg-opacity-20 text-danger">Disabled</span>
                        @endif
                    </td>
                </tr>
                <tr>
                    <td class="text-muted">Email Verification:</td>
                    <td>
                        @if($client->hasVerifiedEmail())
                            <span class="badge bg-success bg-opacity-20 text-success">Verified</span>
                        @else
                            <span class="badge bg-warning bg-opacity-20 text-warning">Unverified</span>
                        @endif
                    </td>
                </tr>
                <tr>
                    <td class="text-muted">KYC Status:</td>
                    <td>
                        @php $kycSt = $client->kycProfile?->status->value ?? $client->kycProfile?->status ?? 'not_submitted'; @endphp
                        @if($kycSt === 'approved')
                            <span class="badge bg-success bg-opacity-20 text-success">Approved</span>
                        @elseif($kycSt === 'pending')
                            <span class="badge bg-warning bg-opacity-20 text-warning">Pending Review</span>
                        @elseif($kycSt === 'rejected')
                            <span class="badge bg-danger bg-opacity-20 text-danger">Rejected</span>
                        @else
                            <span class="badge bg-secondary bg-opacity-20 text-secondary">Not Submitted</span>
                        @endif
                        <a href="{{ route('admin.kyc.show', $client->id) }}" class="btn btn-sm btn-link text-info p-0 ms-2 text-decoration-none">
                            Review &rarr;
                        </a>
                    </td>
                </tr>
                <tr>
                    <td class="text-muted">Registered:</td>
                    <td class="text-muted">{{ $client->created_at->format('M d, Y H:i') }}</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- CRM Wallet Card -->
    <div class="col-12 col-lg-8">
        <div class="fx-admin-card h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <span class="text-muted small fw-semibold">Available CRM Wallet Balance</span>
                    <div class="fs-3 fw-bold text-success font-monospace">${{ \App\Services\Financial\MoneyFormatter::format($wallet->balance) }} {{ $wallet->currency }}</div>
                </div>
                <div>
                    <span class="badge bg-secondary">Base Currency: {{ config('broker.base_currency', 'USD') }}</span>
                </div>
            </div>

            <h6 class="text-white fw-bold small border-bottom border-secondary border-opacity-25 pb-2 mb-2">Recent CRM Ledger Entries</h6>
            @if($recentTransactions->isEmpty())
                <div class="text-muted small py-3 text-center">No transaction records found for this client.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted">
                                <th>Ref</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($recentTransactions as $tx)
                                <tr>
                                    <td class="font-monospace text-muted">{{ $tx->reference_id }}</td>
                                    <td><span class="badge bg-secondary text-capitalize">{{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}</span></td>
                                    <td class="fw-bold {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                        {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}${{ \App\Services\Financial\MoneyFormatter::format($tx->amount) }}
                                    </td>
                                    <td>
                                        @php $st = $tx->status->value ?? $tx->status; @endphp
                                        <span class="badge {{ $st === 'completed' ? 'bg-success' : ($st === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }} bg-opacity-25">
                                            {{ ucfirst($st) }}
                                        </span>
                                    </td>
                                    <td class="text-muted">{{ $tx->created_at->format('M d, H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
</div>

<!-- Trading Accounts Section -->
<div class="fx-admin-card mb-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Registered Trading Accounts ({{ $tradingAccounts->count() }})</h6>
    </div>

    @if($tradingAccounts->isEmpty())
        <div class="text-muted small py-4 text-center">No trading accounts currently provisioned for this client.</div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>Platform</th>
                        <th>Login ID</th>
                        <th>Server</th>
                        <th>Type</th>
                        <th>Currency</th>
                        <th>Leverage</th>
                        <th>Status</th>
                        <th>Credentials</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($tradingAccounts as $acc)
                        <tr>
                            <td class="fw-bold text-white">{{ $acc->platform_name }}</td>
                            <td class="font-monospace text-info fw-bold">{{ $acc->login_id }}</td>
                            <td class="text-muted">{{ $acc->server_name }}</td>
                            <td><span class="badge bg-secondary text-capitalize">{{ $acc->account_type }}</span></td>
                            <td class="text-muted">{{ $acc->currency }}</td>
                            <td class="text-muted">{{ $acc->leverage }}</td>
                            <td>
                                @if($acc->status === 'active')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Active</span>
                                @elseif($acc->status === 'disabled')
                                    <span class="badge bg-danger bg-opacity-25 text-danger">Disabled</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($acc->status) }}</span>
                                @endif
                            </td>
                            <td>
                                <div class="d-flex align-items-center gap-1">
                                    <button type="button" class="btn btn-sm btn-outline-info p-1 px-2 text-nowrap admin-reveal-pw-btn" data-account-id="{{ $acc->id }}" data-login-id="{{ $acc->login_id }}" title="Reveal Password">
                                        <i class="bi bi-eye"></i> Show
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-secondary p-1 px-2 text-nowrap" data-bs-toggle="modal" data-bs-target="#setPasswordModal{{ $acc->id }}" title="Reset Password">
                                        <i class="bi bi-key"></i> Reset
                                    </button>
                                </div>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
</div>

<!-- Requests Tabs -->
<div class="fx-admin-card mb-4">
    <h6 class="text-white fw-bold mb-3">Client Requests & History</h6>

    <ul class="nav nav-tabs nav-tabs-dark border-secondary mb-3" id="clientRequestsTab" role="tablist">
        <li class="nav-item">
            <button class="nav-link active" id="deposits-tab" data-bs-toggle="tab" data-bs-target="#deposits-pane" type="button">Deposits ({{ $deposits->count() }})</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="withdrawals-tab" data-bs-toggle="tab" data-bs-target="#withdrawals-pane" type="button">Withdrawals ({{ $withdrawals->count() }})</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="accreq-tab" data-bs-toggle="tab" data-bs-target="#accreq-pane" type="button">Account Requests ({{ $tradingAccountRequests->count() }})</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="fundings-tab" data-bs-toggle="tab" data-bs-target="#fundings-pane" type="button">Trading Fundings ({{ $tradingFundings->count() }})</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="pwresets-tab" data-bs-toggle="tab" data-bs-target="#pwresets-pane" type="button">Password Resets ({{ $passwordResetRequests->count() }})</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="kycdocs-tab" data-bs-toggle="tab" data-bs-target="#kycdocs-pane" type="button">KYC Documents ({{ $kycDocuments->count() }})</button>
        </li>
    </ul>

    <div class="tab-content" id="clientRequestsTabContent">
        <!-- Deposits Tab -->
        <div class="tab-pane fade show active" id="deposits-pane">
            @if($deposits->isEmpty())
                <div class="text-muted small py-3 text-center">No deposit requests recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Amount</th><th>Method</th><th>Channel</th><th>Reason</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            @foreach($deposits as $dep)
                                <tr>
                                    <td>#{{ $dep->id }}</td>
                                    <td class="fw-bold text-success">${{ \App\Services\Financial\MoneyFormatter::format($dep->amount) }}</td>
                                    <td>{{ $dep->paymentMethod?->name ?? 'Manual/None' }}</td>
                                    <td><span class="badge bg-secondary">{{ $dep->request_channel }}</span></td>
                                    <td><span class="badge bg-secondary">{{ $dep->credit_reason }}</span></td>
                                    <td><span class="badge {{ $dep->status === 'completed' || $dep->status === 'approved' ? 'bg-success' : ($dep->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($dep->status) }}</span></td>
                                    <td class="text-muted">{{ $dep->created_at->format('M d, Y H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <!-- Withdrawals Tab -->
        <div class="tab-pane fade" id="withdrawals-pane">
            @if($withdrawals->isEmpty())
                <div class="text-muted small py-3 text-center">No withdrawal requests recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Amount</th><th>Method</th><th>Destination</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            @foreach($withdrawals as $wd)
                                <tr>
                                    <td>#{{ $wd->id }}</td>
                                    <td class="fw-bold text-warning">${{ \App\Services\Financial\MoneyFormatter::format($wd->amount) }}</td>
                                    <td>{{ $wd->withdrawal_method }}</td>
                                    <td class="text-muted font-monospace">{{ $wd->destination_details }}</td>
                                    <td><span class="badge {{ $wd->status === 'completed' ? 'bg-success' : ($wd->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($wd->status) }}</span></td>
                                    <td class="text-muted">{{ $wd->created_at->format('M d, Y H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <!-- Trading Account Requests Tab -->
        <div class="tab-pane fade" id="accreq-pane">
            @if($tradingAccountRequests->isEmpty())
                <div class="text-muted small py-3 text-center">No trading account requests recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Platform</th><th>Type</th><th>Leverage</th><th>Currency</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            @foreach($tradingAccountRequests as $req)
                                <tr>
                                    <td>#{{ $req->id }}</td>
                                    <td class="fw-bold">{{ $req->platform }}</td>
                                    <td>{{ $req->account_type }}</td>
                                    <td>{{ $req->leverage }}</td>
                                    <td>{{ $req->currency }}</td>
                                    <td><span class="badge {{ $req->status === 'approved' ? 'bg-success' : ($req->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($req->status) }}</span></td>
                                    <td class="text-muted">{{ $req->created_at->format('M d, Y H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <!-- Trading Funding Tab -->
        <div class="tab-pane fade" id="fundings-pane">
            @if($tradingFundings->isEmpty())
                <div class="text-muted small py-3 text-center">No trading funding requests recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Trading Account</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            @foreach($tradingFundings as $fnd)
                                <tr>
                                    <td>#{{ $fnd->id }}</td>
                                    <td class="font-monospace text-info">{{ $fnd->tradingAccount?->platform_name }} (#{{ $fnd->tradingAccount?->login_id }})</td>
                                    <td class="fw-bold text-success">${{ \App\Services\Financial\MoneyFormatter::format($fnd->amount) }}</td>
                                    <td><span class="badge {{ $fnd->status === 'completed' ? 'bg-success' : ($fnd->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($fnd->status) }}</span></td>
                                    <td class="text-muted">{{ $fnd->created_at->format('M d, Y H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <!-- Password Resets Tab -->
        <div class="tab-pane fade" id="pwresets-pane">
            @if($passwordResetRequests->isEmpty())
                <div class="text-muted small py-3 text-center">No password reset requests recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Trading Account</th><th>Notes</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            @foreach($passwordResetRequests as $pw)
                                <tr>
                                    <td>#{{ $pw->id }}</td>
                                    <td class="font-monospace text-info">{{ $pw->tradingAccount?->platform_name }} (#{{ $pw->tradingAccount?->login_id }})</td>
                                    <td class="text-muted">{{ $pw->notes ?? '—' }}</td>
                                    <td><span class="badge {{ $pw->status === 'completed' ? 'bg-success' : ($pw->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($pw->status) }}</span></td>
                                    <td class="text-muted">{{ $pw->created_at->format('M d, Y H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <!-- KYC Documents Tab -->
        <div class="tab-pane fade" id="kycdocs-pane">
            @if($kycDocuments->isEmpty())
                <div class="text-muted small py-3 text-center">No verification documents uploaded by this client.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-sm table-hover align-middle mb-0" style="font-size: 0.8rem;">
                        <thead>
                            <tr class="text-muted"><th>ID</th><th>Document Type</th><th>Status</th><th>Rejection Reason</th><th>Uploaded</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            @foreach($kycDocuments as $doc)
                                <tr>
                                    <td>#{{ $doc->id }}</td>
                                    <td class="fw-bold">{{ $doc->document_type === 'id_proof' ? 'Proof of Identity' : 'Proof of Address' }}</td>
                                    <td><span class="badge {{ $doc->status === 'approved' ? 'bg-success' : ($doc->status === 'pending' ? 'bg-warning text-dark' : 'bg-danger') }}">{{ ucfirst($doc->status) }}</span></td>
                                    <td class="text-muted">{{ $doc->rejection_reason ?? '—' }}</td>
                                    <td class="text-muted">{{ $doc->created_at->format('M d, Y H:i') }}</td>
                                    <td>
                                        <a href="{{ route('admin.kyc.documents.view', $doc->id) }}" target="_blank" class="btn btn-sm btn-outline-info py-0 px-2" style="font-size: 0.75rem;">
                                            <i class="bi bi-eye me-1"></i>View
                                        </a>
                                        <a href="{{ route('admin.kyc.show', $client->id) }}" class="btn btn-sm btn-outline-secondary py-0 px-2 ms-1" style="font-size: 0.75rem;">
                                            Review Page
                                        </a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
</div>

<!-- Activity Audit Trail -->
<div class="fx-admin-card">
    <h6 class="text-white fw-bold mb-3">Audit & Activity Log for Client</h6>
    @if($auditLogs->isEmpty())
        <div class="text-muted small py-3 text-center">No activity entries recorded for this client.</div>
    @else
        <div class="list-group list-group-flush bg-transparent">
            @foreach($auditLogs as $log)
                <div class="list-group-item bg-transparent text-white border-secondary border-opacity-25 px-0 py-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="badge bg-info bg-opacity-20 text-info font-monospace small mb-1">{{ $log->action }}</span>
                            <div class="small text-white-50">{{ $log->description ?? 'No details' }}</div>
                        </div>
                        <span class="text-muted small">{{ $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('M d, Y H:i:s') : '—' }}</span>
                    </div>
                </div>
            @endforeach
        </div>
    @endif
</div>
<!-- Reset Client Password Modal -->
<div class="modal fade" id="resetClientPasswordModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary text-white">
            <form method="POST" action="{{ route('admin.clients.reset-password', $client->id) }}">
                @csrf
                <div class="modal-header border-secondary">
                    <h5 class="modal-title"><i class="bi bi-shield-lock text-warning me-2"></i> Reset Client Password</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-start">
                    <p class="text-muted small">Reset password for <strong>{{ $client->email }}</strong> (#{{ $client->id }}). An audit event will be logged.</p>
                    
                    <div class="mb-3">
                        <label class="form-label small text-muted d-block">Generation Strategy</label>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="mode" id="clientModeGen" value="generate" checked onchange="document.getElementById('clientCustomPwSection').classList.add('d-none'); document.getElementById('clientCustomPw').removeAttribute('required'); document.getElementById('clientCustomPwConfirm').removeAttribute('required');">
                            <label class="form-check-label small" for="clientModeGen">Auto-generate Secure Password (16 chars)</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="mode" id="clientModeCustom" value="custom" onchange="document.getElementById('clientCustomPwSection').classList.remove('d-none'); document.getElementById('clientCustomPw').setAttribute('required', 'required'); document.getElementById('clientCustomPwConfirm').setAttribute('required', 'required');">
                            <label class="form-check-label small" for="clientModeCustom">Specify Custom Password</label>
                        </div>
                    </div>

                    <div id="clientCustomPwSection" class="d-none">
                        <div class="mb-3">
                            <label class="form-label small text-muted">New Password (min 8 chars)</label>
                            <input type="password" name="password" id="clientCustomPw" class="form-control bg-black border-secondary text-white" minlength="8" maxlength="128">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small text-muted">Confirm New Password</label>
                            <input type="password" name="password_confirmation" id="clientCustomPwConfirm" class="form-control bg-black border-secondary text-white" minlength="8" maxlength="128">
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small text-muted">Reason / Administrative Note (Optional)</label>
                        <input type="text" name="reason" class="form-control bg-black border-secondary text-white small" placeholder="e.g., Client requested password reset via phone/email verification">
                    </div>

                    <div class="p-2 rounded bg-black bg-opacity-50 border border-secondary border-opacity-25 small text-muted">
                        <i class="bi bi-info-circle text-info me-1"></i> The password will be encrypted using bcrypt. Plaintext passwords are never logged or stored. The client will receive an in-app security alert.
                    </div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-warning text-dark fw-bold">Reset Password</button>
                </div>
            </form>
        </div>
    </div>
</div>

@foreach($tradingAccounts as $acc)
<!-- Set Trading Password Modal for #{{ $acc->login_id }} -->
<div class="modal fade" id="setPasswordModal{{ $acc->id }}" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary text-white">
            <form method="POST" action="{{ route('admin.trading-accounts.set-password', $acc->id) }}">
                @csrf
                <div class="modal-header border-secondary">
                    <h5 class="modal-title">Reset Trading Password: #{{ $acc->login_id }}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-start">
                    <div class="mb-3">
                        <label class="form-label small text-muted d-block">Reset Strategy</label>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="mode" id="modeGenClient{{ $acc->id }}" value="generate" checked onchange="document.getElementById('customPwFieldClient{{ $acc->id }}').classList.add('d-none'); document.getElementById('customPwInputClient{{ $acc->id }}').removeAttribute('required');">
                            <label class="form-check-label small" for="modeGenClient{{ $acc->id }}">Auto-generate Secure Password</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="mode" id="modeCustomClient{{ $acc->id }}" value="custom" onchange="document.getElementById('customPwFieldClient{{ $acc->id }}').classList.remove('d-none'); document.getElementById('customPwInputClient{{ $acc->id }}').setAttribute('required', 'required');">
                            <label class="form-check-label small" for="modeCustomClient{{ $acc->id }}">Set Custom Password</label>
                        </div>
                    </div>

                    <div class="mb-3 d-none" id="customPwFieldClient{{ $acc->id }}">
                        <label class="form-label small text-muted">Custom Trading Password</label>
                        <input type="text" name="password" id="customPwInputClient{{ $acc->id }}" class="form-control bg-black border-secondary text-white font-monospace" placeholder="Enter new trading password..." minlength="4" maxlength="128">
                    </div>

                    <div class="p-2 rounded bg-black bg-opacity-50 border border-secondary border-opacity-25 small text-muted">
                        <i class="bi bi-shield-lock text-info me-1"></i> Passwords are encrypted at rest using AES-256. This reset is recorded in audit logs with action <code>trading_account_password_reset_by_admin</code>.
                    </div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Confirm & Reset Password</button>
                </div>
            </form>
        </div>
    </div>
</div>
@endforeach

<!-- Reveal Password Modal for Admin -->
<div class="modal fade" id="adminPasswordModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary text-white">
            <div class="modal-header border-secondary">
                <h5 class="modal-title" id="adminPasswordModalTitle">Trading Account Password</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-start">
                <p class="text-muted small mb-2">Decrypted credentials retrieved from encrypted storage. This action is recorded in the audit logs.</p>
                <div class="p-3 bg-black rounded border border-secondary mb-3 d-flex align-items-center justify-content-between">
                    <div>
                        <span class="text-muted small d-block">Trading Password</span>
                        <span id="adminRevealedPassword" class="font-monospace fs-5 fw-bold text-warning">Loading...</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-warning" id="adminCopyPasswordBtn" title="Copy to clipboard">
                        <i class="bi bi-clipboard"></i> Copy
                    </button>
                </div>
                <div class="alert alert-info py-2 px-3 small mb-0 border-info border-opacity-25 bg-info bg-opacity-10 text-info">
                    <i class="bi bi-info-circle me-1"></i> Password viewed by administrator. Do not share or store plaintext passwords insecurely.
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function() {
    const adminPasswordModalEl = document.getElementById('adminPasswordModal');
    let adminPasswordModal = null;
    if (adminPasswordModalEl) {
        adminPasswordModal = new bootstrap.Modal(adminPasswordModalEl);
    }

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    document.querySelectorAll('.admin-reveal-pw-btn').forEach(button => {
        button.addEventListener('click', function() {
            const accountId = this.getAttribute('data-account-id');
            const loginId = this.getAttribute('data-login-id');

            document.getElementById('adminPasswordModalTitle').innerText = 'Trading Account #' + loginId;
            document.getElementById('adminRevealedPassword').innerText = 'Decrypting...';
            document.getElementById('adminRevealedPassword').className = 'font-monospace fs-5 fw-bold text-muted';
            adminPasswordModal.show();

            fetch('/admin/trading-accounts/' + accountId + '/reveal-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json'
                }
            })
            .then(res => res.json())
            .then(data => {
                const pwElem = document.getElementById('adminRevealedPassword');
                if (data.success && data.has_password) {
                    pwElem.innerText = data.password;
                    pwElem.className = 'font-monospace fs-5 fw-bold text-warning';
                } else {
                    pwElem.innerText = 'No password stored / unavailable';
                    pwElem.className = 'font-monospace fs-6 text-muted';
                }
            })
            .catch(() => {
                const pwElem = document.getElementById('adminRevealedPassword');
                pwElem.innerText = 'Error decrypting credentials';
                pwElem.className = 'font-monospace fs-6 text-danger';
            });
        });
    });

    const copyBtn = document.getElementById('adminCopyPasswordBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            const pw = document.getElementById('adminRevealedPassword').innerText;
            if (pw && !pw.includes('...') && !pw.includes('Error') && !pw.includes('unavailable')) {
                navigator.clipboard.writeText(pw);
                this.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
                setTimeout(() => {
                    this.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
                }, 2000);
            }
        });
    }
});
</script>
@endpush
