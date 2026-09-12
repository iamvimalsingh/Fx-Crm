@extends('layouts.admin')

@section('title', 'KYC Applications')
@section('header_title', 'Client KYC Verification Management')

@section('content')
<div class="row g-3 mb-4">
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 mb-0">
            <span class="text-muted small text-uppercase fw-bold">Total Profiles</span>
            <div class="fs-4 fw-bold text-white mt-1">{{ number_format($stats['total']) }}</div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 mb-0 border-warning border-opacity-25">
            <span class="text-warning small text-uppercase fw-bold">Pending Review</span>
            <div class="fs-4 fw-bold text-warning mt-1">{{ number_format($stats['pending']) }}</div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 mb-0 border-success border-opacity-25">
            <span class="text-success small text-uppercase fw-bold">Approved</span>
            <div class="fs-4 fw-bold text-success mt-1">{{ number_format($stats['approved']) }}</div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="fx-admin-card p-3 mb-0 border-danger border-opacity-25">
            <span class="text-danger small text-uppercase fw-bold">Rejected</span>
            <div class="fs-4 fw-bold text-danger mt-1">{{ number_format($stats['rejected']) }}</div>
        </div>
    </div>
</div>

<div class="fx-admin-card mb-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="btn-group btn-group-sm" role="group">
            <a href="{{ route('admin.kyc.index') }}" class="btn btn-outline-secondary {{ !request('status') ? 'active' : '' }}">All ({{ $stats['total'] }})</a>
            <a href="{{ route('admin.kyc.index', ['status' => 'pending']) }}" class="btn btn-outline-warning {{ request('status') === 'pending' ? 'active' : '' }}">Pending ({{ $stats['pending'] }})</a>
            <a href="{{ route('admin.kyc.index', ['status' => 'approved']) }}" class="btn btn-outline-success {{ request('status') === 'approved' ? 'active' : '' }}">Approved ({{ $stats['approved'] }})</a>
            <a href="{{ route('admin.kyc.index', ['status' => 'rejected']) }}" class="btn btn-outline-danger {{ request('status') === 'rejected' ? 'active' : '' }}">Rejected ({{ $stats['rejected'] }})</a>
        </div>
    </div>
</div>

<div class="fx-admin-card">
    <div class="table-responsive">
        <table class="table table-dark table-hover align-middle mb-0" style="background-color: transparent;">
            <thead>
                <tr class="text-muted small text-uppercase" style="border-bottom: 1px solid var(--fx-admin-border);">
                    <th>Client</th>
                    <th>Country</th>
                    <th>KYC Status</th>
                    <th>Documents</th>
                    <th>Last Updated</th>
                    <th class="text-end">Action</th>
                </tr>
            </thead>
            <tbody>
                @forelse($profiles as $profile)
                    @php
                        $client = $profile->user;
                        $statusVal = $profile->status instanceof \App\Enums\KycStatus ? $profile->status->value : $profile->status;
                        $docs = $client?->kycDocuments ?? collect();
                    @endphp
                    <tr>
                        <td>
                            @if($client)
                                <div class="fw-bold text-white">{{ $client->profile?->full_name ?? $client->name ?? 'Client #' . $client->id }}</div>
                                <div class="text-muted small">{{ $client->email }}</div>
                            @else
                                <span class="text-muted">User #{{ $profile->user_id }}</span>
                            @endif
                        </td>
                        <td>
                            <span class="text-secondary small">{{ $client?->profile?->country ?? '—' }}</span>
                        </td>
                        <td>
                            @if($statusVal === 'approved')
                                <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Approved</span>
                            @elseif($statusVal === 'pending')
                                <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25">Pending Review</span>
                            @elseif($statusVal === 'rejected')
                                <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">Rejected</span>
                            @else
                                <span class="badge bg-secondary bg-opacity-25 text-secondary">Not Submitted</span>
                            @endif
                        </td>
                        <td>
                            <div class="d-flex gap-1 flex-wrap">
                                @forelse($docs as $doc)
                                    @php
                                        $badgeColor = match($doc->status) {
                                            'approved' => 'bg-success',
                                            'rejected' => 'bg-danger',
                                            default => 'bg-warning text-dark',
                                        };
                                    @endphp
                                    <span class="badge {{ $badgeColor }}" style="font-size: 0.7rem;">
                                        {{ $doc->document_type === 'id_proof' ? 'ID' : 'Address' }}: {{ ucfirst($doc->status) }}
                                    </span>
                                @empty
                                    <span class="text-muted small">No documents</span>
                                @endforelse
                            </div>
                        </td>
                        <td>
                            <span class="text-muted small">{{ $profile->updated_at->format('M d, Y H:i') }}</span>
                        </td>
                        <td class="text-end">
                            @if($client)
                                <a href="{{ route('admin.kyc.show', $client->id) }}" class="btn btn-sm btn-primary">
                                    <i class="bi bi-eye me-1"></i> Review
                                </a>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6" class="text-center py-4 text-muted">
                            No KYC applications found matching criteria.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @if($profiles->hasPages())
        <div class="mt-4 pt-3 border-top border-secondary border-opacity-25">
            {{ $profiles->links() }}
        </div>
    @endif
</div>
@endsection
