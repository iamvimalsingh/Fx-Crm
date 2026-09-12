@extends('layouts.client')

@section('title', 'My Trading Accounts')
@section('header_title', 'Trading Account Registry')

@section('content')
<!-- Architectural Notice Banner -->
<div class="alert alert-dark bg-dark bg-opacity-75 border-secondary border-opacity-25 text-light d-flex align-items-center gap-3 p-3 rounded-3 mb-4">
    <i class="bi bi-info-circle-fill text-primary fs-4"></i>
    <div class="small">
        <strong>Trading Account Registry:</strong> Trading accounts listed here represent your registered accounts on external broker platforms. Account provisioning, wallet funding, returns, and password changes are securely verified and processed by back-office administration.
    </div>
</div>

<!-- Central Default Test / Demo Account (If Enabled by Admin) -->
@if(!empty($testAccountEnabled) && !empty($testAccount))
    <div class="card bg-dark border-warning border-opacity-50 text-white rounded-3 shadow-sm mb-4 overflow-hidden">
        <div class="card-header bg-warning bg-opacity-10 border-bottom border-warning border-opacity-25 d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-warning text-dark fw-bold px-2 py-1"><i class="bi bi-star-fill me-1"></i> TEST / DEMO ACCOUNT</span>
                <span class="fw-bold text-white fs-6">{{ $testAccount['name'] ?? 'Broker Demo Account' }}</span>
            </div>
            <span class="badge bg-dark text-warning border border-warning border-opacity-25 font-monospace">Ready for Testing</span>
        </div>
        <div class="card-body p-4">
            <div class="row g-4 align-items-center">
                <div class="col-12 col-lg-8">
                    <p class="text-muted small mb-3">
                        Use this default demo account to test trading strategies, explore platform charts, and execute risk-free paper trades on the live platform server.
                    </p>
                    <div class="row g-3">
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Platform</span>
                            <span class="text-light fw-bold">{{ $testAccount['platform_name'] ?? 'MT5' }}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Server</span>
                            <span class="text-light fw-bold font-monospace">{{ $testAccount['server_name'] ?? 'Demo-Server' }}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Login ID</span>
                            <div class="d-flex align-items-center gap-1">
                                <span class="text-warning fw-bold font-monospace fs-6">#{{ $testAccount['login_id'] ?? '100001' }}</span>
                                <button type="button" class="btn btn-link btn-sm text-muted p-0" onclick="copyToClipboard('{{ $testAccount['login_id'] ?? '' }}', this)" title="Copy Login ID">
                                    <i class="bi bi-clipboard"></i>
                                </button>
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Password</span>
                            <div class="d-flex align-items-center gap-1">
                                <span id="demoPasswordMask" class="text-light font-monospace">••••••••</span>
                                <span id="demoPasswordVal" class="text-warning fw-bold font-monospace d-none"></span>
                                <button type="button" class="btn btn-link btn-sm text-info p-0 ms-1" id="btnRevealDemo" onclick="toggleDemoPassword(this)" title="Show/Hide Password">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button type="button" class="btn btn-link btn-sm text-muted p-0 d-none" id="btnCopyDemo" onclick="copyDemoPassword(this)" title="Copy Password">
                                    <i class="bi bi-clipboard"></i>
                                </button>
                            </div>
                            <div id="demoPwTimer" class="text-muted mt-1 d-none" style="font-size: 0.7rem;">
                                Auto-hiding in <span id="demoTimerSec" class="text-warning">30</span>s
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Account Type</span>
                            <span class="text-light">{{ $testAccount['account_type'] ?? 'Demo Standard' }}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Currency</span>
                            <span class="text-light">{{ $testAccount['currency'] ?? 'USD' }}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <span class="text-muted d-block small">Leverage</span>
                            <span class="text-light font-monospace">{{ $testAccount['leverage'] ?? '1:100' }}</span>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-lg-4 text-lg-end">
                    @if(!empty($testAccount['web_url']))
                        <a href="{{ $testAccount['web_url'] }}" target="_blank" class="btn btn-warning text-dark fw-bold px-4 py-2 w-100 w-lg-auto mb-2">
                            <i class="bi bi-box-arrow-up-right me-1"></i> Launch WebTrader
                        </a>
                    @else
                        <a href="{{ config('broker.platforms.web_trader', '#') }}" target="_blank" class="btn btn-warning text-dark fw-bold px-4 py-2 w-100 w-lg-auto mb-2">
                            <i class="bi bi-box-arrow-up-right me-1"></i> Launch WebTrader
                        </a>
                    @endif
                    <div class="text-muted small">Instant browser trading terminal</div>
                </div>
            </div>
        </div>
    </div>
