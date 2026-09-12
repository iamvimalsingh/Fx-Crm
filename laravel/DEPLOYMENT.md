# Forex Broker Client CRM — Production Deployment Guide

## 1. Architecture Overview

- **Core Application Directory**: `/home/fxcentru/crm_core` (Placed outside the public web root for security)
- **Public Document Root**: `/home/fxcentru/crm_public` (or `/home/fxcentru/public_html`)
- **PHP Version**: PHP 8.2 or PHP 8.3
- **Database**: MySQL 8.0+ or MariaDB 10.4+
- **Web Server**: LiteSpeed / Apache with `mod_rewrite` enabled
- **Background Processes**: None required (`QUEUE_CONNECTION=sync`, `SESSION_DRIVER=file`, `CACHE_STORE=file`)

---

## 2. Directory Layout on cPanel

```
/home/fxcentru/
├── crm_core/                          <-- Extracted core Laravel application
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── resources/
│   ├── routes/
│   ├── storage/
│   │   ├── app/
│   │   ├── framework/
│   │   │   ├── cache/
│   │   │   ├── sessions/
│   │   │   └── views/
│   │   └── logs/
│   ├── artisan
│   ├── composer.json
│   ├── composer.lock
│   └── .env                          <-- Configured from .env.example
│
└── crm_public/                        <-- Public Document Root mapped in cPanel
    ├── index.php                      <-- Front controller loading ../crm_core
    └── .htaccess                      <-- Apache URL rewrite configuration
```

---

## 3. Step-by-Step Installation

### Step 1: Upload and Extract Files
1. Upload `forexcore-crm-production-final.zip` to `/home/fxcentru/`.
2. Extract the archive directly in `/home/fxcentru/`:
```bash
cd /home/fxcentru
unzip forexcore-crm-production-final.zip
```
This automatically produces `/home/fxcentru/crm_core` and `/home/fxcentru/crm_public`.
(If using `public_html` as document root, map your domain to `crm_public` in cPanel Domains or symlink/copy `crm_public/*` to `public_html`).

### Step 2: Install Composer Dependencies
In cPanel Terminal or SSH:
```bash
cd /home/fxcentru/crm_core
composer install --no-dev --prefer-dist --optimize-autoloader
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your database and broker credentials:
```bash
cp .env.example .env
nano .env
```
Key production variables:
```env
APP_NAME="Forex Broker CRM"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://crm.yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=yourcpanel_crm
DB_USERNAME=yourcpanel_user
DB_PASSWORD=YourStrongPasswordHere

QUEUE_CONNECTION=sync
CACHE_STORE=file
SESSION_DRIVER=file
```

### Step 4: Generate Application Key and Migrate Database
```bash
php artisan key:generate --force
php artisan migrate --force
```

### Step 5: Provision Initial Administrator
```bash
php artisan crm:create-admin admin@yourdomain.com --first_name=Operations --last_name=Admin --password="YourSecureAdminPassword123!"
```

### Step 6: Set Directory Permissions
Ensure the web server user can read and write to `storage` and `bootstrap/cache`:
```bash
chmod -R 775 storage bootstrap/cache
```

### Step 7: Compile Production Caches
```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## 4. Verification URLs

1. **Health Check**: `https://crm.yourdomain.com/up` (Expect: 200 OK)
2. **Client Portal**: `https://crm.yourdomain.com/login`
3. **Admin Terminal**: `https://crm.yourdomain.com/admin/login`
