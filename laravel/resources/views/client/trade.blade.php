@extends('layouts.client')

@section('title', 'Trading Terminals')
@section('header_title', 'External Trading Platforms')

@section('content')
<!-- Architecture Notice Banner -->
<div class="alert alert-dark bg-dark bg-opacity-75 border-secondary border-opacity-25 text-light d-flex align-items-center gap-3 p-3 rounded-3 mb-4">
    <i class="bi bi-box-arrow-up-right text-primary fs-4"></i>
    <div class="small">
        <strong>External Trading Platforms Notice:</strong> Trading accounts and market execution terminals are hosted on external trading platforms (Web Trader, Desktop Terminal, Mobile App). Trading account credentials and platform access are managed separately by broker administration.
    </div>
</div>

<div class="fx-card mb-4">
    <div class="d-flex align-items-center gap-3 mb-2">
        <div class="bg-primary bg-opacity-20 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
            <i class="bi bi-bar-chart-line-fill fs-4"></i>
        </div>
        <div>
            <h4 class="fw-bold text-white mb-0">Trading Terminals & Access Links</h4>
            <p class="text-muted small mb-0">Access external WebTrader or download desktop and mobile applications.</p>
        </div>
    </div>
</div>

<div class="row g-3">
    <!-- WebTrader Card -->
    <div class="col-12 col-md-6 col-lg-4">
        <div class="fx-card h-100 d-flex flex-column justify-content-between">
            <div>
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <i class="bi bi-globe2 text-primary fs-2"></i>
                    <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25">External WebTrader</span>
                </div>
                <h5 class="fw-bold text-white mb-2">WebTrader Terminal</h5>
                <p class="text-muted small mb-4">
                    Access the external HTML5 trading terminal directly in your web browser.
                </p>
            </div>
            <a href="{{ config('broker.platforms.web_trader') }}" target="_blank" class="btn btn-primary w-100 rounded-3 fw-semibold">
                Launch WebTrader <i class="bi bi-box-arrow-up-right ms-1"></i>
            </a>
        </div>
    </div>

    <!-- Windows Desktop Terminal -->
    <div class="col-12 col-md-6 col-lg-4">
        <div class="fx-card h-100 d-flex flex-column justify-content-between">
            <div>
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <i class="bi bi-windows text-info fs-2"></i>
                    <span class="badge bg-info bg-opacity-20 text-info border border-info border-opacity-25">Desktop Application</span>
                </div>
                <h5 class="fw-bold text-white mb-2">Windows Terminal</h5>
                <p class="text-muted small mb-4">
                    Download the external desktop trading terminal for Windows systems.
                </p>
            </div>
            <a href="{{ config('broker.platforms.windows') }}" target="_blank" class="btn btn-outline-light w-100 rounded-3 fw-semibold">
                Download for Windows <i class="bi bi-download ms-1"></i>
            </a>
        </div>
    </div>

    <!-- macOS Desktop Terminal -->
    <div class="col-12 col-md-6 col-lg-4">
        <div class="fx-card h-100 d-flex flex-column justify-content-between">
            <div>
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <i class="bi bi-apple text-light fs-2"></i>
                    <span class="badge bg-secondary bg-opacity-20 text-light border border-secondary border-opacity-25">macOS Application</span>
                </div>
                <h5 class="fw-bold text-white mb-2">macOS Terminal</h5>
                <p class="text-muted small mb-4">
                    Download the external desktop trading terminal for Apple Silicon and Intel Macs.
                </p>
            </div>
            <a href="{{ config('broker.platforms.mac') }}" target="_blank" class="btn btn-outline-light w-100 rounded-3 fw-semibold">
                Download for Mac <i class="bi bi-download ms-1"></i>
            </a>
        </div>
    </div>

    <!-- Mobile Android -->
    <div class="col-12 col-md-6 col-lg-6">
        <div class="fx-card h-100 d-flex flex-column justify-content-between">
            <div>
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <i class="bi bi-android2 text-success fs-2"></i>
                    <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25">Android App</span>
                </div>
                <h5 class="fw-bold text-white mb-2">Android Mobile App</h5>
                <p class="text-muted small mb-4">
                    Trade on external platforms via Google Play mobile app.
                </p>
            </div>
            <a href="{{ config('broker.platforms.android') }}" target="_blank" class="btn btn-outline-success w-100 rounded-3 fw-semibold">
                Get on Google Play <i class="bi bi-google-play ms-1"></i>
            </a>
        </div>
    </div>

    <!-- Mobile iOS -->
    <div class="col-12 col-md-6 col-lg-6">
        <div class="fx-card h-100 d-flex flex-column justify-content-between">
            <div>
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <i class="bi bi-apple text-warning fs-2"></i>
                    <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">iOS App</span>
                </div>
                <h5 class="fw-bold text-white mb-2">iOS iPhone App</h5>
                <p class="text-muted small mb-4">
                    Trade on external platforms via Apple App Store mobile app.
                </p>
            </div>
            <a href="{{ config('broker.platforms.ios') }}" target="_blank" class="btn btn-outline-warning w-100 rounded-3 fw-semibold">
                Download on App Store <i class="bi bi-apple ms-1"></i>
            </a>
        </div>
    </div>
</div>
@endsection
