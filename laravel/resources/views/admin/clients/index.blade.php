@extends('layouts.admin')

@section('title', 'Clients Management')
@section('header_title', 'Client Directory')

@section('content')
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.clients.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-6 col-lg-5">
            <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-muted"><i class="bi bi-search"></i></span>
                <input type="text" name="search" class="form-control bg-dark border-secondary text-white" placeholder="Search by name, email, or phone..." value="{{ request('search') }}">
            </div>
        </div>

        <div class="col-6 col-md-3 col-lg-3">
            <select name="status" class="form-select bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Account Statuses</option>
                <option value="active" {{ request('status') === 'active' ? 'selected' : '' }}>Active</option>
                <option value="disabled" {{ request('status') === 'disabled' ? 'selected' : '' }}>Disabled</option>
            </select>
        </div>

        <div class="col-6 col-md-3 col-lg-2">
            <button type="submit" class="btn btn-primary w-100"><i class="bi bi-filter me-1"></i> Filter</button>
        </div>

        @if(request('search') || request('status'))
            <div class="col-12 col-lg-2">
                <a href="{{ route('admin.clients.index') }}" class="btn btn-outline-secondary w-100"><i class="bi bi-x-circle me-1"></i> Reset</a>
            </div>
        @endif
    </form>
</div>

<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Registered Clients ({{ $clients->total() }})</h6>
    </div>

    @if($clients->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-person-x fs-1 d-block mb-2 text-secondary"></i>
            No clients match the specified search or filter criteria.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>Client</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Email Verified</th>
                        <th>KYC Status</th>
                        <th>CRM Wallet Balance</th>
                        <th>Trading Accounts</th>
                        <th>Registered</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($clients as $client)
                        <tr>
                            <td>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="rounded-circle bg-primary bg-opacity-20 text-primary d-flex align-items-center justify-content-center fw-bold" style="width: 34px; height: 34px; font-size: 0.8rem;">
                                        {{ strtoupper(substr($client->profile?->first_name ?? $client->email, 0, 2)) }}
                                    </div>
                                    <div>
                                        <a href="{{ route('admin.clients.show', $client->id) }}" class="text-white fw-semibold text-decoration-none">
                                            {{ $client->profile ? $client->profile->first_name . ' ' . $client->profile->last_name : 'No Name Set' }}
                                        </a>
                                        <div class="text-muted small">{{ $client->email }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="text-muted">{{ $client->profile?->phone ?? '—' }}</td>
                            <td>
                                @php
                                    $st = $client->status->value ?? $client->status;
                                @endphp
                                @if($st === 'active')
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Active</span>
                                @else
                                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Disabled</span>
                                @endif
                            </td>
                            <td>
                                @if($client->hasVerifiedEmail())
                                    <span class="badge bg-success bg-opacity-20 text-success"><i class="bi bi-check-circle me-1"></i> Verified</span>
                                @else
                                    <span class="badge bg-warning bg-opacity-20 text-warning"><i class="bi bi-hourglass-split me-1"></i> Unverified</span>
                                @endif
                            </td>
                            <td>
                                @php
                                    $kyc = $client->kycProfile?->status ?? 'none';
                                @endphp
                                @if($kyc === 'approved')
                                    <span class="badge bg-success bg-opacity-20 text-success">Approved</span>
                                @elseif($kyc === 'submitted' || $kyc === 'pending')
                                    <span class="badge bg-info bg-opacity-20 text-info">Submitted</span>
                                @elseif($kyc === 'rejected')
                                    <span class="badge bg-danger bg-opacity-20 text-danger">Rejected</span>
                                @else
                                    <span class="badge bg-secondary">None</span>
                                @endif
                            </td>
                            <td class="fw-bold text-success font-monospace">
                                ${{ \App\Services\Financial\MoneyFormatter::format($client->wallet?->balance ?? '0.00') }}
                            </td>
                            <td class="text-center">
                                <span class="badge bg-secondary">{{ $client->trading_accounts_count }}</span>
                            </td>
                            <td class="text-muted small">
                                {{ $client->created_at->format('M d, Y') }}
                            </td>
                            <td class="text-end">
                                <a href="{{ route('admin.clients.show', $client->id) }}" class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-eye me-1"></i> View 360
                                </a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $clients->links() }}
        </div>
    @endif
</div>
@endsection
