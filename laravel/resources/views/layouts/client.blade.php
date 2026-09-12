<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-100" data-bs-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('title', 'Client Portal') - {{ config('broker.name', 'Forex Broker CRM') }}</title>
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

    <!-- Modern Fintech Dark/Neutral Slate Styles -->
    <style>
        :root,
        [data-bs-theme="dark"] {
            --fx-bg-main: #0b0e14;
            --fx-bg-surface: #121824;
            --fx-bg-card: #182030;
            --fx-bg-input: #1f2a3e;
            --fx-border: #26334d;
            --fx-text-primary: #f0f4f8;
            --fx-text-secondary: #cbd5e1;
            --fx-text-muted: #94a3b8;
            --fx-accent-primary: #3b82f6;
            --fx-accent-hover: #2563eb;
            --fx-accent-success: #10b981;
            --fx-accent-danger: #ef4444;
            --fx-accent-warning: #f59e0b;
            --fx-sidebar-width: 240px;
            --fx-bottom-nav-height: 64px;
            --fx-header-height: 60px;

            /* Native Bootstrap 5.3 Theme Overrides */
            --bs-body-color: #f0f4f8;
            --bs-body-color-rgb: 240, 244, 248;
            --bs-body-bg: #0b0e14;
            --bs-body-bg-rgb: 11, 14, 20;
            --bs-secondary-color: #94a3b8;
            --bs-secondary-color-rgb: 148, 163, 184;
            --bs-tertiary-color: #cbd5e1;
            --bs-tertiary-color-rgb: 203, 213, 225;
            --bs-emphasis-color: #ffffff;
            --bs-emphasis-color-rgb: 255, 255, 255;
            --bs-heading-color: #ffffff;
            --bs-link-color: #60a5fa;
            --bs-link-hover-color: #93c5fd;
            --bs-border-color: #26334d;
            --bs-border-color-translucent: rgba(38, 51, 77, 0.6);
            --bs-card-bg: #182030;
            --bs-card-color: #f0f4f8;
            --bs-card-border-color: #26334d;
            --bs-card-title-color: #ffffff;
            --bs-card-subtitle-color: #cbd5e1;
            --bs-table-color: #f0f4f8;
            --bs-table-bg: transparent;
            --bs-table-border-color: #26334d;
            --bs-table-striped-color: #f0f4f8;
            --bs-table-striped-bg: rgba(255, 255, 255, 0.02);
            --bs-table-hover-color: #ffffff;
            --bs-table-hover-bg: rgba(255, 255, 255, 0.04);
        }

        body {
            background-color: var(--fx-bg-main);
            color: var(--fx-text-primary);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow-x: hidden;
            -webkit-tap-highlight-color: transparent;
        }

        /* Desktop Layout */
        #app-wrapper {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar Styling */
        .fx-sidebar {
            width: var(--fx-sidebar-width);
            background-color: var(--fx-bg-surface);
            border-right: 1px solid var(--fx-border);
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            z-index: 1030;
            display: flex;
            flex-direction: column;
            transition: transform 0.25s ease-in-out;
        }

        .fx-sidebar-brand {
            height: var(--fx-header-height);
            display: flex;
            align-items: center;
            padding: 0 1.25rem;
            border-bottom: 1px solid var(--fx-border);
            font-weight: 700;
            font-size: 1.1rem;
            color: #fff;
            text-decoration: none;
        }

        .fx-sidebar-menu {
            padding: 1rem 0.75rem;
            flex-grow: 1;
            overflow-y: auto;
        }

        .fx-nav-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            color: var(--fx-text-secondary);
            text-decoration: none;
            border-radius: 8px;
            font-size: 0.925rem;
            font-weight: 500;
            margin-bottom: 0.25rem;
            transition: all 0.15s ease;
        }

        .fx-nav-item:hover {
            color: #fff;
            background-color: var(--fx-bg-card);
        }

        .fx-nav-item.active {
            color: #fff;
            background-color: var(--fx-accent-primary);
            font-weight: 600;
        }

        .fx-nav-item i {
            font-size: 1.15rem;
        }

        /* Main Content Area */
        .fx-main-content {
            margin-left: var(--fx-sidebar-width);
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding-bottom: calc(var(--fx-bottom-nav-height) + 1rem);
        }

        /* Header Navbar */
        .fx-top-header {
            height: var(--fx-header-height);
            background-color: var(--fx-bg-surface);
            border-bottom: 1px solid var(--fx-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.25rem;
            position: sticky;
            top: 0;
            z-index: 1020;
        }

        .fx-card {
            background-color: var(--fx-bg-card);
            border: 1px solid var(--fx-border);
            border-radius: 12px;
            padding: 1.25rem;
            margin-bottom: 1.25rem;
        }

        /* Mobile Bottom Nav */
        .fx-bottom-nav {
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: var(--fx-bottom-nav-height);
            background-color: var(--fx-bg-surface);
            border-top: 1px solid var(--fx-border);
            z-index: 1040;
            padding: 0 0.5rem;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.4);
        }

        .fx-bottom-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--fx-text-muted);
            text-decoration: none;
            font-size: 0.725rem;
            font-weight: 500;
            gap: 2px;
            transition: color 0.15s ease;
        }

        .fx-bottom-nav-item i {
            font-size: 1.25rem;
        }

        .fx-bottom-nav-item.active {
            color: var(--fx-accent-primary);
            font-weight: 600;
        }

        /* Responsive Breakpoints */
        @media (max-width: 991.98px) {
            .fx-sidebar {
                transform: translateX(-100%);
            }
            .fx-sidebar.show {
                transform: translateX(0);
            }
            .fx-main-content {
                margin-left: 0;
            }
            .fx-bottom-nav {
                display: flex;
            }
        }

        @media (min-width: 992px) {
            .fx-main-content {
                padding-bottom: 2rem;
            }
        }

        /* ==========================================================================
           GLOBAL UI CONTRAST & VISIBILITY OVERRIDES (WCAG COMPLIANT)
           ========================================================================== */

        /* --- GLOBAL HIGH-CONTRAST TEXT UTILITIES --- */
        .text-muted,
        [class*="text-muted"] {
            color: #94a3b8 !important;
        }

        .text-secondary,
        [class*="text-secondary"] {
            color: #cbd5e1 !important;
        }

        .text-light,
        [class*="text-light"] {
            color: #f8fafc !important;
        }

        .text-white,
        [class*="text-white"] {
            color: #ffffff !important;
        }

        .text-body,
        [class*="text-body"] {
            color: #f0f4f8 !important;
        }

        .text-body-secondary {
            color: #94a3b8 !important;
        }

        .text-body-tertiary {
            color: #cbd5e1 !important;
        }

        .text-primary,
        [class*="text-primary"]:not(.btn):not(.badge) {
            color: #60a5fa !important;
        }

        .text-success,
        [class*="text-success"]:not(.btn):not(.badge) {
            color: #34d399 !important;
        }

        .text-danger,
        [class*="text-danger"]:not(.btn):not(.badge) {
            color: #f87171 !important;
        }

        .text-warning,
        [class*="text-warning"]:not(.btn):not(.badge) {
            color: #fbbf24 !important;
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
            color: #94a3b8 !important;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            font-weight: 600;
        }

        .style-xs {
            color: #94a3b8 !important;
            font-size: 0.7rem;
            font-weight: 600;
        }

        /* Headings & Card Headings */
        h1, h2, h3, h4, h5, h6,
        .h1, .h2, .h3, .h4, .h5, .h6 {
            color: #ffffff;
        }

        .card-title,
        .fx-card h1, .fx-card h2, .fx-card h3, .fx-card h4, .fx-card h5, .fx-card h6 {
            color: #ffffff !important;
        }

        .card-subtitle,
        .card-header {
            color: #cbd5e1;
        }

        .card {
            background-color: var(--fx-bg-card, #182030);
            border-color: var(--fx-border, #26334d);
            color: #f0f4f8;
        }

        /* --- TABLE HEADINGS & CELLS --- */
        .table,
        .table-dark {
            color: #f0f4f8;
            --bs-table-color: #f0f4f8;
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
            color: #cbd5e1 !important;
            font-weight: 600;
            letter-spacing: 0.03em;
            border-bottom: 1px solid var(--fx-border, #26334d) !important;
        }

        .table td,
        .table-dark td {
            color: #f0f4f8;
            border-bottom: 1px solid var(--fx-border, #26334d) !important;
        }

        .table td.text-muted,
        .table td .text-muted,
        .table-dark td.text-muted,
        .table-dark td .text-muted {
            color: #94a3b8 !important;
        }

        .table td a:not(.btn):not(.badge) {
            color: #60a5fa;
            text-decoration: none;
        }

        .table td a:not(.btn):not(.badge):hover {
            color: #93c5fd;
            text-decoration: underline;
        }

        /* --- FORM LABELS & INPUTS --- */
        .form-label,
        label.form-label,
        label.form-label.text-muted,
        label.form-label.text-secondary,
        label {
            color: #cbd5e1 !important;
            font-weight: 500;
        }

        .form-text,
        .form-text.text-muted,
        .form-text.text-secondary {
            color: #94a3b8 !important;
        }

        .form-control,
        .form-select {
            background-color: var(--fx-bg-input, #1f2a3e) !important;
            color: #f8fafc !important;
            border-color: var(--fx-border, #26334d) !important;
        }

        .form-control:focus,
        .form-select:focus {
            background-color: var(--fx-bg-input, #1f2a3e) !important;
            color: #ffffff !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 0.25rem rgba(59, 130, 246, 0.25) !important;
        }

        .form-control::placeholder {
            color: #64748b !important;
            opacity: 1 !important;
        }

        .form-control:disabled,
        .form-control[readonly],
        .form-select:disabled {
            background-color: rgba(18, 24, 36, 0.6) !important;
            color: #94a3b8 !important;
            border-color: var(--fx-border, #26334d) !important;
            opacity: 0.8 !important;
        }

        .input-group-text {
            background-color: var(--fx-bg-surface, #121824) !important;
            color: #cbd5e1 !important;
            border-color: var(--fx-border, #26334d) !important;
        }

        .input-group-text.text-muted {
            color: #cbd5e1 !important;
        }

        /* --- MODALS & DROPDOWNS --- */
        .modal-content {
            background-color: var(--fx-bg-card, #182030) !important;
            color: #f0f4f8 !important;
            border: 1px solid var(--fx-border, #26334d) !important;
        }

        .modal-header {
            border-bottom: 1px solid var(--fx-border, #26334d) !important;
            color: #ffffff !important;
        }

        .modal-title {
            color: #ffffff !important;
        }

        .modal-footer {
            border-top: 1px solid var(--fx-border, #26334d) !important;
        }

        .dropdown-menu {
            background-color: var(--fx-bg-surface, #121824) !important;
            color: #f0f4f8 !important;
            border: 1px solid var(--fx-border, #26334d) !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
        }

        .dropdown-item {
            color: #cbd5e1 !important;
        }

        .dropdown-item:hover,
        .dropdown-item:focus {
            background-color: rgba(59, 130, 246, 0.15) !important;
            color: #ffffff !important;
        }

        .dropdown-divider {
            border-color: var(--fx-border, #26334d) !important;
        }

        /* --- DISABLED BUTTONS & LINKS --- */
        .btn:disabled,
        .btn.disabled,
        fieldset:disabled .btn {
            color: #94a3b8 !important;
            background-color: rgba(30, 41, 59, 0.6) !important;
            border-color: rgba(51, 65, 85, 0.6) !important;
            opacity: 0.65 !important;
            cursor: not-allowed;
        }

        .btn-link {
            color: #60a5fa !important;
        }

        .btn-link:hover {
            color: #93c5fd !important;
        }

        /* --- TABS & TAB CONTROLS --- */
        .nav-tabs,
        .nav-tabs-dark {
            border-bottom: 1px solid var(--fx-border, #26334d);
            gap: 4px;
        }

        .nav-tabs .nav-item,
        .nav-tabs-dark .nav-item {
            margin-bottom: -1px;
        }

        /* Inactive Tab Styling */
        .nav-tabs .nav-link,
        .nav-tabs-dark .nav-link {
            color: #94a3b8 !important;
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
            background-color: #2563eb !important;
            border-color: #2563eb #2563eb transparent !important;
            font-weight: 600 !important;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
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
            background-color: #10b981 !important;
            color: #ffffff !important;
        }

        .badge.bg-danger:not([class*="bg-opacity-"]),
        .badge.text-bg-danger {
            background-color: #ef4444 !important;
            color: #ffffff !important;
        }

        .badge.bg-primary:not([class*="bg-opacity-"]),
        .badge.text-bg-primary {
            background-color: #2563eb !important;
            color: #ffffff !important;
        }

        .badge.bg-secondary:not([class*="bg-opacity-"]),
        .badge.text-bg-secondary {
            background-color: #475569 !important;
            color: #ffffff !important;
        }

        .badge.bg-dark:not([class*="bg-opacity-"]),
        .badge.text-bg-dark {
            background-color: #0f172a !important;
            color: #f8fafc !important;
            border: 1px solid #334155 !important;
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
            background-color: rgba(16, 185, 129, 0.18) !important;
            color: #34d399 !important;
            border: 1px solid rgba(52, 211, 153, 0.35) !important;
        }

        .badge.bg-warning[class*="bg-opacity-"],
        .badge[class*="bg-warning"][class*="bg-opacity-"] {
            background-color: rgba(245, 158, 11, 0.18) !important;
            color: #fbbf24 !important;
            border: 1px solid rgba(251, 191, 36, 0.35) !important;
        }

        .badge.bg-danger[class*="bg-opacity-"],
        .badge[class*="bg-danger"][class*="bg-opacity-"] {
            background-color: rgba(239, 68, 68, 0.18) !important;
            color: #f87171 !important;
            border: 1px solid rgba(248, 113, 113, 0.35) !important;
        }

        .badge.bg-primary[class*="bg-opacity-"],
        .badge[class*="bg-primary"][class*="bg-opacity-"] {
            background-color: rgba(37, 99, 235, 0.18) !important;
            color: #60a5fa !important;
            border: 1px solid rgba(96, 165, 250, 0.35) !important;
        }

        .badge.bg-secondary[class*="bg-opacity-"],
        .badge[class*="bg-secondary"][class*="bg-opacity-"] {
            background-color: rgba(148, 163, 184, 0.16) !important;
            color: #cbd5e1 !important;
            border: 1px solid rgba(203, 213, 225, 0.28) !important;
        }

        .badge.bg-purple,
        .badge[class*="bg-purple"] {
            background-color: rgba(168, 85, 247, 0.2) !important;
            color: #c084fc !important;
            border: 1px solid rgba(192, 132, 252, 0.35) !important;
        }

        /* --- BUTTONS & FILTER CONTROLS --- */
        .btn {
            font-weight: 500;
            transition: all 0.15s ease-in-out;
        }

        /* Solid Buttons */
        .btn-primary {
            color: #ffffff !important;
            background-color: #2563eb !important;
            border-color: #2563eb !important;
        }
        .btn-primary:hover,
        .btn-primary:focus,
        .btn-primary:active {
            color: #ffffff !important;
            background-color: #1d4ed8 !important;
            border-color: #1d4ed8 !important;
        }

        .btn-warning {
            color: #1a1200 !important;
            background-color: #f59e0b !important;
            border-color: #f59e0b !important;
            font-weight: 600 !important;
        }
        .btn-warning:hover,
        .btn-warning:focus,
        .btn-warning:active {
            color: #1a1200 !important;
            background-color: #d97706 !important;
            border-color: #d97706 !important;
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
            background-color: #10b981 !important;
            border-color: #10b981 !important;
        }
        .btn-success:hover,
        .btn-success:focus,
        .btn-success:active {
            color: #ffffff !important;
            background-color: #059669 !important;
            border-color: #059669 !important;
        }

        .btn-danger {
            color: #ffffff !important;
            background-color: #ef4444 !important;
            border-color: #ef4444 !important;
        }
        .btn-danger:hover,
        .btn-danger:focus,
        .btn-danger:active {
            color: #ffffff !important;
            background-color: #dc2626 !important;
            border-color: #dc2626 !important;
        }

        .btn-secondary {
            color: #ffffff !important;
            background-color: #475569 !important;
            border-color: #475569 !important;
        }
        .btn-secondary:hover,
        .btn-secondary:focus,
        .btn-secondary:active {
            color: #ffffff !important;
            background-color: #334155 !important;
            border-color: #334155 !important;
        }

        /* Outline Buttons with High Contrast Foreground */
        .btn-outline-secondary {
            color: #cbd5e1 !important;
            border-color: #64748b !important;
            background-color: transparent !important;
        }
        .btn-outline-secondary:hover,
        .btn-outline-secondary:focus {
            color: #ffffff !important;
            background-color: #334155 !important;
            border-color: #94a3b8 !important;
        }
        .btn-outline-secondary.active,
        .btn-outline-secondary:active,
        .btn-check:checked + .btn-outline-secondary {
            color: #ffffff !important;
            background-color: #475569 !important;
            border-color: #94a3b8 !important;
            font-weight: 600 !important;
        }

        .btn-outline-warning {
            color: #fbbf24 !important;
            border-color: #f59e0b !important;
            background-color: transparent !important;
        }
        .btn-outline-warning:hover,
        .btn-outline-warning:focus,
        .btn-outline-warning.active,
        .btn-outline-warning:active,
        .btn-check:checked + .btn-outline-warning {
            color: #1a1200 !important;
            background-color: #fbbf24 !important;
            border-color: #fbbf24 !important;
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
            color: #34d399 !important;
            border-color: #10b981 !important;
            background-color: transparent !important;
        }
        .btn-outline-success:hover,
        .btn-outline-success:focus,
        .btn-outline-success.active,
        .btn-outline-success:active,
        .btn-check:checked + .btn-outline-success {
            color: #ffffff !important;
            background-color: #10b981 !important;
            border-color: #10b981 !important;
            font-weight: 600 !important;
        }

        .btn-outline-danger {
            color: #f87171 !important;
            border-color: #ef4444 !important;
            background-color: transparent !important;
        }
        .btn-outline-danger:hover,
        .btn-outline-danger:focus,
        .btn-outline-danger.active,
        .btn-outline-danger:active,
        .btn-check:checked + .btn-outline-danger {
            color: #ffffff !important;
            background-color: #ef4444 !important;
            border-color: #ef4444 !important;
            font-weight: 600 !important;
        }

        .btn-outline-light {
            color: #f1f5f9 !important;
            border-color: #64748b !important;
            background-color: transparent !important;
        }
        .btn-outline-light:hover,
        .btn-outline-light:focus,
        .btn-outline-light.active,
        .btn-outline-light:active {
            color: #0f172a !important;
            background-color: #f1f5f9 !important;
            border-color: #f1f5f9 !important;
            font-weight: 600 !important;
        }

        /* --- PAGINATION --- */
        .pagination {
            gap: 3px;
        }
        .page-link {
            background-color: var(--fx-bg-surface, #121824) !important;
            border-color: var(--fx-border, #26334d) !important;
            color: #cbd5e1 !important;
            font-size: 0.85rem;
            padding: 0.35rem 0.75rem;
            border-radius: 4px;
        }
        .page-link:hover {
            background-color: var(--fx-bg-card, #182030) !important;
            color: #ffffff !important;
            border-color: #3b82f6 !important;
        }
        .page-item.active .page-link {
            background-color: #2563eb !important;
            border-color: #2563eb !important;
            color: #ffffff !important;
            font-weight: 600;
        }
        .page-item.disabled .page-link {
            background-color: rgba(18, 24, 36, 0.5) !important;
            border-color: var(--fx-border, #26334d) !important;
            color: #64748b !important;
        }

        /* --- FORMS & SELECTS --- */
        .form-select option {
            background-color: #121824 !important;
            color: #f0f4f8 !important;
        }

        /* --- ALERTS --- */
        .alert {
            font-weight: 500;
            border-radius: 6px;
        }
        .alert-danger,
        .alert.alert-danger {
            background-color: rgba(239, 68, 68, 0.15) !important;
            border-color: rgba(239, 68, 68, 0.35) !important;
            color: #fca5a5 !important;
        }
        .alert-success,
        .alert.alert-success {
            background-color: rgba(16, 185, 129, 0.15) !important;
            border-color: rgba(16, 185, 129, 0.35) !important;
            color: #6ee7b7 !important;
        }
        .alert-warning,
        .alert.alert-warning {
            background-color: rgba(245, 158, 11, 0.15) !important;
            border-color: rgba(245, 158, 11, 0.35) !important;
            color: #fde047 !important;
        }
        .alert-info,
        .alert.alert-info {
            background-color: rgba(14, 165, 233, 0.15) !important;
            border-color: rgba(14, 165, 233, 0.35) !important;
            color: #7dd3fc !important;
        }

        /* --- LIGHT THEME COMPREHENSIVE OVERRIDES --- */
        [data-bs-theme="light"] {
            --fx-bg-main: #f8fafc;
            --fx-bg-surface: #ffffff;
            --fx-bg-card: #ffffff;
            --fx-bg-input: #ffffff;
            --fx-border: #e2e8f0;
            --fx-text-primary: #0f172a;
            --fx-text-secondary: #334155;
            --fx-text-muted: #64748b;
            --fx-accent-primary: #2563eb;
            --fx-accent-hover: #1d4ed8;

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
        [data-bs-theme="light"] .fx-sidebar-brand {
            color: #0f172a !important;
            background-color: #ffffff;
        }
        [data-bs-theme="light"] .fx-top-header {
            background-color: #ffffff !important;
            border-bottom-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .fx-bottom-nav {
            background-color: #ffffff !important;
            border-top-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .fx-card,
        [data-bs-theme="light"] .card {
            background-color: #ffffff !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        [data-bs-theme="light"] .form-control,
        [data-bs-theme="light"] .form-select {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
        }
        [data-bs-theme="light"] .bg-dark {
            background-color: #f8fafc !important;
        }
        [data-bs-theme="light"] .bg-black {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
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
        [data-bs-theme="light"] .modal-content {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .modal-header,
        [data-bs-theme="light"] .modal-footer {
            border-color: #e2e8f0 !important;
        }
        [data-bs-theme="light"] .btn-close-white {
            filter: none !important;
        }
    </style>

    @stack('styles')
</head>
<body>
    <div id="app-wrapper">
        <!-- Desktop / Tablet Sidebar -->
        <aside class="fx-sidebar" id="clientSidebar">
            <a href="{{ route('client.dashboard') }}" class="fx-sidebar-brand">
                <i class="bi bi-graph-up-arrow text-primary me-2"></i>
                <span>{{ config('broker.short_name', 'BrokerCRM') }}</span>
            </a>

            <div class="fx-sidebar-menu">
                <div class="text-uppercase px-3 py-2 text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Menu</div>
                
                <a href="{{ route('client.dashboard') }}" class="fx-nav-item {{ request()->routeIs('client.dashboard') ? 'active' : '' }}">
                    <i class="bi bi-grid-1x2-fill"></i>
                    <span>Home Dashboard</span>
                </a>

                <a href="{{ route('client.wallet') }}" class="fx-nav-item {{ request()->routeIs('client.wallet*') ? 'active' : '' }}">
                    <i class="bi bi-wallet2"></i>
                    <span>My Wallet</span>
                </a>

                <a href="{{ route('client.trading-accounts.index') }}" class="fx-nav-item {{ request()->routeIs('client.trading-accounts*') ? 'active' : '' }}">
                    <i class="bi bi-display"></i>
                    <span>Trading Accounts</span>
                </a>

                <a href="{{ route('client.trade') }}" class="fx-nav-item {{ request()->routeIs('client.trade*') ? 'active' : '' }}">
                    <i class="bi bi-bar-chart-line-fill"></i>
                    <span>Trading Terminal</span>
                </a>

                <a href="{{ route('client.activity') }}" class="fx-nav-item {{ request()->routeIs('client.activity*') ? 'active' : '' }}">
                    <i class="bi bi-clock-history"></i>
                    <span>Transactions & Logs</span>
                </a>

                <a href="{{ route('client.profile') }}" class="fx-nav-item {{ request()->routeIs('client.profile*') ? 'active' : '' }}">
                    <i class="bi bi-person-badge-fill"></i>
                    <span>Profile & KYC</span>
                </a>

                <a href="{{ route('client.support.index') }}" class="fx-nav-item {{ request()->routeIs('client.support*') ? 'active' : '' }}">
                    <i class="bi bi-headset"></i>
                    <span>Support Center</span>
                </a>

                <div class="text-uppercase px-3 pt-4 pb-2 text-muted fw-bold" style="font-size: 0.7rem; letter-spacing: 0.05em;">Platforms</div>

                <a href="{{ config('broker.platforms.web_trader') }}" target="_blank" class="fx-nav-item">
                    <i class="bi bi-globe2"></i>
                    <span>WebTrader</span>
                    <i class="bi bi-box-arrow-up-right ms-auto opacity-50" style="font-size: 0.8rem;"></i>
                </a>
            </div>

            <div class="p-3 border-top border-secondary border-opacity-25">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                        <div class="bg-primary bg-opacity-20 text-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div class="overflow-hidden">
                            <div class="text-white text-truncate fw-semibold" style="font-size: 0.875rem;">
                                {{ auth()->user()->profile->first_name ?? 'Client' }}
                            </div>
                            <div class="text-muted text-truncate" style="font-size: 0.75rem;">
                                {{ auth()->user()->email ?? 'client@demo.com' }}
                            </div>
                        </div>
                    </div>
                    <form method="POST" action="{{ route('logout') }}" class="d-inline" id="clientSidebarLogoutForm">
                        @csrf
                        <button type="submit" class="btn btn-outline-danger btn-sm p-1 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;" title="Log Out" id="clientSidebarLogoutBtn" aria-label="Log Out">
                            <i class="bi bi-box-arrow-right"></i>
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="fx-main-content">
            <!-- Top Header -->
            <header class="fx-top-header">
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-link text-white p-0 d-lg-none me-2" id="sidebarToggleBtn" type="button">
                        <i class="bi bi-list fs-3"></i>
                    </button>
                    <span class="fw-semibold text-white d-none d-sm-inline">
                        @yield('header_title', 'Client Portal')
                    </span>
                </div>

                <div class="d-flex align-items-center gap-3">
                    <div class="bg-dark bg-opacity-50 border border-secondary border-opacity-25 px-3 py-1 rounded-pill d-flex align-items-center gap-2">
                        <span class="text-muted" style="font-size: 0.75rem;">CRM Wallet:</span>
                        <span class="text-emerald-400 fw-bold" style="color: #10b981; font-size: 0.875rem;">
                            {{ auth()->user()->wallet->currency ?? config('broker.base_currency', 'USD') }} ${{ auth()->user()->wallet?->formatted_balance ?? '0.00' }}
                        </span>
                    </div>

                    @php $unreadNavCount = auth()->user()->unreadNotifications()->count(); @endphp
                    <a href="{{ route('client.notifications') }}" class="btn btn-outline-secondary border-opacity-25 text-white position-relative rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;" title="Notifications">
                        <i class="bi bi-bell"></i>
                        @if($unreadNavCount > 0)
                            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.65rem;">
                                {{ $unreadNavCount > 99 ? '99+' : $unreadNavCount }}
                            </span>
                        @endif
                    </a>

                    <!-- Theme Toggle -->
                    <button type="button" class="btn btn-outline-secondary border-opacity-25 text-white rounded-circle p-2 d-flex align-items-center justify-content-center theme-toggle-btn" id="clientThemeToggleBtn" style="width: 38px; height: 38px;" title="Toggle Dark/Light Mode" aria-label="Toggle theme">
                        <i class="bi bi-sun theme-icon-light d-none"></i>
                        <i class="bi bi-moon-stars theme-icon-dark"></i>
                    </button>

                    <!-- Client User Dropdown Menu with Logout -->
                    <div class="dropdown">
                        <button class="btn btn-dark border-secondary border-opacity-25 text-white dropdown-toggle d-flex align-items-center gap-2 py-1 px-2" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="clientUserDropdown">
                            <i class="bi bi-person-circle text-primary"></i>
                            <span class="d-none d-md-inline" style="font-size: 0.875rem;">{{ auth()->user()->profile->first_name ?? 'Client' }}</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow-sm border-secondary border-opacity-25" aria-labelledby="clientUserDropdown">
                            <li>
                                <a class="dropdown-item d-flex align-items-center gap-2" href="{{ route('client.profile') }}">
                                    <i class="bi bi-person-badge"></i> Profile & KYC
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center gap-2" href="{{ route('client.support.index') }}">
                                    <i class="bi bi-headset"></i> Support Center
                                </a>
                            </li>
                            <li><hr class="dropdown-divider border-secondary border-opacity-25"></li>
                            <li>
                                <form method="POST" action="{{ route('logout') }}" id="clientHeaderLogoutForm">
                                    @csrf
                                    <button type="submit" class="dropdown-item text-danger d-flex align-items-center gap-2" id="clientHeaderLogoutBtn">
                                        <i class="bi bi-box-arrow-right"></i> Log Out
                                    </button>
                                </form>
                            </li>
                        </ul>
                    </div>
                </div>
            </header>

            <!-- Container for Page Content & Flash Messages -->
            <div class="container-fluid p-3 p-md-4">
                <!-- Flash Messages -->
                @if(session('success'))
                    <div class="alert alert-success alert-dismissible fade show bg-success bg-opacity-10 text-success border-success border-opacity-25" role="alert">
                        <i class="bi bi-check-circle-fill me-2"></i> {{ session('success') }}
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                @endif

                @if(session('error'))
                    <div class="alert alert-danger alert-dismissible fade show bg-danger bg-opacity-10 text-danger border-danger border-opacity-25" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ session('error') }}
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                @endif

                <!-- Yield Page Content -->
                @yield('content')
            </div>
        </main>

        <!-- Mobile App-Like Fixed Bottom Navigation -->
        <nav class="fx-bottom-nav">
            <a href="{{ route('client.dashboard') }}" class="fx-bottom-nav-item {{ request()->routeIs('client.dashboard') ? 'active' : '' }}">
                <i class="bi bi-house-door-fill"></i>
                <span>Home</span>
            </a>
            <a href="{{ route('client.wallet') }}" class="fx-bottom-nav-item {{ request()->routeIs('client.wallet*') ? 'active' : '' }}">
                <i class="bi bi-wallet2"></i>
                <span>Wallet</span>
            </a>
            <a href="{{ route('client.trade') }}" class="fx-bottom-nav-item {{ request()->routeIs('client.trade*') ? 'active' : '' }}">
                <i class="bi bi-bar-chart-fill"></i>
                <span>Trade</span>
            </a>
            <a href="{{ route('client.activity') }}" class="fx-bottom-nav-item {{ request()->routeIs('client.activity*') ? 'active' : '' }}">
                <i class="bi bi-activity"></i>
                <span>Activity</span>
            </a>
            <a href="{{ route('client.profile') }}" class="fx-bottom-nav-item {{ request()->routeIs('client.profile*') ? 'active' : '' }}">
                <i class="bi bi-person-fill"></i>
                <span>Profile</span>
            </a>
        </nav>
    </div>

    <!-- Bootstrap 5 JS Bundle CDN -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const toggleBtn = document.getElementById('sidebarToggleBtn');
            const sidebar = document.getElementById('clientSidebar');
            if(toggleBtn && sidebar) {
                toggleBtn.addEventListener('click', function() {
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
