<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - {{ config('broker.name', 'Forex Broker CRM') }}</title>
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
            max-width: 420px;
        }
    </style>
</head>
<body>
    <div class="auth-card shadow-lg">
        <div class="text-center mb-4">
            <h4 class="text-white fw-bold">Reset Password</h4>
            <p class="text-muted small">Enter your email to receive recovery instructions</p>
        </div>

        @if (session('status'))
            <div class="alert alert-success py-2 small mb-3">
                {{ session('status') }}
            </div>
        @endif

        <form method="POST" action="{{ route('password.email') }}">
            @csrf
            <div class="mb-4">
                <label for="email" class="form-label text-light small fw-bold">Email Address</label>
                <input type="email" class="form-control bg-dark text-white border-secondary" id="email" name="email" value="{{ old('email') }}" required autofocus>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold mb-3">Send Reset Instructions</button>
            <div class="text-center">
                <a href="{{ route('login') }}" class="text-muted text-decoration-none small">Back to Sign In</a>
            </div>
        </form>
    </div>
</body>
</html>
