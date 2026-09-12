<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set New Password - {{ config('broker.name', 'Forex Broker CRM') }}</title>
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
            <h4 class="text-white fw-bold">Choose New Password</h4>
            <p class="text-muted small">Update your account credentials</p>
        </div>

        @if ($errors->any())
            <div class="alert alert-danger py-2 small mb-3">
                @foreach ($errors->all() as $error)
                    <div>{{ $error }}</div>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('password.update') }}">
            @csrf
            <input type="hidden" name="token" value="{{ $token }}">

            <div class="mb-3">
                <label for="email" class="form-label text-light small fw-bold">Email Address</label>
                <input type="email" class="form-control bg-dark text-white border-secondary" id="email" name="email" value="{{ $email ?? old('email') }}" required autofocus>
            </div>

            <div class="mb-3">
                <label for="password" class="form-label text-light small fw-bold">New Password</label>
                <input type="password" class="form-control bg-dark text-white border-secondary" id="password" name="password" required>
            </div>

            <div class="mb-4">
                <label for="password_confirmation" class="form-label text-light small fw-bold">Confirm New Password</label>
                <input type="password" class="form-control bg-dark text-white border-secondary" id="password_confirmation" name="password_confirmation" required>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">Save New Password</button>
        </form>
    </div>
</body>
</html>