@endif

<!-- Page Action Header -->
<div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
    <div>
        <h4 class="fw-bold text-white mb-1">My Live Trading Accounts</h4>
        <p class="text-muted small mb-0">View registered accounts, securely reveal credentials, fund your account, or request balance returns to your CRM wallet.</p>
    </div>
    <button type="button" class="btn btn-primary rounded-3 fw-semibold px-3 py-2" data-bs-toggle="modal" data-bs-target="#requestAccountModal">
        <i class="bi bi-plus-lg me-1"></i> Request New Trading Account
    </button>
</div>

<!-- Active Trading Accounts Cards Section -->
<div class="row g-3 mb-4">
    @forelse($tradingAccounts as $account)
        <div class="col-12 col-md-6 col-xl-4">
            <div class="fx-card h-100 d-flex flex-column justify-content-between border border-secondary border-opacity-25 shadow-sm">
                <div>
                    <!-- Account Card Header -->
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-display text-primary fs-4"></i>
                            <div>
                                <span class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Login ID</span>
                                <span class="fw-bold text-white font-monospace fs-5">#{{ $account->login_id }}</span>
                            </div>
                        </div>

                        @if($account->status === 'active')
                            <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Active</span>
                        @elseif($account->status === 'suspended')
                            <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Suspended</span>
                        @else
                            <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Disabled</span>
                        @endif
                    </div>

                    <!-- Account Details Grid -->
                    <div class="row g-2 mb-3" style="font-size: 0.85rem;">
                        <div class="col-6">
                            <span class="text-muted d-block">Platform</span>
                            <span class="text-light fw-semibold">{{ $account->platform_name }}</span>
                        </div>
                        <div class="col-6">
                            <span class="text-muted d-block">Server</span>
                            <span class="text-light fw-semibold font-monospace">{{ $account->server_name }}</span>
                        </div>
                        <div class="col-6">
                            <span class="text-muted d-block">Account Type</span>
                            <span class="text-light fw-semibold text-capitalize">{{ str_replace('_', ' ', $account->account_type) }}</span>
                        </div>
                        <div class="col-6">
                            <span class="text-muted d-block">Leverage</span>
                            <span class="text-light fw-semibold font-monospace">{{ $account->leverage }}</span>
                        </div>
                        <div class="col-6">
                            <span class="text-muted d-block">Currency</span>
                            <span class="text-light fw-semibold">{{ $account->currency }}</span>
                        </div>
                    </div>

                    <!-- Trading Password Section -->
                    <div class="p-2 mb-3 bg-black rounded border border-secondary border-opacity-25">
                        <div class="d-flex align-items-center justify-content-between">
                            <div>
                                <span class="text-muted d-block" style="font-size: 0.72rem;">Trading Password</span>
                                <span id="pw-mask-{{ $account->id }}" class="font-monospace text-light fw-bold" style="font-size: 0.9rem;">••••••••</span>
                                <span id="pw-val-{{ $account->id }}" class="font-monospace text-warning fw-bold d-none" style="font-size: 0.9rem;"></span>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <button type="button" class="btn btn-sm btn-outline-info px-2 py-1 reveal-btn" id="btn-reveal-{{ $account->id }}" onclick="toggleAccountPassword('{{ $account->id }}')">
                                    <i class="bi bi-eye me-1"></i> Show
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-secondary px-2 py-1 copy-pw-btn d-none" id="btn-copy-{{ $account->id }}" onclick="copyRevealedPassword('{{ $account->id }}')">
                                    <i class="bi bi-clipboard"></i>
                                </button>
                            </div>
                        </div>
                        <div id="pw-timer-{{ $account->id }}" class="text-muted style-xs mt-1 d-none" style="font-size: 0.7rem;">
                            Auto-hiding in <span class="timer-sec text-warning">30</span>s
                        </div>
                    </div>
                </div>

                <!-- Account Actions -->
                <div class="pt-3 border-top border-secondary border-opacity-25 d-flex gap-2 flex-wrap">
                    @if($account->status === 'active')
                        <button type="button" class="btn btn-outline-success btn-sm flex-fill rounded-3" data-bs-toggle="modal" data-bs-target="#fundAccountModal{{ $account->id }}" title="Deposit from CRM Wallet into this Trading Account">
                            <i class="bi bi-cash-stack me-1"></i> Fund
                        </button>
                        <button type="button" class="btn btn-outline-info btn-sm flex-fill rounded-3" data-bs-toggle="modal" data-bs-target="#returnAccountModal{{ $account->id }}" title="Transfer funds from this Trading Account back to CRM Wallet">
                            <i class="bi bi-arrow-down-left-circle me-1"></i> To Wallet
                        </button>
                    @endif
                    <a href="{{ config('broker.platforms.web_trader', '#') }}" target="_blank" class="btn btn-outline-primary btn-sm flex-fill rounded-3">
                        <i class="bi bi-box-arrow-up-right me-1"></i> WebTrader
                    </a>
                    <button type="button" class="btn btn-outline-light btn-sm flex-fill rounded-3" data-bs-toggle="modal" data-bs-target="#resetPasswordModal{{ $account->id }}">
                        <i class="bi bi-key me-1"></i> Reset
                    </button>
                </div>
            </div>
        </div>

        <!-- Funding Modal for Account -->
        @if($account->status === 'active')
            <div class="modal fade" id="fundAccountModal{{ $account->id }}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
                        <form method="POST" action="{{ route('client.trading-accounts.fund', $account->id) }}">
                            @csrf
                            <div class="modal-header border-bottom border-secondary border-opacity-25">
                                <h5 class="modal-title fw-bold">
                                    <i class="bi bi-cash-stack text-success me-2"></i>Fund Trading Account (#{{ $account->login_id }})
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-info bg-info bg-opacity-10 text-info border-info border-opacity-25 small mb-3">
                                    <i class="bi bi-info-circle me-1"></i>
                                    Funds will be debited and reserved from your CRM Wallet immediately. An administrator will manually credit your external trading account.
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Amount to Transfer (USD) <span class="text-danger">*</span></label>
                                    <input type="text" name="amount" class="form-control bg-black text-white border-secondary font-monospace" placeholder="100.00" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Notes / Reference (Optional)</label>
                                    <textarea name="notes" class="form-control bg-black text-white border-secondary" rows="2" placeholder="Optional notes for administration..."></textarea>
                                </div>
                            </div>
                            <div class="modal-footer border-top border-secondary border-opacity-25">
                                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-success btn-sm fw-semibold">Submit Funding Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Return Transfer Modal (Trading -> Wallet) -->
            <div class="modal fade" id="returnAccountModal{{ $account->id }}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
                        <form method="POST" action="{{ route('client.trading-accounts.return', $account->id) }}">
                            @csrf
                            <div class="modal-header border-bottom border-secondary border-opacity-25">
                                <h5 class="modal-title fw-bold">
                                    <i class="bi bi-arrow-down-left-circle text-info me-2"></i>Transfer to CRM Wallet (#{{ $account->login_id }})
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-warning bg-warning bg-opacity-10 text-warning border-warning border-opacity-25 small mb-3">
                                    <i class="bi bi-exclamation-triangle me-1"></i>
                                    <strong>Important Broker Notice:</strong> Please ensure you have sufficient free margin in your trading terminal. An administrator will verify and manually deduct this balance on the trading platform server before crediting your CRM wallet.
                                </div>
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <label class="form-label text-muted small fw-semibold mb-0">Amount to Return (USD) <span class="text-danger">*</span></label>
                                        <span class="text-muted small">Min: ${{ $minReturnAmount }} | Max: ${{ $maxReturnAmount }}</span>
                                    </div>
                                    <input type="text" name="amount" class="form-control bg-black text-white border-secondary font-monospace" placeholder="100.00" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Notes / Terminal Ticket (Optional)</label>
                                    <textarea name="notes" class="form-control bg-black text-white border-secondary" rows="2" placeholder="e.g. Free equity withdrawal from closed EURUSD positions..."></textarea>
                                </div>
                            </div>
                            <div class="modal-footer border-top border-secondary border-opacity-25">
                                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-info btn-sm fw-semibold text-dark">Submit Return Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        @endif

        <!-- Password Reset Request Modal for Account -->
        <div class="modal fade" id="resetPasswordModal{{ $account->id }}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
                    <form method="POST" action="{{ route('client.trading-accounts.reset-password', $account->id) }}">
                        @csrf
                        <div class="modal-header border-bottom border-secondary border-opacity-25">
                            <h5 class="modal-title fw-bold">
                                <i class="bi bi-key text-warning me-2"></i>Request Password Reset (#{{ $account->login_id }})
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted small mb-3">
                                Password resets are processed manually by broker administrators. You will be notified once updated platform credentials are ready.
                            </p>
                            <div class="mb-3">
                                <label for="notes{{ $account->id }}" class="form-label text-muted small">Notes / Special Instructions (Optional)</label>
                                <textarea name="notes" id="notes{{ $account->id }}" class="form-control bg-black text-white border-secondary" rows="3" placeholder="e.g., Please reset investor/read-only password as well..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer border-top border-secondary border-opacity-25">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-warning btn-sm fw-semibold">Submit Reset Request</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    @empty
        <div class="col-12">
            <div class="fx-card text-center py-5 border border-secondary border-opacity-25">
                <i class="bi bi-display fs-1 text-muted d-block mb-2"></i>
                <h5 class="fw-bold text-white mb-1">No Registered Trading Accounts</h5>
                <p class="text-muted small mb-3">You do not have any active live trading accounts linked yet.</p>
                <button type="button" class="btn btn-primary btn-sm rounded-3 px-3" data-bs-toggle="modal" data-bs-target="#requestAccountModal">
                    Request Your First Account
                </button>
            </div>
        </div>
    @endforelse
</div>

<!-- Requests & Activity History Tabs Section -->
<div class="fx-card mb-4 border border-secondary border-opacity-25 shadow-sm">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="text-white fw-bold mb-0">Trading Requests & History</h5>
    </div>

    <ul class="nav nav-tabs nav-tabs-dark border-secondary mb-3" id="tradingTabs" role="tablist">
        <li class="nav-item">
            <button class="nav-link active" id="req-tab" data-bs-toggle="tab" data-bs-target="#req-pane" type="button">
                Account Requests ({{ $accountRequests->count() }})
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="fnd-tab" data-bs-toggle="tab" data-bs-target="#fnd-pane" type="button">
                Funding Requests ({{ $fundingRequests->count() }})
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="ret-tab" data-bs-toggle="tab" data-bs-target="#ret-pane" type="button">
                Wallet Returns ({{ $returnRequests->count() }})
            </button>
        </li>
        <li class="nav-item">
            <button class="nav-link" id="pw-tab" data-bs-toggle="tab" data-bs-target="#pw-pane" type="button">
                Password Resets ({{ $passwordResetRequests->count() }})
            </button>
        </li>
    </ul>

    <div class="tab-content" id="tradingTabsContent">
        <!-- Account Requests Pane -->
        <div class="tab-pane fade show active" id="req-pane">
            @if($accountRequests->count() > 0)
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                        <thead class="text-muted">
                            <tr>
                                <th>Date</th>
                                <th>Platform</th>
                                <th>Account Type</th>
                                <th>Leverage</th>
                                <th>Currency</th>
                                <th>Notes</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($accountRequests as $req)
                                <tr>
                                    <td class="text-muted">{{ $req->created_at->format('M d, Y H:i') }}</td>
                                    <td class="fw-semibold text-light">{{ $platforms[$req->platform]['name'] ?? $req->platform }}</td>
                                    <td>{{ $req->account_type }}</td>
                                    <td>{{ $req->leverage }}</td>
                                    <td>{{ $req->currency }}</td>
                                    <td class="text-muted small">{{ $req->notes ?? '—' }}</td>
                                    <td>
                                        @if($req->status === 'approved')
                                            <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Approved</span>
                                        @elseif($req->status === 'pending')
                                            <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Pending Review</span>
                                        @elseif($req->status === 'rejected')
                                            <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Rejected</span>
                                        @else
                                            <span class="badge bg-secondary">{{ ucfirst($req->status) }}</span>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <div class="text-center py-4 text-muted small">No account creation requests on record.</div>
            @endif
        </div>

        <!-- Funding Requests Pane -->
        <div class="tab-pane fade" id="fnd-pane">
            @if($fundingRequests->count() > 0)
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                        <thead class="text-muted">
                            <tr>
                                <th>Date</th>
                                <th>Account</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($fundingRequests as $fnd)
                                <tr>
                                    <td class="text-muted">{{ $fnd->created_at->format('M d, Y H:i') }}</td>
                                    <td class="font-monospace text-info">#{{ $fnd->tradingAccount?->login_id }} ({{ $fnd->tradingAccount?->platform_name }})</td>
                                    <td class="fw-bold text-success font-monospace">${{ \App\Services\Financial\MoneyFormatter::format($fnd->amount) }}</td>
                                    <td>
                                        @if($fnd->status === 'completed')
                                            <span class="badge bg-success bg-opacity-20 text-success">Completed</span>
                                        @elseif($fnd->status === 'pending')
                                            <span class="badge bg-warning bg-opacity-20 text-warning">Pending Credit</span>
                                        @elseif($fnd->status === 'rejected')
                                            <span class="badge bg-danger bg-opacity-20 text-danger">Rejected (Refunded)</span>
                                        @elseif($fnd->status === 'cancelled')
                                            <span class="badge bg-secondary">Cancelled</span>
                                        @endif
                                    </td>
                                    <td class="text-end">
                                        @if($fnd->status === 'pending')
                                            <form method="POST" action="{{ route('client.trading-accounts.fund.cancel', $fnd->id) }}" class="d-inline">
                                                @csrf
                                                <button type="submit" class="btn btn-sm btn-outline-danger" onclick="return confirm('Cancel this funding request and refund reserved balance to your wallet?')">
                                                    Cancel Request
                                                </button>
                                            </form>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <div class="text-center py-4 text-muted small">No funding requests on record.</div>
            @endif
        </div>

        <!-- Wallet Returns Pane (Trading -> Wallet) -->
        <div class="tab-pane fade" id="ret-pane">
            @if($returnRequests->count() > 0)
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                        <thead class="text-muted">
                            <tr>
                                <th>Date</th>
                                <th>Source Account</th>
                                <th>Amount</th>
                                <th>Client Notes</th>
                                <th>Status</th>
                                <th>Admin Notes</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($returnRequests as $ret)
                                <tr>
                                    <td class="text-muted">{{ $ret->created_at->format('M d, Y H:i') }}</td>
                                    <td class="font-monospace text-info">#{{ $ret->tradingAccount?->login_id }} ({{ $ret->tradingAccount?->platform_name }})</td>
                                    <td class="fw-bold text-success font-monospace">${{ \App\Services\Financial\MoneyFormatter::format($ret->amount) }}</td>
                                    <td class="text-muted small">{{ $ret->notes ?? '—' }}</td>
                                    <td>
                                        @if($ret->status === 'completed')
                                            <span class="badge bg-success bg-opacity-20 text-success">Completed (Credited)</span>
                                        @elseif($ret->status === 'pending')
                                            <span class="badge bg-warning bg-opacity-20 text-warning">Pending Review</span>
                                        @elseif($ret->status === 'rejected')
                                            <span class="badge bg-danger bg-opacity-20 text-danger">Rejected</span>
                                        @elseif($ret->status === 'cancelled')
                                            <span class="badge bg-secondary">Cancelled</span>
                                        @endif
                                    </td>
                                    <td class="text-muted small">{{ $ret->admin_notes ?? '—' }}</td>
                                    <td class="text-end">
                                        @if($ret->status === 'pending')
                                            <form method="POST" action="{{ route('client.trading-accounts.return.cancel', $ret->id) }}" class="d-inline">
                                                @csrf
                                                <button type="submit" class="btn btn-sm btn-outline-danger" onclick="return confirm('Cancel this return request?')">
                                                    Cancel
                                                </button>
                                            </form>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <div class="text-center py-4 text-muted small">No wallet return requests on record.</div>
            @endif
        </div>

        <!-- Password Resets Pane -->
        <div class="tab-pane fade" id="pw-pane">
            @if($passwordResetRequests->count() > 0)
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                        <thead class="text-muted">
                            <tr>
                                <th>Date</th>
                                <th>Account</th>
                                <th>Notes</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($passwordResetRequests as $pw)
                                <tr>
                                    <td class="text-muted">{{ $pw->created_at->format('M d, Y H:i') }}</td>
                                    <td class="font-monospace text-info">#{{ $pw->tradingAccount?->login_id }}</td>
                                    <td class="text-muted small">{{ $pw->notes ?? '—' }}</td>
                                    <td>
                                        @if($pw->status === 'completed')
                                            <span class="badge bg-success bg-opacity-20 text-success">Completed</span>
                                        @elseif($pw->status === 'pending')
                                            <span class="badge bg-warning bg-opacity-20 text-warning">Pending Review</span>
                                        @elseif($pw->status === 'rejected')
                                            <span class="badge bg-danger bg-opacity-20 text-danger">Rejected</span>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <div class="text-center py-4 text-muted small">No password reset requests on record.</div>
            @endif
        </div>
    </div>
</div>

<!-- Request New Trading Account Modal -->
<div class="modal fade" id="requestAccountModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
            <form method="POST" action="{{ route('client.trading-accounts.request') }}">
                @csrf
                <div class="modal-header border-bottom border-secondary border-opacity-25">
                    <h5 class="modal-title fw-bold">
                        <i class="bi bi-plus-circle text-primary me-2"></i>Request New Trading Account
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="text-muted small mb-3">
                        Submit your platform specifications. An administrator will provision your account on the external trading server and configure your initial credentials.
                    </p>

                    <div class="mb-3">
                        <label for="platform" class="form-label text-muted small fw-semibold">Trading Platform</label>
                        <select name="platform" id="platform" class="form-select bg-black text-white border-secondary" required>
                            @foreach($platforms as $key => $cfg)
                                <option value="{{ $key }}">{{ is_array($cfg) ? ($cfg['name'] ?? $key) : $cfg }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="account_type" class="form-label text-muted small fw-semibold">Account Type</label>
                        <select name="account_type" id="account_type" class="form-select bg-black text-white border-secondary" required>
                            @foreach($accountTypes as $type)
                                <option value="{{ $type }}">{{ ucfirst(str_replace('_', ' ', $type)) }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-6">
                            <label for="leverage" class="form-label text-muted small fw-semibold">Leverage</label>
                            <select name="leverage" id="leverage" class="form-select bg-black text-white border-secondary" required>
                                @foreach($leverages as $lev)
                                    <option value="{{ $lev }}" {{ $lev === '1:100' ? 'selected' : '' }}>{{ $lev }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-6">
                            <label for="currency" class="form-label text-muted small fw-semibold">Currency</label>
                            <input type="text" name="currency" id="currency" class="form-control bg-black text-white border-secondary" value="{{ config('broker.base_currency', 'USD') }}" readonly>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="notes" class="form-label text-muted small fw-semibold">Additional Notes (Optional)</label>
                        <textarea name="notes" id="notes" class="form-control bg-black text-white border-secondary" rows="2" placeholder="e.g. Preferred server location, specific comments..."></textarea>
                    </div>
                </div>
                <div class="modal-footer border-top border-secondary border-opacity-25">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-sm fw-semibold">Submit Account Request</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
const passwordTimers = {};

function toggleAccountPassword(accountId) {
    const maskEl = document.getElementById('pw-mask-' + accountId);
    const valEl = document.getElementById('pw-val-' + accountId);
    const btnEl = document.getElementById('btn-reveal-' + accountId);
    const copyBtn = document.getElementById('btn-copy-' + accountId);
    const timerEl = document.getElementById('pw-timer-' + accountId);

    // If currently visible, hide it
    if (!valEl.classList.contains('d-none')) {
        hidePassword(accountId);
        return;
    }

    btnEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btnEl.disabled = true;

    fetch('/client/trading-accounts/' + accountId + '/reveal-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
        }
    })
    .then(res => res.json())
    .then(data => {
        btnEl.disabled = false;
        if (data.success && data.password) {
            valEl.textContent = data.password;
            valEl.classList.remove('d-none');
            maskEl.classList.add('d-none');
            copyBtn.classList.remove('d-none');
            btnEl.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Hide';
            btnEl.className = 'btn btn-sm btn-outline-warning px-2 py-1 reveal-btn';

            // Start 30s auto-hide countdown
            startAutoHideTimer(accountId);
        } else {
            valEl.textContent = '(No password set)';
            valEl.classList.remove('d-none');
            maskEl.classList.add('d-none');
            btnEl.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Hide';
        }
    })
    .catch(err => {
        btnEl.disabled = false;
        btnEl.innerHTML = '<i class="bi bi-eye me-1"></i> Show';
        alert('Could not retrieve credentials. Please try again.');
    });
}

function hidePassword(accountId) {
    const maskEl = document.getElementById('pw-mask-' + accountId);
    const valEl = document.getElementById('pw-val-' + accountId);
    const btnEl = document.getElementById('btn-reveal-' + accountId);
    const copyBtn = document.getElementById('btn-copy-' + accountId);
    const timerEl = document.getElementById('pw-timer-' + accountId);

    valEl.classList.add('d-none');
    maskEl.classList.remove('d-none');
    copyBtn.classList.add('d-none');
    timerEl.classList.add('d-none');
    btnEl.innerHTML = '<i class="bi bi-eye me-1"></i> Show';
    btnEl.className = 'btn btn-sm btn-outline-info px-2 py-1 reveal-btn';

    if (passwordTimers[accountId]) {
        clearInterval(passwordTimers[accountId]);
        delete passwordTimers[accountId];
    }
}

function startAutoHideTimer(accountId) {
    if (passwordTimers[accountId]) {
        clearInterval(passwordTimers[accountId]);
    }
    const timerEl = document.getElementById('pw-timer-' + accountId);
    const secEl = timerEl.querySelector('.timer-sec');
    timerEl.classList.remove('d-none');
    let timeLeft = 30;
    secEl.textContent = timeLeft;

    passwordTimers[accountId] = setInterval(() => {
        timeLeft -= 1;
        secEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            hidePassword(accountId);
        }
    }, 1000);
}

function copyRevealedPassword(accountId) {
    const valEl = document.getElementById('pw-val-' + accountId);
    const btn = document.getElementById('btn-copy-' + accountId);
    if (valEl.textContent && !valEl.textContent.startsWith('(')) {
        navigator.clipboard.writeText(valEl.textContent).then(() => {
            btn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-clipboard"></i>';
            }, 2000);
        });
    }
}

let demoTimer = null;
let demoDecryptedPassword = null;

function toggleDemoPassword(btn) {
    const mask = document.getElementById('demoPasswordMask');
    const val = document.getElementById('demoPasswordVal');
    const copyBtn = document.getElementById('btnCopyDemo');
    const timerEl = document.getElementById('demoPwTimer');
    const secEl = document.getElementById('demoTimerSec');

    if (val.classList.contains('d-none')) {
        if (!demoDecryptedPassword) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm text-info" style="width: 0.8rem; height: 0.8rem;"></span>';
            btn.disabled = true;
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            fetch('{{ route("client.trading-accounts.reveal-demo-password") }}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json'
                }
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(data => { throw new Error(data.message || 'Server error ' + res.status); });
                }
                return res.json();
            })
            .then(data => {
                btn.disabled = false;
                if (data.success && data.password) {
                    demoDecryptedPassword = data.password;
                    showDemoPasswordUI(demoDecryptedPassword, btn, mask, val, copyBtn, timerEl, secEl);
                } else {
                    val.textContent = '(No password set)';
                    val.classList.remove('d-none');
                    mask.classList.add('d-none');
                    btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-eye"></i>';
                alert('Unable to retrieve demo credentials: ' + (err.message || 'Please try again.'));
            });
        } else {
            showDemoPasswordUI(demoDecryptedPassword, btn, mask, val, copyBtn, timerEl, secEl);
        }
    } else {
        hideDemoPasswordUI(btn, mask, val, copyBtn, timerEl);
    }
}

