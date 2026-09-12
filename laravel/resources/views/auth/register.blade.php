<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Account - {{ config('broker.name', 'Forex Broker CRM') }}</title>
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
            padding: 2rem 0;
        }
        .auth-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 2.5rem;
            width: 100%;
            max-width: 480px;
        }
    </style>
</head>
<body>
    <div class="auth-card shadow-lg">
        <div class="text-center mb-4">
            <h4 class="text-white fw-bold">{{ config('broker.name', 'Forex Broker CRM') }}</h4>
            <p class="text-muted small">Open a Real Trading Account</p>
        </div>

        @if ($errors->any())
            <div class="alert alert-danger py-2 small mb-3">
                @foreach ($errors->all() as $error)
                    <div>{{ $error }}</div>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('register') }}">
            @csrf
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label text-light small fw-bold">First Name</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" name="first_name" value="{{ old('first_name') }}" required>
                </div>
                <div class="col-6">
                    <label class="form-label text-light small fw-bold">Last Name</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" name="last_name" value="{{ old('last_name') }}" required>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label text-light small fw-bold">Email Address</label>
                <input type="email" class="form-control bg-dark text-white border-secondary" name="email" value="{{ old('email') }}" required>
            </div>

            <div class="row g-2 mb-3">
                <div class="col-6">
                    <label class="form-label text-light small fw-bold">Country</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" name="country" value="{{ old('country', 'US') }}">
                </div>
                <div class="col-6">
                    <label class="form-label text-light small fw-bold">Phone</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" name="phone" value="{{ old('phone') }}">
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label text-light small fw-bold">Password</label>
                <input type="password" class="form-control bg-dark text-white border-secondary" name="password" required>
            </div>

            <div class="mb-4">
                <label class="form-label text-light small fw-bold">Confirm Password</label>
                <input type="password" class="form-control bg-dark text-white border-secondary" name="password_confirmation" required>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">Register & Open Wallet</button>
        </form>

        <div class="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
            <span class="text-muted small">Already have an account?</span>
            <a href="{{ route('login') }}" class="text-primary text-decoration-none small ms-1 fw-bold">Sign In</a>
        </div>
    </div>
</body>
</html>
