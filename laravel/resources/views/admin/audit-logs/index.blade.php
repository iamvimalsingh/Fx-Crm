@extends('layouts.admin')

@section('title', 'Audit Trail')
@section('header_title', 'System & Security Audit Log')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">Audit Logs</h4>
        <p class="text-muted small mb-0">Immutable compliance log capturing all administrative and sensitive operations.</p>
    </div>
</div>

<!-- Filters -->
<div class="fx-admin-card mb-4">
    <form method="GET" action="{{ route('admin.audit-logs.index') }}" class="row g-2 align-items-center">
        <div class="col-12 col-md-5">
            <input type="text" name="search" class="form-control form-control-sm bg-dark border-secondary text-white" placeholder="Search action, description, IP, or user email..." value="{{ request('search') }}">
        </div>

        <div class="col-6 col-md-3">
            <input type="date" name="date" class="form-control form-control-sm bg-dark border-secondary text-white" value="{{ request('date') }}">
        </div>

        <div class="col-6 col-md-2">
            <button type="submit" class="btn btn-sm btn-primary w-100">Filter</button>
        </div>

        <div class="col-12 col-md-2">
            <a href="{{ route('admin.audit-logs.index') }}" class="btn btn-sm btn-outline-secondary w-100">Reset</a>
        </div>
    </form>
</div>

<!-- Audit Logs Table -->
<div class="fx-admin-card">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white fw-bold mb-0">Audit Trail Entries ({{ $auditLogs->total() }})</h6>
    </div>

    @if($auditLogs->isEmpty())
        <div class="text-muted text-center py-5">
            <i class="bi bi-shield-check fs-1 d-block mb-2 text-secondary"></i>
            No audit log entries found matching the filter.
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead>
                    <tr class="text-muted border-secondary">
                        <th>Timestamp</th>
                        <th>User / Admin</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>IP Address</th>
                        <th>Description / Details</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($auditLogs as $log)
                        <tr>
                            <td class="text-muted small" style="white-space: nowrap;">
                                {{ $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('Y-m-d H:i:s') : '—' }}
                            </td>
                            <td>
                                @if($log->user)
                                    <span class="text-white fw-semibold">{{ $log->user->email }}</span>
                                    <div class="text-muted small" style="font-size: 0.75rem;">Role: {{ $log->user->role }}</div>
                                @else
                                    <span class="text-muted">System</span>
                                @endif
                            </td>
                            <td>
                                <span class="badge bg-info bg-opacity-20 text-info font-monospace">{{ $log->action }}</span>
                            </td>
                            <td class="text-muted font-monospace small">
                                {{ $log->target_type ? class_basename($log->target_type) . ' #' . $log->target_id : '—' }}
                            </td>
                            <td class="text-muted font-monospace small">{{ $log->ip_address ?? '—' }}</td>
                            <td class="text-white-50 small">{{ $log->description ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="p-3 border-top border-secondary border-opacity-25">
            {{ $auditLogs->links() }}
        </div>
    @endif
</div>
@endsection
