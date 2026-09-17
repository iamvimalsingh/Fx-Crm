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
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  UserPlus,
  KeyRound,
  ArrowLeftRight,
} from 'lucide-react';

export interface TradingAccountAdminItem {
  id: string;
  account_number: string;
  user_id: string;
  platform: string;
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
  password?: string | null;
  balance?: string | null;
  terminal_url?: string | null;
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

  // Active View Tab: 'accounts' | 'resets'
  const [activeViewTab, setActiveViewTab] = useState<'accounts' | 'resets'>('accounts');

  // Modals
  const [approvingAccount, setApprovingAccount] = useState<TradingAccountAdminItem | null>(null);
  const [rejectingAccount, setRejectingAccount] = useState<TradingAccountAdminItem | null>(null);
  const [statusModalAccount, setStatusModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [metadataModalAccount, setMetadataModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [deleteModalAccount, setDeleteModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [assignModalAccount, setAssignModalAccount] = useState<TradingAccountAdminItem | null>(null);
  const [targetClientId, setTargetClientId] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Password reset requests state
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [loadingResets, setLoadingResets] = useState(false);
  const [processingReset, setProcessingReset] = useState<any | null>(null);
  const [resetAction, setResetAction] = useState<'approve' | 'reject'>('approve');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetAdminNotes, setResetAdminNotes] = useState('');
  const [resetRejectionReason, setResetRejectionReason] = useState('');
  const [submittingResetProcess, setSubmittingResetProcess] = useState(false);

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
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editPlatform, setEditPlatform] = useState('MT5');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editBalance, setEditBalance] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editStatus, setEditStatus] = useState<TradingAccountAdminItem['status']>('active');
  const [editTerminalUrl, setEditTerminalUrl] = useState('');
  const [editLeverage, setEditLeverage] = useState('1:100');
  const [editServer, setEditServer] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editType, setEditType] = useState<TradingAccountAdminItem['account_type']>('standard');
  const [editNotes, setEditNotes] = useState('');
  const [submittingMeta, setSubmittingMeta] = useState(false);

  // Table view helper state for password toggle & copy
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2500);
  };

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

  const fetchPasswordResets = async () => {
    if (!token) return;
    setLoadingResets(true);
    try {
      const res = await fetch('/api/admin/trading-password-resets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPasswordResets(data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching password resets:', err);
    } finally {
      setLoadingResets(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchPasswordResets();
  }, [token, statusFilter, platformFilter]);

  const handleDeleteAccount = async () => {
    if (!token || !deleteModalAccount) return;
    setSubmittingDelete(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${deleteModalAccount.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(data.message || `Account #${deleteModalAccount.account_number} ${data.action || 'processed'}.`);
        setDeleteModalAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to delete trading account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error deleting account');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleAssignAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !assignModalAccount || !targetClientId.trim()) return;
    setSubmittingAssign(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${assignModalAccount.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_client_id: targetClientId.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account #${assignModalAccount.account_number} reassigned successfully.`);
        setAssignModalAccount(null);
        setTargetClientId('');
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to assign trading account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error assigning account');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleProcessPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !processingReset) return;
    setSubmittingResetProcess(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-password-resets/${processingReset.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: resetAction,
          new_password: resetAction === 'approve' && resetNewPassword.trim() ? resetNewPassword.trim() : undefined,
          admin_notes: resetAdminNotes.trim() || undefined,
          rejection_reason: resetAction === 'reject' && resetRejectionReason.trim() ? resetRejectionReason.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(data.message || `Password reset request ${resetAction}d successfully.`);
        setProcessingReset(null);
        setResetNewPassword('');
        setResetAdminNotes('');
        setResetRejectionReason('');
        await fetchPasswordResets();
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to process password reset request');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error processing reset');
    } finally {
      setSubmittingResetProcess(false);
    }
  };

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
          account_number: editAccountNumber.trim() || undefined,
          platform: editPlatform.trim() || undefined,
          currency: editCurrency.trim().toUpperCase() || undefined,
          balance: editBalance.trim() || undefined,
          password: editPassword.trim() || undefined,
          status: editStatus,
          terminal_url: editTerminalUrl.trim() || null,
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
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[11px] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Manual Mode (V1)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] font-semibold">
                Bridge Not Configured
              </span>
            </div>
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

      {/* Top Module Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveViewTab('accounts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeViewTab === 'accounts'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Trading Accounts</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab('resets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeViewTab === 'resets'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Password Reset Requests</span>
          {passwordResets.filter((r) => r.status === 'pending').length > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold animate-pulse">
              {passwordResets.filter((r) => r.status === 'pending').length} pending
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
              {passwordResets.length}
            </span>
          )}
        </button>
      </div>

      {activeViewTab === 'accounts' ? (
        <>
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
                        {acc.password && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-mono bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 w-fit">
                            <Key className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            <span className="text-slate-300">
                              {visiblePasswords[acc.id] ? acc.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisiblePasswords((prev) => ({
                                  ...prev,
                                  [acc.id]: !prev[acc.id],
                                }))
                              }
                              className="text-slate-400 hover:text-slate-200 p-0.5"
                              title={visiblePasswords[acc.id] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[acc.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(acc.password!, `pwd_${acc.id}`)}
                              className="text-slate-400 hover:text-slate-200 p-0.5"
                              title="Copy password"
                            >
                              {copiedId === `pwd_${acc.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{acc.platform}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Provider: {acc.platform}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px] block truncate max-w-[140px]" title={acc.server_name}>
                          {acc.server_name}
                        </span>
                        <div className="mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400/90 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            <span className="w-1 h-1 rounded-full bg-amber-400" />
                            Bridge Not Configured (Manual Mode V1)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-200 block font-medium">
                          {acc.account_type.replace('_', ' ')}
                        </span>
                        <span className="text-blue-400 text-[11px] block font-mono">
                          {acc.currency} • {acc.leverage}
                        </span>
                        <span className="text-emerald-400 text-[11px] font-mono font-semibold block mt-0.5">
                          ${acc.balance || (acc.is_demo ? '10,000.00' : '0.00')}
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
                          {acc.terminal_url && (
                            <a
                              href={acc.terminal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition"
                              title={`Open Web Terminal (${acc.terminal_url})`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

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
                              setEditAccountNumber(acc.account_number);
                              setEditPlatform(acc.platform);
                              setEditCurrency(acc.currency);
                              setEditBalance(acc.balance || (acc.is_demo ? '10000.00' : '0.00'));
                              setEditPassword(acc.password || '');
                              setShowEditPassword(false);
                              setEditStatus(acc.status);
                              setEditTerminalUrl(acc.terminal_url || '');
                              setEditLeverage(acc.leverage);
                              setEditServer(acc.server_name);
                              setEditTier(acc.group_tier || '');
                              setEditType(acc.account_type);
                              setEditNotes(acc.admin_notes || '');
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

                          <button
                            onClick={() => {
                              setAssignModalAccount(acc);
                              setTargetClientId(acc.user_id);
                            }}
                            className="p-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition"
                            title="Assign / Reassign Client Owner"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteModalAccount(acc)}
                            className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition"
                            title="Delete or Archive Trading Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        </>
      ) : (
        /* Password Reset Requests View */
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-white">
                Client Trading Password Reset Requests
              </span>
              <span className="text-[11px] text-slate-400">
                (Manual admin workflow for MT5/cTrader/Vertex accounts)
              </span>
            </div>
            <button
              onClick={fetchPasswordResets}
              disabled={loadingResets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingResets ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Requested At</th>
                    <th className="py-3 px-4">Processed Info</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingResets ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                        Loading password reset requests...
                      </td>
                    </tr>
                  ) : passwordResets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No password reset requests recorded.
                      </td>
                    </tr>
                  ) : (
                    passwordResets.map((reset) => (
                      <tr key={reset.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white font-mono flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {reset.account?.platform || 'Trading'}
                            </span>
                            <span>#{reset.account?.account_number || reset.account_id.slice(0, 8)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {reset.account?.is_demo ? 'Demo' : 'Live'} • {reset.account?.server_name || 'Standard'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">
                            {reset.user ? `${reset.user.first_name} ${reset.user.last_name}` : 'Unknown Client'}
                          </div>
                          <div className="text-[10px] text-purple-300 font-mono">
                            {reset.user?.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-slate-300 truncate" title={reset.reason}>
                            {reset.reason || 'No specific reason provided'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              reset.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : reset.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {reset.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(reset.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-400">
                          {reset.processed_at ? (
                            <div>
                              <div>{new Date(reset.processed_at).toLocaleString()}</div>
                              {reset.rejection_reason && (
                                <div className="text-rose-400 text-[10px]">
                                  Rejection: {reset.rejection_reason}
                                </div>
                              )}
                              {reset.admin_notes && (
                                <div className="text-slate-400 text-[10px]">
                                  Notes: {reset.admin_notes}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">Pending Review</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {reset.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setProcessingReset(reset);
                                  setResetAction('approve');
                                  setResetNewPassword('');
                                  setResetAdminNotes('');
                                  setResetRejectionReason('');
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setProcessingReset(reset);
                                  setResetAction('reject');
                                  setResetNewPassword('');
                                  setResetAdminNotes('');
                                  setResetRejectionReason('');
                                }}
                                className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Closed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal: Edit Metadata / Account Specifications */}
      {metadataModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit className="w-4 h-4 text-blue-400" />
                  Edit Account Specifications (#{metadataModalAccount.account_number})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {metadataModalAccount.is_demo ? (
                    <span className="text-sky-400 font-semibold">Demo Account</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">Live Trading Account</span>
                  )}
                  {metadataModalAccount.owner && ` • ${metadataModalAccount.owner.email}`}
                </p>
              </div>
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
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account / Login #</label>
                  <input
                    type="text"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 5092144"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Trading Platform</label>
                  <input
                    type="text"
                    list="platform-options"
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    placeholder="MT5, MT4, cTrader..."
                    required
                  />
                  <datalist id="platform-options">
                    <option value="MT5" />
                    <option value="MT4" />
                    <option value="cTrader" />
                    <option value="EdgeTrader" />
                    <option value="AeroTrader" />
                    <option value="WebTrader" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Trading Server</label>
                  <input
                    type="text"
                    value={editServer}
                    onChange={(e) => setEditServer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Broker-Demo or Broker-Live"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Active (Trading authorized)</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="read_only">Read Only (Monitoring)</option>
                    <option value="disabled">Disabled (Suspended)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Base Currency</label>
                  <input
                    type="text"
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-blue-500"
                    placeholder="USD"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account Balance</label>
                  <input
                    type="text"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-blue-500"
                    placeholder="10000.00"
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Trading Password (Viewable / Resettable by Admin)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = 'Demo@' + Math.floor(1000 + Math.random() * 9000);
                      setEditPassword(gen);
                      setShowEditPassword(true);
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                  >
                    Generate Random
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-16 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    placeholder="Set account password"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title={showEditPassword ? 'Hide password' : 'Show password'}
                    >
                      {showEditPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {editPassword && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(editPassword, 'edit_pwd')}
                        className="text-slate-400 hover:text-slate-200 p-1"
                        title="Copy password"
                      >
                        {copiedId === 'edit_pwd' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Password is saved securely in the account metadata and displayed to the client for demo access.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Web Terminal URL</label>
                <input
                  type="url"
                  value={editTerminalUrl}
                  onChange={(e) => setEditTerminalUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  placeholder="https://trade.mql5.com/trade or custom web trader URL"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Group / Tier</label>
                <input
                  type="text"
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  placeholder="demo_usd or standard_live"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Admin Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Administrative or operational notes..."
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
                  {submittingMeta ? 'Saving Specifications...' : 'Save Specifications'}
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
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Provider: {auditModalAccount.account.platform}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Bridge Not Configured (Manual Mode V1)
                  </span>
                </div>
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

      {/* Modal: Delete / Archive Account */}
      {deleteModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#0b0e14] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Delete / Archive Account #{deleteModalAccount.account_number}</span>
              </h3>
              <button
                onClick={() => setDeleteModalAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Platform & Type:</span>
                <span className="text-white font-semibold">
                  {deleteModalAccount.platform} • {deleteModalAccount.account_type} ({deleteModalAccount.is_demo ? 'Demo' : 'Live'})
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Balance:</span>
                <span className="text-emerald-400 font-bold">
                  ${deleteModalAccount.balance || (deleteModalAccount.is_demo ? '10,000.00' : '0.00')} {deleteModalAccount.currency}
                </span>
              </div>
              {deleteModalAccount.owner && (
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Owner:</span>
                  <span className="text-purple-300">{deleteModalAccount.owner.email}</span>
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-200/90 leading-relaxed">
              <div className="font-bold text-amber-300 uppercase text-[10px] mb-1">
                Ledger Audit Protection Rule
              </div>
              <p>
                If this trading account has executed prior internal transfers, it will be safely updated to <strong className="text-white">archived</strong> status to retain immutable ledger audit trails. If zero transfer history exists, the account will be permanently deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModalAccount(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={submittingDelete}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{submittingDelete ? 'Processing...' : 'Confirm Delete / Archive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign / Reassign Trading Account */}
      {assignModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-400" />
                <span>Assign Account #{assignModalAccount.account_number}</span>
              </h3>
              <button
                onClick={() => setAssignModalAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Reassign or map this trading account to a new client profile. The account credentials, history, and status will transfer to the target client.
              </p>
              {assignModalAccount.owner && (
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
                  <span className="text-slate-500 block">Current Owner:</span>
                  <span className="text-white font-semibold">
                    {assignModalAccount.owner.first_name} {assignModalAccount.owner.last_name} ({assignModalAccount.owner.email})
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleAssignAccount} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Target Client ID (User UUID)
                </label>
                <input
                  type="text"
                  value={targetClientId}
                  onChange={(e) => setTargetClientId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalAccount(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign || !targetClientId.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{submittingAssign ? 'Assigning...' : 'Assign Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Password Reset Request */}
      {processingReset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>Process Password Reset Request</span>
              </h3>
              <button
                onClick={() => setProcessingReset(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Trading Account:</span>
                <span className="font-mono text-white font-bold">
                  #{processingReset.account?.account_number || processingReset.account_id.slice(0, 8)} ({processingReset.account?.platform})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="text-purple-300">
                  {processingReset.user?.first_name} {processingReset.user?.last_name} ({processingReset.user?.email})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client Reason:</span>
                <span className="text-white italic">{processingReset.reason || 'None provided'}</span>
              </div>
            </div>

            <form onSubmit={handleProcessPasswordReset} className="space-y-4">
              {/* Action Selection */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Administrative Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetAction('approve')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                      resetAction === 'approve'
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve & Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetAction('reject')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                      resetAction === 'reject'
                        ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Request</span>
                  </button>
                </div>
              </div>

              {resetAction === 'approve' ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        New Trading Password (optional override)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const gen = 'Trade@' + Math.floor(1000 + Math.random() * 9000);
                          setResetNewPassword(gen);
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                      >
                        Generate Random
                      </button>
                    </div>
                    <input
                      type="text"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate a secure password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">
                      For demo accounts, the new password is automatically updated and visible in the client portal.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Admin Notes (Optional)
                    </label>
                    <textarea
                      value={resetAdminNotes}
                      onChange={(e) => setResetAdminNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. Identity verified via client support ticket #..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-rose-300 block mb-1">
                      Rejection Reason (Client will be notified)
                    </label>
                    <input
                      type="text"
                      value={resetRejectionReason}
                      onChange={(e) => setResetRejectionReason(e.target.value)}
                      placeholder="e.g. Identity could not be verified; account under compliance review"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Internal Admin Notes
                    </label>
                    <textarea
                      value={resetAdminNotes}
                      onChange={(e) => setResetAdminNotes(e.target.value)}
                      rows={2}
                      placeholder="Internal audit notes..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-700"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setProcessingReset(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResetProcess || (resetAction === 'reject' && !resetRejectionReason.trim())}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 ${
                    resetAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {resetAction === 'approve' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {submittingResetProcess
                      ? 'Processing...'
                      : resetAction === 'approve'
                      ? 'Confirm Approval'
                      : 'Confirm Rejection'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
