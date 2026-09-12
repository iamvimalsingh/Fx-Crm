<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Broker White-Label Information
    |--------------------------------------------------------------------------
    |
    | Basic branding and contact details for the white-label installation.
    | Sourced from environment variables with safe neutral defaults.
    |
    */
    'name' => env('BROKER_NAME', 'Forex Broker CRM'),
    'short_name' => env('BROKER_SHORT_NAME', 'BrokerCRM'),
    'logo_url' => env('BROKER_LOGO_URL', '/assets/img/logo.svg'),
    'logo_dark_url' => env('BROKER_LOGO_DARK_URL', '/assets/img/logo-dark.svg'),
    'favicon_url' => env('BROKER_FAVICON_URL', '/assets/img/favicon.ico'),
    'support_email' => env('BROKER_SUPPORT_EMAIL', 'support@example.com'),
    'support_phone' => env('BROKER_SUPPORT_PHONE', '+1 (800) 555-0199'),
    'base_currency' => env('BROKER_BASE_CURRENCY', 'USD'),
    'default_country' => env('BROKER_DEFAULT_COUNTRY', 'US'),

    /*
    |--------------------------------------------------------------------------
    | Supported Platforms, Account Types, and Leverages
    |--------------------------------------------------------------------------
    */
    'supported_platforms' => [
        'ArrowTrader' => 'Arrow Trader',
        'IceTrader'   => 'Ice Trader',
        'EdgeTrader'  => 'Edge Trader',
        'WebTrader'   => 'Web Trader',
    ],

    'supported_account_types' => [
        'Standard',
        'Raw Spread',
        'VIP',
    ],

    'supported_leverages' => [
        '1:100',
        '1:200',
        '1:400',
        '1:500',
    ],

    /*
    |--------------------------------------------------------------------------
    | External Trading Platform Links
    |--------------------------------------------------------------------------
    |
    | Neutral default URLs for WebTrader and downloadable trading clients.
    |
    */
    'platforms' => [
        'web_trader' => env('TRADING_WEB_TRADER_URL', 'https://webtrader.example.com'),
        'android' => env('TRADING_ANDROID_APP_URL', 'https://play.google.com/store/apps/details?id=com.example.trader'),
        'ios' => env('TRADING_IOS_APP_URL', 'https://apps.apple.com/app/example-trader/id123456789'),
        'windows' => env('TRADING_WINDOWS_DESKTOP_URL', 'https://downloads.example.com/setup.exe'),
        'mac' => env('TRADING_MAC_DESKTOP_URL', 'https://downloads.example.com/setup.dmg'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Supported Withdrawal Methods
    |--------------------------------------------------------------------------
    */
    'withdrawal_methods' => [
        'bank_transfer' => 'Bank Transfer',
        'usdt_trc20'    => 'USDT TRC20',
        'crypto'        => 'Crypto',
        'manual'        => 'Manual',
    ],

    /*
    |--------------------------------------------------------------------------
    | System Feature Flags
    |--------------------------------------------------------------------------
    */
    'features' => [
        'deposits_enabled' => (bool) env('FEATURE_DEPOSITS_ENABLED', true),
        'withdrawals_enabled' => (bool) env('FEATURE_WITHDRAWALS_ENABLED', true),
        'kyc_required' => (bool) env('FEATURE_KYC_REQUIRED', true),
        'internal_transfers_enabled' => (bool) env('FEATURE_INTERNAL_TRANSFERS_ENABLED', true),
        'demo_accounts_enabled' => (bool) env('FEATURE_DEMO_ACCOUNTS_ENABLED', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Wallet Constraints
    |--------------------------------------------------------------------------
    */
    'wallet' => [
        'min_deposit' => env('MIN_DEPOSIT_AMOUNT', '10.00'),
        'max_deposit' => env('MAX_DEPOSIT_AMOUNT', '50000.00'),
        'min_withdrawal' => env('MIN_WITHDRAWAL_AMOUNT', '20.00'),
        'max_withdrawal' => env('MAX_WITHDRAWAL_AMOUNT', '25000.00'),
    ],
];