function showDemoPasswordUI(password, btn, mask, val, copyBtn, timerEl, secEl) {
    val.textContent = password;
    val.classList.remove('d-none');
    mask.classList.add('d-none');
    if (copyBtn) copyBtn.classList.remove('d-none');
    btn.innerHTML = '<i class="bi bi-eye-slash"></i>';

    if (timerEl && secEl) {
        if (demoTimer) clearInterval(demoTimer);
        timerEl.classList.remove('d-none');
        let timeLeft = 30;
        secEl.textContent = timeLeft;
        demoTimer = setInterval(() => {
            timeLeft -= 1;
            secEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                hideDemoPasswordUI(btn, mask, val, copyBtn, timerEl);
            }
        }, 1000);
    }
}

function hideDemoPasswordUI(btn, mask, val, copyBtn, timerEl) {
    val.classList.add('d-none');
    mask.classList.remove('d-none');
    if (copyBtn) copyBtn.classList.add('d-none');
    if (timerEl) timerEl.classList.add('d-none');
    btn.innerHTML = '<i class="bi bi-eye"></i>';
    if (demoTimer) {
        clearInterval(demoTimer);
        demoTimer = null;
    }
}

function copyDemoPassword(btn) {
    if (demoDecryptedPassword) {
        navigator.clipboard.writeText(demoDecryptedPassword).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
            setTimeout(() => {
                btn.innerHTML = orig;
            }, 2000);
        });
    }
}

function copyToClipboard(text, btn) {
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
            setTimeout(() => {
                btn.innerHTML = orig;
            }, 2000);
        });
    }
}
</script>
@endsection
