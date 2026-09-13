import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Edit,
  History,
  Shield,
  User,
  RefreshCw,
  Server,
  TrendingUp,
  ChevronDown,
  Info,
} from 'lucide-react';

export interface TradingAccountAdminItem {
  id: string;
  account_number: string;
  user_id: string;
  platform: 'MT4' | 'MT5' | 'cTrader' | 'WebTrader';
  account_type: 'standard' | 'raw_spread' | 'pro' | 'islamic';
  server_name: string;
  currency: string;
  leverage: string;
  status: 'pending_approval' | 'active' | 'read_only' | 'disabled' | 'archived';
  nickname?: string | null;
  is_demo: boolean;
  group_tier?: string | null;
  investor_notes?: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    country: string;
  };
}

export function AdminTradingAccountsView() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccountAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [approvingAccount, setApprovingAccount] = useState<TradingAccountAdminItem | null>(null);
  const [rejectingAccount, setRejectingAccount] = useState<TradingAccountAdminItem | null>(null);
  const [statusModalAccount, setStatusModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [metadataModalAccount, setMetadataModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [auditModalAccount, setAuditModalAccount] = useState<{
    account: TradingAccountAdminItem;
    audit_trail: any[];
  } | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form states - Approve
  const [approveServer, setApproveServer] = useState('');
  const [approveTier, setApproveTier] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  // Form states - Reject
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Form states - Status
  const [newStatus, setNewStatus] = useState<TradingAccountAdminItem['status']>('active');
  const [statusNotes, setStatusNotes] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Form states - Metadata
  const [editLeverage, setEditLeverage] = useState('1:100');
  const [editServer, setEditServer] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editType, setEditType] = useState<TradingAccountAdminItem['account_type']>('standard');
  const [editNotes, setEditNotes] = useState('');
  const [submittingMeta, setSubmittingMeta] = useState(false);

  const fetchAccounts = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);

    const queryParams = new URLSearchParams();
    if (statusFilter !== 'all') queryParams.append('status', statusFilter);
    if (platformFilter !== 'all') queryParams.append('platform', platformFilter);
    if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

    try {
      const res = await fetch(`/api/admin/trading-accounts?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAccounts(data.data);
      } else {
        setErrorMessage(data.message || 'Failed to fetch trading accounts');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [token, statusFilter, platformFilter]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !approvingAccount) return;
    setSubmittingApprove(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${approvingAccount.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          server_name: approveServer.trim() || undefined,
          group_tier: approveTier.trim() || undefined,
          admin_notes: approveNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account #${approvingAccount.account_number} approved and activated.`);
        setApprovingAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to approve account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during approval');
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !rejectingAccount) return;
    setSubmittingReject(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${rejectingAccount.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rejection_reason: rejectionReason.trim(),
          admin_notes: rejectNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account #${rejectingAccount.account_number} rejected.`);
        setRejectingAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to reject account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during rejection');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !statusModalAccount) return;
    setSubmittingStatus(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${statusModalAccount.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          admin_notes: statusNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account #${statusModalAccount.account_number} status updated to ${newStatus}.`);
        setStatusModalAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to update status');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error updating status');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !metadataModalAccount) return;
    setSubmittingMeta(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${metadataModalAccount.id}/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leverage: editLeverage,
          server_name: editServer.trim() || undefined,
          group_tier: editTier.trim() || undefined,
          account_type: editType,
          admin_notes: editNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account #${metadataModalAccount.account_number} metadata updated.`);
        setMetadataModalAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to update metadata');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error updating metadata');
    } finally {
      setSubmittingMeta(false);
    }
  };

  const handleOpenAudit = async (acc: TradingAccountAdminItem) => {
    if (!token) return;
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/admin/trading-accounts/${acc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAuditModalAccount(data.data);
      } else {
        setErrorMessage(data.message || 'Failed to load audit trail');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error loading audit trail');
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Isolation Note */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Trading Accounts Registry (Admin)</h2>
              <p className="text-xs text-slate-400">
                Broker account registry, server routing assignments, tier groups, and authorization review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Architecture Boundary:</strong> This module manages trading account login registrations and metadata within the CRM. It is strictly decoupled from the core financial ledger and does not interface with trade execution or market data feeds.
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-grow">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="active">Active</option>
              <option value="read_only">Read Only</option>
              <option value="disabled">Disabled</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="MT5">MetaTrader 5</option>
              <option value="MT4">MetaTrader 4</option>
              <option value="cTrader">cTrader</option>
              <option value="WebTrader">WebTrader</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchAccounts();
          }}
          className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 w-full sm:w-64"
        >
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search account #, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none w-full"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Account Number</th>
                <th className="px-4 py-3">Client Owner</th>
                <th className="px-4 py-3">Platform & Server</th>
                <th className="px-4 py-3">Type & Leverage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Loading trading accounts...</span>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">No trading accounts found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting the status or platform filters.</p>
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const statusBadges = {
                    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    pending_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    read_only: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    disabled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                  };

                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>#{acc.account_number}</span>
                          {acc.is_demo ? (
                            <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/30">
                              DEMO
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              LIVE
                            </span>
                          )}
                        </div>
                        {acc.nickname && (
                          <span className="text-[11px] font-sans font-normal text-slate-400 block truncate max-w-[150px]">
                            {acc.nickname}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {acc.owner ? (
                          <div>
                            <span className="font-medium text-slate-200 block">
                              {acc.owner.first_name} {acc.owner.last_name}
                            </span>
                            <span className="text-slate-400 text-[11px] block">{acc.owner.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">User ID: {acc.user_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{acc.platform}</span>
                        <span className="text-slate-400 text-[11px] block truncate max-w-[140px]" title={acc.server_name}>
                          {acc.server_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-200 block font-medium">
                          {acc.account_type.replace('_', ' ')}
                        </span>
                        <span className="text-blue-400 text-[11px] block font-mono">
                          {acc.currency} • {acc.leverage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            statusBadges[acc.status]
                          }`}
                        >
                          {acc.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(acc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {acc.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => {
                                  setApprovingAccount(acc);
                                  setApproveServer(acc.server_name);
                                  setApproveTier(acc.group_tier || '');
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
                                title="Approve Account"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingAccount(acc);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
                                title="Reject Account"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setStatusModalAccount(acc);
                              setNewStatus(acc.status);
                              setStatusNotes('');
                            }}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Change Status"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setMetadataModalAccount(acc);
                              setEditLeverage(acc.leverage);
                              setEditServer(acc.server_name);
                              setEditTier(acc.group_tier || '');
                              setEditType(acc.account_type);
                              setEditNotes('');
                            }}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Edit Specifications"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenAudit(acc)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Audit Trail"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Approve Account */}
      {approvingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Approve Trading Account (#{approvingAccount.account_number})</span>
              </h3>
              <button
                onClick={() => setApprovingAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApprove} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Server Routing Assignment</label>
                <input
                  type="text"
                  value={approveServer}
                  onChange={(e) => setApproveServer(e.target.value)}
                  placeholder="e.g. Broker-Live-Alpha-01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Group / Spread Tier</label>
                <input
                  type="text"
                  value={approveTier}
                  onChange={(e) => setApproveTier(e.target.value)}
                  placeholder="e.g. raw_vip_usd"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Admin Verification Notes</label>
                <textarea
                  rows={2}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Notes recorded for internal compliance audit..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApprovingAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApprove}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingApprove ? 'Approving...' : 'Confirm Activation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Account */}
      {rejectingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Reject Account (#{rejectingAccount.account_number})</span>
              </h3>
              <button
                onClick={() => setRejectingAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReject} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason visible to user (e.g. Duplicate account number on cTrader)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Internal Admin Notes</label>
                <textarea
                  rows={2}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectingAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Status */}
      {statusModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Change Status (#{statusModalAccount.account_number})
              </h3>
              <button
                onClick={() => setStatusModalAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStatusChange} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Account Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active (Trading authorized)</option>
                  <option value="read_only">Read Only (Invest / monitoring only)</option>
                  <option value="disabled">Disabled (Trading suspended)</option>
                  <option value="archived">Archived (Closed / hidden)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Administrative Justification</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Reason for status change..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStatusModalAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Metadata */}
      {metadataModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Edit Specifications (#{metadataModalAccount.account_number})
              </h3>
              <button
                onClick={() => setMetadataModalAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMetadata} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Leverage</label>
                  <select
                    value={editLeverage}
                    onChange={(e) => setEditLeverage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="1:50">1:50</option>
                    <option value="1:100">1:100</option>
                    <option value="1:200">1:200</option>
                    <option value="1:400">1:400</option>
                    <option value="1:500">1:500</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="raw_spread">Raw Spread</option>
                    <option value="pro">Pro</option>
                    <option value="islamic">Islamic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Trading Server</label>
                <input
                  type="text"
                  value={editServer}
                  onChange={(e) => setEditServer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Group / Tier</label>
                <input
                  type="text"
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMetadataModalAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMeta}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingMeta ? 'Saving...' : 'Save Specifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Audit Trail */}
      {auditModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  <span>Account Audit Trail (#{auditModalAccount.account.account_number})</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Owner: {auditModalAccount.account.owner?.email || auditModalAccount.account.user_id}
                </p>
              </div>
              <button
                onClick={() => setAuditModalAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
              {auditModalAccount.audit_trail.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No audit events recorded.</div>
              ) : (
                auditModalAccount.audit_trail.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 font-semibold">{log.action}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono break-all">
                      Actor: {log.actor_id || 'System'}
                    </div>
                    {log.details && (
                      <pre className="text-[10px] bg-slate-900/90 text-slate-300 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right border-t border-slate-800">
              <button
                onClick={() => setAuditModalAccount(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
