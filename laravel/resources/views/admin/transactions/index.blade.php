@extends('layouts.admin')

@section('title', 'Ledger Transactions')
@section('header_title', 'CRM Financial Ledger')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">CRM Ledger Transactions</h4>
        <p class="text-muted small mb-0">Immutable record of all financial ledger transactions across client wallets.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.transactions.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-4">
            <input type="text" name="search" class="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Search reference, client email, name..." value="{{ request('search') }}">
        </div>

        <div class="col-6 col-md-2">
            <select name="type" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Types</option>
                <option value="deposit" {{ request('type') === 'deposit' ? 'selected' : '' }}>Deposit</option>
                <option value="withdrawal" {{ request('type') === 'withdrawal' ? 'selected' : '' }}>Withdrawal</option>
                <option value="manual_credit" {{ request('type') === 'manual_credit' ? 'selected' : '' }}>Manual Credit / Bonus</option>
                <option value="manual_debit" {{ request('type') === 'manual_debit' ? 'selected' : '' }}>Manual Debit / Funding</option>
                <option value="adjustment" {{ request('type') === 'adjustment' ? 'selected' : '' }}>Adjustment</option>
            </select>
        </div>

        <div class="col-6 col-md-2">
            <select name="status" class="form-select form-select-sm bg-dark border-secondary text-white" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="completed" {{ request('status') === 'completed' ? 'selected' : '' }}>Completed</option>
                <option value="pending" {{ request('status') === 'pending' ? 'selected' : '' }}>Pending</option>
                <option value="rejected" {{ request('status') === 'rejected' ? 'selected' : '' }}>Rejected</option>
                <option value="cancelled" {{ request('status') === 'cancelled' ? 'selected' : '' }}>Cancelled</option>
            </select>
        </div>

        <div class="col-6 col-md-2">
            <input type="date" name="date_from" class="form-control form-control-sm bg-dark border-secondary text-white" value="{{ request('date_from') }}" placeholder="From date">
        </div>

        <div class="col-6 col-md-2">
            <button type="submit" class="btn btn-sm btn-primary w-100">Filter</button>
        </div>
    </form>
</div>

<!-- Transactions Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Transactions ({{ $transactions->total() }})</h6>
    </div>

    @if($transactions->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
            No transaction records found.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>Reference</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($transactions as $tx)
                        <tr>
                            <td class="font-monospace text-muted">#{{ $tx->reference_id }}</td>
                            <td>
                                <a href="{{ route('admin.clients.show', $tx->user_id) }}" class="text-white fw-semibold text-decoration-none">
                                    {{ $tx->user->email }}
                                </a>
                            </td>
                            <td>
                                <span class="badge bg-secondary text-capitalize">{{ str_replace('_', ' ', $tx->type->value ?? $tx->type) }}</span>
                            </td>
                            <td class="fw-bold font-monospace fs-6 {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? 'text-success' : 'text-danger' }}">
                                {{ in_array($tx->type->value ?? $tx->type, ['deposit', 'manual_credit']) ? '+' : '-' }}${{ \App\Services\Financial\MoneyFormatter::format($tx->amount) }} {{ $tx->currency }}
                            </td>
                            <td class="text-muted small">{{ $tx->description ?? '—' }}</td>
                            <td>
                                @php $st = $tx->status->value ?? $tx->status; @endphp
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
                            <td class="text-muted small">{{ $tx->created_at->format('Y-m-d H:i:s') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $transactions->links() }}
        </div>
    @endif
</div>
@endsection
