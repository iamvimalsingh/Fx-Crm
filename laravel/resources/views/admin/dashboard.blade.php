@extends('layouts.admin')

@section('title', 'Operations Dashboard')
@section('header_title', 'Admin Operations Terminal')

@section('content')
<div class="row g-3 mb-4">
    <!-- Active Clients -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div class="fx-admin-card h-100 p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Active Clients</span>
                <i class="bi bi-people-fill text-primary fs-5"></i>
            </div>
            <div class="fs-3 fw-bold text-white mb-1">{{ $activeClientsCount }}</div>
            <div class="small text-muted">Registered active CRM clients</div>
        </div>
    </div>

    <!-- Total CRM Wallet Funds -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div class="fx-admin-card h-100 p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Total CRM Wallet Funds</span>
                <i class="bi bi-wallet2 text-success fs-5"></i>
            </div>
            <div class="fs-3 fw-bold text-success mb-1">${{ \App\Services\Financial\MoneyFormatter::format($totalCrmWalletFunds) }}</div>
            <div class="small text-muted">Aggregated CRM client balances</div>
        </div>
    </div>

    <!-- Pending Deposits -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div class="fx-admin-card h-100 p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Pending Deposits</span>
                <i class="bi bi-arrow-down-left-square-fill text-info fs-5"></i>
            </div>
            <div class="d-flex align-items-baseline gap-2 mb-1">
                <div class="fs-3 fw-bold text-white">{{ $pendingDepositsCount }}</div>
                <div class="small text-info">(${{ \App\Services\Financial\MoneyFormatter::format($pendingDepositsAmount) }})</div>
            </div>
            <div class="small"><a href="{{ route('admin.deposits.index', ['status' => 'pending']) }}" class="text-decoration-none text-info">Review pending deposits &rarr;</a></div>
        </div>
    </div>

    <!-- Pending Withdrawals -->
    <div class="col-12 col-sm-6 col-xl-3">
        <div class="fx-admin-card h-100 p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Pending Withdrawals</span>
                <i class="bi bi-arrow-up-right-square-fill text-warning fs-5"></i>
            </div>
            <div class="d-flex align-items-baseline gap-2 mb-1">
                <div class="fs-3 fw-bold text-white">{{ $pendingWithdrawalsCount }}</div>
                <div class="small text-warning">(${{ \App\Services\Financial\MoneyFormatter::format($pendingWithdrawalsAmount) }})</div>
            </div>
            <div class="small"><a href="{{ route('admin.withdrawals.index', ['status' => 'pending']) }}" class="text-decoration-none text-warning">Review pending payouts &rarr;</a></div>
        </div>
    </div>
</div>

<div class="row g-3 mb-4">
    <!-- Pending Trading Requests Quick Cards -->
    <div class="col-12 col-md-4">
        <div class="fx-admin-card p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Account Requests</span>
                <span class="badge {{ $pendingTradingAccountRequestsCount > 0 ? 'bg-warning text-dark' : 'bg-secondary' }}">{{ $pendingTradingAccountRequestsCount }}</span>
            </div>
            <p class="small text-muted mb-2">Clients waiting for external account manual provisioning</p>
            <a href="{{ route('admin.trading-accounts.requests.index') }}" class="btn btn-sm btn-outline-light w-100">Process Account Requests</a>
        </div>
    </div>

    <div class="col-12 col-md-4">
        <div class="fx-admin-card p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Funding Requests</span>
                <span class="badge {{ $pendingFundingsCount > 0 ? 'bg-warning text-dark' : 'bg-secondary' }}">{{ $pendingFundingsCount }}</span>
            </div>
            <p class="small text-muted mb-2">Clients waiting for external trading account manual credit</p>
            <a href="{{ route('admin.fundings.index') }}" class="btn btn-sm btn-outline-light w-100">Process Funding Requests</a>
        </div>
    </div>

    <div class="col-12 col-md-4">
        <div class="fx-admin-card p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted fw-semibold small">Password Resets</span>
                <span class="badge {{ $pendingPasswordResetsCount > 0 ? 'bg-warning text-dark' : 'bg-secondary' }}">{{ $pendingPasswordResetsCount }}</span>
            </div>
            <p class="small text-muted mb-2">Clients requested manual external trading password reset</p>
            <a href="{{ route('admin.trading-accounts.password-resets.index') }}" class="btn btn-sm btn-outline-light w-100">Process Password Resets</a>
        </div>
    </div>
</div>

<div class="row g-3">
    <!-- Recent CRM Transactions -->
    <div class="col-12 col-lg-7">
        <div class="fx-admin-card h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="text-white fw-bold mb-0">Recent CRM Ledger Transactions</h6>
                <a href="{{ route('admin.transactions.index') }}" class="btn btn-sm btn-outline-secondary">View All</a>
            </div>

            @if($recentTransactions->isEmpty())
                <div class="text-muted text-center py-4 small">No recent transactions recorded.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                        <thead>
                            <tr class="text-muted border-secondary">
                                <th>Ref</th>
                                <th>Client</th>
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
                                    <td>
                                        <a href="{{ route('admin.clients.show', $tx->user_id) }}" class="text-decoration-none text-white fw-semibold">
                                            {{ $tx->user->email }}
                                        </a>
                                    </td>
                                    <td>
                                        <span class="badge bg-secondary text-capitalize">{{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}</span>
                                    </td>
                                    <td class="fw-bold {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                        {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}${{ \App\Services\Financial\MoneyFormatter::format($tx->amount) }}
                                    </td>
                                    <td>
                                        @php
                                            $st = $tx->status->value ?? $tx->status;
                                        @endphp
                                        @if($st === 'completed')
                                            <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Completed</span>
                                        @elseif($st === 'pending')
                                            <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending</span>
                                        @elseif($st === 'rejected')
                                            <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                                        @else
                                            <span class="badge bg-secondary">{{ ucfirst($st) }}</span>
                                        @endif
                                    </td>
                                    <td class="text-muted small">{{ $tx->created_at->format('M d, H:i') }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>

    <!-- Recent Admin & User Activity -->
    <div class="col-12 col-lg-5">
        <div class="fx-admin-card h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="text-white fw-bold mb-0">Recent Admin & System Activity</h6>
                <a href="{{ route('admin.audit-logs.index') }}" class="btn btn-sm btn-outline-secondary">Audit Trail</a>
            </div>

            @if($recentActivity->isEmpty())
                <div class="text-muted text-center py-4 small">No activity logged yet.</div>
            @else
                <div class="list-group list-group-flush bg-transparent">
                    @foreach($recentActivity as $log)
                        <div class="list-group-item bg-transparent text-white border-secondary border-opacity-25 px-0 py-2">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <span class="badge bg-info bg-opacity-20 text-info font-monospace small mb-1">{{ $log->action }}</span>
                                    <div class="small text-white-50">{{ $log->description ?? 'No details' }}</div>
                                    <div class="small text-muted" style="font-size: 0.75rem;">By: {{ $log->user?->email ?? 'System' }}</div>
                                </div>
                                <span class="text-muted small" style="font-size: 0.75rem;">{{ $log->created_at ? \Carbon\Carbon::parse($log->created_at)->diffForHumans() : 'Just now' }}</span>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </div>
</div>
@endsection
