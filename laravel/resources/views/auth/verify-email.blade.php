<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Email - {{ config('broker.name', 'Forex Broker CRM') }}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .auth-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 2.5rem;
            width: 100%;
            max-width: 440px;
        }
    </style>
</head>
<body>
    <div class="auth-card shadow-lg">
        <div class="text-center mb-4">
            <h4 class="text-white fw-bold">Verify Your Email</h4>
            <p class="text-muted small">Please verify your email address to continue.</p>
        </div>

        @if (session('status') == 'verification-link-sent')
            <div class="alert alert-success py-2 small mb-3">
                A fresh verification link has been dispatched to your email address.
            </div>
        @endif

        <form method="POST" action="{{ route('verification.send') }}">
            @csrf
            <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold mb-3">Resend Verification Email</button>
        </form>

        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button type="submit" class="btn btn-outline-secondary w-100 py-2">Log Out</button>
        </form>
    </div>
</body>
</html>
