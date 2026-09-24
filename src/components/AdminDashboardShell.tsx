import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../lib/router';
import { AdminFinancialView } from './financial/AdminFinancialView';
import { AdminTradingAccountsView } from './trading/AdminTradingAccountsView';
import { AdminKycView } from './kyc/AdminKycView';
import { AdminSupportView } from './support/AdminSupportView';
import { AdminOperationsDashboard } from './admin/AdminOperationsDashboard';
import { AdminClientDirectoryView } from './admin/AdminClientDirectoryView';
import { AdminNotificationsView } from './admin/AdminNotificationsView';
import { AdminBrokerSettingsView } from './admin/AdminBrokerSettingsView';
import { AdminStaffManagementView } from './admin/AdminStaffManagementView';
import { NotificationCenter } from './notifications/NotificationCenter';
import {
  Shield,
  Layout,
  Users,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  CreditCard,
  Sliders,
  Lock,
  LogOut,
  RefreshCw,
  Layers,
  HelpCircle,
  Menu,
  X,
  Bell,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

interface AdminViewErrorBoundaryProps {
  children: React.ReactNode;
  moduleName?: string;
}

interface AdminViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminViewErrorBoundary extends React.Component<
  AdminViewErrorBoundaryProps,
  AdminViewErrorBoundaryState
> {
  constructor(props: AdminViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AdminViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[AdminViewErrorBoundary:${this.props.moduleName}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-red-500/30 bg-red-950/20 text-slate-200 space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="font-semibold text-sm">
              Error rendering {this.props.moduleName || 'view'}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {this.state.error?.message || 'A client-side error occurred in this module.'}
          </p>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
            >
              Retry View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AdminDashboardShellProps {
  brokerName?: string;
  onLogoutRequested?: () => void;
}

export function AdminDashboardShell({
  brokerName = 'ForexCore',
  onLogoutRequested,
}: AdminDashboardShellProps) {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  const [adminNav, setAdminNav] = useState<
    | 'dashboard'
    | 'clients'
    | 'trading_accounts'
    | 'deposits'
    | 'withdrawals'
    | 'transfers'
    | 'transactions'
    | 'kyc'
    | 'support'
    | 'notifications'
    | 'staff'
    | 'settings'
    | 'audit_logs'
  >('dashboard');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    if (onLogoutRequested) {
      onLogoutRequested();
    } else {
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="h-16 bg-[#0b0e14] border-b border-[#1b222d] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-[#141a24] text-slate-300 hover:text-white border border-[#232c3b]"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-md shadow-purple-600/20">
              <Shield className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">{brokerName} Back Office</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Operations Control
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter
            onNavigate={(tab) => {
              if (tab === 'kyc') setAdminNav('kyc');
              else if (tab === 'support') setAdminNav('support');
            }}
          />

          <div className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1">
            <div className="text-right">
              <div className="text-xs font-semibold text-white truncate max-w-[130px]">
                {user ? `${user.first_name} ${user.last_name}` : 'Administrator'}
              </div>
              <div className="text-[10px] text-purple-400 font-mono">Role: Back Office Admin</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
              A
            </div>
          </div>

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
        {/* Sidebar Navigation */}
        <aside
          className={`fixed md:sticky top-16 z-20 h-[calc(100vh-4rem)] w-64 bg-[#0b0e14] border-r border-[#1b222d] flex flex-col flex-shrink-0 transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-3 space-y-1 flex-grow overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-2">
              Overview
            </div>
            <button
              onClick={() => {
                setAdminNav('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'dashboard'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Layout className="w-4 h-4 text-purple-400" /> Operations Dashboard
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 pt-4 pb-2">
              Client Management
            </div>
            <button
              onClick={() => {
                setAdminNav('clients');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'clients'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-blue-400" /> Client Accounts
            </button>
            <button
              onClick={() => {
                setAdminNav('trading_accounts');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'trading_accounts'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-400" /> Trading Accounts
            </button>
            <button
              onClick={() => {
                setAdminNav('kyc');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'kyc'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> KYC Review Queue
            </button>
            <button
              onClick={() => {
                setAdminNav('support');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'support'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" /> Support Desk
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 pt-4 pb-2">
              Financial Operations
            </div>
            <button
              onClick={() => {
                setAdminNav('deposits');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'deposits'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Deposit Requests
            </button>
            <button
              onClick={() => {
                setAdminNav('withdrawals');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'withdrawals'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-rose-400" /> Withdrawal Approvals
            </button>
            <button
              onClick={() => {
                setAdminNav('transfers');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'transfers'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 text-cyan-400" /> Internal Transfers Queue
            </button>
            <button
              onClick={() => {
                setAdminNav('transactions');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'transactions'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-cyan-400" /> Ledger Audit Trail
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 pt-4 pb-2">
              System & Governance
            </div>
            <button
              onClick={() => {
                setAdminNav('notifications');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'notifications'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Bell className="w-4 h-4 text-amber-400" /> Client Broadcasts
            </button>
            <button
              onClick={() => {
                setAdminNav('staff');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'staff'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-400" /> Staff Administrators
            </button>
            <button
              onClick={() => {
                setAdminNav('audit_logs');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'audit_logs'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Lock className="w-4 h-4 text-cyan-400" /> Security Audit Trail
            </button>
            <button
              onClick={() => {
                setAdminNav('settings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                adminNav === 'settings'
                  ? 'bg-purple-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:bg-[#141a24] hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4 text-purple-400" /> Broker Settings
            </button>
          </div>

          <div className="p-3 border-t border-[#1b222d] bg-[#07090e] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                A
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {user?.email || 'Back Office Staff'}
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
          <div className="flex items-center justify-between border-b border-[#1b222d] pb-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight uppercase">
                {adminNav === 'dashboard'
                  ? 'Operations Overview'
                  : adminNav === 'clients'
                  ? 'Client Directory'
                  : adminNav === 'trading_accounts'
                  ? 'Trading Accounts Registry'
                  : adminNav === 'deposits'
                  ? 'Deposit Verification Queue'
                  : adminNav === 'withdrawals'
                  ? 'Withdrawal Approval Queue'
                  : adminNav === 'transfers'
                  ? 'Internal Transfers Bridge Queue'
                  : adminNav === 'transactions'
                  ? 'Ledger Audit Trail'
                  : adminNav === 'kyc'
                  ? 'KYC Compliance Queue'
                  : adminNav === 'support'
                  ? 'Support Desk'
                  : adminNav === 'notifications'
                  ? 'Client Broadcasts'
                  : adminNav === 'staff'
                  ? 'Staff Administrator Directory & Governance'
                  : adminNav === 'audit_logs'
                  ? 'Security Audit Trail'
                  : 'Broker Settings'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Broker operations and regulatory risk management console
              </p>
            </div>
          </div>

          {/* Dynamic Module Views */}
          <AdminViewErrorBoundary key={adminNav} moduleName={adminNav}>
            {adminNav === 'dashboard' && (
              <AdminOperationsDashboard onNavigateTab={(tab) => setAdminNav(tab)} />
            )}
            {adminNav === 'clients' && <AdminClientDirectoryView />}
            {adminNav === 'trading_accounts' && <AdminTradingAccountsView />}
            {adminNav === 'deposits' && <AdminFinancialView initialTab="deposits" />}
            {adminNav === 'withdrawals' && <AdminFinancialView initialTab="withdrawals" />}
            {adminNav === 'transfers' && <AdminFinancialView initialTab="transfers" />}
            {adminNav === 'transactions' && <AdminFinancialView initialTab="transactions" />}
            {adminNav === 'audit_logs' && <AdminFinancialView initialTab="audit_logs" />}
            {adminNav === 'kyc' && <AdminKycView />}
            {adminNav === 'support' && <AdminSupportView />}
            {adminNav === 'notifications' && <AdminNotificationsView />}
            {adminNav === 'staff' && <AdminStaffManagementView />}
            {adminNav === 'settings' && <AdminBrokerSettingsView />}
          </AdminViewErrorBoundary>
        </main>
      </div>
    </div>
  );
}
