@extends('layouts.client')

@section('title', 'Client Dashboard')
@section('header_title', 'Account Overview')

@section('content')
<!-- Architectural Notice Banner -->
<div class="alert alert-dark bg-dark bg-opacity-75 border-secondary border-opacity-25 text-light d-flex align-items-center gap-3 p-3 rounded-3 mb-4">
    <i class="bi bi-info-circle-fill text-primary fs-4"></i>
    <div class="small">
        <strong>Architecture Notice:</strong> Your <strong>CRM Wallet</strong> tracks client accounting inside this portal. External trading accounts (Web Trader, Desktop Terminal, Mobile App) are hosted on separate trading platforms and managed manually by broker administration.
    </div>
</div>

<!-- Welcome & Quick Stats Banner -->
<div class="row g-3 mb-4">
    <div class="col-12 col-md-6 col-xl-4">
        <div class="fx-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="text-muted fw-semibold style-sm" style="font-size: 0.75rem; letter-spacing: 0.05em;">CRM WALLET BALANCE</span>
                <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25 px-2 py-1">
                    {{ $user->wallet->currency ?? config('broker.base_currency', 'USD') }}
                </span>
            </div>
            <h2 class="fw-bold mb-3 text-white">
                ${{ $user->wallet?->formatted_balance ?? '0.00' }}
            </h2>
            <div class="d-flex align-items-center gap-2 text-muted small">
                <i class="bi bi-person-badge"></i>
                <span>User ID: <strong>#ACC-{{ sprintf('%06d', $user->id) }}</strong></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-md-6 col-xl-4">
        <div class="fx-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="text-muted fw-semibold style-sm" style="font-size: 0.75rem; letter-spacing: 0.05em;">KYC VERIFICATION STATUS</span>
                @php
                    $kycStatus = $user->kycProfile->status->value ?? 'not_submitted';
                @endphp
                @if($kycStatus === 'approved')
                    <span class="badge bg-success text-white">Approved</span>
                @elseif($kycStatus === 'pending')
                    <span class="badge bg-warning text-dark">Under Review</span>
                @elseif($kycStatus === 'rejected')
                    <span class="badge bg-danger text-white">Rejected</span>
                @else
                    <span class="badge bg-secondary text-white">Not Submitted</span>
                @endif
            </div>
            <h5 class="fw-bold text-white mb-1">
                {{ $user->profile->first_name ?? 'Client' }} {{ $user->profile->last_name ?? '' }}
            </h5>
            <p class="text-muted mb-3" style="font-size: 0.85rem;">
                {{ $user->email }}
            </p>
            <a href="{{ route('client.profile') }}" class="btn btn-outline-light btn-sm w-100 rounded-3">
                <i class="bi bi-shield-check me-1"></i> Manage Profile & KYC
            </a>
        </div>
    </div>

    <div class="col-12 col-md-12 col-xl-4">
        <div class="fx-card">
            <span class="text-muted fw-semibold style-sm d-block mb-3" style="font-size: 0.75rem; letter-spacing: 0.05em;">PENDING CRM REQUESTS</span>
            <div class="row g-2">
                <div class="col-6">
                    <div class="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25 text-center">
                        <div class="text-muted small">Pending Deposits</div>
                        <div class="text-warning fw-bold fs-5 mt-1">{{ $pendingDepositsCount }}</div>
                        <div class="text-muted style-xs" style="font-size: 0.75rem;">
                            ${{ \App\Services\Financial\MoneyFormatter::format($pendingDepositsSum) }}
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25 text-center">
                        <div class="text-muted small">Pending Withdrawals</div>
                        <div class="text-info fw-bold fs-5 mt-1">{{ $pendingWithdrawalsCount }}</div>
                        <div class="text-muted style-xs" style="font-size: 0.75rem;">
                            ${{ \App\Services\Financial\MoneyFormatter::format($pendingWithdrawalsSum) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Recent Activity Summary Table -->
<div class="fx-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="fw-bold text-white mb-0">Recent CRM Ledger Activity</h5>
        <a href="{{ route('client.activity') }}" class="btn btn-link text-primary p-0 text-decoration-none small">
            View All Activity <i class="bi bi-arrow-right"></i>
        </a>
    </div>

    @if($recentTransactions->count() > 0)
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead class="text-muted">
                    <tr>
                        <th>Date & Time</th>
                        <th>Reference ID</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($recentTransactions as $tx)
                        <tr>
                            <td class="text-muted">{{ $tx->created_at->format('M d, Y H:i') }}</td>
                            <td class="font-monospace text-light">{{ $tx->reference_id }}</td>
                            <td>
                                <span class="text-capitalize">{{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}</span>
                            </td>
                            <td class="fw-bold {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}
                                ${{ $tx->formatted_amount }}
                            </td>
                            <td>
                                @php $statusVal = $tx->status->value ?? $tx->status; @endphp
                                @if($statusVal === 'completed')
                                    <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Completed</span>
                                @elseif($statusVal === 'pending')
                                    <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Pending</span>
                                @elseif($statusVal === 'rejected')
                                    <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Rejected</span>
                                @else
                                    <span class="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-25">{{ ucfirst($statusVal) }}</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @else
        <div class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-2 d-block mb-2"></i>
            <span>No transaction history found on record.</span>
        </div>
    @endif
</div>
@endsection
