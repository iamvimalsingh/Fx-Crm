import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminFinancialView } from './financial/AdminFinancialView';
import { AdminTradingAccountsView } from './trading/AdminTradingAccountsView';
import { AdminKycView } from './kyc/AdminKycView';
import { AdminSupportView } from './support/AdminSupportView';
import { NotificationCenter } from './notifications/NotificationCenter';
import {
  Shield,
  Layout,
  Users,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  CreditCard,
  Sliders,
  Lock,
  LogOut,
  RefreshCw,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface AdminDashboardShellProps {
  brokerName?: string;
  onLogoutRequested?: () => void;
}

export function AdminDashboardShell({
  brokerName = 'Forex Broker CRM',
  onLogoutRequested,
}: AdminDashboardShellProps) {
  const { user, logout } = useAuth();

  const [adminNav, setAdminNav] = useState<
    | 'dashboard'
    | 'trading_accounts'
    | 'clients'
    | 'deposits'
    | 'withdrawals'
    | 'transactions'
    | 'kyc'
    | 'support'
    | 'payment_methods'
    | 'settings'
    | 'audit_logs'
  >('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    if (onLogoutRequested) onLogoutRequested();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Admin Base Layout Shell & RBAC Dashboard
          </h2>
          <p className="text-xs text-slate-400">
            Authorized administrator session (<code className="text-emerald-400">{user?.email}</code> • role: <code className="text-emerald-400">{user?.role}</code>).
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition"
        >
          {loggingOut ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          <span>Sign Out Admin</span>
        </button>
      </div>

      {/* Admin Shell Frame */}
      <div className="border border-slate-800 rounded-xl bg-[#0d1117] min-h-[600px] flex flex-col md:flex-row overflow-hidden shadow-2xl">
        {/* Admin Sidebar */}
        <div className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0">
          <div className="h-16 px-4 border-b border-[#30363d] flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span>CRM Admin</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
              v1.0
            </span>
          </div>

          <div className="p-3 space-y-1 flex-grow overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Overview</div>
            <button
              onClick={() => setAdminNav('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'dashboard'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <Layout className="w-4 h-4" /> Dashboard
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">
              Client Management
            </div>
            <button
              onClick={() => setAdminNav('clients')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'clients'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" /> Clients
            </button>
            <button
              onClick={() => setAdminNav('trading_accounts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'trading_accounts'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" /> Trading Accounts
            </button>
            <button
              onClick={() => setAdminNav('kyc')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'kyc'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> KYC Applications
            </button>
            <button
              onClick={() => setAdminNav('support')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'support'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Support Tickets
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">
              Finance & Billing
            </div>
            <button
              onClick={() => setAdminNav('deposits')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'deposits'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" /> Deposits
            </button>
            <button
              onClick={() => setAdminNav('withdrawals')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'withdrawals'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Withdrawals
            </button>
            <button
              onClick={() => setAdminNav('transactions')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'transactions'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" /> Transactions
            </button>
            <button
              onClick={() => setAdminNav('payment_methods')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'payment_methods'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Payment Methods
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 pt-3 pb-1">
              System & Security
            </div>
            <button
              onClick={() => setAdminNav('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'settings'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" /> Broker Settings
            </button>
            <button
              onClick={() => setAdminNav('audit_logs')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition ${
                adminNav === 'audit_logs'
                  ? 'bg-[#1f6feb] text-white font-semibold shadow'
                  : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" /> Audit Logs
            </button>
          </div>

          {/* Admin User Footer in Sidebar */}
          <div className="p-3 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                A
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {user?.email || 'Administrator'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-500 hover:text-rose-400 p-1"
            >
              <LogOut className="w-4 h-4" />
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
              <NotificationCenter
                onNavigate={(tab) => {
                  if (tab === 'kyc') setAdminNav('kyc');
                  else if (tab === 'support') setAdminNav('support');
                }}
              />
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
              <div
                onClick={() => setAdminNav('kyc')}
                className="bg-[#21262d] border border-[#30363d] p-4 rounded-lg cursor-pointer hover:border-slate-500 transition"
              >
                <div className="text-xs text-slate-400 font-semibold mb-1">PENDING KYC</div>
                <div className="text-2xl font-bold text-amber-400">Review</div>
                <div className="text-[10px] text-slate-500 mt-1">Click to open applications</div>
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
            {adminNav === 'trading_accounts' && <AdminTradingAccountsView />}
            {adminNav === 'deposits' && <AdminFinancialView initialTab="deposits" />}
            {adminNav === 'withdrawals' && <AdminFinancialView initialTab="withdrawals" />}
            {adminNav === 'transactions' && <AdminFinancialView initialTab="transactions" />}
            {adminNav === 'audit_logs' && <AdminFinancialView initialTab="audit_logs" />}
            {adminNav === 'kyc' && <AdminKycView />}
            {adminNav === 'support' && <AdminSupportView />}

            {adminNav === 'dashboard' && (
              <div className="space-y-6">
                <AdminTradingAccountsView />
                <AdminFinancialView initialTab="deposits" />
              </div>
            )}

            {adminNav !== 'trading_accounts' &&
              adminNav !== 'deposits' &&
              adminNav !== 'withdrawals' &&
              adminNav !== 'transactions' &&
              adminNav !== 'audit_logs' &&
              adminNav !== 'kyc' &&
              adminNav !== 'support' &&
              adminNav !== 'dashboard' && (
                <div className="bg-[#21262d] border border-[#30363d] p-5 rounded-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                    <h4 className="text-sm font-bold text-white">Admin View: {adminNav.toUpperCase()}</h4>
                    <span className="text-xs text-emerald-400 font-mono">Netlify-Native RBAC Protected</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    This module shell provides administrative management for broker operations staff. All requests are guarded by stateless Netlify-native serverless RBAC tokens.
                  </p>

                  <div className="p-4 bg-[#161b22] border border-[#30363d] rounded text-xs space-y-2">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      Module Route Map
                    </div>
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
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
