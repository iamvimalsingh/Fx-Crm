@extends('layouts.client')

@section('title', 'My CRM Wallet')
@section('header_title', 'CRM Internal Wallet')

@section('content')
<!-- Success Alert -->
@if (session('success'))
    <div class="alert alert-success alert-dismissible fade show border-0 bg-success bg-opacity-20 text-success p-3 rounded-3 mb-4" role="alert">
        <i class="bi bi-check-circle-fill me-2"></i> {{ session('success') }}
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
@endif

<!-- Error Alert -->
@if ($errors->any())
    <div class="alert alert-danger alert-dismissible fade show border-0 bg-danger bg-opacity-20 text-danger p-3 rounded-3 mb-4" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <ul class="mb-0 ps-3">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
@endif

<!-- Architecture Notice Banner -->
<div class="alert alert-dark bg-dark bg-opacity-75 border-secondary border-opacity-25 text-light d-flex align-items-start gap-3 p-3 rounded-3 mb-4">
    <i class="bi bi-info-circle-fill text-primary fs-4 mt-1"></i>
    <div class="small">
        <strong>CRM Wallet vs Trading Account Notice:</strong>
        This page manages your <strong>CRM Internal Wallet</strong>.
        The CRM Wallet is used for accounting within the client portal. It is completely separate from external trading account balances hosted on trading platforms (Web Trader, Desktop Terminal, Mobile App). In V1, no automatic funding transfers occur between the CRM Wallet and external trading accounts.
    </div>
</div>

<div class="row g-3 mb-4">
    <!-- Wallet Balance Card -->
    <div class="col-12 col-lg-6">
        <div class="fx-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="text-muted fw-semibold style-sm" style="font-size: 0.75rem; letter-spacing: 0.05em;">CRM INTERNAL WALLET</span>
                <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25 px-2.5 py-1">
                    {{ $user->wallet->currency ?? config('broker.base_currency', 'USD') }}
                </span>
            </div>
            <h1 class="fw-bold text-white mb-2">
                ${{ $user->wallet?->formatted_balance ?? '0.00' }}
            </h1>
            <p class="text-muted small mb-4">
                Base Currency: {{ config('broker.base_currency', 'USD') }} • Account ID: #ACC-{{ sprintf('%06d', $user->id) }}
            </p>

            <div class="d-flex gap-2">
                <button type="button" class="btn btn-primary flex-fill rounded-3 py-2 fw-semibold" data-bs-toggle="modal" data-bs-target="#depositModal">
                    <i class="bi bi-plus-circle me-1"></i> Deposit Request
                </button>
                <button type="button" class="btn btn-outline-light flex-fill rounded-3 py-2 fw-semibold" data-bs-toggle="modal" data-bs-target="#withdrawalModal">
                    <i class="bi bi-dash-circle me-1"></i> Withdraw Request
                </button>
            </div>
        </div>
    </div>

    <!-- Wallet Rules & Info Card -->
    <div class="col-12 col-lg-6">
        <div class="fx-card">
            <h5 class="fw-bold text-white mb-3">
                <i class="bi bi-info-circle text-primary me-2"></i>CRM Wallet Rules & Limits
            </h5>
            <ul class="list-unstyled text-muted style-sm space-y-2 mb-0" style="font-size: 0.875rem;">
                <li class="mb-2">
                    <i class="bi bi-check2 text-success me-2"></i>Minimum Deposit: <strong>${{ \App\Services\Financial\MoneyFormatter::format(config('broker.wallet.min_deposit', '10.00')) }}</strong>
                </li>
                <li class="mb-2">
                    <i class="bi bi-check2 text-success me-2"></i>Minimum Withdrawal: <strong>${{ \App\Services\Financial\MoneyFormatter::format(config('broker.wallet.min_withdrawal', '20.00')) }}</strong>
                </li>
                <li class="mb-2">
                    <i class="bi bi-shield-check text-info me-2"></i>Ledger Status: <span class="badge bg-success bg-opacity-20 text-success">Active Immutable Ledger</span>
                </li>
                <li>
                    <i class="bi bi-lock text-warning me-2"></i>Withdrawals reserve funds immediately from available wallet balance while under administrative review.
                </li>
            </ul>
        </div>
    </div>
</div>

