import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Sliders,
  RefreshCw,
  Search,
  Check,
  User,
  DollarSign,
  Lock,
  Eye,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Client360Drawer } from '../admin/Client360Drawer';

interface DepositRecord {
  id: string;
  reference_no: string;
  user_id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_method_name: string;
  client_notes?: string;
  admin_notes?: string;
  rejection_reason?: string;
  created_at: string;
}

interface WithdrawalRecord {
  id: string;
  reference_no: string;
  user_id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_method_name: string;
  payout_details: Record<string, any>;
  client_notes?: string;
  admin_notes?: string;
  rejection_reason?: string;
  created_at: string;
}

interface TransactionRecord {
  id: string;
  transaction_no: string;
  user_id: string;
  type: string;
  amount: string;
  currency: string;
  balance_before: string;
  balance_after: string;
  reserved_before: string;
  reserved_after: string;
  status: string;
  description: string;
  created_at: string;
}

interface AuditLogRecord {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

interface AdminFinancialViewProps {
  initialTab?: 'deposits' | 'withdrawals' | 'transfers' | 'transactions' | 'adjustments' | 'audit_logs';
}

export function AdminFinancialView({ initialTab = 'deposits' }: AdminFinancialViewProps) {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'transfers' | 'transactions' | 'adjustments' | 'audit_logs'>(
    initialTab
  );

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Client 360 Inspection Drawer State
  const [inspectClientId, setInspectClientId] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>('all');
  const [txnDateFilter, setTxnDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');

  // Approval / Rejection Action Modals
  const [actionItem, setActionItem] = useState<{
    type: 'approve_deposit' | 'reject_deposit' | 'approve_withdrawal' | 'reject_withdrawal';
    id: string;
    reference: string;
    amount: string;
  } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Manual Adjustment Form
  const [adjUserId, setAdjUserId] = useState('');
  const [adjType, setAdjType] = useState<'adjustment_credit' | 'adjustment_debit'>('adjustment_credit');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');

  const fetchAdminData = async () => {
    if (!token) return;
    try {
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };

      const [resDep, resWth, resTxn, resAudit] = await Promise.all([
        fetch('/api/financial/deposits', { headers }),
        fetch('/api/financial/withdrawals', { headers }),
        fetch('/api/financial/transactions', { headers }),
        fetch('/api/financial/admin/audit-logs', { headers }),
      ]);

      const dataDep = await resDep.json();
      const dataWth = await resWth.json();
      const dataTxn = await resTxn.json();
      const dataAudit = await resAudit.json();

      if (resDep.ok) setDeposits(dataDep.data);
      if (resWth.ok) setWithdrawals(dataWth.data);
      if (resTxn.ok) setTransactions(dataTxn.data);
      if (resAudit.ok) setAuditLogs(dataAudit.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch administrator financial queues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  // Process Approval / Rejection
  const handleExecuteReviewAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !actionItem) return;

    try {
      setSubmittingAction(true);
      setError(null);

      let endpoint = '';
      let payload: any = {};

      if (actionItem.type === 'approve_deposit') {
        endpoint = `/api/financial/admin/deposits/${actionItem.id}/approve`;
        payload = { admin_notes: adminNotes || null };
      } else if (actionItem.type === 'reject_deposit') {
        if (!rejectionReason.trim()) throw new Error('Rejection reason is strictly required');
        endpoint = `/api/financial/admin/deposits/${actionItem.id}/reject`;
        payload = { rejection_reason: rejectionReason, admin_notes: adminNotes || null };
      } else if (actionItem.type === 'approve_withdrawal') {
        endpoint = `/api/financial/admin/withdrawals/${actionItem.id}/approve`;
        payload = { admin_notes: adminNotes || null };
      } else if (actionItem.type === 'reject_withdrawal') {
        if (!rejectionReason.trim()) throw new Error('Rejection reason is strictly required');
        endpoint = `/api/financial/admin/withdrawals/${actionItem.id}/reject`;
        payload = { rejection_reason: rejectionReason, admin_notes: adminNotes || null };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Action failed');
      }

      setSuccessMessage(`Order ${actionItem.reference} processed successfully.`);
      setActionItem(null);
      setAdminNotes('');
      setRejectionReason('');
      fetchAdminData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Manual Adjustment
  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setSubmittingAction(true);
      setError(null);

      const res = await fetch('/api/financial/admin/adjustments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: adjUserId.trim(),
          type: adjType,
          amount: adjAmount,
          description: adjDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Manual adjustment failed');
      }

      setSuccessMessage(
        `Manual adjustment executed. New client balance: $${data.data.wallet.balance} USD`
      );
      setAdjAmount('');
      setAdjDesc('');
      fetchAdminData();
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      d.reference_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.payment_method_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      w.reference_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.payment_method_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Filtered transactions for unified global ledger
  const filteredTransactions = transactions.filter((t) => {
    const matchesType = txnTypeFilter === 'all' || t.type === txnTypeFilter;
    const matchesSearch =
      !searchTerm ||
      t.transaction_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesType || !matchesSearch) return false;

    if (txnDateFilter === 'all') return true;
    const date = new Date(t.created_at).getTime();
    const now = Date.now();
    if (txnDateFilter === 'today') return now - date <= 24 * 60 * 60 * 1000;
    if (txnDateFilter === '7d') return now - date <= 7 * 24 * 60 * 60 * 1000;
    if (txnDateFilter === '30d') return now - date <= 30 * 24 * 60 * 60 * 1000;
    return true;
  });

  const transferTransactions = transactions.filter(
    (t) => t.type === 'internal_transfer' || t.type === 'transfer' || t.type.includes('transfer')
  );

  const pendingDepositsCount = deposits.filter((d) => d.status === 'pending').length;
  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Queue Metrics */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Financial CRM & Escrow Settlement Desk</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly non-floating-point <code className="text-blue-400">Decimal</code> ledger accounting. Real-time review and manual clearing.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Queues</span>
          </button>
        </div>

        {/* Action Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => {
              setActiveTab('deposits');
              setStatusFilter('pending');
            }}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              pendingDepositsCount > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-[#21262d] border-[#30363d]'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Pending Deposits</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{pendingDepositsCount}</div>
            <div className="text-[10px] text-slate-500 mt-1">Awaiting bank verification</div>
          </div>

          <div
            onClick={() => {
              setActiveTab('withdrawals');
              setStatusFilter('pending');
            }}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              pendingWithdrawalsCount > 0
                ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-[#21262d] border-[#30363d]'
            }`}
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Pending Payouts</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{pendingWithdrawalsCount}</div>
            <div className="text-[10px] text-slate-500 mt-1">Funds reserved, await dispatch</div>
          </div>

          <div
            onClick={() => setActiveTab('transactions')}
            className="p-3 rounded-lg bg-[#21262d] border border-[#30363d] hover:bg-[#30363d]/50 transition cursor-pointer"
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Ledger Entries</div>
            <div className="text-xl font-bold text-white mt-0.5">{transactions.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">Immutable journal records</div>
          </div>

          <div
            onClick={() => setActiveTab('adjustments')}
            className="p-3 rounded-lg bg-[#21262d] border border-[#30363d] hover:bg-[#30363d]/50 transition cursor-pointer"
          >
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Adjustments</div>
            <div className="text-xl font-bold text-indigo-400 mt-0.5">Manual Desk</div>
            <div className="text-[10px] text-slate-500 mt-1">Credit & debit corrections</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="border-b border-[#30363d] px-6 pt-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('deposits')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'deposits'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Deposits Review Queue</span>
              {pendingDepositsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                  {pendingDepositsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'withdrawals'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Withdrawals Review Queue</span>
              {pendingWithdrawalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                  {pendingWithdrawalsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('transfers')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'transfers'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Internal Transfers Queue</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px] border border-slate-700">
                Offline
              </span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Global Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('adjustments')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'adjustments'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Manual Adjustments</span>
            </button>

            <button
              onClick={() => setActiveTab('audit_logs')}
              className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'audit_logs'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Audit Trail</span>
            </button>
          </div>

          {/* Search bar & status pill filter for lists */}
          {(activeTab === 'deposits' || activeTab === 'withdrawals' || activeTab === 'transactions' || activeTab === 'transfers') && (
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter by ref, user, text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#21262d] border border-[#30363d] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-52"
                />
              </div>

              {(activeTab === 'deposits' || activeTab === 'withdrawals') && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-[#21262d] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Only</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}

              {activeTab === 'transactions' && (
                <>
                  <select
                    value={txnTypeFilter}
                    onChange={(e) => setTxnTypeFilter(e.target.value)}
                    className="bg-[#21262d] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Transaction Types</option>
                    <option value="deposit">Deposits</option>
                    <option value="withdrawal">Withdrawals</option>
                    <option value="withdrawal_reserve">Withdrawal Reserves</option>
                    <option value="adjustment_credit">Credit Adjustments</option>
                    <option value="adjustment_debit">Debit Adjustments</option>
                    <option value="transfer">Internal Transfers</option>
                  </select>

                  <select
                    value={txnDateFilter}
                    onChange={(e) => setTxnDateFilter(e.target.value as any)}
                    className="bg-[#21262d] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today (24h)</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* DEPOSITS QUEUE */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              {filteredDeposits.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No deposits matching current filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#30363d] text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-3">Client User</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Client Notes</th>
                        <th className="py-2.5 px-3 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#21262d]">
                      {filteredDeposits.map((dep) => (
                        <tr key={dep.id} className="hover:bg-[#21262d]/50 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-200">{dep.reference_no}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setInspectClientId(dep.user_id)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-mono transition group max-w-[150px]"
                              title="Inspect Client 360°"
                            >
                              <span className="truncate max-w-[95px]">{dep.user_id}</span>
                              <Eye className="w-3 h-3 text-purple-400 group-hover:text-purple-200 flex-shrink-0" />
                            </button>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{dep.payment_method_name}</td>
                          <td className="py-3 px-3 font-bold font-mono text-emerald-400">
                            +${dep.amount} {dep.currency}
                          </td>
                          <td className="py-3 px-3">
                            {dep.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                                <Clock className="w-3 h-3" /> Pending Review
                              </span>
                            )}
                            {dep.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {dep.status === 'rejected' && (
                              <span
                                title={dep.rejection_reason}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold cursor-help"
                              >
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(dep.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate" title={dep.client_notes || ''}>
                            {dep.client_notes || '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {dep.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    setActionItem({
                                      type: 'approve_deposit',
                                      id: dep.id,
                                      reference: dep.reference_no,
                                      amount: dep.amount,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow transition"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() =>
                                    setActionItem({
                                      type: 'reject_deposit',
                                      id: dep.id,
                                      reference: dep.reference_no,
                                      amount: dep.amount,
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* WITHDRAWALS QUEUE */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              {filteredWithdrawals.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No withdrawals matching current filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#30363d] text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-3">Client User</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payout Destination</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#21262d]">
                      {filteredWithdrawals.map((wth) => (
                        <tr key={wth.id} className="hover:bg-[#21262d]/50 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-200">{wth.reference_no}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setInspectClientId(wth.user_id)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-mono transition group max-w-[150px]"
                              title="Inspect Client 360°"
                            >
                              <span className="truncate max-w-[95px]">{wth.user_id}</span>
                              <Eye className="w-3 h-3 text-purple-400 group-hover:text-purple-200 flex-shrink-0" />
                            </button>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{wth.payment_method_name}</td>
                          <td className="py-3 px-3 font-bold font-mono text-amber-300">
                            ${wth.amount} {wth.currency}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-300 max-w-xs truncate" title={JSON.stringify(wth.payout_details)}>
                            {wth.payout_details?.destination || JSON.stringify(wth.payout_details)}
                          </td>
                          <td className="py-3 px-3">
                            {wth.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                                <Clock className="w-3 h-3" /> Funds Reserved
                              </span>
                            )}
                            {wth.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Dispatched
                              </span>
                            )}
                            {wth.status === 'rejected' && (
                              <span
                                title={wth.rejection_reason}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold cursor-help"
                              >
                                <XCircle className="w-3 h-3" /> Funds Released
                              </span>
                            )}
                            {wth.status === 'cancelled' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-700 text-[10px] font-semibold">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(wth.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {wth.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    setActionItem({
                                      type: 'approve_withdrawal',
                                      id: wth.id,
                                      reference: wth.reference_no,
                                      amount: wth.amount,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow transition"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Dispatch</span>
                                </button>
                                <button
                                  onClick={() =>
                                    setActionItem({
                                      type: 'reject_withdrawal',
                                      id: wth.id,
                                      reference: wth.reference_no,
                                      amount: wth.amount,
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* INTERNAL TRANSFERS QUEUE & ARCHITECTURAL GOVERNANCE */}
          {activeTab === 'transfers' && (
            <div className="space-y-6">
              {/* Architectural Capability Boundary Banner */}
              <div className="bg-[#10141d] border border-cyan-500/30 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Wallet ↔ Trading Account Bridge Queue</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Bridge Offline / Backend Support Required
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                        Internal fund transfers between CRM Wallets and external trading server engines (MetaTrader 4, MetaTrader 5, cTrader) are intentionally gated to preserve immutable accounting ledger invariants.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technical Boundary Specification Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-lg bg-[#07090e] border border-[#1b222d] space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Domain Isolation Invariant</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      CRM Wallets (PostgreSQL single source of truth) and Trading Account balances (external trade server equity) are separate financial realms. Trading equity must never be silently co-mingled with wallet deposits.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#07090e] border border-[#1b222d] space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Two-Phase Commit Required</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Requires an atomic two-phase transfer ledger table: Phase 1 reserves wallet funds via existing reservation mechanism; Phase 2 invokes the Trade Server Gateway API (Manager API); Phase 3 clears or reverses the reservation upon trade server confirmation.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#07090e] border border-[#1b222d] space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Missing Trade Server Gateway</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Automated execution is halted until MT4/MT5 Server Gateway Manager credentials and dedicated transfer schema (<code className="text-purple-300">internal_transfers</code>) are provisioned in the backend.
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Transfers Records in Ledger */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Internal Transfer Audit Records ({transferTransactions.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Filtered by type: internal_transfer
                  </span>
                </div>

                {transferTransactions.length === 0 ? (
                  <div className="p-8 text-center bg-[#0d1117] border border-[#21262d] rounded-xl text-slate-500 text-xs">
                    No internal transfers recorded in the immutable transaction journal.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="border-b border-[#30363d] text-slate-400 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Txn No</th>
                          <th className="py-2.5 px-3">Client User</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Bal Before</th>
                          <th className="py-2.5 px-3">Bal After</th>
                          <th className="py-2.5 px-3 font-sans">Description</th>
                          <th className="py-2.5 px-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#21262d]">
                        {transferTransactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-[#21262d]/50 transition text-[11px]">
                            <td className="py-2.5 px-3 font-semibold text-slate-200">{txn.transaction_no}</td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => setInspectClientId(txn.user_id)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-mono transition group"
                                title="Inspect Client 360°"
                              >
                                <span className="truncate max-w-[100px]">{txn.user_id}</span>
                                <Eye className="w-3 h-3 text-purple-400 group-hover:text-purple-200" />
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-cyan-400">
                              ${txn.amount} {txn.currency}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">${txn.balance_before}</td>
                            <td className="py-2.5 px-3 text-slate-300">${txn.balance_after}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-400">{txn.description}</td>
                            <td className="py-2.5 px-3 text-slate-400">{new Date(txn.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GLOBAL LEDGER */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 pb-2 border-b border-[#30363d]">
                Double-entry financial audit journal with balance before/after snapshots for every transaction.
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#30363d] text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Txn No</th>
                      <th className="py-2.5 px-3">Client User</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Bal Before</th>
                      <th className="py-2.5 px-3">Bal After</th>
                      <th className="py-2.5 px-3">Res Before</th>
                      <th className="py-2.5 px-3">Res After</th>
                      <th className="py-2.5 px-3 font-sans">Description</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]">
                    {filteredTransactions.map((txn) => {
                      const isCredit = txn.type === 'deposit' || txn.type === 'adjustment_credit';
                      const isDebit = txn.type === 'withdrawal' || txn.type === 'adjustment_debit';
                      const isReserve = txn.type === 'withdrawal_reserve';

                      return (
                        <tr key={txn.id} className="hover:bg-[#21262d]/50 transition text-[11px]">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">{txn.transaction_no}</td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => setInspectClientId(txn.user_id)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-mono transition group max-w-[150px]"
                              title="Inspect Client 360°"
                            >
                              <span className="truncate max-w-[95px]">{txn.user_id}</span>
                              <Eye className="w-3 h-3 text-purple-400 group-hover:text-purple-200 flex-shrink-0" />
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : isDebit
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : isReserve
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-indigo-500/10 text-indigo-400'
                              }`}
                            >
                              {txn.type}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 font-bold ${
                              isCredit ? 'text-emerald-400' : isDebit ? 'text-rose-400' : 'text-slate-200'
                            }`}
                          >
                            {isCredit ? '+' : isDebit ? '-' : ''}${txn.amount}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">${txn.balance_before}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">${txn.balance_after}</td>
                          <td className="py-2.5 px-3 text-slate-500">${txn.reserved_before}</td>
                          <td className="py-2.5 px-3 text-amber-400/80">${txn.reserved_after}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs truncate" title={txn.description}>
                            {txn.description}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                            {new Date(txn.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MANUAL ADJUSTMENTS TOOL */}
          {activeTab === 'adjustments' && (
            <div className="max-w-2xl mx-auto py-4 space-y-6">
              <div className="bg-[#21262d] border border-[#30363d] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <span>Execute Administrative Balance Adjustment</span>
                </div>
                <p className="text-xs text-slate-400">
                  Directly credits or debits a client's trading wallet. Creates an immutable transaction ledger record and security audit log entry.
                </p>

                <form onSubmit={handleManualAdjustment} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Target User ID <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adjUserId}
                      onChange={(e) => setAdjUserId(e.target.value)}
                      placeholder="e.g. client user UUID or email lookup ID"
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Adjustment Type</label>
                      <select
                        value={adjType}
                        onChange={(e) => setAdjType(e.target.value as any)}
                        className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="adjustment_credit">Credit Wallet (+ Deposit / Bonus)</option>
                        <option value="adjustment_debit">Debit Wallet (- Correction / Fee)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Amount (USD) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={adjAmount}
                          onChange={(e) => setAdjAmount(e.target.value)}
                          placeholder="100.00"
                          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg py-2 pl-7 pr-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Reason / Compulsory Audit Justification <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={adjDesc}
                      onChange={(e) => setAdjDesc(e.target.value)}
                      placeholder="Specify rationale (e.g. Escrow manual settlement, promotional credit, or reconciliation correction)"
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingAction}
                      className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow"
                    >
                      {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Post Adjustment to Ledger</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeTab === 'audit_logs' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 pb-2 border-b border-[#30363d]">
                Security and administrative event trail recording actors, IP addresses, and state changes.
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#30363d] text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity Type</th>
                      <th className="py-2.5 px-3">Entity ID</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">IP Address</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#21262d]/50 transition text-[11px]">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 uppercase text-[10px] font-mono">{log.entity_type}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={log.entity_id || ''}>
                          {log.entity_id || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-300 max-w-[120px] truncate" title={log.actor_id || ''}>
                          {log.actor_id || 'System'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{log.ip_address || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate font-mono text-[10px]" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[10px] font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* APPROVAL / REJECTION MODAL */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {actionItem.type.startsWith('approve') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {actionItem.type === 'approve_deposit' && 'Confirm Deposit Approval'}
                  {actionItem.type === 'reject_deposit' && 'Reject Deposit Request'}
                  {actionItem.type === 'approve_withdrawal' && 'Confirm Payout Dispatch'}
                  {actionItem.type === 'reject_withdrawal' && 'Reject & Release Reserved Funds'}
                </span>
              </h3>
              <button
                onClick={() => setActionItem(null)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#21262d] p-3 rounded-lg border border-[#30363d] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Order Reference:</span>
                <span className="font-mono text-white font-semibold">{actionItem.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-mono text-emerald-400 font-bold">${actionItem.amount} USD</span>
              </div>
            </div>

            <form onSubmit={handleExecuteReviewAction} className="space-y-4 text-xs">
              {actionItem.type.startsWith('reject') && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Rejection Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Sender bank name discrepancy, invalid destination address, or KYC requirements not met"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Internal Administrative Notes (Optional)
                </label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Escrow cleared / transaction batch ID #992"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActionItem(null)}
                  className="px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 shadow ${
                    actionItem.type.startsWith('approve')
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Confirm Execution</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Client 360° Inspector Drawer preserving active tab & filters */}
      <Client360Drawer
        clientId={inspectClientId}
        onClose={() => setInspectClientId(null)}
        onClientUpdated={fetchAdminData}
      />
    </div>
  );
}
