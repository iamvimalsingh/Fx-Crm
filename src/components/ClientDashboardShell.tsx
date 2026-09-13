import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClientWalletView } from './financial/ClientWalletView';
import { ClientTradingAccountsView } from './trading/ClientTradingAccountsView';
import { ClientKycView } from './kyc/ClientKycView';
import { ClientSupportView } from './support/ClientSupportView';
import { NotificationCenter } from './notifications/NotificationCenter';
import {
  Layout,
  Wallet,
  Activity,
  FileText,
  Users,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  ExternalLink,
  LogOut,
  Smartphone,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ClientDashboardShellProps {
  brokerName?: string;
  brokerCurrency?: string;
  onLogoutRequested?: () => void;
}

export function ClientDashboardShell({
  brokerName = 'Forex Broker CRM',
  brokerCurrency = 'USD',
  onLogoutRequested,
}: ClientDashboardShellProps) {
  const { user, logout, token } = useAuth();

  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [clientNav, setClientNav] = useState<'home' | 'accounts' | 'wallet' | 'trade' | 'activity' | 'kyc' | 'support'>('home');
  const [supportTicketContextId, setSupportTicketContextId] = useState<string | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>('0.00');

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
  }, [token, clientNav]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    if (onLogoutRequested) onLogoutRequested();
  };

  const userInitials = user
    ? `${user.first_name?.[0] || 'U'}${user.last_name?.[0] || 'S'}`.toUpperCase()
    : 'CL';

  const handleDeepNavigate = (tab: string, contextId?: string) => {
    if (tab === 'kyc' || tab === 'support' || tab === 'wallet' || tab === 'accounts' || tab === 'home') {
      setClientNav(tab as any);
      if (contextId && tab === 'support') {
        setSupportTicketContextId(contextId);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Viewport & Identity Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layout className="w-4 h-4 text-blue-400" /> Client App Shell & Dashboard
          </h2>
          <p className="text-xs text-slate-400">
            Authenticated session connected to Netlify backend (<code className="text-blue-400">{user?.email}</code>).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile / Desktop Simulator Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewportMode('mobile')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                viewportMode === 'mobile' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile App
            </button>
            <button
              onClick={() => setViewportMode('desktop')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                viewportMode === 'desktop' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop Fluid
            </button>
          </div>

          {/* Quick Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition"
          >
            {loggingOut ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Shell Interactive Simulator Container */}
      <div
        className={`mx-auto transition-all duration-300 ${
          viewportMode === 'mobile'
            ? 'max-w-[390px] border-[10px] border-slate-800 rounded-[38px] shadow-2xl overflow-hidden bg-[#0b0e14] my-4 min-h-[720px] flex flex-col'
            : 'w-full border border-slate-800 rounded-xl bg-[#0b0e14] min-h-[640px]'
        }`}
      >
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
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 py-1">
                  Main Menu
                </div>
                <button
                  onClick={() => setClientNav('home')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'home'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <Layout className="w-4 h-4" /> Home Dashboard
                </button>
                <button
                  onClick={() => setClientNav('accounts')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'accounts'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Trading Accounts
                </button>
                <button
                  onClick={() => setClientNav('wallet')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'wallet'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <Wallet className="w-4 h-4" /> My Wallet
                </button>
                <button
                  onClick={() => setClientNav('trade')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'trade'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-4 h-4" /> Trading Terminal
                </button>
                <button
                  onClick={() => setClientNav('activity')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'activity'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Transactions
                </button>
                <button
                  onClick={() => setClientNav('kyc')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'kyc'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Identity & KYC
                </button>
                <button
                  onClick={() => setClientNav('support')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    clientNav === 'support'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#182030] hover:text-slate-200'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" /> Help & Support
                </button>
              </div>

              {/* User Profile Badge at bottom of sidebar */}
              <div className="p-3 border-t border-[#26334d] bg-[#0b0e14]/50 flex items-center justify-between">
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
                  title="Logout"
                  className="text-slate-500 hover:text-rose-400 p-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
                    {clientNav === 'accounts' && 'Trading Accounts'}
                    {clientNav === 'wallet' && 'Funding & Wallet'}
                    {clientNav === 'trade' && 'Web Trading Terminal'}
                    {clientNav === 'activity' && 'Account Activity & Ledger'}
                    {clientNav === 'kyc' && 'Client Profile & Identity Verification (KYC)'}
                    {clientNav === 'support' && 'Customer Support & Help Desk'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-[#182030] border border-[#26334d] px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[10px]">Wallet:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {user?.preferred_currency || brokerCurrency} ${walletBalance}
                  </span>
                </div>
                <NotificationCenter onNavigate={handleDeepNavigate} />
              </div>
            </div>

            {/* Body Content depending on clientNav */}
            <div className="p-4 space-y-4 flex-grow overflow-y-auto">
              {clientNav === 'home' && (
                <div className="space-y-4">
                  {/* Welcome banner */}
                  <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Total Wallet Balance
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                        {user?.preferred_currency || brokerCurrency}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3 font-mono">${walletBalance}</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setClientNav('wallet')}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
                      </button>
                      <button
                        onClick={() => setClientNav('wallet')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                      >
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
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      Submit your ID & Proof of Address to remove deposit restrictions.
                    </p>
                    <button
                      onClick={() => setClientNav('kyc')}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
                    >
                      Verify Identity (KYC)
                    </button>
                  </div>

                  {/* Live FX Rates */}
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

              {clientNav === 'accounts' && (
                <ClientTradingAccountsView />
              )}

              {clientNav === 'wallet' && (
                <ClientWalletView />
              )}

              {clientNav === 'trade' && (
                <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4 space-y-3 text-center">
                  <Activity className="w-8 h-8 text-blue-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">Trading Platform Bridge</h3>
                  <p className="text-xs text-slate-400">
                    Connect directly to configured WebTrader, MT4, or MT5 terminals.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-500 transition"
                  >
                    Launch WebTrader <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {clientNav === 'activity' && (
                <div className="space-y-4">
                  <ClientWalletView />
                </div>
              )}

              {clientNav === 'kyc' && (
                <ClientKycView />
              )}

              {clientNav === 'support' && (
                <ClientSupportView initialTicketId={supportTicketContextId} />
              )}
            </div>

            {/* Mobile Fixed Bottom Navigation (Only in mobile mode) */}
            {viewportMode === 'mobile' && (
              <nav className="h-14 bg-[#121824] border-t border-[#26334d] grid grid-cols-6 items-center px-1">
                <button
                  onClick={() => setClientNav('home')}
                  className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                    clientNav === 'home' ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Layout className="w-4 h-4" /> Home
                </button>
                <button
                  onClick={() => setClientNav('accounts')}
                  className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                    clientNav === 'accounts' ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Accounts
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
                  onClick={() => setClientNav('activity')}
                  className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                    clientNav === 'activity' ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Activity
                </button>
                <button
                  onClick={() => setClientNav('kyc')}
                  className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                    clientNav === 'kyc' ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> KYC
                </button>
                <button
                  onClick={() => setClientNav('support')}
                  className={`flex flex-col items-center justify-center text-[10px] font-medium gap-0.5 ${
                    clientNav === 'support' ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" /> Support
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
