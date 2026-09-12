@extends('layouts.admin')

@section('title', 'Registered Trading Accounts')
@section('header_title', 'Trading Account Operations')

@section('content')
@if(session('generated_trading_password'))
    <div class="alert alert-success border-success border-opacity-50 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
            <div class="fw-bold fs-6"><i class="bi bi-shield-check me-2"></i> Trading Account #{{ session('trading_account_reset_login_id') }} Password Updated</div>
            <div class="small text-muted">A new trading password was encrypted and saved. Securely provide this one-time credential to the client:</div>
            <div class="mt-2 font-monospace fs-5 fw-bold text-warning bg-black p-2 rounded px-3 d-inline-block border border-warning border-opacity-25" id="oneTimeTradingPasswordDisplay">
                {{ session('generated_trading_password') }}
            </div>
        </div>
        <button type="button" class="btn btn-outline-warning btn-sm" onclick="navigator.clipboard.writeText('{{ session('generated_trading_password') }}'); this.innerHTML='<i class=\'bi bi-check-lg\'></i> Copied';">
            <i class="bi bi-clipboard me-1"></i> Copy Password
        </button>
    </div>
@endif

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Registered Trading Accounts</h4>
        <p class="text-muted small mb-0">Manage CRM trading account bindings across external broker platforms, password credentials, and account statuses.</p>
    </div>
    <div>
        <a href="{{ route('admin.trading-accounts.requests.index') }}" class="btn btn-outline-light d-flex align-items-center gap-2">
            <i class="bi bi-clock-history"></i>
            <span>View Pending Account Requests</span>
        </a>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.trading-accounts.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <input type="text" name="search" class="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Search login ID, server, or client email..." value="{{ request('search') }}">
        </div>

        <div class="col-6 col-md-3">
            <select name="platform" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Platforms</option>
                @foreach($platforms as $pKey => $pCfg)
                    <option value="{{ $pKey }}" {{ request('platform') === $pKey ? 'selected' : '' }}>{{ is_array($pCfg) ? ($pCfg['name'] ?? $pKey) : $pCfg }}</option>
                @endforeach
            </select>
        </div>

        <div class="col-6 col-md-3">
            <select name="status" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="active" {{ request('status') === 'active' ? 'selected' : '' }}>Active</option>
                <option value="suspended" {{ request('status') === 'suspended' ? 'selected' : '' }}>Suspended</option>
                <option value="disabled" {{ request('status') === 'disabled' ? 'selected' : '' }}>Disabled</option>
            </select>
        </div>

        <div class="col-12 col-md-2">
            <button type="submit" class="btn btn-sm btn-primary w-100">Filter</button>
        </div>
    </form>
</div>

