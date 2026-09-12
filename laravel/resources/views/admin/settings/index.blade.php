@extends('layouts.admin')

@section('title', 'Broker Settings')
@section('header_title', 'Broker System & Trading Configuration')

@section('content')
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <div>
        <h4 class="text-white fw-bold mb-0">System & Trading Account Settings</h4>
        <p class="text-muted small mb-0">Central control settings for test trading accounts, trading-to-wallet returns, platforms, and operational rules.</p>
    </div>
    <div>
        <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25 px-3 py-2">
            <i class="bi bi-shield-lock me-1"></i> V1 Manual Back-Office Mode
        </span>
    </div>
</div>

<div class="row g-4">
    <!-- Central Default Test/Demo Account Settings -->
    <div class="col-12 col-lg-7">
        <div class="fx-admin-card h-100">
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <h6 class="text-white fw-bold mb-0">
                    <i class="bi bi-laptop me-2 text-warning"></i> Central Default Test / Demo Trading Account
                </h6>
                <span class="badge {{ ($settings['TRADING_TEST_ACCOUNT_ENABLED'] ?? '0') === '1' ? 'bg-success text-success' : 'bg-secondary text-white' }} bg-opacity-25 border {{ ($settings['TRADING_TEST_ACCOUNT_ENABLED'] ?? '0') === '1' ? 'border-success' : 'border-secondary' }}">
                    {{ ($settings['TRADING_TEST_ACCOUNT_ENABLED'] ?? '0') === '1' ? 'Active in Client Portal' : 'Disabled' }}
                </span>
            </div>
            <p class="text-muted small mb-3">
                When enabled, all authenticated clients will see this central test/demo trading account on their Trading Accounts page with one-click credential reveal and instant web trader launch links.
            </p>

            <form method="POST" action="{{ route('admin.settings.test-account') }}">
                @csrf
                <div class="row g-3 mb-3">
                    <div class="col-12">
                        <label class="form-label small text-muted">Feature Status</label>
                        <select name="enabled" class="form-select bg-black border-secondary text-white">
                            <option value="1" {{ ($settings['TRADING_TEST_ACCOUNT_ENABLED'] ?? '0') === '1' ? 'selected' : '' }}>Enabled (Show Demo Account to Clients)</option>
                            <option value="0" {{ ($settings['TRADING_TEST_ACCOUNT_ENABLED'] ?? '0') === '0' ? 'selected' : '' }}>Disabled (Hide Demo Account)</option>
                        </select>
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Display Name / Title</label>
                        <input type="text" name="name" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TEST_ACCOUNT_NAME'] ?? 'ArrowTrader Demo Account' }}" placeholder="e.g. ArrowTrader Demo Account">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Platform Name</label>
                        <input type="text" name="platform" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TEST_ACCOUNT_PLATFORM'] ?? 'ArrowTrader MT5' }}" placeholder="e.g. ArrowTrader MT5">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Trading Server Name</label>
                        <input type="text" name="server" class="form-control bg-black border-secondary text-white font-monospace" value="{{ $settings['TRADING_TEST_ACCOUNT_SERVER'] ?? 'ArrowTrader-Demo01' }}" placeholder="e.g. ArrowTrader-Demo01">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Demo Login ID / Account Number</label>
                        <input type="text" name="login" class="form-control bg-black border-secondary text-white font-monospace" value="{{ $settings['TRADING_TEST_ACCOUNT_LOGIN'] ?? '100001' }}" placeholder="e.g. 100001">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Demo Trading Password</label>
                        <input type="password" name="password" class="form-control bg-black border-secondary text-white font-monospace" value="" placeholder="Leave blank to keep current password">
                        <div class="d-flex align-items-center justify-content-between mt-1">
                            <div class="d-flex align-items-center gap-1">
                                <span class="text-muted small">Current:</span>
                                <span id="adminDemoPwMask" class="text-muted font-monospace small">••••••••</span>
                                <span id="adminDemoPwVal" class="text-warning font-monospace small d-none"></span>
                            </div>
                            <button type="button" class="btn btn-link btn-sm text-info p-0 text-decoration-none" id="btnAdminDemoReveal" onclick="toggleAdminDemoPassword(this)">
                                <i class="bi bi-eye me-1"></i> Reveal
                            </button>
                        </div>
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Account Type</label>
                        <input type="text" name="account_type" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TEST_ACCOUNT_TYPE'] ?? 'Demo Standard' }}" placeholder="e.g. Demo Standard">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Currency</label>
                        <input type="text" name="currency" class="form-control bg-black border-secondary text-white text-uppercase" value="{{ $settings['TRADING_TEST_ACCOUNT_CURRENCY'] ?? 'USD' }}" maxlength="3">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Leverage</label>
                        <input type="text" name="leverage" class="form-control bg-black border-secondary text-white font-monospace" value="{{ $settings['TRADING_TEST_ACCOUNT_LEVERAGE'] ?? '1:100' }}">
                    </div>

                    <div class="col-12">
                        <label class="form-label small text-muted">Web Trader Launch URL</label>
                        <input type="url" name="web_url" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TEST_ACCOUNT_WEB_URL'] ?? '' }}" placeholder="https://webtrader.broker.com">
                    </div>
                </div>

                <div class="d-flex justify-content-end">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-check2-circle me-1"></i> Save Demo Account Settings
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Trading to Wallet Return Rules -->
    <div class="col-12 col-lg-5">
        <div class="fx-admin-card mb-4">
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <h6 class="text-white fw-bold mb-0">
                    <i class="bi bi-arrow-down-left-circle me-2 text-info"></i> Trading -> Wallet Return Rules
                </h6>
                <span class="badge {{ ($settings['TRADING_TO_WALLET_ENABLED'] ?? '1') === '1' ? 'bg-success text-success' : 'bg-danger text-danger' }} bg-opacity-25 border {{ ($settings['TRADING_TO_WALLET_ENABLED'] ?? '1') === '1' ? 'border-success' : 'border-danger' }}">
                    {{ ($settings['TRADING_TO_WALLET_ENABLED'] ?? '1') === '1' ? 'Enabled' : 'Disabled' }}
                </span>
            </div>
            <p class="text-muted small mb-3">
                Control whether clients can submit withdrawal/return requests from their external trading account to their CRM wallet, along with minimum and maximum single request limits.
            </p>

            <form method="POST" action="{{ route('admin.settings.trading-wallet-rules') }}">
                @csrf
                <div class="mb-3">
                    <label class="form-label small text-muted">Allow Client Return Requests</label>
                    <select name="trading_to_wallet_enabled" class="form-select bg-black border-secondary text-white">
                        <option value="1" {{ ($settings['TRADING_TO_WALLET_ENABLED'] ?? '1') === '1' ? 'selected' : '' }}>Enabled (Allow Clients to Request Returns)</option>
                        <option value="0" {{ ($settings['TRADING_TO_WALLET_ENABLED'] ?? '1') === '0' ? 'selected' : '' }}>Disabled (Block New Return Requests)</option>
                    </select>
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label small text-muted">Minimum Amount ($)</label>
                        <input type="number" step="0.01" name="min_amount" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TO_WALLET_MIN_AMOUNT'] ?? '10.00' }}" required>
                    </div>
                    <div class="col-6">
                        <label class="form-label small text-muted">Maximum Amount ($)</label>
                        <input type="number" step="0.01" name="max_amount" class="form-control bg-black border-secondary text-white" value="{{ $settings['TRADING_TO_WALLET_MAX_AMOUNT'] ?? '50000.00' }}" required>
                    </div>
                </div>

                <div class="d-flex justify-content-end">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-check2-circle me-1"></i> Update Return Rules
                    </button>
                </div>
            </form>
        </div>

        <!-- General Identity Card -->
        <div class="fx-admin-card">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-building me-2 text-primary"></i> General Broker Identity
            </h6>
            <table class="table table-dark table-borderless table-sm mb-0" style="font-size: 0.85rem;">
                <tr>
                    <td class="text-muted" style="width: 45%;">Broker Name:</td>
                    <td class="text-white fw-bold">{{ $config['name'] ?? config('app.name') }}</td>
                </tr>
                <tr>
                    <td class="text-muted">Base Currency:</td>
                    <td class="text-success fw-bold font-monospace">{{ $config['base_currency'] ?? 'USD' }}</td>
                </tr>
                <tr>
                    <td class="text-muted">KYC Requirement:</td>
                    <td>
                        <span class="badge bg-info bg-opacity-20 text-info">Optional / Managed</span>
                    </td>
                </tr>
                <tr>
                    <td class="text-muted">CRM Mode:</td>
                    <td class="text-white">Manual Terminal (No external automated API side-effects)</td>
                </tr>
            </table>
        </div>

        <!-- Support Center & Help Desk Configuration Card -->
        <div class="fx-admin-card mt-4">
            <h6 class="text-white fw-bold border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                <i class="bi bi-headset me-2 text-info"></i> Support Center & Help Desk Configuration
            </h6>
            <p class="text-muted small mb-3">
                Configure official support contact information, operating hours, and instructions displayed dynamically across the Client Support Center.
            </p>

            <form method="POST" action="{{ route('admin.settings.support') }}">
                @csrf
                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Support Email</label>
                        <input type="email" name="support_email" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_EMAIL'] ?? ($config['support_email'] ?? 'support@broker.com') }}" required>
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Support Phone</label>
                        <input type="text" name="support_phone" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_PHONE'] ?? '+1 (555) 019-2834' }}" placeholder="+1 (555) 019-2834">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">WhatsApp Support</label>
                        <input type="text" name="support_whatsapp" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_WHATSAPP'] ?? '+1 (555) 019-2834' }}" placeholder="+1 (555) 019-2834">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Support Operating Hours</label>
                        <input type="text" name="support_hours" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_HOURS'] ?? '24/5 Monday – Friday' }}" placeholder="e.g. 24/5 Monday – Friday">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Support Timezone</label>
                        <input type="text" name="support_timezone" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_TIMEZONE'] ?? 'UTC / GMT' }}" placeholder="e.g. UTC / GMT">
                    </div>

                    <div class="col-12 col-md-6">
                        <label class="form-label small text-muted">Emergency Desk / Hotline</label>
                        <input type="text" name="support_emergency" class="form-control bg-black border-secondary text-white" value="{{ $settings['SUPPORT_EMERGENCY_CONTACT'] ?? 'For urgent trade issues, reach out immediately via our priority phone line.' }}" placeholder="Emergency notice or direct phone">
                    </div>

                    <div class="col-12">
                        <label class="form-label small text-muted">Support Instructions & Welcome Note</label>
                        <textarea name="support_instructions" rows="3" class="form-control bg-black border-secondary text-white" placeholder="Help desk instructions shown to clients">{{ $settings['SUPPORT_INSTRUCTIONS'] ?? 'Submit a ticket for account, deposit, or trading inquiries. Our dedicated support team reviews requests within 1-2 business hours.' }}</textarea>
                    </div>
                </div>

                <div class="d-flex justify-content-end">
                    <button type="submit" class="btn btn-info">
                        <i class="bi bi-check2-circle me-1"></i> Save Support Settings
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

