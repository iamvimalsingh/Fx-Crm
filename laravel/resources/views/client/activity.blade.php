@extends('layouts.client')

@section('title', 'Activity & Logs')
@section('header_title', 'CRM Ledger, Deposit & Withdrawal History')

@section('content')
<div class="fx-card mb-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
            <h5 class="fw-bold text-white mb-1">CRM Activity History</h5>
            <p class="text-muted small mb-0">View deposit requests, withdrawal requests, and immutable ledger activity.</p>
        </div>

        <!-- Filter Tabs -->
        <div class="btn-group btn-group-sm" role="group">
            <a href="{{ route('client.activity') }}" class="btn {{ empty($type) || $type === 'all' ? 'btn-primary' : 'btn-outline-secondary' }}">
                All Records
            </a>
            <a href="{{ route('client.activity', ['type' => 'deposit']) }}" class="btn {{ $type === 'deposit' ? 'btn-primary' : 'btn-outline-secondary' }}">
                Deposit Requests
            </a>
            <a href="{{ route('client.activity', ['type' => 'withdrawal']) }}" class="btn {{ $type === 'withdrawal' ? 'btn-primary' : 'btn-outline-secondary' }}">
                Withdrawals
            </a>
        </div>
    </div>

    <!-- Deposit Requests Table -->
    @if(isset($deposits) && $deposits->count() > 0 && ($type === 'deposit' || $type === 'all'))
        <div class="mb-4">
            <h6 class="fw-bold text-muted mb-3 text-uppercase style-xs" style="letter-spacing: 0.05em;">CRM Deposit / Credit Requests</h6>
            
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                    <thead class="text-muted">
                        <tr>
                            <th>Date & Time</th>
                            <th>Amount</th>
                            <th>Channel</th>
                            <th>Credit Reason</th>
                            <th>Reference</th>
                            <th>Client Notes</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($deposits as $dep)
                            <tr>
                                <td class="text-muted">{{ $dep->created_at->format('M d, Y H:i:s') }}</td>
                                <td class="fw-bold text-success">+${{ $dep->formatted_amount }}</td>
                                <td>
                                    <span class="badge bg-dark border border-secondary border-opacity-25 text-light">
                                        @switch($dep->request_channel)
                                            @case('client_panel') Client Panel @break
                                            @case('phone') Phone @break
                                            @case('whatsapp') WhatsApp @break
                                            @case('admin') Admin @break
                                            @default {{ ucfirst($dep->request_channel) }}
                                        @endswitch
                                    </span>
                                </td>
                                <td>
                                    <span class="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-25">
                                        @switch($dep->credit_reason)
                                            @case('deposit') Deposit @break
                                            @case('bonus') Bonus @break
                                            @case('manual_credit') Manual Credit @break
                                            @default {{ ucfirst(str_replace('_', ' ', $dep->credit_reason)) }}
                                        @endswitch
                                    </span>
                                </td>
                                <td class="font-monospace text-light">{{ $dep->source_reference ?? '—' }}</td>
                                <td class="text-muted small text-truncate" style="max-width: 200px;">{{ $dep->client_notes ?? '—' }}</td>
                                <td>
                                    @if($dep->status === 'completed')
                                        <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Completed</span>
                                    @elseif($dep->status === 'pending')
                                        <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Pending</span>
                                    @elseif($dep->status === 'rejected')
                                        <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Rejected</span>
                                    @else
                                        <span class="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-25">{{ ucfirst($dep->status) }}</span>
                                    @endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            @if(method_exists($deposits, 'links') && $type === 'deposit')
                <div class="mt-3 d-flex justify-content-center">
                    {{ $deposits->links() }}
                </div>
            @endif
        </div>
    @endif

    <!-- Withdrawal Requests Table -->
    @if(isset($withdrawals) && $withdrawals->count() > 0 && ($type === 'withdrawal' || $type === 'all'))
        <div class="mb-4">
            <h6 class="fw-bold text-muted mb-3 text-uppercase style-xs" style="letter-spacing: 0.05em;">CRM Withdrawal Requests</h6>
            
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                    <thead class="text-muted">
                        <tr>
                            <th>Date & Time</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Destination</th>
                            <th>Client Notes</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($withdrawals as $wd)
                            <tr>
                                <td class="text-muted">{{ $wd->created_at->format('M d, Y H:i:s') }}</td>
                                <td class="fw-bold text-danger">-${{ $wd->formatted_amount }}</td>
                                <td>
                                    <span class="badge bg-dark border border-secondary border-opacity-25 text-light">
                                        {{ config('broker.withdrawal_methods')[$wd->withdrawal_method] ?? ucfirst(str_replace('_', ' ', $wd->withdrawal_method)) }}
                                    </span>
                                </td>
                                <td class="text-muted small text-truncate" style="max-width: 220px;">
                                    {{ $wd->destination_details }}
                                </td>
                                <td class="text-muted small text-truncate" style="max-width: 180px;">
                                    {{ $wd->client_notes ?? '—' }}
                                </td>
                                <td>
                                    @if($wd->status === 'completed')
                                        <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Completed</span>
                                    @elseif($wd->status === 'pending')
                                        <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Pending Payout</span>
                                    @elseif($wd->status === 'rejected')
                                        <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Rejected (Refunded)</span>
                                    @elseif($wd->status === 'cancelled')
                                        <span class="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-25">Cancelled (Refunded)</span>
                                    @else
                                        <span class="badge bg-secondary border border-secondary border-opacity-25">{{ ucfirst($wd->status) }}</span>
                                    @endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            @if(method_exists($withdrawals, 'links') && $type === 'withdrawal')
                <div class="mt-3 d-flex justify-content-center">
                    {{ $withdrawals->links() }}
                </div>
            @endif
        </div>
    @endif

    <!-- Ledger Transactions Table -->
    @if(isset($transactions) && $transactions->count() > 0 && ($type === 'all'))
        <div>
            <h6 class="fw-bold text-muted mb-3 text-uppercase style-xs" style="letter-spacing: 0.05em;">Completed Ledger Transactions</h6>
            
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.875rem;">
                    <thead class="text-muted">
                        <tr>
                            <th>Date & Time</th>
                            <th>Reference ID</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Description</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($transactions as $tx)
                            <tr>
                                <td class="text-muted">{{ $tx->created_at->format('M d, Y H:i:s') }}</td>
                                <td class="font-monospace text-light">{{ $tx->reference_id }}</td>
                                <td>
                                    <span class="badge bg-dark border border-secondary border-opacity-25 text-capitalize text-light">
                                        {{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}
                                    </span>
                                </td>
                                <td class="fw-bold {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                    {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}
                                    ${{ $tx->formatted_amount }} {{ $tx->currency }}
                                </td>
                                <td class="text-muted small">{{ $tx->description ?? '—' }}</td>
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

            @if(method_exists($transactions, 'links'))
                <div class="mt-3 d-flex justify-content-center">
                    {{ $transactions->links() }}
                </div>
            @endif
        </div>
    @elseif((!isset($deposits) || $deposits->count() === 0) && (!isset($withdrawals) || $withdrawals->count() === 0) && (!isset($transactions) || $transactions->count() === 0))
        <div class="text-center py-5 text-muted">
            <i class="bi bi-clock-history fs-1 d-block mb-2"></i>
            <p class="mb-0">No CRM records match your filter parameters.</p>
        </div>
    @endif
</div>
@endsection
