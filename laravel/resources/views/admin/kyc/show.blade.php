@extends('layouts.admin')

@section('title', 'Review KYC - ' . ($client->profile?->full_name ?? $client->name ?? $client->email))
@section('header_title', 'Client KYC Verification Review')

@section('content')
<div class="mb-3">
    <a href="{{ route('admin.kyc.index') }}" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Back to KYC Applications
    </a>
</div>

<div class="row g-4">
    <!-- Left Column: Client Summary & Overall Status -->
    <div class="col-12 col-lg-4">
        <div class="fx-admin-card mb-4">
            <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2">Client Overview</h6>

            <div class="mb-3">
                <div class="text-muted small">Full Name</div>
                <div class="fw-bold text-white fs-6">{{ $client->profile?->full_name ?? $client->name ?? '—' }}</div>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Email Address</div>
                <div class="text-white">{{ $client->email }}</div>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Country</div>
                <div class="text-white">{{ $client->profile?->country ?? '—' }}</div>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Phone</div>
                <div class="text-white">{{ $client->profile?->phone ?? '—' }}</div>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Residential Address</div>
                <div class="text-white small">
                    {{ $client->profile?->address ?? '—' }}<br>
                    {{ $client->profile?->city ?? '' }}{{ $client->profile?->state ? ', ' . $client->profile?->state : '' }} {{ $client->profile?->postal_code ?? '' }}
                </div>
            </div>

            <div class="pt-2 border-top border-secondary border-opacity-25">
                <a href="{{ route('admin.clients.show', $client->id) }}" class="btn btn-sm btn-outline-secondary w-100">
                    <i class="bi bi-person me-1"></i> View Client 360
                </a>
            </div>
        </div>

        <div class="fx-admin-card">
            <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2">Overall KYC Status</h6>

            @php
                $statusVal = $kycProfile->status instanceof \App\Enums\KycStatus ? $kycProfile->status->value : $kycProfile->status;
            @endphp

            <div class="mb-3">
                <span class="text-muted small d-block mb-1">Current Status:</span>
                @if($statusVal === 'approved')
                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 fs-6 p-2 w-100 text-center">
                        <i class="bi bi-check-circle me-1"></i> Approved
                    </span>
                @elseif($statusVal === 'pending')
                    <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 fs-6 p-2 w-100 text-center">
                        <i class="bi bi-hourglass-split me-1"></i> Pending Review
                    </span>
                @elseif($statusVal === 'rejected')
                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 fs-6 p-2 w-100 text-center">
                        <i class="bi bi-x-circle me-1"></i> Rejected
                    </span>
                @else
                    <span class="badge bg-secondary bg-opacity-25 text-secondary fs-6 p-2 w-100 text-center">
                        Not Submitted
                    </span>
                @endif
            </div>

            @if($statusVal === 'rejected' && $kycProfile->rejection_reason)
                <div class="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger small mb-3">
                    <strong>Rejection Reason:</strong><br>
                    {{ $kycProfile->rejection_reason }}
                </div>
            @endif

            <!-- Overall Actions -->
            <div class="d-grid gap-2 mt-4">
                @if($statusVal !== 'approved')
                    <form method="POST" action="{{ route('admin.kyc.profiles.approve', $client->id) }}">
                        @csrf
                        <button type="submit" class="btn btn-success w-100" onclick="return confirm('Are you sure you want to approve this client\'s KYC profile?')">
                            <i class="bi bi-shield-check me-1"></i> Approve KYC Profile
                        </button>
                    </form>
                @endif

                @if($statusVal !== 'rejected')
                    <button type="button" class="btn btn-outline-danger w-100" data-bs-toggle="collapse" data-bs-target="#rejectProfileCollapse">
                        <i class="bi bi-shield-x me-1"></i> Reject KYC Profile
                    </button>

                    <div class="collapse mt-2" id="rejectProfileCollapse">
                        <form method="POST" action="{{ route('admin.kyc.profiles.reject', $client->id) }}" class="p-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25 rounded">
                            @csrf
                            <label class="form-label text-white small fw-bold">Rejection Reason <span class="text-danger">*</span></label>
                            <textarea name="rejection_reason" rows="3" class="form-control form-control-sm bg-dark text-white border-secondary mb-2" placeholder="Explain why the KYC profile is rejected..." required></textarea>
                            <button type="submit" class="btn btn-sm btn-danger w-100">Confirm Rejection</button>
                        </form>
                    </div>
                @endif
            </div>
        </div>
    </div>

    <!-- Right Column: Uploaded Documents Review -->
    <div class="col-12 col-lg-8">
        <div class="fx-admin-card">
            <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2">
                <i class="bi bi-file-earmark-text me-1"></i> Submitted Verification Documents ({{ $documents->count() }})
            </h6>

            @if($documents->isEmpty())
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-file-earmark-x fs-1 d-block mb-2"></i>
                    No documents have been uploaded by this client yet.
                </div>
            @else
                <div class="d-flex flex-column gap-3">
                    @foreach($documents as $doc)
                        @php
                            $docStatus = $doc->status;
                        @endphp
                        <div class="p-3 border border-secondary border-opacity-25 rounded bg-dark bg-opacity-25">
                            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                <div>
                                    <h6 class="text-white fw-bold mb-1">
                                        {{ $doc->document_type === 'id_proof' ? 'Proof of Identity (ID/Passport)' : 'Proof of Address (Utility/Bank)' }}
                                    </h6>
                                    <span class="text-muted small">Uploaded: {{ $doc->created_at->format('M d, Y H:i') }}</span>
                                </div>

                                <div>
                                    @if($docStatus === 'approved')
                                        <span class="badge bg-success">Approved</span>
                                    @elseif($docStatus === 'pending')
                                        <span class="badge bg-warning text-dark">Pending Review</span>
                                    @elseif($docStatus === 'rejected')
                                        <span class="badge bg-danger">Rejected</span>
                                    @endif
                                </div>
                            </div>

                            @if($docStatus === 'rejected' && $doc->rejection_reason)
                                <div class="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger small py-1 px-2 mb-2">
                                    <strong>Rejection Reason:</strong> {{ $doc->rejection_reason }}
                                </div>
                            @endif

                            <div class="d-flex align-items-center gap-2 flex-wrap mt-3 pt-2 border-top border-secondary border-opacity-25">
                                <a href="{{ route('admin.kyc.documents.view', $doc->id) }}" target="_blank" class="btn btn-sm btn-outline-info">
                                    <i class="bi bi-box-arrow-up-right me-1"></i> View Document Securely
                                </a>

                                @if($docStatus !== 'approved')
                                    <form method="POST" action="{{ route('admin.kyc.documents.approve', $doc->id) }}" class="d-inline">
                                        @csrf
                                        <button type="submit" class="btn btn-sm btn-outline-success">
                                            <i class="bi bi-check2 me-1"></i> Approve
                                        </button>
                                    </form>
                                @endif

                                @if($docStatus !== 'rejected')
                                    <button type="button" class="btn btn-sm btn-outline-danger" data-bs-toggle="collapse" data-bs-target="#rejectDocCollapse-{{ $doc->id }}">
                                        <i class="bi bi-x me-1"></i> Reject
                                    </button>
                                @endif
                            </div>

                            <div class="collapse mt-2" id="rejectDocCollapse-{{ $doc->id }}">
                                <form method="POST" action="{{ route('admin.kyc.documents.reject', $doc->id) }}" class="p-2 bg-dark rounded border border-secondary border-opacity-25">
                                    @csrf
                                    <div class="input-group input-group-sm">
                                        <input type="text" name="rejection_reason" class="form-control bg-dark text-white border-secondary" placeholder="Reason for rejecting this document..." required>
                                        <button class="btn btn-danger" type="submit">Confirm Reject</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </div>
</div>
@endsection