<!-- Pending Withdrawal Requests (If any exist) -->
@if(isset($pendingWithdrawals) && $pendingWithdrawals->count() > 0)
    <div class="fx-card mb-4 border border-warning border-opacity-25">
        <div class="d-flex align-items-center justify-content-between mb-3">
            <h5 class="fw-bold text-warning mb-0">
                <i class="bi bi-hourglass-split me-2"></i>Pending Withdrawal Requests ({{ $pendingWithdrawals->count() }})
            </h5>
            <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Funds Reserved</span>
        </div>
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead class="text-muted">
                    <tr>
                        <th>Date & Time</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Destination</th>
                        <th>Status</th>
                        <th class="text-end">Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($pendingWithdrawals as $wd)
                        <tr>
                            <td class="text-muted">{{ $wd->created_at->format('Y-m-d H:i') }}</td>
                            <td class="fw-bold text-danger">-${{ $wd->formatted_amount }}</td>
                            <td>
                                <span class="badge bg-dark border border-secondary border-opacity-25 text-light">
                                    {{ config('broker.withdrawal_methods')[$wd->withdrawal_method] ?? ucfirst(str_replace('_', ' ', $wd->withdrawal_method)) }}
                                </span>
                            </td>
                            <td class="text-muted small text-truncate" style="max-width: 200px;">
                                {{ $wd->destination_details }}
                            </td>
                            <td>
                                <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25 px-2.5 py-1">
                                    Pending Payout
                                </span>
                            </td>
                            <td class="text-end">
                                <form action="{{ route('client.wallet.withdraw.cancel', $wd) }}" method="POST" onsubmit="return confirm('Are you sure you want to cancel this withdrawal request? The reserved amount will be refunded immediately to your available wallet balance.');" class="d-inline">
                                    @csrf
                                    <button type="submit" class="btn btn-outline-danger btn-sm py-1 px-2.5 rounded-2">
                                        <i class="bi bi-x-circle me-1"></i> Cancel Request
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
@endif

<!-- Pending Deposit Requests (If any exist) -->
@if(isset($pendingDeposits) && $pendingDeposits->count() > 0)
    <div class="fx-card mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
            <h5 class="fw-bold text-warning mb-0">
                <i class="bi bi-clock-history me-2"></i>Pending Deposit Requests ({{ $pendingDeposits->count() }})
            </h5>
            <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Awaiting Admin Approval</span>
        </div>
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead class="text-muted">
                    <tr>
                        <th>Date & Time</th>
                        <th>Amount</th>
                        <th>Payment Method</th>
                        <th>Reference</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($pendingDeposits as $req)
                        <tr>
                            <td class="text-muted">{{ $req->created_at->format('Y-m-d H:i') }}</td>
                            <td class="fw-bold text-white">${{ $req->formatted_amount }}</td>
                            <td>{{ $req->paymentMethod->name ?? 'Standard Transfer' }}</td>
                            <td class="font-monospace text-muted">{{ $req->source_reference ?? '—' }}</td>
                            <td>
                                <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25 px-2.5 py-1">
                                    Pending Approval
                                </span>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
@endif

