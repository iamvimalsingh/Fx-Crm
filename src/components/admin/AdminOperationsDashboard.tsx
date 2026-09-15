import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserCheck,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Layers,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText,
  DollarSign,
} from 'lucide-react';

interface DashboardKpiData {
  kpis: {
    total_clients: number;
    active_clients: number;
    pending_kyc: number;
    pending_deposits: number;
    pending_withdrawals: number;
    open_support_tickets: number;
    active_trading_accounts: number;
  };
  urgent: {
    deposits: Array<{
      id: string;
      reference_no: string;
      amount: string;
      currency: string;
      created_at: string;
      payment_method_name: string;
      first_name: string;
      last_name: string;
      email: string;
    }>;
    withdrawals: Array<{
      id: string;
      reference_no: string;
      amount: string;
      currency: string;
      created_at: string;
      payment_method_name: string;
      first_name: string;
      last_name: string;
      email: string;
    }>;
    kyc: Array<{
      id: string;
      user_id: string;
      first_name: string;
      last_name: string;
      status: string;
      submitted_at: string;
      email: string;
      country: string;
    }>;
  };
}

interface AdminOperationsDashboardProps {
  onNavigateTab: (tab: any) => void;
}

export function AdminOperationsDashboard({ onNavigateTab }: AdminOperationsDashboardProps) {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await fetch('/api/admin/dashboard/kpis', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to load operations metrics');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error communicating with broker backend');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchKpis();
  };

  if (loading) {
    return (
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Querying real-time broker ledger & operational metrics...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {
    total_clients: 0,
    active_clients: 0,
    pending_kyc: 0,
    pending_deposits: 0,
    pending_withdrawals: 0,
    open_support_tickets: 0,
    active_trading_accounts: 0,
  };

  const urgentDeposits = data?.urgent.deposits || [];
  const urgentWithdrawals = data?.urgent.withdrawals || [];
  const urgentKyc = data?.urgent.kyc || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Broker Operations Control Center</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Database Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational queues, real user registrations, and verified financial state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1b222d] border border-[#232c3b] text-slate-200 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Grid (7 core metrics from real DB queries) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clients */}
        <div
          onClick={() => onNavigateTab('clients')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-purple-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Clients</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">{kpis.total_clients}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Registered trader accounts</div>
          </div>
        </div>

        {/* Active Clients */}
        <div
          onClick={() => onNavigateTab('clients')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-emerald-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Clients</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono">{kpis.active_clients}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Good standing (status: active)</div>
          </div>
        </div>

        {/* Pending KYC */}
        <div
          onClick={() => onNavigateTab('kyc')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-amber-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending KYC</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-400 font-mono">{kpis.pending_kyc}</div>
            <div className="text-[11px] text-amber-500/80 mt-0.5">Under review & unverified</div>
          </div>
        </div>

        {/* Active Trading Accounts */}
        <div
          onClick={() => onNavigateTab('trading_accounts')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-indigo-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Accounts</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-400 font-mono">{kpis.active_trading_accounts}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">MT4/MT5/cTrader/WebTrader</div>
          </div>
        </div>

        {/* Pending Deposits */}
        <div
          onClick={() => onNavigateTab('deposits')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-emerald-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Deposit Queue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono">{kpis.pending_deposits}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Awaiting proof review</div>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div
          onClick={() => onNavigateTab('withdrawals')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-rose-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Withdrawal Queue</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-400 font-mono">{kpis.pending_withdrawals}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Awaiting dispatch approval</div>
          </div>
        </div>

        {/* Open Support Tickets */}
        <div
          onClick={() => onNavigateTab('support')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-cyan-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Open Inquiries</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-cyan-400 font-mono">{kpis.open_support_tickets}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Open & in-progress tickets</div>
          </div>
        </div>

        {/* System Ledger Status */}
        <div
          onClick={() => onNavigateTab('transactions')}
          className="bg-[#0b0e14] border border-[#1b222d] hover:border-purple-500/40 p-4 rounded-xl shadow-lg cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ledger Health</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-purple-300 font-mono">Immutable</div>
            <div className="text-[11px] text-slate-500 mt-0.5">High-precision double ledger</div>
          </div>
        </div>
      </div>

      {/* Urgent Attention Section (Top 3 queues needing action) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Urgent Operational Action Queues</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Pending Deposits Queue */}
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#1b222d] bg-[#0e121a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase">Deposit Verification</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {kpis.pending_deposits} Pending
              </span>
            </div>

            <div className="p-4 flex-grow space-y-3">
              {urgentDeposits.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <p>Queue is empty</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">All deposits have been reviewed</p>
                </div>
              ) : (
                urgentDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-2.5 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white truncate max-w-[140px]">
                        {dep.first_name} {dep.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{dep.reference_no}</div>
                      <div className="text-[10px] text-slate-500">{dep.payment_method_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 font-mono">
                        +{Number(dep.amount).toFixed(2)} {dep.currency}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(dep.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#1b222d] bg-[#07090e]">
              <button
                onClick={() => onNavigateTab('deposits')}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold transition"
              >
                <span>Inspect Deposit Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Pending Withdrawals Queue */}
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#1b222d] bg-[#0e121a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white uppercase">Withdrawal Dispatch</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {kpis.pending_withdrawals} Pending
              </span>
            </div>

            <div className="p-4 flex-grow space-y-3">
              {urgentWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <p>Queue is empty</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">All withdrawal requests dispatched</p>
                </div>
              ) : (
                urgentWithdrawals.map((wth) => (
                  <div
                    key={wth.id}
                    className="p-2.5 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white truncate max-w-[140px]">
                        {wth.first_name} {wth.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{wth.reference_no}</div>
                      <div className="text-[10px] text-slate-500">{wth.payment_method_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-400 font-mono">
                        -{Number(wth.amount).toFixed(2)} {wth.currency}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(wth.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#1b222d] bg-[#07090e]">
              <button
                onClick={() => onNavigateTab('withdrawals')}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold transition"
              >
                <span>Inspect Withdrawal Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Pending KYC Submissions Queue */}
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#1b222d] bg-[#0e121a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase">KYC Compliance</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {kpis.pending_kyc} Pending
              </span>
            </div>

            <div className="p-4 flex-grow space-y-3">
              {urgentKyc.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <p>Queue is empty</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">All identity profiles verified</p>
                </div>
              ) : (
                urgentKyc.map((kyc) => (
                  <div
                    key={kyc.id}
                    className="p-2.5 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white truncate max-w-[140px]">
                        {kyc.first_name} {kyc.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{kyc.email}</div>
                      <div className="text-[10px] text-slate-500">{kyc.country || 'International'}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {kyc.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString() : 'Pending'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#1b222d] bg-[#07090e]">
              <button
                onClick={() => onNavigateTab('kyc')}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-semibold transition"
              >
                <span>Inspect KYC Submissions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