<!-- Trading Accounts Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Trading Accounts ({{ $tradingAccounts->total() }})</h6>
    </div>

    @if($tradingAccounts->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No registered trading accounts match the search criteria.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>Platform</th>
                        <th>Login ID</th>
                        <th>Server</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>Currency</th>
                        <th>Leverage</th>
                        <th>Password</th>
                        <th>Status</th>
                        <th>Registered</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($tradingAccounts as $acc)
                        <tr>
                            <td class="fw-bold text-white">{{ $acc->platform_name }}</td>
                            <td class="font-monospace text-info fw-bold fs-6">#{{ $acc->login_id }}</td>
                            <td class="text-muted">{{ $acc->server_name }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $acc->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $acc->user->email }}
                                </a>
                            </td>
                            <td><span class="badge bg-secondary text-capitalize">{{ $acc->account_type }}</span></td>
                            <td class="text-muted">{{ $acc->currency }}</td>
                            <td class="text-muted">{{ $acc->leverage }}</td>
                            <td>
                                <div class="d-flex align-items-center gap-1">
                                    <button type="button" class="btn btn-sm btn-outline-info p-1 px-2 text-nowrap admin-reveal-pw-btn" data-account-id="{{ $acc->id }}" data-login-id="{{ $acc->login_id }}" title="Reveal Password">
                                        <i class="bi bi-eye"></i> Show
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-secondary p-1 px-2 text-nowrap" data-bs-toggle="modal" data-bs-target="#setPasswordModal{{ $acc->id }}" title="Set / Reset Password">
                                        <i class="bi bi-key"></i> Set
                                    </button>
                                </div>
                            </td>
                            <td>
                                @if($acc->status === 'active')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Active</span>
                                @elseif($acc->status === 'suspended')
                                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Suspended</span>
                                @elseif($acc->status === 'disabled')
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Disabled</span>
                                @else
                                    <span class="badge bg-secondary">{{ ucfirst($acc->status) }}</span>
                                @endif
                            </td>
                            <td class="text-muted small">{{ $acc->created_at->format('M d, Y') }}</td>
                            <td class="text-end">
                                <form method="POST" action="{{ route('admin.trading-accounts.status', $acc->id) }}" class="d-inline">
                                    @csrf
                                    <select name="status" class="form-select form-select-sm bg-black border-secondary text-white d-inline-block w-auto" onchange="this.form.submit()">
                                        <option value="active" {{ $acc->status === 'active' ? 'selected' : '' }}>Active</option>
                                        <option value="suspended" {{ $acc->status === 'suspended' ? 'selected' : '' }}>Suspended</option>
                                        <option value="disabled" {{ $acc->status === 'disabled' ? 'selected' : '' }}>Disabled</option>
                                    </select>
                                </form>
                            </td>
                        </tr>

                        <!-- Set Password Modal -->
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
                                                    <input class="form-check-input" type="radio" name="mode" id="modeGen{{ $acc->id }}" value="generate" checked onchange="document.getElementById('customPwField{{ $acc->id }}').classList.add('d-none'); document.getElementById('customPwInput{{ $acc->id }}').removeAttribute('required');">
                                                    <label class="form-check-label small" for="modeGen{{ $acc->id }}">Auto-generate Secure Password</label>
                                                </div>
                                                <div class="form-check form-check-inline">
                                                    <input class="form-check-input" type="radio" name="mode" id="modeCustom{{ $acc->id }}" value="custom" onchange="document.getElementById('customPwField{{ $acc->id }}').classList.remove('d-none'); document.getElementById('customPwInput{{ $acc->id }}').setAttribute('required', 'required');">
                                                    <label class="form-check-label small" for="modeCustom{{ $acc->id }}">Set Custom Password</label>
                                                </div>
                                            </div>

                                            <div class="mb-3 d-none" id="customPwField{{ $acc->id }}">
                                                <label class="form-label small text-muted">Custom Trading Password</label>
                                                <input type="text" name="password" id="customPwInput{{ $acc->id }}" class="form-control bg-black border-secondary text-white font-monospace" placeholder="Enter new trading password..." minlength="4" maxlength="128">
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
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $tradingAccounts->links() }}
        </div>
    @endif
</div>

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
                    <button type="button" class="btn btn-sm btn-outline-light" id="adminCopyPasswordBtn" onclick="copyAdminPassword()">
                        <i class="bi bi-clipboard"></i> Copy
                    </button>
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const modalEl = document.getElementById('adminPasswordModal');
    const modal = new bootstrap.Modal(modalEl);
    const titleEl = document.getElementById('adminPasswordModalTitle');
    const passEl = document.getElementById('adminRevealedPassword');
    const copyBtn = document.getElementById('adminCopyPasswordBtn');

    document.querySelectorAll('.admin-reveal-pw-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const accId = this.getAttribute('data-account-id');
            const loginId = this.getAttribute('data-login-id');

            titleEl.textContent = 'Trading Password #' + loginId;
            passEl.textContent = 'Decrypting...';
            passEl.className = 'font-monospace fs-5 fw-bold text-muted';
            modal.show();

            fetch('/admin/trading-accounts/' + accId + '/reveal-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.password) {
                    passEl.textContent = data.password;
                    passEl.className = 'font-monospace fs-5 fw-bold text-warning';
                } else {
                    passEl.textContent = '(No password set)';
                    passEl.className = 'font-monospace fs-6 text-muted';
                }
            })
            .catch(err => {
                passEl.textContent = 'Error retrieving password';
                passEl.className = 'font-monospace fs-6 text-danger';
            });
        });
    });

    window.copyAdminPassword = function() {
        const text = passEl.textContent;
        if (text && !text.startsWith('(') && !text.startsWith('Error')) {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
                }, 2000);
            });
        }
    };
});
</script>
@endsection
