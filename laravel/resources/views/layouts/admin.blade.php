<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-100" data-bs-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('title', 'Admin Portal') - {{ config('broker.name', 'Forex Broker CRM') }} Admin</title>
    <link rel="icon" href="{{ config('broker.favicon_url', '/assets/img/favicon.ico') }}">

    <!-- Bootstrap 5.3 CDN -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <script>
        (function() {
            const savedTheme = localStorage.getItem('forex_theme') || 'dark';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
        })();
    </script>

    <!-- Admin Fintech Slate Theme -->
    <style>
        :root,
        [data-bs-theme="dark"] {
            --fx-admin-bg: #0d1117;
            --fx-admin-surface: #161b22;
            --fx-admin-card: #21262d;
            --fx-admin-border: #30363d;
            --fx-admin-text: #c9d1d9;
            --fx-admin-accent: #238636;
            --fx-admin-accent-hover: #2ea043;
            --fx-admin-sidebar-width: 260px;
            --fx-admin-header-height: 64px;

            /* Native Bootstrap 5.3 Dark-Mode Native CSS Variables Override */
            --bs-body-color: #f0f6fc;
            --bs-body-color-rgb: 240, 246, 252;
            --bs-body-bg: #0d1117;
            --bs-body-bg-rgb: 13, 17, 23;
            --bs-secondary-color: #8b949e;
            --bs-secondary-color-rgb: 139, 148, 158;
            --bs-tertiary-color: #c9d1d9;
            --bs-tertiary-color-rgb: 201, 209, 217;
            --bs-emphasis-color: #ffffff;
            --bs-emphasis-color-rgb: 255, 255, 255;
            --bs-heading-color: #ffffff;
            --bs-link-color: #58a6ff;
            --bs-link-hover-color: #79b8ff;
            --bs-border-color: #30363d;
            --bs-border-color-translucent: rgba(48, 54, 61, 0.6);
            --bs-card-bg: #21262d;
            --bs-card-color: #f0f6fc;
            --bs-card-border-color: #30363d;
            --bs-card-title-color: #ffffff;
            --bs-card-subtitle-color: #c9d1d9;
            --bs-table-color: #f0f6fc;
            --bs-table-bg: transparent;
            --bs-table-border-color: #30363d;
            --bs-table-striped-color: #f0f6fc;
            --bs-table-striped-bg: rgba(255, 255, 255, 0.02);
            --bs-table-hover-color: #ffffff;
            --bs-table-hover-bg: rgba(255, 255, 255, 0.04);
        }

        body {
            background-color: var(--fx-admin-bg);
            color: var(--fx-admin-text);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow-x: hidden;
        }

        #admin-wrapper {
            display: flex;
            min-height: 100vh;
        }

        .fx-admin-sidebar {
            width: var(--fx-admin-sidebar-width);
            background-color: var(--fx-admin-surface);
            border-right: 1px solid var(--fx-admin-border);
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            z-index: 1030;
            display: flex;
            flex-direction: column;
            transition: transform 0.25s ease;
        }

        .fx-admin-brand {
            height: var(--fx-admin-header-height);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.25rem;
            border-bottom: 1px solid var(--fx-admin-border);
            color: #fff;
            text-decoration: none;
            font-weight: 700;
        }

        .fx-admin-menu {
            padding: 1rem 0.75rem;
            flex-grow: 1;
            overflow-y: auto;
        }

        .fx-admin-nav-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.7rem 1rem;
            color: #8b949e;
            text-decoration: none;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            margin-bottom: 0.2rem;
            transition: all 0.15s ease;
        }

        .fx-admin-nav-item:hover {
            color: #f0f6fc;
            background-color: var(--fx-admin-card);
        }

        .fx-admin-nav-item.active {
            color: #ffffff;
            background-color: #1f6feb;
            font-weight: 600;
        }

        .fx-admin-main {
            margin-left: var(--fx-admin-sidebar-width);
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .fx-admin-header {
            height: var(--fx-admin-header-height);
            background-color: var(--fx-admin-surface);
            border-bottom: 1px solid var(--fx-admin-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.5rem;
            position: sticky;
            top: 0;
            z-index: 1020;
        }

        .fx-admin-card {
            background-color: var(--fx-admin-card);
            border: 1px solid var(--fx-admin-border);
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 1.25rem;
        }

        @media (max-width: 991.98px) {
            .fx-admin-sidebar {
                transform: translateX(-100%);
            }
            .fx-admin-sidebar.show {
                transform: translateX(0);
            }
            .fx-admin-main {
                margin-left: 0;
            }
        }

        /* ==========================================================================
           GLOBAL UI CONTRAST & VISIBILITY OVERRIDES (WCAG COMPLIANT)
           ========================================================================== */

        /* --- GLOBAL HIGH-CONTRAST TEXT UTILITIES --- */
        .text-muted,
        [class*="text-muted"] {
            color: #8b949e !important;
        }

        .text-secondary,
        [class*="text-secondary"] {
            color: #c9d1d9 !important;
        }

        .text-light,
        [class*="text-light"] {
            color: #f0f6fc !important;
        }

        .text-white,
        [class*="text-white"] {
            color: #ffffff !important;
        }

        .text-body,
        [class*="text-body"] {
            color: #f0f6fc !important;
        }

        .text-body-secondary {
            color: #8b949e !important;
        }

        .text-body-tertiary {
            color: #c9d1d9 !important;
        }

        .text-primary,
        [class*="text-primary"]:not(.btn):not(.badge) {
            color: #58a6ff !important;
        }

        .text-success,
        [class*="text-success"]:not(.btn):not(.badge) {
            color: #3fb950 !important;
        }

        .text-danger,
        [class*="text-danger"]:not(.btn):not(.badge) {
            color: #f85149 !important;
        }

        .text-warning,
        [class*="text-warning"]:not(.btn):not(.badge) {
            color: #e3b341 !important;
        }

        .text-info,
        [class*="text-info"]:not(.btn):not(.badge) {
            color: #38bdf8 !important;
        }

        .text-dark {
            color: #1a1200 !important;
        }

        /* Style marker classes */
        .style-sm {
            color: #8b949e !important;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            font-weight: 600;
        }

        .style-xs {
            color: #8b949e !important;
            font-size: 0.7rem;
            font-weight: 600;
        }

        /* Headings & Card Headings */
        h1, h2, h3, h4, h5, h6,
        .h1, .h2, .h3, .h4, .h5, .h6 {
            color: #ffffff;
        }

        .card-title,
        .fx-admin-card h1, .fx-admin-card h2, .fx-admin-card h3, .fx-admin-card h4, .fx-admin-card h5, .fx-admin-card h6 {
            color: #ffffff !important;
        }

        .card-subtitle,
        .card-header {
            color: #c9d1d9;
        }

        .card {
            background-color: var(--fx-admin-card, #21262d);
            border-color: var(--fx-admin-border, #30363d);
            color: #f0f6fc;
        }

        /* --- TABLE HEADINGS & CELLS --- */
        .table,
        .table-dark {
            color: #f0f6fc;
            --bs-table-color: #f0f6fc;
            --bs-table-bg: transparent;
        }

        .table th,
        .table thead th,
        .table-dark th,
        .table thead.text-muted th,
        .table thead tr.text-muted th,
        tr.text-muted th,
        thead.text-muted,
        thead th {
            color: #c9d1d9 !important;
            font-weight: 600;
            letter-spacing: 0.03em;
            border-bottom: 1px solid var(--fx-admin-border, #30363d) !important;
        }

        .table td,
        .table-dark td {
            color: #f0f6fc;
            border-bottom: 1px solid var(--fx-admin-border, #30363d) !important;
        }

        .table td.text-muted,
        .table td .text-muted,
        .table-dark td.text-muted,
        .table-dark td .text-muted {
            color: #8b949e !important;
        }

        .table td a:not(.btn):not(.badge) {
            color: #58a6ff;
            text-decoration: none;
        }

        .table td a:not(.btn):not(.badge):hover {
            color: #79b8ff;
            text-decoration: underline;
        }

        /* --- FORM LABELS & INPUTS --- */
        .form-label,
        label.form-label,
        label.form-label.text-muted,
        label.form-label.text-secondary,
        label {
            color: #c9d1d9 !important;
            font-weight: 500;
        }

        .form-text,
        .form-text.text-muted,
        .form-text.text-secondary {
            color: #8b949e !important;
        }

        .form-control,
        .form-select {
            background-color: #161b22 !important;
            color: #f0f6fc !important;
            border-color: #30363d !important;
        }

        .form-control:focus,
        .form-select:focus {
            background-color: #161b22 !important;
            color: #ffffff !important;
            border-color: #58a6ff !important;
            box-shadow: 0 0 0 0.25rem rgba(88, 166, 255, 0.25) !important;
        }

        .form-control::placeholder {
            color: #6e7681 !important;
            opacity: 1 !important;
        }

        .form-control:disabled,
        .form-control[readonly],
        .form-select:disabled {
            background-color: rgba(22, 27, 34, 0.6) !important;
            color: #8b949e !important;
            border-color: #30363d !important;
            opacity: 0.8 !important;
        }

        .input-group-text {
            background-color: #161b22 !important;
            color: #c9d1d9 !important;
            border-color: #30363d !important;
        }

        .input-group-text.text-muted {
            color: #c9d1d9 !important;
        }

        /* --- MODALS & DROPDOWNS --- */
        .modal-content {
            background-color: var(--fx-admin-card, #21262d) !important;
            color: #f0f6fc !important;
            border: 1px solid var(--fx-admin-border, #30363d) !important;
        }

        .modal-header {
            border-bottom: 1px solid var(--fx-admin-border, #30363d) !important;
            color: #ffffff !important;
        }

        .modal-title {
            color: #ffffff !important;
        }

        .modal-footer {
            border-top: 1px solid var(--fx-admin-border, #30363d) !important;
        }

        .dropdown-menu {
            background-color: var(--fx-admin-surface, #161b22) !important;
            color: #f0f6fc !important;
            border: 1px solid var(--fx-admin-border, #30363d) !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
        }

        .dropdown-item {
            color: #c9d1d9 !important;
        }

        .dropdown-item:hover,
        .dropdown-item:focus {
            background-color: rgba(88, 166, 255, 0.15) !important;
            color: #ffffff !important;
        }

        .dropdown-divider {
            border-color: var(--fx-admin-border, #30363d) !important;
        }

        /* --- DISABLED BUTTONS & LINKS --- */
        .btn:disabled,
        .btn.disabled,
        fieldset:disabled .btn {
            color: #8b949e !important;
            background-color: rgba(33, 38, 45, 0.6) !important;
            border-color: rgba(48, 54, 61, 0.6) !important;
            opacity: 0.65 !important;
            cursor: not-allowed;
        }

        .btn-link {
            color: #58a6ff !important;
        }

        .btn-link:hover {
            color: #79b8ff !important;
        }

        /* --- TABS & TAB CONTROLS --- */
        .nav-tabs,
        .nav-tabs-dark {
            border-bottom: 1px solid var(--fx-admin-border, #30363d);
            gap: 4px;
        }

        .nav-tabs .nav-item,
        .nav-tabs-dark .nav-item {
            margin-bottom: -1px;
        }

        /* Inactive Tab Styling */
        .nav-tabs .nav-link,
        .nav-tabs-dark .nav-link {
            color: #8b949e !important;
            background-color: transparent !important;
            border: 1px solid transparent !important;
            border-radius: 6px 6px 0 0 !important;
            padding: 0.6rem 1.15rem !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }

        .nav-tabs .nav-link:hover,
        .nav-tabs .nav-link:focus,
        .nav-tabs-dark .nav-link:hover,
        .nav-tabs-dark .nav-link:focus {
            color: #ffffff !important;
            background-color: rgba(255, 255, 255, 0.08) !important;
            border-color: rgba(255, 255, 255, 0.15) rgba(255, 255, 255, 0.15) transparent !important;
        }

        /* Active Tab Styling - High contrast vivid blue with crisp white text */
        .nav-tabs .nav-link.active,
        .nav-tabs .nav-item.show .nav-link,
        .nav-tabs-dark .nav-link.active,
        .nav-tabs-dark .nav-item.show .nav-link {
            color: #ffffff !important;
            background-color: #1f6feb !important;
            border-color: #1f6feb #1f6feb transparent !important;
            font-weight: 600 !important;
            box-shadow: 0 2px 8px rgba(31, 111, 235, 0.4);
        }

        /* Fallback: If an active tab is rendered with light or white background */
        .nav-tabs .nav-link.active.bg-white,
        .nav-tabs .nav-link.active.bg-light,
        .bg-white .nav-tabs .nav-link.active,
        .bg-light .nav-tabs .nav-link.active,
        .nav-tabs-light .nav-link.active {
            background-color: #ffffff !important;
            color: #0b1120 !important;
            border-color: #cbd5e1 #cbd5e1 #ffffff !important;
            font-weight: 600 !important;
        }

        /* --- BADGES & STATUS LABELS --- */
        .badge {
            font-weight: 600 !important;
            letter-spacing: 0.02em;
            padding: 0.35em 0.65em;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            line-height: 1.2;
        }

        /* Solid Bright Badges: High Contrast Dark Text */
        .badge.bg-info:not([class*="bg-opacity-"]),
        .badge.text-bg-info {
            background-color: #0ea5e9 !important;
            color: #041f29 !important;
        }

        .badge.bg-warning:not([class*="bg-opacity-"]),
        .badge.text-bg-warning {
            background-color: #f59e0b !important;
            color: #1a1200 !important;
        }

        .badge.bg-light:not([class*="bg-opacity-"]),
        .badge.text-bg-light {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
        }

        /* Solid Dark / Colored Badges: High Contrast White Text */
        .badge.bg-success:not([class*="bg-opacity-"]),
        .badge.text-bg-success {
            background-color: #238636 !important;
            color: #ffffff !important;
        }

        .badge.bg-danger:not([class*="bg-opacity-"]),
        .badge.text-bg-danger {
            background-color: #da3633 !important;
            color: #ffffff !important;
        }

        .badge.bg-primary:not([class*="bg-opacity-"]),
        .badge.text-bg-primary {
            background-color: #1f6feb !important;
            color: #ffffff !important;
        }

        .badge.bg-secondary:not([class*="bg-opacity-"]),
        .badge.text-bg-secondary {
            background-color: #484f58 !important;
            color: #ffffff !important;
        }

        .badge.bg-dark:not([class*="bg-opacity-"]),
        .badge.text-bg-dark {
            background-color: #161b22 !important;
            color: #f0f6fc !important;
            border: 1px solid #30363d !important;
        }

        /* Translucent / Soft Badges with Opacity - High Contrast Foreground on Dark Surfaces */
        .badge.bg-info[class*="bg-opacity-"],
        .badge[class*="bg-info"][class*="bg-opacity-"] {
            background-color: rgba(14, 165, 233, 0.18) !important;
            color: #38bdf8 !important;
            border: 1px solid rgba(56, 189, 248, 0.35) !important;
        }

        .badge.bg-success[class*="bg-opacity-"],
        .badge[class*="bg-success"][class*="bg-opacity-"] {
            background-color: rgba(35, 134, 54, 0.2) !important;
            color: #3fb950 !important;
            border: 1px solid rgba(63, 185, 80, 0.35) !important;
        }

        .badge.bg-warning[class*="bg-opacity-"],
        .badge[class*="bg-warning"][class*="bg-opacity-"] {
            background-color: rgba(210, 153, 34, 0.2) !important;
            color: #e3b341 !important;
            border: 1px solid rgba(227, 179, 65, 0.35) !important;
        }

        .badge.bg-danger[class*="bg-opacity-"],
        .badge[class*="bg-danger"][class*="bg-opacity-"] {
            background-color: rgba(218, 54, 51, 0.2) !important;
            color: #f85149 !important;
            border: 1px solid rgba(248, 81, 73, 0.35) !important;
        }

        .badge.bg-primary[class*="bg-opacity-"],
        .badge[class*="bg-primary"][class*="bg-opacity-"] {
            background-color: rgba(31, 111, 235, 0.2) !important;
            color: #58a6ff !important;
            border: 1px solid rgba(88, 166, 255, 0.35) !important;
        }

        .badge.bg-secondary[class*="bg-opacity-"],
        .badge[class*="bg-secondary"][class*="bg-opacity-"] {
            background-color: rgba(110, 118, 129, 0.18) !important;
            color: #c9d1d9 !important;
            border: 1px solid rgba(201, 209, 217, 0.28) !important;
        }

        .badge.bg-purple,
        .badge[class*="bg-purple"] {
            background-color: rgba(168, 85, 247, 0.2) !important;
            color: #d2a8ff !important;
            border: 1px solid rgba(210, 168, 255, 0.35) !important;
        }

        /* --- BUTTONS & FILTER CONTROLS --- */
        .btn {
            font-weight: 500;
            transition: all 0.15s ease-in-out;
        }

        /* Solid Buttons */
        .btn-primary {
            color: #ffffff !important;
            background-color: #1f6feb !important;
            border-color: #1f6feb !important;
        }
        .btn-primary:hover,
        .btn-primary:focus,
        .btn-primary:active {
            color: #ffffff !important;
            background-color: #388bfd !important;
            border-color: #388bfd !important;
        }

        .btn-warning {
            color: #1a1200 !important;
            background-color: #d29922 !important;
            border-color: #d29922 !important;
            font-weight: 600 !important;
        }
        .btn-warning:hover,
        .btn-warning:focus,
        .btn-warning:active {
            color: #1a1200 !important;
            background-color: #bb8009 !important;
            border-color: #bb8009 !important;
        }

        .btn-info {
            color: #041f29 !important;
            background-color: #0ea5e9 !important;
            border-color: #0ea5e9 !important;
            font-weight: 600 !important;
        }
        .btn-info:hover,
        .btn-info:focus,
        .btn-info:active {
            color: #041f29 !important;
            background-color: #0284c7 !important;
            border-color: #0284c7 !important;
        }

        .btn-success {
            color: #ffffff !important;
            background-color: #238636 !important;
            border-color: #238636 !important;
        }
        .btn-success:hover,
        .btn-success:focus,
        .btn-success:active {
            color: #ffffff !important;
            background-color: #2ea043 !important;
            border-color: #2ea043 !important;
        }

        .btn-danger {
            color: #ffffff !important;
            background-color: #da3633 !important;
            border-color: #da3633 !important;
        }
        .btn-danger:hover,
        .btn-danger:focus,
        .btn-danger:active {
            color: #ffffff !important;
            background-color: #f85149 !important;
            border-color: #f85149 !important;
        }

        .btn-secondary {
            color: #ffffff !important;
            background-color: #30363d !important;
            border-color: #30363d !important;
        }
        .btn-secondary:hover,
        .btn-secondary:focus,
        .btn-secondary:active {
            color: #ffffff !important;
            background-color: #484f58 !important;
            border-color: #484f58 !important;
        }

        /* Outline Buttons with High Contrast Foreground */
        .btn-outline-secondary {
            color: #c9d1d9 !important;
            border-color: #484f58 !important;
            background-color: transparent !important;
        }
        .btn-outline-secondary:hover,
        .btn-outline-secondary:focus {
            color: #ffffff !important;
            background-color: #30363d !important;
            border-color: #8b949e !important;
        }
        .btn-outline-secondary.active,
        .btn-outline-secondary:active,
        .btn-check:checked + .btn-outline-secondary {
            color: #ffffff !important;
            background-color: #484f58 !important;
            border-color: #8b949e !important;
            font-weight: 600 !important;
        }

        .btn-outline-warning {
            color: #e3b341 !important;
            border-color: #d29922 !important;
            background-color: transparent !important;
        }
        .btn-outline-warning:hover,
        .btn-outline-warning:focus,
        .btn-outline-warning.active,
        .btn-outline-warning:active,
        .btn-check:checked + .btn-outline-warning {
            color: #1a1200 !important;
            background-color: #e3b341 !important;
            border-color: #e3b341 !important;
            font-weight: 600 !important;
        }

        .btn-outline-info {
            color: #38bdf8 !important;
            border-color: #0ea5e9 !important;
            background-color: transparent !important;
        }
        .btn-outline-info:hover,
        .btn-outline-info:focus,
        .btn-outline-info.active,
        .btn-outline-info:active,
        .btn-check:checked + .btn-outline-info {
            color: #041f29 !important;
            background-color: #38bdf8 !important;
            border-color: #38bdf8 !important;
            font-weight: 600 !important;
        }

        .btn-outline-success {
            color: #3fb950 !important;
            border-color: #238636 !important;
            background-color: transparent !important;
        }
        .btn-outline-success:hover,
        .btn-outline-success:focus,
        .btn-outline-success.active,
        .btn-outline-success:active,
        .btn-check:checked + .btn-outline-success {
            color: #ffffff !important;
            background-color: #238636 !important;
            border-color: #238636 !important;
            font-weight: 600 !important;
        }

        .btn-outline-danger {
            color: #f85149 !important;
            border-color: #da3633 !important;
            background-color: transparent !important;
        }
        .btn-outline-danger:hover,
        .btn-outline-danger:focus,
        .btn-outline-danger.active,
        .btn-outline-danger:active,
        .btn-check:checked + .btn-outline-danger {
            color: #ffffff !important;
            background-color: #da3633 !important;
            border-color: #da3633 !important;
            font-weight: 600 !important;
        }

        .btn-outline-light {
            color: #f0f6fc !important;
            border-color: #484f58 !important;
            background-color: transparent !important;
        }
        .btn-outline-light:hover,
        .btn-outline-light:focus,
        .btn-outline-light.active,
        .btn-outline-light:active {
            color: #0d1117 !important;
            background-color: #f0f6fc !important;
            border-color: #f0f6fc !important;
            font-weight: 600 !important;
        }

        .btn-outline-primary {
            color: #58a6ff !important;
            border-color: #1f6feb !important;
            background-color: transparent !important;
        }
        .btn-outline-primary:hover,
        .btn-outline-primary:focus,
        .btn-outline-primary.active,
        .btn-outline-primary:active {
            color: #ffffff !important;
            background-color: #1f6feb !important;
            border-color: #1f6feb !important;
            font-weight: 600 !important;
        }

        /* --- PAGINATION --- */
        .pagination {
            gap: 3px;
        }
        .page-link {
            background-color: var(--fx-admin-surface, #161b22) !important;
            border-color: var(--fx-admin-border, #30363d) !important;
            color: #c9d1d9 !important;
            font-size: 0.85rem;
            padding: 0.35rem 0.75rem;
            border-radius: 4px;
        }
        .page-link:hover {
            background-color: var(--fx-admin-card, #21262d) !important;
            color: #ffffff !important;
            border-color: #58a6ff !important;
        }
        .page-item.active .page-link {
            background-color: #1f6feb !important;
            border-color: #1f6feb !important;
            color: #ffffff !important;
            font-weight: 600;
        }
        .page-item.disabled .page-link {
            background-color: rgba(22, 27, 34, 0.5) !important;
            border-color: var(--fx-admin-border, #30363d) !important;
            color: #6e7681 !important;
        }

        /* --- FORMS & SELECTS --- */
        .form-select option {
            background-color: #161b22 !important;
            color: #f0f6fc !important;
        }

        /* --- ALERTS --- */
        .alert {
            font-weight: 500;
            border-radius: 6px;
        }
        .alert-danger,
        .alert.alert-danger {
            background-color: rgba(218, 54, 51, 0.15) !important;
            border-color: rgba(218, 54, 51, 0.35) !important;
            color: #f85149 !important;
        }
        .alert-success,
        .alert.alert-success {
            background-color: rgba(35, 134, 54, 0.15) !important;
            border-color: rgba(35, 134, 54, 0.35) !important;
            color: #3fb950 !important;
        }
        .alert-warning,
        .alert.alert-warning {
            background-color: rgba(210, 153, 34, 0.15) !important;
            border-color: rgba(210, 153, 34, 0.35) !important;
            color: #e3b341 !important;
        }
        .alert-info,
        .alert.alert-info {
            background-color: rgba(14, 165, 233, 0.15) !important;
            border-color: rgba(14, 165, 233, 0.35) !important;
            color: #38bdf8 !important;
        }

        /* --- LIGHT THEME COMPREHENSIVE OVERRIDES FOR ADMIN --- */
        [data-bs-theme="light"] {
            --fx-admin-bg: #f8fafc;
            --fx-admin-surface: #ffffff;
            --fx-admin-card: #ffffff;
            --fx-admin-border: #e2e8f0;
            --fx-admin-text: #1e293b;
            --fx-admin-accent: #16a34a;
            --fx-admin-accent-hover: #15803d;

            --bs-body-color: #0f172a;
            --bs-body-color-rgb: 15, 23, 42;
            --bs-body-bg: #f8fafc;
            --bs-body-bg-rgb: 248, 250, 252;
            --bs-secondary-color: #64748b;
            --bs-secondary-color-rgb: 100, 116, 139;
            --bs-tertiary-color: #334155;
            --bs-tertiary-color-rgb: 51, 65, 85;
            --bs-emphasis-color: #0f172a;
            --bs-emphasis-color-rgb: 15, 23, 42;
            --bs-heading-color: #0f172a;
            --bs-link-color: #2563eb;
            --bs-link-hover-color: #1d4ed8;
            --bs-border-color: #e2e8f0;
            --bs-border-color-translucent: rgba(226, 232, 240, 0.7);
            --bs-card-bg: #ffffff;
            --bs-card-color: #0f172a;
            --bs-card-border-color: #e2e8f0;
            --bs-card-title-color: #0f172a;
            --bs-card-subtitle-color: #475569;
            --bs-table-color: #0f172a;
            --bs-table-bg: #ffffff;
            --bs-table-border-color: #e2e8f0;
            --bs-table-striped-color: #0f172a;
            --bs-table-striped-bg: #f1f5f9;
            --bs-table-hover-color: #0f172a;
            --bs-table-hover-bg: #e2e8f0;
        }

        [data-bs-theme="light"] .text-white:not(.badge):not(.btn):not(.btn *):not(.badge *) {
            color: #0f172a !important;
        }
        [data-bs-theme="light"] .text-light {
            color: #334155 !important;
        }
        [data-bs-theme="light"] .text-muted {
            color: #64748b !important;
        }
        [data-bs-theme="light"] .fx-admin-brand {
            color: #0f172a !important;
            background-color: #ffffff;
        }
        [data-bs-theme="light"] .fx-admin-header {
            background-color: #ffffff !important;
            border-bottom-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .fx-admin-sidebar {
            background-color: #ffffff !important;
            border-right-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .fx-admin-nav-item {
            color: #475569;
        }
        [data-bs-theme="light"] .fx-admin-nav-item:hover {
            color: #0f172a;
            background-color: #f1f5f9;
        }
        [data-bs-theme="light"] .fx-admin-nav-item.active {
            color: #16a34a;
            background-color: #f0fdf4;
            border-left-color: #16a34a;
        }
        [data-bs-theme="light"] .fx-admin-card {
            background-color: #ffffff !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        [data-bs-theme="light"] .table-dark {
            background-color: #ffffff !important;
            color: #0f172a !important;
        }
        [data-bs-theme="light"] .table-dark th {
            background-color: #f8fafc !important;
            color: #475569 !important;
            border-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .table-dark td {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #f1f5f9 !important;
        }
        [data-bs-theme="light"] .bg-dark {
            background-color: #f8fafc !important;
        }
        [data-bs-theme="light"] .bg-black {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
        }
        [data-bs-theme="light"] .form-control,
        [data-bs-theme="light"] .form-select {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
        }
        [data-bs-theme="light"] .modal-content {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .modal-header,
        [data-bs-theme="light"] .modal-footer {
            border-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .dropdown-menu {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        [data-bs-theme="light"] .dropdown-item {
            color: #334155 !important;
        }
        [data-bs-theme="light"] .dropdown-item:hover {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
        }
        [data-bs-theme="light"] .btn-close-white {
            filter: none !important;
        }
    </style>

    @stack('styles')
</head>
<body>
    <div id="admin-wrapper">
        <!-- Admin Sidebar -->
        <aside class="fx-admin-sidebar" id="adminSidebar">
            <a href="{{ route('admin.dashboard') }}" class="fx-admin-brand">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-shield-lock-fill text-success fs-5"></i>
                    <span>CRM Admin</span>
                </div>
                <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25" style="font-size: 0.65rem;">v1.0</span>
            </a>

            <div class="fx-admin-menu">
                <div class="text-uppercase px-3 py-2 text-muted fw-bold" style="font-size: 0.65rem; letter-spacing: 0.08em; color: #8b949e !important;">Overview</div>

                <a href="{{ route('admin.dashboard') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.dashboard') ? 'active' : '' }}">
                    <i class="bi bi-speedometer2"></i>
                    <span>Dashboard</span>
                </a>

                <div class="text-uppercase px-3 pt-3 pb-2 text-muted fw-bold" style="font-size: 0.65rem; letter-spacing: 0.08em; color: #8b949e !important;">Client Management</div>

                <a href="{{ route('admin.clients.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.clients*') ? 'active' : '' }}">
                    <i class="bi bi-people-fill"></i>
                    <span>Clients</span>
                </a>

                <a href="{{ route('admin.kyc.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.kyc*') ? 'active' : '' }}">
                    <i class="bi bi-shield-check"></i>
                    <span>KYC Applications</span>
                </a>

                <a href="{{ route('admin.support.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.support*') ? 'active' : '' }}">
                    <i class="bi bi-headset"></i>
                    <span>Support Center</span>
                </a>

                <div class="text-uppercase px-3 pt-3 pb-2 text-muted fw-bold" style="font-size: 0.65rem; letter-spacing: 0.08em; color: #8b949e !important;">Finance Operations</div>

                <a href="{{ route('admin.deposits.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.deposits*') ? 'active' : '' }}">
                    <i class="bi bi-arrow-down-left-square-fill"></i>
                    <span>Deposits</span>
                </a>

                <a href="{{ route('admin.withdrawals.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.withdrawals*') ? 'active' : '' }}">
                    <i class="bi bi-arrow-up-right-square-fill"></i>
                    <span>Withdrawals</span>
                </a>

                <a href="{{ route('admin.transactions.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.transactions*') ? 'active' : '' }}">
                    <i class="bi bi-receipt"></i>
                    <span>Transactions</span>
                </a>

                <div class="text-uppercase px-3 pt-3 pb-2 text-muted fw-bold" style="font-size: 0.65rem; letter-spacing: 0.08em; color: #8b949e !important;">Trading Operations</div>

                <a href="{{ route('admin.trading-accounts.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.trading-accounts.index') ? 'active' : '' }}">
                    <i class="bi bi-person-lines-fill"></i>
                    <span>Trading Accounts</span>
                </a>

                <a href="{{ route('admin.trading-accounts.requests.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.trading-accounts.requests*') ? 'active' : '' }}">
                    <i class="bi bi-plus-circle-fill"></i>
                    <span>Account Requests</span>
                </a>

                <a href="{{ route('admin.trading-accounts.password-resets.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.trading-accounts.password-resets*') ? 'active' : '' }}">
                    <i class="bi bi-key-fill"></i>
                    <span>Password Resets</span>
                </a>

                <a href="{{ route('admin.fundings.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.fundings*') ? 'active' : '' }}">
                    <i class="bi bi-cash-stack"></i>
                    <span>Trading Funding</span>
                </a>

                <a href="{{ route('admin.returns.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.returns*') ? 'active' : '' }}">
                    <i class="bi bi-arrow-down-left-circle-fill"></i>
                    <span>Trading Returns</span>
                </a>

                <div class="text-uppercase px-3 pt-3 pb-2 text-muted fw-bold" style="font-size: 0.65rem; letter-spacing: 0.08em; color: #8b949e !important;">System & Security</div>

                <a href="{{ route('admin.audit-logs.index') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.audit-logs*') ? 'active' : '' }}">
                    <i class="bi bi-journal-text"></i>
                    <span>Audit Logs</span>
                </a>

                <a href="{{ route('admin.settings') }}" class="fx-admin-nav-item {{ request()->routeIs('admin.settings*') ? 'active' : '' }}">
                    <i class="bi bi-sliders"></i>
                    <span>Settings</span>
                </a>
            </div>

            <div class="p-3 border-top border-secondary border-opacity-25 bg-black bg-opacity-20">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="overflow-hidden">
                        <div class="text-white fw-bold text-truncate" style="font-size: 0.85rem;">{{ config('broker.name', 'Broker CRM') }}</div>
                        <div class="text-muted text-truncate" style="font-size: 0.725rem;">cPanel Multi-Tenant</div>
                    </div>
                    <form method="POST" action="{{ route('admin.logout') }}" class="d-inline" id="adminSidebarLogoutForm">
                        @csrf
                        <button type="submit" class="btn btn-outline-danger btn-sm p-1 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" title="Log Out" id="adminSidebarLogoutBtn" aria-label="Log Out">
                            <i class="bi bi-box-arrow-right"></i>
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        <!-- Admin Main Content Area -->
        <div class="fx-admin-main">
            <!-- Header -->
            <header class="fx-admin-header">
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-link text-white p-0 d-lg-none me-2" id="adminSidebarToggle" type="button">
                        <i class="bi bi-list fs-3"></i>
                    </button>
                    <span class="fw-bold text-white fs-5">
                        @yield('header_title', 'Admin Control Panel')
                    </span>
                </div>

                <div class="d-flex align-items-center gap-3">
                    <span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25 px-2 py-1 d-none d-sm-inline">
                        <i class="bi bi-building me-1"></i> {{ config('broker.short_name') }}
                    </span>

                    <!-- Theme Toggle -->
                    <button type="button" class="btn btn-outline-secondary border-opacity-25 text-white rounded-circle p-2 d-flex align-items-center justify-content-center theme-toggle-btn" id="adminThemeToggleBtn" style="width: 38px; height: 38px;" title="Toggle Dark/Light Mode" aria-label="Toggle theme">
                        <i class="bi bi-sun theme-icon-light d-none"></i>
                        <i class="bi bi-moon-stars theme-icon-dark"></i>
                    </button>

                    <div class="dropdown">
                        <button class="btn btn-dark border-secondary border-opacity-25 text-white dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                            <i class="bi bi-person-circle text-success"></i>
                            <span class="d-none d-md-inline">System Administrator</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">
                            <li><a class="dropdown-menu-item dropdown-item" href="{{ route('admin.settings') }}"><i class="bi bi-gear me-2"></i> Settings</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <form method="POST" action="{{ route('admin.logout') }}">
                                    @csrf
                                    <button type="submit" class="dropdown-item text-danger"><i class="bi bi-box-arrow-right me-2"></i> Log Out</button>
                                </form>
                            </li>
                        </ul>
                    </div>
                </div>
            </header>

            <!-- Content Area -->
            <div class="container-fluid p-3 p-md-4">
                <!-- Flash messages -->
                @if(session('success'))
                    <div class="alert alert-success bg-success bg-opacity-10 text-success border-success border-opacity-25 alert-dismissible fade show">
                        <i class="bi bi-check-circle-fill me-2"></i> {{ session('success') }}
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
                    </div>
                @endif

                @yield('content')
            </div>
        </div>
    </div>

    <!-- Bootstrap 5 JS Bundle CDN -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const toggle = document.getElementById('adminSidebarToggle');
            const sidebar = document.getElementById('adminSidebar');
            if(toggle && sidebar) {
                toggle.addEventListener('click', function() {
                    sidebar.classList.toggle('show');
                });
            }

            // Theme toggle logic
            function syncThemeIcons(theme) {
                document.querySelectorAll('.theme-icon-light').forEach(el => {
                    if (theme === 'light') el.classList.remove('d-none'); else el.classList.add('d-none');
                });
                document.querySelectorAll('.theme-icon-dark').forEach(el => {
                    if (theme === 'light') el.classList.add('d-none'); else el.classList.remove('d-none');
                });
            }

            const currentTheme = localStorage.getItem('forex_theme') || 'dark';
            document.documentElement.setAttribute('data-bs-theme', currentTheme);
            syncThemeIcons(currentTheme);

            document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const activeTheme = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-bs-theme', activeTheme);
                    localStorage.setItem('forex_theme', activeTheme);
                    syncThemeIcons(activeTheme);
                });
            });
        });
    </script>
    @stack('scripts')
</body>
</html>