@push('scripts')
<script>
let adminDemoDecryptedPassword = null;

function toggleAdminDemoPassword(btn) {
    const maskEl = document.getElementById('adminDemoPwMask');
    const valEl = document.getElementById('adminDemoPwVal');

    if (valEl.classList.contains('d-none')) {
        if (!adminDemoDecryptedPassword) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm text-info" style="width: 0.8rem; height: 0.8rem;"></span>';
            fetch('{{ route("admin.settings.reveal-demo-password") }}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': '{{ csrf_token() }}',
                    'Accept': 'application/json'
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.password) {
                    adminDemoDecryptedPassword = data.password;
                    valEl.textContent = adminDemoDecryptedPassword;
                    valEl.classList.remove('d-none');
                    maskEl.classList.add('d-none');
                    btn.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Hide';
                } else {
                    valEl.textContent = '(No password configured)';
                    valEl.classList.remove('d-none');
                    maskEl.classList.add('d-none');
                    btn.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Hide';
                }
            })
            .catch(err => {
                btn.innerHTML = '<i class="bi bi-eye me-1"></i> Reveal';
                alert('Failed to retrieve demo trading password.');
            });
        } else {
            valEl.textContent = adminDemoDecryptedPassword;
            valEl.classList.remove('d-none');
            maskEl.classList.add('d-none');
            btn.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Hide';
        }
    } else {
        valEl.classList.add('d-none');
        maskEl.classList.remove('d-none');
        btn.innerHTML = '<i class="bi bi-eye me-1"></i> Reveal';
    }
}
</script>
@endpush
@endsection
