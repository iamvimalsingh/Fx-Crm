<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Sign In - {{ config('broker.name', 'Forex Broker CRM') }}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <script>
        (function() {
            const savedTheme = localStorage.getItem('forex_theme') || 'dark';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
        })();
    </script>
    <style>
        :root, [data-bs-theme="dark"] {
            --auth-bg: #0b0e14;
            --card-bg: #121824;
            --card-border: #26334d;
            --text-main: #f0f4f8;
            --text-sub: #94a3b8;
            --input-bg: #182030;
            --input-border: #26334d;
        }
        [data-bs-theme="light"] {
            --auth-bg: #f1f5f9;
            --card-bg: #ffffff;
            --card-border: #e2e8f0;
            --text-main: #0f172a;
            --text-sub: #64748b;
            --input-bg: #ffffff;
            --input-border: #cbd5e1;
        }
        body {
            background-color: var(--auth-bg);
            color: var(--text-main);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            position: relative;
        }
        .auth-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 2.5rem 2.25rem;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
        }
        .form-control {
            background-color: var(--input-bg) !important;
            color: var(--text-main) !important;
            border-color: var(--input-border) !important;
            padding: 0.7rem 0.9rem;
            border-radius: 8px;
        }
        .form-control:focus {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
        }
        .brand-icon {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
        }
        .theme-toggle-corner {
            position: absolute;
            top: 1rem;
            right: 1rem;
        }
    </style>
</head>
<body>
    <div class="theme-toggle-corner">
        <button type="button" class="btn btn-sm btn-outline-secondary border-opacity-25 rounded-circle p-2 theme-toggle-btn" id="themeToggleBtn" style="width: 36px; height: 36px;" title="Toggle Theme" aria-label="Toggle theme">
            <i class="bi bi-sun theme-icon-light d-none"></i>
            <i class="bi bi-moon-stars theme-icon-dark"></i>
        </button>
    </div>

    <div class="auth-card">
        <div class="text-center mb-4">
            <div class="brand-icon">
                <i class="bi bi-graph-up-arrow"></i>
            </div>
            <h4 class="fw-bold mb-1">{{ config('broker.name', 'Forex Broker CRM') }}</h4>
            <p class="text-muted small mb-0">Client Portal Sign In</p>
        </div>

        @if (session('status'))
            <div class="alert alert-success py-2 px-3 small mb-3 border-success border-opacity-25 d-flex align-items-center gap-2">
                <i class="bi bi-check-circle-fill"></i>
                <span>{{ session('status') }}</span>
            </div>
        @endif

        @if ($errors->any())
            <div class="alert alert-danger py-2 px-3 small mb-3 border-danger border-opacity-25">
                @foreach ($errors->all() as $error)
                    <div><i class="bi bi-exclamation-circle-fill me-1"></i> {{ $error }}</div>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('login') }}">
            @csrf
            <div class="mb-3">
                <label for="email" class="form-label small fw-bold mb-1">Email Address</label>
                <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 border-secondary text-muted">
                        <i class="bi bi-envelope"></i>
                    </span>
                    <input type="email" class="form-control border-start-0" id="email" name="email" value="{{ old('email') }}" required autofocus placeholder="trader@example.com">
                </div>
            </div>

            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label for="password" class="form-label small fw-bold mb-0">Password</label>
                    <a href="{{ route('password.request') }}" class="text-primary text-decoration-none small">Forgot Password?</a>
                </div>
                <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 border-secondary text-muted">
                        <i class="bi bi-lock"></i>
                    </span>
                    <input type="password" class="form-control border-start-0 border-end-0" id="password" name="password" required placeholder="Enter password">
                    <button class="btn btn-outline-secondary border-start-0 border-secondary" type="button" id="togglePasswordBtn" title="Show password">
                        <i class="bi bi-eye" id="passwordEyeIcon"></i>
                    </button>
                </div>
            </div>

            <div class="mb-4 form-check">
                <input type="checkbox" class="form-check-input" id="remember" name="remember">
                <label class="form-check-label text-muted small" for="remember">Remember me on this device</label>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm">
                <span>Sign In to Portal</span>
                <i class="bi bi-arrow-right"></i>
            </button>
        </form>

        <div class="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
            <span class="text-muted small">New to {{ config('broker.short_name', 'ForexCore') }}?</span>
            <a href="{{ route('register') }}" class="text-primary text-decoration-none small ms-1 fw-bold">Open Client Account</a>
        </div>
    </div>

    <script>
        // Password toggle
        document.getElementById('togglePasswordBtn').addEventListener('click', function() {
            const input = document.getElementById('password');
            const icon = document.getElementById('passwordEyeIcon');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'bi bi-eye';
            }
        });

        // Theme toggle
        const toggleBtn = document.getElementById('themeToggleBtn');
        function syncThemeIcons(theme) {
            document.querySelectorAll('.theme-icon-light').forEach(el => {
                if (theme === 'light') el.classList.remove('d-none'); else el.classList.add('d-none');
            });
            document.querySelectorAll('.theme-icon-dark').forEach(el => {
                if (theme === 'light') el.classList.add('d-none'); else el.classList.remove('d-none');
            });
        }
        syncThemeIcons(document.documentElement.getAttribute('data-bs-theme'));

        toggleBtn.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', current);
            localStorage.setItem('forex_theme', current);
            syncThemeIcons(current);
        });
    </script>
</body>
</html>
