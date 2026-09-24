import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../lib/router';
import { ClientWalletView } from './financial/ClientWalletView';
import { ClientTradingAccountsView } from './trading/ClientTradingAccountsView';
import { ClientKycView } from './kyc/ClientKycView';
import { ClientSupportView } from './support/ClientSupportView';
import { ClientTraderCockpit } from './trading/ClientTraderCockpit';
import { NotificationCenter } from './notifications/NotificationCenter';
import {
  Layout,
  Wallet,
  Activity,
  FileText,
  User as UserIcon,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  ExternalLink,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  HelpCircle,
  Menu,
  X,
  Globe,
  Lock,
  Clock,
} from 'lucide-react';

export type KycProgressionStatus = 'not_started' | 'action_required' | 'under_review' | 'verified' | 'rejected';

interface ClientDashboardShellProps {
  brokerName?: string;
  brokerCurrency?: string;
  onLogoutRequested?: () => void;
}

export function ClientDashboardShell({
  brokerName = 'ForexCore Trader Room',
  brokerCurrency = 'USD',
  onLogoutRequested,
}: ClientDashboardShellProps) {
  const { user, logout, token } = useAuth();
  const { navigate } = useRouter();

  const [clientNav, setClientNav] = useState<
    'home' | 'accounts' | 'wallet' | 'trade' | 'activity' | 'kyc' | 'support' | 'profile'
  >('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportTicketContextId, setSupportTicketContextId] = useState<string | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>('0.00');
  const [kycStatus, setKycStatus] = useState<KycProgressionStatus>('not_started');
  const [kycRejectionReason, setKycRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/financial/wallet', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.balance) {
          setWalletBalance(data.data.balance);
        }
      })
      .catch(() => {});

    fetch('/api/kyc/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const profile = data?.data?.profile ?? data?.data;
        const rawStatus = profile?.status;
        const reason = profile?.rejection_reason || null;
        setKycRejectionReason(reason);

        if (rawStatus === 'approved') {
          setKycStatus('verified');
        } else if (rawStatus === 'rejected') {
          setKycStatus('rejected');
        } else if (rawStatus === 'under_review') {
          setKycStatus('under_review');
        } else if (rawStatus === 'pending') {
          setKycStatus('action_required');
        } else {
          setKycStatus('not_started');
        }
      })
      .catch(() => {
        setKycStatus('not_started');
        setKycRejectionReason(null);
      });
  }, [token]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    if (onLogoutRequested) {
      onLogoutRequested();
    } else {
      navigate('/login', { replace: true });
    }
  };

  const userInitials = user
    ? `${user.first_name?.[0] || 'U'}${user.last_name?.[0] || 'S'}`.toUpperCase()
    : 'TR';

  const handleDeepNavigate = (tab: string, contextId?: string) => {
    if (
      tab === 'kyc' ||
      tab === 'support' ||
      tab === 'wallet' ||
      tab === 'accounts' ||
      tab === 'home' ||
      tab === 'profile' ||
      tab === 'trade' ||
      tab === 'activity'
    ) {
      setClientNav(tab as any);
      if (contextId && tab === 'support') {
        setSupportTicketContextId(contextId);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col">
      {/* Top Application Bar */}
      <header className="h-16 bg-[#0c1018] border-b border-[#1b2333] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-[#141b29] text-slate-300 hover:text-white border border-[#232d40]"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">{brokerName}</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Trader Room
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Header KYC Status Badge - Standardized 5-State Progression */}
          {kycStatus === 'verified' && (
            <button
              onClick={() => setClientNav('kyc')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition"
              title="Identity verification approved"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>KYC Verified</span>
            </button>
          )}

          {kycStatus === 'under_review' && (
            <button
              onClick={() => setClientNav('kyc')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition"
              title="Identity verification in review"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>KYC In Review</span>
            </button>
          )}

          {kycStatus === 'action_required' && (
            <button
              onClick={() => setClientNav('kyc')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition"
              title="Identity verification requires document submission"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Action Required</span>
            </button>
          )}

          {kycStatus === 'rejected' && (
            <button
              onClick={() => setClientNav('kyc')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition"
              title={kycRejectionReason ? `KYC Rejected: ${kycRejectionReason}` : 'KYC Rejected: Re-upload documents'}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>KYC Rejected</span>
            </button>
          )}

          {kycStatus === 'not_started' && (
            <button
              onClick={() => setClientNav('kyc')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition"
              title="Verify identity to unlock full trading limits"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Verify KYC</span>
            </button>
          )}

          {/* Quick Wallet Pill */}
          <button
            onClick={() => setClientNav('wallet')}
            className="bg-[#121824] hover:bg-[#182030] border border-[#232d40] px-3 py-1.5 rounded-full flex items-center gap-2 text-xs transition"
          >
            <Wallet className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline text-slate-400 text-[11px]">Wallet:</span>
            <span className="text-emerald-400 font-bold font-mono">
              {user?.preferred_currency || brokerCurrency} ${walletBalance}
            </span>
          </button>

          {/* In-app notification center */}
          <NotificationCenter onNavigate={handleDeepNavigate} />

          {/* User initials / quick profile */}
          <button
            onClick={() => setClientNav('profile')}
            className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[#141b29] transition"
          >
            <div className="text-right">
              <div className="text-xs font-semibold text-white truncate max-w-[120px]">
                {user ? `${user.first_name} ${user.last_name}` : 'Client'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {String(user?.id || '').slice(0, 8) || 'Active'}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
              {userInitials}
            </div>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition disabled:opacity-50"
          >
            {loggingOut ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-grow flex w-full">
        {/* Desktop Sidebar Navigation */}
        <aside
          className={`fixed md:sticky top-16 z-20 h-[calc(100vh-4rem)] w-64 bg-[#0c1018] border-r border-[#1b2333] flex flex-col flex-shrink-0 transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-3 space-y-1 flex-grow overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 py-2">
              Trading & Accounts
            </div>
            <button
              onClick={() => {
                setClientNav('home');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'home'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <Layout className="w-4 h-4 text-blue-400" /> Overview
            </button>
            <button
              onClick={() => {
                setClientNav('accounts');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'accounts'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-400" /> Trading Accounts
            </button>
            <button
              onClick={() => {
                setClientNav('wallet');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'wallet'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <Wallet className="w-4 h-4 text-emerald-400" /> Wallet & Funds
            </button>
            <button
              onClick={() => {
                setClientNav('trade');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'trade'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4 text-cyan-400" /> WebTrader Terminal
            </button>
            <button
              onClick={() => {
                setClientNav('activity');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'activity'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-400" /> Account Activity
            </button>

            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 pt-4 pb-2">
              Verification & Support
            </div>
            <button
              onClick={() => {
                setClientNav('kyc');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'kyc'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" /> Identity & KYC
            </button>
            <button
              onClick={() => {
                setClientNav('support');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'support'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-purple-400" /> Help & Support
            </button>
            <button
              onClick={() => {
                setClientNav('profile');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                clientNav === 'profile'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141b29] hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-4 h-4 text-rose-400" /> Profile & Security
            </button>
          </div>

          {/* User Profile Badge at bottom of sidebar */}
          <div className="p-3 border-t border-[#1b2333] bg-[#080b12] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {userInitials}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'Client Account'}
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {user?.email || '—'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Backdrop for mobile menu */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 z-10 md:hidden backdrop-blur-sm"
          />
        )}

        {/* Main Content Area */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Breadcrumb / Title Bar */}
          <div className="flex items-center justify-between border-b border-[#1b2333] pb-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {clientNav === 'home' && 'Trader Room Overview'}
                {clientNav === 'accounts' && 'Trading Accounts'}
                {clientNav === 'wallet' && 'Funding & Multi-Currency Wallet'}
                {clientNav === 'trade' && 'WebTrader Platform'}
                {clientNav === 'activity' && 'Account Activity & Ledger'}
                {clientNav === 'kyc' && 'Identity & Verification (KYC)'}
                {clientNav === 'support' && 'Support Tickets & Help Desk'}
                {clientNav === 'profile' && 'Client Profile & Security'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {clientNav === 'home' && 'Real-time overview of your balances, margin status, and live market rates'}
                {clientNav === 'accounts' && 'Create and manage MT4, MT5, cTrader, and WebTrader live accounts'}
                {clientNav === 'wallet' && 'Deposit, withdraw, and transfer funds securely'}
                {clientNav === 'trade' && 'Launch live trading terminal and execute market orders'}
                {clientNav === 'activity' && 'Detailed chronological history of all deposits, withdrawals, and ledger entries'}
                {clientNav === 'kyc' && 'Upload proof of identity and address documents for regulatory approval'}
                {clientNav === 'support' && 'Direct line to broker support staff and account managers'}
                {clientNav === 'profile' && 'Manage your personal details, registered currency, and security credentials'}
              </p>
            </div>
          </div>

          {/* Tab Views */}
          {clientNav === 'home' && (
            <ClientTraderCockpit
              onNavigate={handleDeepNavigate}
              brokerCurrency={brokerCurrency}
              brokerName={brokerName}
              kycStatus={kycStatus}
              kycRejectionReason={kycRejectionReason}
            />
          )}

          {clientNav === 'accounts' && <ClientTradingAccountsView />}
          {clientNav === 'wallet' && <ClientWalletView />}
          {clientNav === 'activity' && <ClientWalletView />}
          {clientNav === 'kyc' && <ClientKycView />}
          {clientNav === 'support' && <ClientSupportView initialTicketId={supportTicketContextId} />}

          {clientNav === 'trade' && (
            <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-8 text-center space-y-4 max-w-xl mx-auto my-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">WebTrader Platform Bridge</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Trade directly from your browser with live market execution, advanced charting, and integrated risk management.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setClientNav('accounts')}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition"
                >
                  Configure Trading Account <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {clientNav === 'profile' && (
            <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-6 sm:p-8 space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-400" /> Account Details & Preferences
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Registered personal information and security status
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Full Legal Name</span>
                  <span className="text-white font-semibold">{user?.first_name} {user?.last_name}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Email Address</span>
                  <span className="text-white font-semibold font-mono">{user?.email}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Country of Residence</span>
                  <span className="text-white font-semibold">{user?.country || 'US'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Account Base Currency</span>
                  <span className="text-white font-semibold font-mono">{user?.preferred_currency || brokerCurrency}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Account Role</span>
                  <span className="text-blue-400 font-semibold uppercase">{user?.role}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333]">
                  <span className="text-slate-500 block text-[11px] mb-1">Authentication Type</span>
                  <span className="text-emerald-400 font-semibold">JWT Session Active</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1b2333] flex justify-between items-center">
                <span className="text-xs text-slate-500">Need to update legal details or phone number?</span>
                <button
                  onClick={() => setClientNav('support')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
