@extends('layouts.client')

@section('title', 'Open Support Ticket')
@section('header_title', 'New Support Inquiry')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <a href="{{ route('client.support.index') }}" class="btn btn-sm btn-outline-secondary mb-2">
            <i class="bi bi-arrow-left me-1"></i> Back to Support Center
        </a>
        <h4 class="text-white fw-bold mb-0">Open a Support Ticket</h4>
        <p class="text-muted small mb-0">Submit an inquiry directly to our back-office support team.</p>
    </div>
</div>

<div class="row justify-content-center">
    <div class="col-12 col-lg-9">
        <div class="fx-card">
            @if($errors->any())
                <div class="alert alert-danger alert-dismissible fade show bg-danger bg-opacity-10 text-danger border-danger border-opacity-25 mb-4" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> <strong>Please correct the following errors:</strong>
                    <ul class="mb-0 mt-2 ps-3 small">
                        @foreach($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            @endif

            <form method="POST" action="{{ route('client.support.store') }}" enctype="multipart/form-data">
                @csrf

                <div class="row g-3 mb-3">
                    <!-- Subject -->
                    <div class="col-12">
                        <label class="form-label text-light small fw-semibold">Subject / Inquiry Title <span class="text-danger">*</span></label>
                        <input type="text" name="subject" class="form-control bg-black border-secondary text-white @error('subject') is-invalid @enderror" value="{{ old('subject') }}" placeholder="e.g. Question regarding withdrawal processing time" required maxlength="255">
                        @error('subject')
                            <div class="invalid-feedback">{{ $message }}</div>
                        @enderror
                    </div>

                    <!-- Category -->
                    <div class="col-12 col-md-6">
                        <label class="form-label text-light small fw-semibold">Inquiry Category <span class="text-danger">*</span></label>
                        <select name="category" id="categorySelect" class="form-select bg-black border-secondary text-white @error('category') is-invalid @enderror" required onchange="handleCategoryChange(this.value)">
                            <option value="">Select Category...</option>
                            @foreach(\App\Models\SupportTicket::CATEGORIES as $cat)
                                <option value="{{ $cat }}" {{ old('category', request('category')) === $cat ? 'selected' : '' }}>{{ $cat }}</option>
                            @endforeach
                        </select>
                        @error('category')
                            <div class="invalid-feedback">{{ $message }}</div>
                        @enderror
                    </div>

                    <!-- Priority -->
                    <div class="col-12 col-md-6">
                        <label class="form-label text-light small fw-semibold">Priority Level <span class="text-danger">*</span></label>
                        <select name="priority" class="form-select bg-black border-secondary text-white @error('priority') is-invalid @enderror" required>
                            <option value="normal" {{ old('priority', 'normal') === 'normal' ? 'selected' : '' }}>Normal (Standard priority)</option>
                            <option value="high" {{ old('priority') === 'high' ? 'selected' : '' }}>High (Urgent trading / financial issue)</option>
                            <option value="low" {{ old('priority') === 'low' ? 'selected' : '' }}>Low (General inquiry)</option>
                        </select>
                        @error('priority')
                            <div class="invalid-feedback">{{ $message }}</div>
                        @enderror
                    </div>
                </div>

                <!-- Optional Linked CRM Record -->
                <div class="p-3 mb-3 rounded bg-black bg-opacity-40 border border-secondary border-opacity-25">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="bi bi-link-45deg text-primary fs-5"></i>
                        <span class="text-white fw-semibold small">Link to Existing CRM Record (Optional)</span>
                    </div>
                    <p class="text-muted small mb-3">
                        Linking your ticket to an existing request or trading account allows our agents to resolve your issue faster.
                    </p>

                    <div class="row g-2">
                        <div class="col-12 col-md-5">
                            <label class="form-label text-muted small">Record Type</label>
                            <select name="linked_record_type" id="linkedRecordType" class="form-select form-select-sm bg-black border-secondary text-white" onchange="updateRecordOptions()">
                                <option value="">None / Not Applicable</option>
                                <option value="deposit" {{ old('linked_record_type', $prefillType) === 'deposit' ? 'selected' : '' }}>Deposit Request</option>
                                <option value="withdrawal" {{ old('linked_record_type', $prefillType) === 'withdrawal' ? 'selected' : '' }}>Withdrawal Request</option>
                                <option value="trading_account" {{ old('linked_record_type', $prefillType) === 'trading_account' ? 'selected' : '' }}>Trading Account</option>
                                <option value="trading_account_request" {{ old('linked_record_type', $prefillType) === 'trading_account_request' ? 'selected' : '' }}>Trading Account Request</option>
                                <option value="trading_funding_request" {{ old('linked_record_type', $prefillType) === 'trading_funding_request' ? 'selected' : '' }}>Trading Funding Request</option>
                                @if($userKyc)
                                    <option value="kyc" {{ old('linked_record_type', $prefillType) === 'kyc' ? 'selected' : '' }}>KYC Verification Profile</option>
                                @endif
                            </select>
                        </div>

                        <div class="col-12 col-md-7">
                            <label class="form-label text-muted small">Select Your Record</label>
                            <select name="linked_record_id" id="linkedRecordId" class="form-select form-select-sm bg-black border-secondary text-white">
                                <option value="">-- Select Specific Record --</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Message Description -->
                <div class="mb-3">
                    <label class="form-label text-light small fw-semibold">Message & Detailed Description <span class="text-danger">*</span></label>
                    <textarea name="message" rows="6" class="form-control bg-black border-secondary text-white @error('message') is-invalid @enderror" placeholder="Describe your question or issue in detail..." required maxlength="5000">{{ old('message') }}</textarea>
                    <div class="form-text text-muted small">Please include any relevant error messages, transaction references, or timestamps.</div>
                    @error('message')
                        <div class="invalid-feedback">{{ $message }}</div>
                    @enderror
                </div>

                <!-- File Attachment -->
                <div class="mb-4">
                    <label class="form-label text-light small fw-semibold">Attachment (Optional)</label>
                    <input type="file" name="attachment" class="form-control bg-black border-secondary text-white @error('attachment') is-invalid @enderror" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip">
                    <div class="form-text text-muted small">Accepted file types: JPG, PNG, PDF, DOC, DOCX, TXT, ZIP. Maximum size: 5 MB.</div>
                    @error('attachment')
                        <div class="invalid-feedback">{{ $message }}</div>
                    @enderror
                </div>

                <div class="d-flex justify-content-end gap-2 border-top border-secondary border-opacity-25 pt-3">
                    <a href="{{ route('client.support.index') }}" class="btn btn-outline-secondary">
                        Cancel
                    </a>
                    <button type="submit" class="btn btn-primary px-4">
                        <i class="bi bi-send-fill me-1"></i> Submit Ticket
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

@push('scripts')
<script>
const userRecords = {
    deposit: [
        @foreach($userDeposits as $dep)
            { id: {{ $dep->id }}, label: "Deposit #{{ $dep->id }} — {{ $dep->currency }} ${{ $dep->amount }} ({{ ucfirst($dep->status) }})" },
        @endforeach
    ],
    withdrawal: [
        @foreach($userWithdrawals as $w)
            { id: {{ $w->id }}, label: "Withdrawal #{{ $w->id }} — {{ $w->currency }} ${{ $w->amount }} ({{ ucfirst($w->status) }})" },
        @endforeach
    ],
    trading_account: [
        @foreach($userTradingAccounts as $acc)
            { id: {{ $acc->id }}, label: "Account #{{ $acc->login_id }} — {{ $acc->platform_name }} {{ $acc->account_type }}" },
        @endforeach
    ],
    trading_account_request: [
        @foreach($userAccountRequests as $req)
            { id: {{ $req->id }}, label: "Request #{{ $req->id }} — {{ $req->platform_name }} {{ $req->account_type }} ({{ ucfirst($req->status) }})" },
        @endforeach
    ],
    trading_funding_request: [
        @foreach($userFundingRequests as $f)
            { id: {{ $f->id }}, label: "Funding #{{ $f->id }} — ${{ $f->amount }} ({{ ucfirst($f->status) }})" },
        @endforeach
    ],
    kyc: [
        @if($userKyc)
            { id: {{ $userKyc->id }}, label: "KYC Profile — Status: {{ \App\Models\SupportTicket::formatStatusLabel($userKyc->status) }}" }
        @endif
    ]
};

const preselectedId = "{{ old('linked_record_id', $prefillId) }}";

function updateRecordOptions() {
    const typeSelect = document.getElementById('linkedRecordType');
    const idSelect = document.getElementById('linkedRecordId');
    const selectedType = typeSelect.value;

    idSelect.innerHTML = '<option value="">-- Select Specific Record --</option>';

    if (selectedType && userRecords[selectedType]) {
        const records = userRecords[selectedType];
        if (records.length === 0) {
            idSelect.innerHTML = '<option value="">No existing records found for this category</option>';
            return;
        }

        records.forEach(rec => {
            const opt = document.createElement('option');
            opt.value = rec.id;
            opt.textContent = rec.label;
            if (preselectedId && String(preselectedId) === String(rec.id)) {
                opt.selected = true;
            }
            idSelect.appendChild(opt);
        });
    }
}

function handleCategoryChange(category) {
    const typeSelect = document.getElementById('linkedRecordType');
    if (!typeSelect.value) {
        if (category === 'Deposit') {
            typeSelect.value = 'deposit';
        } else if (category === 'Withdrawal') {
            typeSelect.value = 'withdrawal';
        } else if (category === 'Trading Account') {
            typeSelect.value = 'trading_account';
        } else if (category === 'Trading Funding') {
            typeSelect.value = 'trading_funding_request';
        } else if (category === 'Trading Password') {
            typeSelect.value = 'trading_account';
        } else if (category === 'KYC') {
            typeSelect.value = 'kyc';
        }
        updateRecordOptions();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    updateRecordOptions();
});
</script>
@endpush
@endsection
