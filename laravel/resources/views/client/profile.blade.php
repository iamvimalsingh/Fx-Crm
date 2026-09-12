@extends('layouts.client')

@section('title', 'Profile Settings')
@section('header_title', 'Client Profile')

@section('content')
<div class="row g-4">
    <!-- Protected Account Meta Summary (Read-Only) -->
    <div class="col-12 col-lg-4">
        <div class="fx-card mb-4">
            <div class="text-center pb-3 border-bottom border-secondary border-opacity-25 mb-3">
                <div class="bg-primary bg-opacity-20 text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style="width: 64px; height: 64px;">
                    <i class="bi bi-person-fill fs-2"></i>
                </div>
                <h5 class="fw-bold text-white mb-1">
                    {{ $user->profile->first_name ?? '' }} {{ $user->profile->last_name ?? '' }}
                </h5>
                <span class="text-muted small d-block font-monospace">#ACC-{{ sprintf('%06d', $user->id) }}</span>
            </div>

            <div class="space-y-3" style="font-size: 0.875rem;">
                <!-- Account Role -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted"><i class="bi bi-lock me-1"></i> Account Role</span>
                    <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25 text-uppercase">
                        {{ $user->role->value ?? $user->role }}
                    </span>
                </div>

                <!-- Account Status -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted"><i class="bi bi-lock me-1"></i> Account Status</span>
                    @if(($user->status->value ?? $user->status) === 'active')
                        <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Active</span>
                    @else
                        <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25">Disabled</span>
                    @endif
                </div>

                <!-- Email Address (Protected) -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted"><i class="bi bi-lock me-1"></i> Email</span>
                    <span class="text-light fw-semibold text-truncate ms-2" style="max-width: 160px;">{{ $user->email }}</span>
                </div>

                <!-- KYC Verification Status -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted"><i class="bi bi-shield-check me-1"></i> KYC Status</span>
                    @php $kyc = $user->kycProfile->status->value ?? $user->kycProfile->status ?? 'not_submitted'; @endphp
                    @if($kyc === 'approved')
                        <span class="badge bg-success">Approved</span>
                    @elseif($kyc === 'pending')
                        <span class="badge bg-warning text-dark">Under Review</span>
                    @elseif($kyc === 'rejected')
                        <span class="badge bg-danger">Rejected</span>
                    @else
                        <span class="badge bg-secondary">Not Submitted</span>
                    @endif
                </div>

                @if($kyc === 'rejected' && $user->kycProfile?->rejection_reason)
                    <div class="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger small p-2 mb-2" style="font-size: 0.75rem;">
                        <strong>Rejection Reason:</strong> {{ $user->kycProfile->rejection_reason }}
                    </div>
                @endif

                <!-- CRM Wallet Balance (Protected) -->
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted"><i class="bi bi-lock me-1"></i> CRM Wallet Balance</span>
                    <span class="text-emerald-400 fw-bold" style="color: #10b981;">
                        {{ $user->wallet->currency ?? 'USD' }} ${{ $user->wallet?->formatted_balance ?? '0.00' }}
                    </span>
                </div>
            </div>
        </div>
    </div>

    <!-- Editable Personal Information Form -->
    <div class="col-12 col-lg-8">
        <div class="fx-card">
            <h5 class="fw-bold text-white mb-3">
                <i class="bi bi-pencil-square me-2 text-primary"></i>Edit Profile Information
            </h5>
            <p class="text-muted small mb-4">
                Update your contact details and home address. Security critical fields (email, role, wallet balance) are managed by broker administration.
            </p>

            <form method="POST" action="{{ route('client.profile.update') }}">
                @csrf

                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <label for="first_name" class="form-label text-muted small fw-semibold">First Name</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('first_name') is-invalid @enderror" id="first_name" name="first_name" value="{{ old('first_name', $user->profile->first_name ?? '') }}" required>
                        @error('first_name')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    <div class="col-12 col-md-6">
                        <label for="last_name" class="form-label text-muted small fw-semibold">Last Name</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('last_name') is-invalid @enderror" id="last_name" name="last_name" value="{{ old('last_name', $user->profile->last_name ?? '') }}" required>
                        @error('last_name')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <label for="phone" class="form-label text-muted small fw-semibold">Phone Number</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('phone') is-invalid @enderror" id="phone" name="phone" value="{{ old('phone', $user->profile->phone ?? '') }}" placeholder="+1 555 0199">
                        @error('phone')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    <div class="col-12 col-md-6">
                        <label for="country" class="form-label text-muted small fw-semibold">Country of Residence</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('country') is-invalid @enderror" id="country" name="country" value="{{ old('country', $user->profile->country ?? config('broker.default_country', 'US')) }}">
                        @error('country')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>
                </div>

                <div class="mb-3">
                    <label for="address" class="form-label text-muted small fw-semibold">Street Address</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('address') is-invalid @enderror" id="address" name="address" value="{{ old('address', $user->profile->address ?? '') }}" placeholder="123 Financial Way">
                    @error('address')<div class="invalid-feedback">{{ $message }}</div>@enderror
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-12 col-md-4">
                        <label for="city" class="form-label text-muted small fw-semibold">City</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('city') is-invalid @enderror" id="city" name="city" value="{{ old('city', $user->profile->city ?? '') }}">
                        @error('city')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    <div class="col-12 col-md-4">
                        <label for="state" class="form-label text-muted small fw-semibold">State / Province</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('state') is-invalid @enderror" id="state" name="state" value="{{ old('state', $user->profile->state ?? '') }}">
                        @error('state')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    <div class="col-12 col-md-4">
                        <label for="postal_code" class="form-label text-muted small fw-semibold">Postal / Zip Code</label>
                        <input type="text" class="form-control bg-dark text-white border-secondary border-opacity-25 @error('postal_code') is-invalid @enderror" id="postal_code" name="postal_code" value="{{ old('postal_code', $user->profile->postal_code ?? '') }}">
                        @error('postal_code')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>
                </div>

                <div class="d-flex justify-content-end">
                    <button type="submit" class="btn btn-primary px-4 py-2 rounded-3 fw-semibold">
                        <i class="bi bi-save me-1"></i> Save Profile Changes
                    </button>
                </div>
            </form>
        </div>

        <!-- KYC Identity Verification Section -->
        <div class="fx-card mt-4" id="kyc-section">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                    <h5 class="fw-bold text-white mb-1">
                        <i class="bi bi-shield-check me-2 text-success"></i>KYC Identity Verification
                    </h5>
                    <p class="text-muted small mb-0">Upload required verification documents to complete your account compliance check.</p>
                </div>

                <div>
                    @if($kyc === 'approved')
                        <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-3 py-2">
                            <i class="bi bi-check-circle me-1"></i> Verified Client
                        </span>
                    @elseif($kyc === 'pending')
                        <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 px-3 py-2">
                            <i class="bi bi-hourglass-split me-1"></i> Under Review
                        </span>
                    @elseif($kyc === 'rejected')
                        <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 px-3 py-2">
                            <i class="bi bi-exclamation-triangle me-1"></i> Verification Rejected
                        </span>
                    @else
                        <span class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 px-3 py-2">
                            Not Submitted
                        </span>
                    @endif
                </div>
            </div>

            @if($kyc === 'rejected' && $user->kycProfile?->rejection_reason)
                <div class="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger small mb-4">
                    <strong>Rejection Reason:</strong> {{ $user->kycProfile->rejection_reason }}<br>
                    Please review the feedback above, re-upload clear and valid documents, and click "Submit KYC for Verification".
                </div>
            @endif

            @php
                $docsMap = $user->kycDocuments->keyBy('document_type');
                $idDoc = $docsMap->get('id_proof');
                $addrDoc = $docsMap->get('address_proof');
            @endphp

            <div class="row g-4 mb-4">
                <!-- ID Proof Card -->
                <div class="col-12 col-md-6">
                    <div class="p-3 rounded bg-dark bg-opacity-50 border border-secondary border-opacity-25 h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="text-white fw-bold mb-0">
                                    <i class="bi bi-person-vcard me-1 text-primary"></i> Proof of Identity
                                </h6>
                                @if($idDoc)
                                    @if($idDoc->status === 'approved')
                                        <span class="badge bg-success">Approved</span>
                                    @elseif($idDoc->status === 'pending')
                                        <span class="badge bg-warning text-dark">Pending</span>
                                    @else
                                        <span class="badge bg-danger">Rejected</span>
                                    @endif
                                @else
                                    <span class="badge bg-secondary">Not Uploaded</span>
                                @endif
                            </div>

                            <p class="text-muted small mb-2">Government issued ID, Passport, or Driver's License (JPG, PNG, PDF up to 5MB).</p>

                            @if($idDoc)
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <a href="{{ route('client.kyc.document.view', $idDoc->id) }}" target="_blank" class="btn btn-sm btn-outline-info">
                                        <i class="bi bi-eye me-1"></i> View Uploaded File
                                    </a>
                                    <span class="text-muted small">Uploaded {{ $idDoc->created_at->diffForHumans() }}</span>
                                </div>

                                @if($idDoc->status === 'rejected' && $idDoc->rejection_reason)
                                    <div class="alert alert-danger py-1 px-2 small mb-2">
                                        Reason: {{ $idDoc->rejection_reason }}
                                    </div>
                                @endif
                            @endif
                        </div>

                        @if(!$idDoc || $idDoc->status !== 'approved')
                            <form method="POST" action="{{ route('client.kyc.document.upload') }}" enctype="multipart/form-data" class="mt-2">
                                @csrf
                                <input type="hidden" name="document_type" value="id_proof">
                                <div class="mb-2">
                                    <input type="file" name="document_file" class="form-control form-control-sm bg-dark text-white border-secondary" accept=".jpg,.jpeg,.png,.pdf" required>
                                </div>
                                <button type="submit" class="btn btn-sm btn-outline-primary w-100">
                                    <i class="bi bi-upload me-1"></i> {{ $idDoc ? 'Re-upload ID Proof' : 'Upload ID Proof' }}
                                </button>
                            </form>
                        @endif
                    </div>
                </div>

                <!-- Address Proof Card -->
                <div class="col-12 col-md-6">
                    <div class="p-3 rounded bg-dark bg-opacity-50 border border-secondary border-opacity-25 h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="text-white fw-bold mb-0">
                                    <i class="bi bi-geo-alt me-1 text-primary"></i> Proof of Address
                                </h6>
                                @if($addrDoc)
                                    @if($addrDoc->status === 'approved')
                                        <span class="badge bg-success">Approved</span>
                                    @elseif($addrDoc->status === 'pending')
                                        <span class="badge bg-warning text-dark">Pending</span>
                                    @else
                                        <span class="badge bg-danger">Rejected</span>
                                    @endif
                                @else
                                    <span class="badge bg-secondary">Not Uploaded</span>
                                @endif
                            </div>

                            <p class="text-muted small mb-2">Recent Utility Bill or Bank Statement showing your full name and address (max 3 months old).</p>

                            @if($addrDoc)
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <a href="{{ route('client.kyc.document.view', $addrDoc->id) }}" target="_blank" class="btn btn-sm btn-outline-info">
                                        <i class="bi bi-eye me-1"></i> View Uploaded File
                                    </a>
                                    <span class="text-muted small">Uploaded {{ $addrDoc->created_at->diffForHumans() }}</span>
                                </div>

                                @if($addrDoc->status === 'rejected' && $addrDoc->rejection_reason)
                                    <div class="alert alert-danger py-1 px-2 small mb-2">
                                        Reason: {{ $addrDoc->rejection_reason }}
                                    </div>
                                @endif
                            @endif
                        </div>

                        @if(!$addrDoc || $addrDoc->status !== 'approved')
                            <form method="POST" action="{{ route('client.kyc.document.upload') }}" enctype="multipart/form-data" class="mt-2">
                                @csrf
                                <input type="hidden" name="document_type" value="address_proof">
                                <div class="mb-2">
                                    <input type="file" name="document_file" class="form-control form-control-sm bg-dark text-white border-secondary" accept=".jpg,.jpeg,.png,.pdf" required>
                                </div>
                                <button type="submit" class="btn btn-sm btn-outline-primary w-100">
                                    <i class="bi bi-upload me-1"></i> {{ $addrDoc ? 'Re-upload Address Proof' : 'Upload Address Proof' }}
                                </button>
                            </form>
                        @endif
                    </div>
                </div>
            </div>

            <!-- Submit KYC for Verification -->
            @if($user->kycDocuments->isNotEmpty() && $kyc !== 'approved' && $kyc !== 'pending')
                <div class="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <div class="fw-bold text-white small">Ready for compliance review?</div>
                        <div class="text-muted small">Submit your uploaded verification documents to our compliance team.</div>
                    </div>
                    <form method="POST" action="{{ route('client.kyc.submit') }}">
                        @csrf
                        <button type="submit" class="btn btn-success px-4 fw-semibold">
                            <i class="bi bi-send me-1"></i> Submit KYC for Verification
                        </button>
                    </form>
                </div>
            @endif
        </div>
    </div>
</div>
@endsection
