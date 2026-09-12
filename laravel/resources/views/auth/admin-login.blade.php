<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Operations Terminal - {{ config('broker.short_name', 'BrokerCRM') }}</title>
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
            --admin-bg: #040d21;
            --admin-card: #0b162c;
            --admin-border: #1f293d;
            --text-main: #f0f6fc;
            --text-sub: #8b949e;
            --input-bg: #071022;
            --input-border: #1f293d;
        }
        [data-bs-theme="light"] {
            --admin-bg: #f1f5f9;
            --admin-card: #ffffff;
            --admin-border: #cbd5e1;
            --text-main: #0f172a;
            --text-sub: #64748b;
            --input-bg: #ffffff;
            --input-border: #cbd5e1;
        }
        body {
            background-color: var(--admin-bg);
            color: var(--text-main);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            position: relative;
        }
        .admin-card {
            background: var(--admin-card);
            border: 1px solid var(--admin-border);
            border-radius: 16px;
            padding: 2.5rem 2.25rem;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
        }
        .form-control {
            background-color: var(--input-bg) !important;
            color: var(--text-main) !important;
            border-color: var(--input-border) !important;
            padding: 0.7rem 0.9rem;
            border-radius: 8px;
        }
        .form-control:focus {
            border-color: #238636 !important;
            box-shadow: 0 0 0 3px rgba(35, 134, 54, 0.25) !important;
        }
        .terminal-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(35, 134, 54, 0.15);
            color: #3fb950;
            border: 1px solid rgba(63, 185, 80, 0.3);
            border-radius: 20px;
            padding: 0.35rem 0.85rem;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-bottom: 1.25rem;
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

    <div class="admin-card">
        <div class="text-center mb-4">
            <div class="terminal-badge">
                <i class="bi bi-shield-lock-fill"></i>
                <span>Admin Operations Terminal</span>
            </div>
            <h4 class="fw-bold mb-1">{{ config('broker.name', 'Forex Broker CRM') }}</h4>
            <p class="text-muted small mb-0">Authorized Administrative Personnel Only</p>
        </div>

        @if ($errors->any())
            <div class="alert alert-danger py-2 px-3 small mb-3 border-danger border-opacity-25">
                @foreach ($errors->all() as $error)
                    <div><i class="bi bi-exclamation-triangle-fill me-1"></i> {{ $error }}</div>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('admin.login') }}">
            @csrf
            <div class="mb-3">
                <label for="email" class="form-label small fw-bold mb-1">Administrator Email</label>
                <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 border-secondary text-muted">
                        <i class="bi bi-person-badge"></i>
                    </span>
                    <input type="email" class="form-control border-start-0" id="email" name="email" value="{{ old('email') }}" required autofocus placeholder="admin@broker.com">
                </div>
            </div>

            <div class="mb-4">
                <label for="password" class="form-label small fw-bold mb-1">Master Password</label>
                <div class="input-group">
                    <span class="input-group-text bg-transparent border-end-0 border-secondary text-muted">
                        <i class="bi bi-key-fill"></i>
                    </span>
                    <input type="password" class="form-control border-start-0 border-end-0" id="password" name="password" required placeholder="Enter administrative password">
                    <button class="btn btn-outline-secondary border-start-0 border-secondary" type="button" id="toggleAdminPasswordBtn" title="Show password">
                        <i class="bi bi-eye" id="adminPasswordEyeIcon"></i>
                    </button>
                </div>
            </div>

            <button type="submit" class="btn btn-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm">
                <i class="bi bi-shield-check"></i>
                <span>Authenticate Terminal</span>
            </button>
        </form>

        <div class="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
            <span class="text-muted small">Need Client Access?</span>
            <a href="{{ route('login') }}" class="text-info text-decoration-none small ms-1 fw-bold">Go to Client Portal &rarr;</a>
        </div>
    </div>

    <script>
        // Password toggle
        document.getElementById('toggleAdminPasswordBtn').addEventListener('click', function() {
            const input = document.getElementById('password');
            const icon = document.getElementById('adminPasswordEyeIcon');
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
