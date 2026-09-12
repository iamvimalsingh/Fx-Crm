import React, { useState } from 'react';
import {
  Shield,
  Database,
  FolderTree,
  Settings,
  Layout,
  Smartphone,
  Monitor,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  FileText,
  Sliders,
  Users,
  Lock,
  Server,
  Globe,
  Bell,
  Search,
  ChevronRight,
  Code2,
  ListFilter,
  CheckSquare,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'client_shell' | 'admin_shell' | 'migrations' | 'architecture' | 'config' | 'handover'>('client_shell');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Client Shell state
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('mobile');
  const [clientNav, setClientNav] = useState<'home' | 'wallet' | 'trade' | 'activity' | 'profile'>('home');
  const [brokerName, setBrokerName] = useState('Apex Prime Forex');
  const [brokerCurrency, setBrokerCurrency] = useState('USD');

  // Admin Shell state
  const [adminNav, setAdminNav] = useState<'dashboard' | 'clients' | 'deposits' | 'withdrawals' | 'transactions' | 'kyc' | 'payment_methods' | 'settings' | 'audit_logs'>('dashboard');

  // Migration selection
  const [selectedMigration, setSelectedMigration] = useState<number>(0);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const migrationsList = [
    {
      id: '001',
      name: '2026_01_01_000001_create_users_table.php',
      table: 'users',
      description: 'Core user authentication records with role and status enums',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['client', 'admin'])->default('client');
            $table->enum('status', ['active', 'disabled'])->default('active');
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();

            // Indexes
            $table->index('role');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};`
    },
    {
      id: '002',
      name: '2026_01_01_000002_create_user_profiles_table.php',
      table: 'user_profiles',
      description: 'Personal client profile information linked 1-to-1 with users',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone', 30)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->timestamps();

            // Indexes
            $table->index(['first_name', 'last_name']);
            $table->index('country');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};`
    },
    {
      id: '003',
      name: '2026_01_01_000003_create_wallets_table.php',
      table: 'wallets',
      description: 'Primary fiat funding wallet per user (DECIMAL 15,2 strict precision)',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->decimal('balance', 15, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->timestamps();

            // Constraints
            $table->unique(['user_id', 'currency']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};`
    },
    {
      id: '004',
      name: '2026_01_01_000004_create_transactions_table.php',
      table: 'transactions',
      description: 'Universal financial ledger for deposits, withdrawals, and manual adjustments',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('type', ['deposit', 'withdrawal', 'manual_credit', 'manual_debit']);
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('USD');
            $table->enum('status', ['pending', 'completed', 'rejected', 'cancelled'])->default('pending');
            $table->string('reference_id', 64)->unique();
            $table->text('description')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index('type');
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};`
    },
    {
      id: '005',
      name: '2026_01_01_000005_create_payment_methods_table.php',
      table: 'payment_methods',
      description: 'Configurable gateways (Bank Wire, Crypto, USDT, Local Transfer)',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->text('instructions')->nullable();
            $table->decimal('min_amount', 15, 2)->default(10.00);
            $table->decimal('max_amount', 15, 2)->default(10000.00);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            // Indexes
            $table->index('is_active');
            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_methods');
    }
};`
    },
    {
      id: '006',
      name: '2026_01_01_000006_create_deposits_table.php',
      table: 'deposits',
      description: 'Inbound funding submissions with payment method and proof attachment',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('transaction_id')->unique()->constrained('transactions')->onDelete('cascade');
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->onDelete('set null');
            $table->decimal('amount', 15, 2);
            $table->string('proof_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index('payment_method_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposits');
    }
};`
    },
    {
      id: '007',
      name: '2026_01_01_000007_create_withdrawals_table.php',
      table: 'withdrawals',
      description: 'Outbound payout requests with destination account details',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('withdrawals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('transaction_id')->unique()->constrained('transactions')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('withdrawal_method');
            $table->text('destination_details');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index('withdrawal_method');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawals');
    }
};`
    },
    {
      id: '008',
      name: '2026_01_01_000008_create_kyc_profiles_table.php',
      table: 'kyc_profiles',
      description: 'Compliance verification status tracker per user',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kyc_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->enum('status', ['not_submitted', 'pending', 'approved', 'rejected'])->default('not_submitted');
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_profiles');
    }
};`
    },
    {
      id: '009',
      name: '2026_01_01_000009_create_kyc_documents_table.php',
      table: 'kyc_documents',
      description: 'Individual ID and Address proof document attachments',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kyc_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('document_type', ['id_proof', 'address_proof']);
            $table->string('file_path');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index(['user_id', 'document_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_documents');
    }
};`
    },
    {
      id: '010',
      name: '2026_01_01_000010_create_audit_logs_table.php',
      table: 'audit_logs',
      description: 'System-wide security and administrative operation tracking',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Indexes
            $table->index('user_id');
            $table->index('action');
            $table->index(['target_type', 'target_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};`
    },
    {
      id: '011',
      name: '2026_01_01_000011_create_settings_table.php',
      table: 'settings',
      description: 'Dynamic database key-value store for white-label overrides',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};`
    }
  ];

  return (
    <div className="min-h-screen bg-[#090d14] text-[#e2e8f0] font-sans flex flex-col">
      {/* Global Top Banner Header */}
      <header className="border-b border-slate-800 bg-[#0d131f]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Forex Broker Client CRM</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  PHASE 1
                </span>
              </div>
              <p className="text-xs text-slate-400">Laravel 11 • cPanel Shared Hosting • Monolithic Architecture</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('client_shell')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'client_shell' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Client Shell
            </button>
            <button
              onClick={() => setActiveTab('admin_shell')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'admin_shell' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Admin Shell
            </button>
            <button
              onClick={() => setActiveTab('migrations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'migrations' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Migrations (11)
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'architecture' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" /> Architecture
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'config' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> White-Label Config
            </button>
            <button
              onClick={() => setActiveTab('handover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'handover' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Handover
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* ================================================================= */}
        {/* TAB 1: CLIENT APP SHELL PREVIEW */}
        {/* ================================================================= */}
        {activeTab === 'client_shell' && (
          <div className="space-y-6">
            {/* Viewport Control Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layout className="w-4 h-4 text-blue-400" /> App-Like Client Shell Preview
                </h2>
                <p className="text-xs text-slate-400">
                  Responsive Blade template with mobile fixed bottom nav and desktop collapsible sidebar layout.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setViewportMode('mobile')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                      viewportMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile App Frame
                  </button>
                  <button
                    onClick={() => setViewportMode('desktop')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                      viewportMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop Fluid
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Broker:</span>
                  <input
                    type="text"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white w-32 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Shell Interactive Simulator Container */}
            <div className={`mx-auto transition-all duration-300 ${viewportMode === 'mobile' ? 'max-w-[390px] border-[10px] border-slate-800 rounded-[38px] shadow-2xl overflow-hidden bg-[#0b0e14] my-4 min-h-[720px] flex flex-col' : 'w-full border border-slate-800 rounded-xl bg-[#0b0e14] min-h-[640px]'}`}>
              {viewportMode === 'mobile' && (
                <div className="bg-slate-900 text-slate-400 text-[10px] py-1 text-center font-mono border-b border-slate-800 flex items-center justify-between px-4">
                  <span>9:41</span>
                  <span className="font-bold text-slate-200">{brokerName} Mobile Client</span>
                  <span>100% 🔋</span>
                </div>
              )}

              <div className={`flex flex-col flex-grow ${viewportMode === 'desktop' ? 'md:flex-row' : ''}`}>
                {/* Desktop Sidebar (Only in desktop mode) */}
                {viewportMode === 'desktop' && (
                  <div className="w-60 bg-[#121824] border-r border-[#26334d] flex flex-col flex-shrink-0">
                    <div className="h-14 px-4 flex items-center gap-2 border-b border-[#26334d] font-bold text-white text-sm">
                      <Activity className="w-5 h-5 text-blue-500" />
                      <span>{brokerName}</span>
                    </div>

                    <div className="p-3 space-y-1 flex-grow">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1">Main Menu</div>
                      <button
                        onClick={() => setClientNav('home')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          clientNav === 'home' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                        }`}
                      >
                        <Layout className="w-4 h-4" /> Home Dashboard
                      </button>
                      <button
                        onClick={() => setClientNav('wallet')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          clientNav === 'wallet' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                        }`}
                      >
                        <Wallet className="w-4 h-4" /> My Wallet
                      </button>
                      <button
                        onClick={() => setClientNav('trade')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          clientNav === 'trade' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                        }`}
                      >
                        <Activity className="w-4 h-4" /> Trading Terminal
                      </button>
                      <button
                        onClick={() => setClientNav('activity')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          clientNav === 'activity' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                        }`}
                      >
                        <FileText className="w-4 h-4" /> Transactions
                      </button>
                      <button
                        onClick={() => setClientNav('profile')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          clientNav === 'profile' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                        }`}
                      >
                        <Users className="w-4 h-4" /> Profile & KYC
                      </button>
                    </div>

                    <div className="p-3 border-t border-[#26334d] bg-[#0b0e14]/50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          JD
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-white truncate">John Doe</div>
                          <div className="text-[10px] text-slate-400 truncate">john.doe@fx.com</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Content Frame */}
                <div className="flex-grow flex flex-col min-w-0">
                  {/* Top App Header */}
                  <div className="h-14 bg-[#121824] border-b border-[#26334d] px-4 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      {viewportMode === 'mobile' && (
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          <Activity className="w-4 h-4 text-blue-500" />
                          <span>{brokerName}</span>
                        </div>
                      )}
                      {viewportMode === 'desktop' && (
                        <span className="text-xs font-semibold text-slate-300">
                          {clientNav === 'home' && 'Client Dashboard'}
                          {clientNav === 'wallet' && 'Funding & Wallet'}
                          {clientNav === 'trade' && 'Web Trading Terminal'}
                          {clientNav === 'activity' && 'Account Activity & Ledger'}
                          {clientNav === 'profile' && 'Client Profile & Identity Verification'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-[#182030] border border-[#26334d] px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400 text-[10px]">Wallet:</span>
                        <span className="text-emerald-400 font-bold">{brokerCurrency} $0.00</span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-[#182030] border border-[#26334d] flex items-center justify-center text-slate-300">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Body Content depending on clientNav */}
                  <div className="p-4 space-y-4 flex-grow overflow-y-auto">
                    {clientNav === 'home' && (
                      <div className="space-y-4">
                        {/* Welcome banner */}
                        <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Wallet Balance</span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">{brokerCurrency}</span>
                          </div>
                          <h2 className="text-2xl font-bold text-white mb-3">$0.00</h2>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
                            </button>
                            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
                            </button>
                          </div>
                        </div>

                        {/* KYC Action prompt */}
                        <div className="bg-[#182030] border border-amber-500/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Verification Pending
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">Action Required</span>
                          </div>
                          <p className="text-xs text-slate-300 mb-3">
                            Submit your ID & Proof of Address to remove deposit restrictions.
                          </p>
                          <button
                            onClick={() => setClientNav('profile')}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
                          >
                            Verify Identity (KYC)
                          </button>
                        </div>

                        {/* Market watch preview */}
                        <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-blue-400" /> Live FX Rates
                            </h3>
                            <span className="text-[10px] text-emerald-400 font-mono">● LIVE</span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2 rounded bg-[#121824] border border-[#26334d]">
                              <span className="font-bold text-white">EUR / USD</span>
                              <span className="text-slate-300 font-mono">1.08450</span>
                              <span className="text-emerald-400 font-semibold">+0.32%</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded bg-[#121824] border border-[#26334d]">
                              <span className="font-bold text-white">GBP / USD</span>
                              <span className="text-slate-300 font-mono">1.27120</span>
                              <span className="text-rose-400 font-semibold">-0.18%</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded bg-[#121824] border border-[#26334d]">
                              <span className="font-bold text-white">XAU / USD</span>
                              <span className="text-slate-300 font-mono">2645.10</span>
                              <span className="text-emerald-400 font-semibold">+1.12%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {clientNav === 'wallet' && (
                      <div className="space-y-4">
                        <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4">
                          <h3 className="text-sm font-bold text-white mb-2">My Client Wallet</h3>
                          <p className="text-xs text-slate-400 mb-4">
                            All balances strictly managed with <code className="text-blue-400">DECIMAL(15,2)</code> SQL precision.
                          </p>

                          <div className="p-3 bg-[#121824] rounded-lg border border-[#26334d] flex items-center justify-between mb-4">
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Primary Fiat Wallet</span>
                              <div className="text-lg font-bold text-white">{brokerCurrency} $0.00</div>
                            </div>
                            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">Active</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button className="bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold">New Deposit</button>
                            <button className="bg-slate-800 text-slate-200 border border-slate-700 py-2 rounded-lg text-xs font-semibold">New Withdrawal</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {clientNav === 'trade' && (
                      <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4 space-y-3 text-center">
                        <Activity className="w-8 h-8 text-blue-400 mx-auto" />
                        <h3 className="text-sm font-bold text-white">Trading Platform Bridge</h3>
                        <p className="text-xs text-slate-400">
                          Connect directly to WebTrader, MT4, or MT5 terminals using configured external URLs in <code className="text-blue-400">config/broker.php</code>.
                        </p>
                        <a
                          href="https://webtrader.apexprimeforex.com"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                        >
                          Launch WebTrader <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {clientNav === 'activity' && (
                      <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold text-white">Recent Ledger Transactions</h3>
                        <div className="p-3 bg-[#121824] rounded-lg border border-[#26334d] text-xs space-y-1">
                          <div className="flex justify-between font-semibold text-white">
                            <span>Account Registration</span>
                            <span className="text-slate-400">System</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Client profile initialized successfully.</div>
                        </div>
                      </div>
                    )}

                    {clientNav === 'profile' && (
                      <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold text-white">Client Profile & KYC Documents</h3>
                        <div className="text-xs text-slate-300 space-y-2">
                          <div className="p-2 rounded bg-[#121824] border border-[#26334d] flex justify-between">
                            <span className="text-slate-400">First Name:</span>
                            <span className="text-white font-medium">John</span>
                          </div>
                          <div className="p-2 rounded bg-[#121824] border border-[#26334d] flex justify-between">
                            <span className="text-slate-400">Last Name:</span>
                            <span className="text-white font-medium">Doe</span>
                          </div>
                          <div className="p-2 rounded bg-[#121824] border border-[#26334d] flex justify-between">
                            <span className="text-slate-400">KYC Status:</span>
                            <span className="text-amber-400 font-bold">not_submitted</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile Fixed Bottom Navigation (Only in mobile mode) */}
                  {viewportMode === 'mobile' && (
                    <nav className="h-14 bg-[#121824] border-t border-[#26334d] grid grid-cols-5 items-center px-1">
                      <button
                        onClick={() => setClientNav('home')}
                        className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                          clientNav === 'home' ? 'text-blue-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Layout className="w-4 h-4" /> Home
                      </button>
                      <button
                        onClick={() => setClientNav('wallet')}
                        className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                          clientNav === 'wallet' ? 'text-blue-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Wallet className="w-4 h-4" /> Wallet
                      </button>
                      <button
                        onClick={() => setClientNav('trade')}
                        className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                          clientNav === 'trade' ? 'text-blue-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Activity className="w-4 h-4" /> Trade
                      </button>
                      <button
                        onClick={() => setClientNav('activity')}
                        className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                          clientNav === 'activity' ? 'text-blue-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <FileText className="w-4 h-4" /> Activity
                      </button>
                      <button
                        onClick={() => setClientNav('profile')}
                        className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                          clientNav === 'profile' ? 'text-blue-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Users className="w-4 h-4" /> Profile
                      </button>
                    </nav>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ADMIN APP SHELL PREVIEW */}
        {/* ================================================================= */}
        {activeTab === 'admin_shell' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Admin Base Layout Shell Preview
              </h2>
              <p className="text-xs text-slate-400">
                Broker management administration interface (<code className="text-emerald-400">resources/views/layouts/admin.blade.php</code>).
              </p>
            </div>

            <div className="border border-slate-800 rounded-xl bg-[#0d1117] min-h-[600px] flex flex-col md:flex-row overflow-hidden shadow-2xl">
              {/* Admin Sidebar */}
              <div className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0">
                <div className="h-16 px-4 border-b border-[#30363d] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <span>CRM Admin</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">v1.0</span>
                </div>

                <div className="p-3 space-y-1 flex-grow overflow-y-auto">
                  <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Overview</div>
                  <button
                    onClick={() => setAdminNav('dashboard')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'dashboard' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <Layout className="w-4 h-4" /> Dashboard
                  </button>

                  <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">Client Management</div>
                  <button
                    onClick={() => setAdminNav('clients')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'clients' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Clients
                  </button>
                  <button
                    onClick={() => setAdminNav('kyc')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'kyc' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> KYC Applications
                  </button>

                  <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">Finance & Billing</div>
                  <button
                    onClick={() => setAdminNav('deposits')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'deposits' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Deposits
                  </button>
                  <button
                    onClick={() => setAdminNav('withdrawals')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'withdrawals' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Withdrawals
                  </button>
                  <button
                    onClick={() => setAdminNav('transactions')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'transactions' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Transactions
                  </button>
                  <button
                    onClick={() => setAdminNav('payment_methods')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'payment_methods' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Payment Methods
                  </button>

                  <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">System & Security</div>
                  <button
                    onClick={() => setAdminNav('settings')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'settings' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <Sliders className="w-4 h-4" /> Broker Settings
                  </button>
                  <button
                    onClick={() => setAdminNav('audit_logs')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                      adminNav === 'audit_logs' ? 'bg-[#1f6feb] text-white font-semibold' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <Lock className="w-4 h-4" /> Audit Logs
                  </button>
                </div>
              </div>

              {/* Admin Header + Content */}
              <div className="flex-grow flex flex-col">
                <div className="h-16 bg-[#161b22] border-b border-[#30363d] px-6 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {adminNav.replace('_', ' ')}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-slate-300 font-mono">
                      {brokerName}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 flex-grow">
                  {/* Admin KPI Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#21262d] border border-[#30363d] p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-semibold mb-1">TOTAL CLIENTS</div>
                      <div className="text-2xl font-bold text-white">0</div>
                      <div className="text-[10px] text-slate-500 mt-1">Registered Accounts</div>
                    </div>
                    <div className="bg-[#21262d] border border-[#30363d] p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-semibold mb-1">PENDING KYC</div>
                      <div className="text-2xl font-bold text-amber-400">0</div>
                      <div className="text-[10px] text-slate-500 mt-1">Awaiting Review</div>
                    </div>
                    <div className="bg-[#21262d] border border-[#30363d] p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-semibold mb-1">PENDING DEPOSITS</div>
                      <div className="text-2xl font-bold text-emerald-400">$0.00</div>
                      <div className="text-[10px] text-slate-500 mt-1">0 Requests</div>
                    </div>
                    <div className="bg-[#21262d] border border-[#30363d] p-4 rounded-lg">
                      <div className="text-xs text-slate-400 font-semibold mb-1">PENDING WITHDRAWALS</div>
                      <div className="text-2xl font-bold text-rose-400">$0.00</div>
                      <div className="text-[10px] text-slate-500 mt-1">0 Requests</div>
                    </div>
                  </div>

                  {/* Dynamic View Section */}
                  <div className="bg-[#21262d] border border-[#30363d] p-5 rounded-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                      <h4 className="text-sm font-bold text-white">
                        Admin View: {adminNav.toUpperCase()}
                      </h4>
                      <span className="text-xs text-emerald-400 font-mono">Phase 1 Layout Ready</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      This administration shell provides complete navigational routing for all 9 core management modules required by broker operations staff.
                    </p>

                    <div className="p-4 bg-[#161b22] border border-[#30363d] rounded text-xs space-y-2">
                      <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Module Route Map</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300 font-mono text-[11px]">
                        <div>• Dashboard (/admin)</div>
                        <div>• Clients (/admin/clients)</div>
                        <div>• Deposits (/admin/deposits)</div>
                        <div>• Withdrawals (/admin/withdrawals)</div>
                        <div>• Transactions (/admin/transactions)</div>
                        <div>• KYC Review (/admin/kyc)</div>
                        <div>• Gateways (/admin/payment-methods)</div>
                        <div>• Settings (/admin/settings)</div>
                        <div>• Audit Logs (/admin/audit-logs)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: COMPLETE MIGRATIONS EXPLORER */}
        {/* ================================================================= */}
        {activeTab === 'migrations' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" /> Database Migrations (11 Complete Schemas)
                </h2>
                <p className="text-xs text-slate-400">
                  Strict <code className="text-blue-400">DECIMAL(15,2)</code> monetary values, full foreign keys, enums, and indexes.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  MySQL / MariaDB
                </span>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  DECIMAL(15,2)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Migration File List */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1 max-h-[640px] overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5 mb-1 border-b border-slate-800">
                  Laravel Migration Files
                </div>
                {migrationsList.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMigration(idx)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                      selectedMigration === idx
                        ? 'bg-blue-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <div className="text-[11px] font-bold text-slate-200 truncate">{m.table}</div>
                      <div className="text-[10px] text-slate-400 truncate">{m.name}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  </button>
                ))}
              </div>

              {/* Code Inspector */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">
                      {migrationsList[selectedMigration].name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {migrationsList[selectedMigration].description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(migrationsList[selectedMigration].code, migrationsList[selectedMigration].id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
                  >
                    {copiedIndex === migrationsList[selectedMigration].id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Migration PHP
                      </>
                    )}
                  </button>
                </div>

                <div className="relative flex-grow">
                  <pre className="bg-[#0b0e14] border border-slate-800 rounded-lg p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[520px]">
                    <code>{migrationsList[selectedMigration].code}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: DOMAIN ARCHITECTURE & CPANEL SETUP */}
        {/* ================================================================= */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-purple-400" /> Domain Architecture & cPanel Deployment
              </h2>
              <p className="text-xs text-slate-400">
                Future-proof domain services folder layout under <code className="text-purple-400">app/</code> & cPanel document root security guidelines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Folder structure */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" /> Domain-Oriented Directory Structure (<code className="text-blue-400">app/</code>)
                </h3>
                <pre className="bg-[#0b0e14] border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
{`app/
├── Enums/
│   ├── UserRole.php              (client, admin)
│   ├── UserStatus.php            (active, disabled)
│   ├── TransactionType.php       (deposit, withdrawal, manual_credit, manual_debit)
│   ├── TransactionStatus.php     (pending, completed, rejected, cancelled)
│   ├── KycStatus.php             (not_submitted, pending, approved, rejected)
│   └── DocumentType.php          (id_proof, address_proof)
├── Services/
│   ├── Wallet/
│   │   ├── WalletService.php     (Ledger balance calculations & lock)
│   │   └── TransactionService.php (Audit logging & transaction generation)
│   ├── Trading/
│   │   ├── Contracts/
│   │   │   └── TradingPlatformInterface.php (Abstraction layer for MT4/MT5/cTrader)
│   │   └── Adapters/
│   │       ├── Mt4Adapter.php    (V2 MetaTrader 4 API connector)
│   │       └── Mt5Adapter.php    (V2 MetaTrader 5 API connector)
│   ├── Kyc/
│   │   └── KycVerificationService.php
│   └── System/
│       └── AuditLoggerService.php
└── Traits/
    ├── HasWallet.php
    ├── HasKycProfile.php
    └── LogsAuditAction.php`}
                </pre>
              </div>

              {/* cPanel deployment guide */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" /> cPanel Shared Hosting Security Guidelines
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg space-y-1">
                    <span className="font-bold text-white">1. Secure Directory Separation</span>
                    <p className="text-slate-400">
                      Upload core Laravel app files ABOVE web root (e.g., <code className="text-emerald-400">/home/username/laravel_core</code>).
                      Only copy <code className="text-emerald-400">/public</code> contents into <code className="text-emerald-400">/public_html</code>.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg space-y-1">
                    <span className="font-bold text-white">2. Update index.php Autoload Paths</span>
                    <p className="text-slate-400">
                      In <code className="text-emerald-400">public_html/index.php</code>, adjust autoloader paths to point to <code className="text-emerald-400">../laravel_core/vendor/autoload.php</code>.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg space-y-1">
                    <span className="font-bold text-white">3. Root .htaccess Directives</span>
                    <pre className="text-[10px] font-mono text-emerald-300 bg-black/40 p-2 rounded mt-1">
{`<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^$ public/ [L]
    RewriteRule (.*) public/$1 [L]
</IfModule>`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: SYSTEM CONFIG & WHITE-LABEL SETUP */}
        {/* ================================================================= */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" /> System Configuration & White-Label Setup
              </h2>
              <p className="text-xs text-slate-400">
                Dedicated configuration file (<code className="text-amber-400">config/broker.php</code>) & <code className="text-amber-400">.env</code> keys.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* config/broker.php Code */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white font-mono">config/broker.php</span>
                  <button
                    onClick={() => handleCopy(`<?php\n\nreturn [\n    'name' => env('BROKER_NAME', 'Apex Prime Forex'),\n    'short_name' => env('BROKER_SHORT_NAME', 'ApexForex'),\n    'logo_url' => env('BROKER_LOGO_URL', '/assets/img/logo.svg'),\n    'support_email' => env('BROKER_SUPPORT_EMAIL', 'support@apexprimeforex.com'),\n    'base_currency' => env('BROKER_BASE_CURRENCY', 'USD'),\n    'platforms' => [\n        'web_trader' => env('TRADING_WEB_TRADER_URL', 'https://webtrader.apexprimeforex.com'),\n        'android_app' => env('TRADING_ANDROID_APP_URL', 'https://play.google.com/store/apps/details?id=com.apexprimeforex.trader'),\n        'ios_app' => env('TRADING_IOS_APP_URL', 'https://apps.apple.com/app/apex-prime-forex/id123456789'),\n        'windows_desktop' => env('TRADING_WINDOWS_DESKTOP_URL', 'https://downloads.apexprimeforex.com/setup.exe'),\n        'mac_desktop' => env('TRADING_MAC_DESKTOP_URL', 'https://downloads.apexprimeforex.com/setup.dmg'),\n    ],\n    'features' => [\n        'deposits_enabled' => (bool) env('FEATURE_DEPOSITS_ENABLED', true),\n        'withdrawals_enabled' => (bool) env('FEATURE_WITHDRAWALS_ENABLED', true),\n        'kyc_required' => (bool) env('FEATURE_KYC_REQUIRED', true),\n    ],\n];`, 'broker_config')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </button>
                </div>
                <pre className="bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-xs font-mono text-amber-300 overflow-x-auto leading-relaxed max-h-[460px]">
{`<?php

return [
    'name' => env('BROKER_NAME', 'Apex Prime Forex'),
    'short_name' => env('BROKER_SHORT_NAME', 'ApexForex'),
    'logo_url' => env('BROKER_LOGO_URL', '/assets/img/logo.svg'),
    'support_email' => env('BROKER_SUPPORT_EMAIL', 'support@apexprimeforex.com'),
    'base_currency' => env('BROKER_BASE_CURRENCY', 'USD'),
    
    'platforms' => [
        'web_trader' => env('TRADING_WEB_TRADER_URL', 'https://webtrader.apexprimeforex.com'),
        'android_app' => env('TRADING_ANDROID_APP_URL', 'https://play.google.com/store/apps/details?id=com.apexprimeforex.trader'),
        'ios_app' => env('TRADING_IOS_APP_URL', 'https://apps.apple.com/app/apex-prime-forex/id123456789'),
        'windows_desktop' => env('TRADING_WINDOWS_DESKTOP_URL', 'https://downloads.apexprimeforex.com/setup.exe'),
        'mac_desktop' => env('TRADING_MAC_DESKTOP_URL', 'https://downloads.apexprimeforex.com/setup.dmg'),
    ],

    'features' => [
        'deposits_enabled' => (bool) env('FEATURE_DEPOSITS_ENABLED', true),
        'withdrawals_enabled' => (bool) env('FEATURE_WITHDRAWALS_ENABLED', true),
        'kyc_required' => (bool) env('FEATURE_KYC_REQUIRED', true),
    ],
];`}
                </pre>
              </div>

              {/* .env Additions */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white font-mono">.env Environment Additions</span>
                  <button
                    onClick={() => handleCopy(`BROKER_NAME="Apex Prime Forex"\nBROKER_SHORT_NAME="ApexForex"\nBROKER_SUPPORT_EMAIL="support@apexprimeforex.com"\nBROKER_BASE_CURRENCY="USD"\nTRADING_WEB_TRADER_URL="https://webtrader.apexprimeforex.com"\nFEATURE_DEPOSITS_ENABLED=true\nFEATURE_WITHDRAWALS_ENABLED=true\nFEATURE_KYC_REQUIRED=true`, 'env_additions')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy .env
                  </button>
                </div>
                <pre className="bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[460px]">
{`# White-Label Broker Config
BROKER_NAME="Apex Prime Forex"
BROKER_SHORT_NAME="ApexForex"
BROKER_LOGO_URL="/assets/img/logo.svg"
BROKER_SUPPORT_EMAIL="support@apexprimeforex.com"
BROKER_BASE_CURRENCY="USD"
BROKER_DEFAULT_COUNTRY="US"

# Trading Platforms External Links
TRADING_WEB_TRADER_URL="https://webtrader.apexprimeforex.com"
TRADING_ANDROID_APP_URL="https://play.google.com/store/apps/details?id=com.apexprimeforex.trader"
TRADING_IOS_APP_URL="https://apps.apple.com/app/apex-prime-forex/id123456789"
TRADING_WINDOWS_DESKTOP_URL="https://downloads.apexprimeforex.com/setup.exe"
TRADING_MAC_DESKTOP_URL="https://downloads.apexprimeforex.com/setup.dmg"

# Feature Flags
FEATURE_DEPOSITS_ENABLED=true
FEATURE_WITHDRAWALS_ENABLED=true
FEATURE_KYC_REQUIRED=true`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: HANDOVER & PHASE 2 VERIFICATION CHECKLIST */}
        {/* ================================================================= */}
        {activeTab === 'handover' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Phase 1 Handover & Phase 2 Instructions
              </h2>
              <p className="text-xs text-slate-400">
                Verification checklist for Phase 1 completion and prerequisites for Prompt 2 (Authentication & Authorization).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Deliverable Checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" /> Phase 1 Deliverables Verification
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Task 1: Architecture & Directory Structure</div>
                      <div className="text-slate-400 text-[11px]">Defined domain layout under app/ (Enums, Services, Traits) & cPanel document root security.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Task 2: 11 Complete Database Migrations</div>
                      <div className="text-slate-400 text-[11px]">All tables created with foreign keys, indexes, constraints & strictly DECIMAL(15,2) precision.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Task 3: White-Label Config & .env</div>
                      <div className="text-slate-400 text-[11px]">Created config/broker.php with broker details, trading platform URLs, and feature flags.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Task 4: Base Client Shell (Blade + CSS)</div>
                      <div className="text-slate-400 text-[11px]">Client shell with fixed mobile bottom nav & desktop sidebar, dark slate theme, flash messages, CSRF.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Task 5: Base Admin Shell (Blade + CSS)</div>
                      <div className="text-slate-400 text-[11px]">Admin shell with complete 9-module sidebar (Clients, KYC, Deposits, Withdrawals, Transactions, Settings, Audit Logs).</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt 2 Handover */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" /> Instructions for Prompt 2 (Authentication)
                </h3>

                <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                  <p>
                    With the technical foundation, migrations, white-label config, and responsive shells established in Phase 1, you are ready to proceed to <strong className="text-white">Prompt 2: Authentication & User Registration System</strong>.
                  </p>

                  <div className="p-3 bg-[#0b0e14] border border-slate-800 rounded-lg space-y-2">
                    <div className="font-bold text-blue-400">Prompt 2 Objectives:</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                      <li>Implement Client Registration & Login (Blade forms using the client shell).</li>
                      <li>Implement Admin Login (/admin/login using admin shell).</li>
                      <li>Auto-create UserProfile & Wallet records on registration using DB Transactions.</li>
                      <li>Role-Based Middleware (<code className="text-blue-300">EnsureUserIsClient</code>, <code className="text-blue-300">EnsureUserIsAdmin</code>).</li>
                      <li>Email verification flow & account status enforcement (<code className="text-blue-300">disabled</code> state guard).</li>
                      <li>Audit Log records for login attempts & password resets.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0d131f] text-slate-500 text-xs py-4 px-6 text-center">
        Forex Broker Client CRM — Phase 1 Complete • Laravel 11 Architecture & Shell Deliverables
      </footer>
    </div>
  );
}