<!-- Recent Wallet Activity -->
<div class="fx-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="fw-bold text-white mb-0">Recent Completed Ledger Transactions</h5>
        <a href="{{ route('client.activity') }}" class="btn btn-link text-primary p-0 text-decoration-none small">
            Full Transaction History <i class="bi bi-arrow-right"></i>
        </a>
    </div>

    @if($recentTransactions->count() > 0)
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead class="text-muted">
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($recentTransactions as $tx)
                        <tr>
                            <td class="text-muted">{{ $tx->created_at->format('Y-m-d H:i') }}</td>
                            <td class="font-monospace text-light">{{ $tx->reference_id }}</td>
                            <td><span class="text-capitalize">{{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}</span></td>
                            <td class="fw-bold {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}${{ $tx->formatted_amount }}
                            </td>
                            <td><span class="badge bg-secondary">{{ ucfirst($tx->status->value ?? $tx->status) }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @else
        <div class="text-center py-4 text-muted">
            <i class="bi bi-wallet2 fs-2 d-block mb-2"></i>
            <span>No CRM wallet transactions recorded yet.</span>
        </div>
    @endif
</div>

<!-- Modal for Deposit Request -->
<div class="modal fade" id="depositModal" tabindex="-1" aria-labelledby="depositModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
            <div class="modal-header border-bottom border-secondary border-opacity-25">
                <h5 class="modal-title fw-bold" id="depositModalLabel">
                    <i class="bi bi-plus-circle me-2 text-primary"></i>Request CRM Wallet Deposit
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form action="{{ route('client.wallet.deposit') }}" method="POST">
                @csrf
                <div class="modal-body space-y-3">
                    <div class="alert alert-info bg-info bg-opacity-10 border border-info border-opacity-25 text-info small mb-3">
                        <i class="bi bi-info-circle me-1"></i> Submitting a deposit request initiates an administrative review. Your CRM wallet balance will be updated once approved.
                    </div>

                    <div class="mb-3">
                        <label for="deposit_amount" class="form-label text-muted small fw-semibold">Deposit Amount (USD) <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <span class="input-group-text bg-dark border-secondary text-muted">$</span>
                            <input type="number" step="0.01" min="0.01" class="form-control bg-dark border-secondary text-white" id="deposit_amount" name="amount" placeholder="0.00" required>
                        </div>
                    </div>

                    @if(isset($paymentMethods) && $paymentMethods->count() > 0)
                        <div class="mb-3">
                            <label for="payment_method_id" class="form-label text-muted small fw-semibold">Payment Method</label>
                            <select class="form-select bg-dark border-secondary text-white" id="payment_method_id" name="payment_method_id">
                                <option value="">-- Select Payment Method --</option>
                                @foreach($paymentMethods as $pm)
                                    <option value="{{ $pm->id }}">{{ $pm->name }}</option>
                                @endforeach
                            </select>
                        </div>
                    @endif

                    <div class="mb-3">
                        <label for="source_reference" class="form-label text-muted small fw-semibold">Reference / Transaction ID (Optional)</label>
                        <input type="text" class="form-control bg-dark border-secondary text-white" id="source_reference" name="source_reference" placeholder="e.g. TXN-123456 or Bank Transfer Ref">
                    </div>

                    <div class="mb-3">
                        <label for="client_notes" class="form-label text-muted small fw-semibold">Notes / Description (Optional)</label>
                        <textarea class="form-control bg-dark border-secondary text-white" id="client_notes" name="client_notes" rows="3" placeholder="Add any details regarding your payment..."></textarea>
                    </div>
                </div>
                <div class="modal-footer border-top border-secondary border-opacity-25">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-sm px-4 fw-semibold">Submit Request</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Modal for Withdrawal Request -->
<div class="modal fade" id="withdrawalModal" tabindex="-1" aria-labelledby="withdrawalModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border border-secondary border-opacity-25 text-white">
            <div class="modal-header border-bottom border-secondary border-opacity-25">
                <h5 class="modal-title fw-bold" id="withdrawalModalLabel">
                    <i class="bi bi-dash-circle me-2 text-primary"></i>Request CRM Wallet Withdrawal
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form action="{{ route('client.wallet.withdraw') }}" method="POST">
                @csrf
                <div class="modal-body space-y-3">
                    <div class="alert alert-warning bg-warning bg-opacity-10 border border-warning border-opacity-25 text-warning small mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>
                        <strong>Important:</strong> Requested amount is reserved from your CRM Wallet immediately and becomes unavailable while the withdrawal is pending.
                    </div>

                    <div class="mb-3">
                        <label for="withdrawal_amount" class="form-label text-muted small fw-semibold">Withdrawal Amount (USD) <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <span class="input-group-text bg-dark border-secondary text-muted">$</span>
                            <input type="number" step="0.01" min="0.01" class="form-control bg-dark border-secondary text-white" id="withdrawal_amount" name="amount" placeholder="0.00" required>
                        </div>
                        <span class="text-muted style-xs" style="font-size: 0.75rem;">
                            Min: ${{ \App\Services\Financial\MoneyFormatter::format(config('broker.wallet.min_withdrawal', '20.00')) }} • Max: ${{ \App\Services\Financial\MoneyFormatter::format(config('broker.wallet.max_withdrawal', '25000.00')) }}
                        </span>
                    </div>

                    <div class="mb-3">
                        <label for="withdrawal_method" class="form-label text-muted small fw-semibold">Withdrawal Method <span class="text-danger">*</span></label>
                        <select class="form-select bg-dark border-secondary text-white" id="withdrawal_method" name="withdrawal_method" required>
                            <option value="">-- Select Withdrawal Method --</option>
                            @foreach($withdrawalMethods ?? config('broker.withdrawal_methods', []) as $code => $label)
                                <option value="{{ $code }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="destination_details" class="form-label text-muted small fw-semibold">Destination Details (Bank Account / Wallet Address) <span class="text-danger">*</span></label>
                        <textarea class="form-control bg-dark border-secondary text-white" id="destination_details" name="destination_details" rows="2" placeholder="e.g. IBAN / Account Number / Crypto Address..." required></textarea>
                    </div>

                    <div class="mb-3">
                        <label for="withdrawal_client_notes" class="form-label text-muted small fw-semibold">Client Notes (Optional)</label>
                        <textarea class="form-control bg-dark border-secondary text-white" id="withdrawal_client_notes" name="client_notes" rows="2" placeholder="Optional notes for the admin..."></textarea>
                    </div>
                </div>
                <div class="modal-footer border-top border-secondary border-opacity-25">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary btn-sm px-4 fw-semibold">Submit Withdrawal</button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection
