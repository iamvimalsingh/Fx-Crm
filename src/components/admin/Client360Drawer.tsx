import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  User,
  Shield,
  Layers,
  FileText,
  HelpCircle,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  UserPlus,
  ArrowLeftRight,
} from 'lucide-react';

export interface Client360Data {
  client: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    country: string;
    phone: string | null;
    preferred_currency: string;
    status: 'active' | 'suspended' | 'pending';
    created_at: string;
    updated_at: string;
    last_login_at?: string | null;
  };
  wallet: {
    id: string | null;
    currency: string;
    balance: string;
    reserved_balance: string;
  };
  trading_accounts: Array<{
    id: string;
    account_number: string;
    platform: string;
    account_type: string;
    server_name: string;
    currency: string;
    leverage: string;
    status: string;
    nickname?: string | null;
    is_demo: boolean;
    group_tier?: string | null;
    created_at: string;
    password?: string | null;
    balance?: string | null;
    terminal_url?: string | null;
  }>;
  kyc_profile: {
    id: string;
    status: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    nationality: string;
    country: string;
    address_line1: string;
    city: string;
    postal_code: string;
    id_type: string;
    id_number: string;
    submitted_at: string;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
  } | null;
  kyc_documents: Array<{
    id: string;
    document_type: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    status: string;
    rejection_reason?: string | null;
    created_at: string;
  }>;
  recent_deposits: Array<{
    id: string;
    reference_no: string;
    amount: string;
    currency: string;
    status: string;
    payment_method_name: string;
    created_at: string;
    rejection_reason?: string | null;
  }>;
  recent_withdrawals: Array<{
    id: string;
    reference_no: string;
    amount: string;
    currency: string;
    status: string;
    payment_method_name: string;
    created_at: string;
    rejection_reason?: string | null;
  }>;
  support_tickets: Array<{
    id: string;
    ticket_no: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    last_reply_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details?: Record<string, any>;
    created_at: string;
  }>;
}

interface Client360DrawerProps {
  clientId: string | null;
  onClose: () => void;
  onClientUpdated?: () => void;
}

export function Client360Drawer({ clientId, onClose, onClientUpdated }: Client360DrawerProps) {
  const { token } = useAuth();
  const [data, setData] = useState<Client360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'trading' | 'kyc' | 'support' | 'audit'>('overview');

  // Status mutation modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'active' | 'suspended' | 'pending'>('suspended');
  const [statusReason, setStatusReason] = useState('');
  const [mutatingStatus, setMutatingStatus] = useState(false);
  const [mutationMessage, setMutationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Client deletion modal
  const [deleteClientModalOpen, setDeleteClientModalOpen] = useState(false);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState('');
  const [deletingClient, setDeletingClient] = useState(false);

  // Trading account deletion modal
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Client360Data['trading_accounts'][0] | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Trading account assignment modal
  const [assignAccountModalOpen, setAssignAccountModalOpen] = useState(false);
  const [assignAccountId, setAssignAccountId] = useState('');
  const [assigningAccount, setAssigningAccount] = useState(false);

  // Table & drawer password visibility and copy state
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const fetchClient360 = async (id: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setMutationMessage(null);

    try {
      const res = await fetch(`/api/admin/clients/${id}/360`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to load 360° client record');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error fetching client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClient360(clientId);
      setActiveTab('overview');
    } else {
      setData(null);
    }
  }, [clientId, token]);

  const handleUpdateStatus = async () => {
    if (!token || !clientId) return;
    setMutatingStatus(true);
    setMutationMessage(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason.trim() || 'Administrative status change',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update account status');

      setMutationMessage({
        type: 'success',
        text: `Client status successfully changed to ${targetStatus.toUpperCase()}. Audit log recorded.`,
      });
      setStatusModalOpen(false);
      setStatusReason('');
      await fetchClient360(clientId);
      if (onClientUpdated) onClientUpdated();
    } catch (err: any) {
      setMutationMessage({ type: 'error', text: err.message || 'Failed to mutate account status' });
    } finally {
      setMutatingStatus(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!token || !clientId || !data) return;
    if (confirmDeleteEmail.trim().toLowerCase() !== data.client.email.toLowerCase()) {
      setMutationMessage({
        type: 'error',
        text: 'Confirmation email does not match client record. Deletion cancelled.',
      });
      return;
    }

    setDeletingClient(true);
    setMutationMessage(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmEmail: confirmDeleteEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete client');

      setDeleteClientModalOpen(false);
      setConfirmDeleteEmail('');
      if (onClientUpdated) onClientUpdated();
      onClose();
    } catch (err: any) {
      setMutationMessage({ type: 'error', text: err.message || 'Failed to delete client' });
    } finally {
      setDeletingClient(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token || !accountToDelete || !clientId) return;
    setDeletingAccount(true);
    setMutationMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${accountToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete trading account');

      setMutationMessage({
        type: 'success',
        text: json.message || `Trading account #${accountToDelete.account_number} ${json.action || 'processed'}.`,
      });
      setDeleteAccountModalOpen(false);
      setAccountToDelete(null);
      await fetchClient360(clientId);
      if (onClientUpdated) onClientUpdated();
    } catch (err: any) {
      setMutationMessage({ type: 'error', text: err.message || 'Failed to delete trading account' });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleAssignAccount = async () => {
    if (!token || !assignAccountId.trim() || !clientId) return;
    setAssigningAccount(true);
    setMutationMessage(null);

    try {
      const res = await fetch(`/api/admin/trading-accounts/${assignAccountId.trim()}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_client_id: clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to assign trading account to client');

      setMutationMessage({
        type: 'success',
        text: `Trading account successfully mapped and assigned to client.`,
      });
      setAssignAccountModalOpen(false);
      setAssignAccountId('');
      await fetchClient360(clientId);
      if (onClientUpdated) onClientUpdated();
    } catch (err: any) {
      setMutationMessage({ type: 'error', text: err.message || 'Failed to assign trading account' });
    } finally {
      setAssigningAccount(false);
    }
  };

  if (!clientId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0c1017] border-l border-[#1b222d] h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#1b222d] flex items-center justify-between bg-[#080b10]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {data ? `${data.client.first_name} ${data.client.last_name}` : 'Client 360° Inspector'}
                </h3>
                {data && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      data.client.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : data.client.status === 'suspended'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {data.client.status}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {data ? `${data.client.email} • ID: ${data.client.id}` : `ID: ${clientId}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchClient360(clientId)}
              disabled={loading}
              title="Refresh Client 360 Profile"
              className="p-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white border border-[#1b222d]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#141a24] text-slate-400 hover:text-white border border-[#1b222d]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-[#1b222d] bg-[#07090e] px-4 overflow-x-auto gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'financial', label: 'Wallet & Ledger', icon: DollarSign },
            { id: 'trading', label: 'Trading Accounts', icon: Layers },
            { id: 'kyc', label: 'KYC & Docs', icon: Shield },
            { id: 'support', label: 'Support', icon: HelpCircle },
            { id: 'audit', label: 'Audit Trail', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mutationMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                mutationMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{mutationMessage.text}</span>
              <button onClick={() => setMutationMessage(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
              <p className="text-xs font-medium">Aggregating 360° client profile & financial balances...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          ) : data ? (
            <div>
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  {/* Status Banner */}
                  <div className="p-3.5 rounded-xl bg-[#080b10] border border-[#1b222d] flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
                        Account Access Status
                      </span>
                      <div className="font-semibold text-white mt-0.5 capitalize flex items-center gap-1.5">
                        {data.client.status === 'active' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{data.client.status}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTargetStatus(data.client.status === 'active' ? 'suspended' : 'active');
                        setStatusModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                        data.client.status === 'active'
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {data.client.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                    </button>
                  </div>

                  {/* Client Identity Fields */}
                  <div className="grid grid-cols-2 gap-3 bg-[#07090e] border border-[#1b222d] p-4 rounded-xl">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Legal First Name</div>
                      <div className="text-white font-medium mt-0.5">{data.client.first_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Legal Last Name</div>
                      <div className="text-white font-medium mt-0.5">{data.client.last_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Email Address</div>
                      <div className="text-white font-mono mt-0.5">{data.client.email}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Contact Phone</div>
                      <div className="text-slate-300 font-mono mt-0.5">{data.client.phone || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Country of Residence</div>
                      <div className="text-white mt-0.5">{data.client.country || 'International'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Base Currency</div>
                      <div className="text-white font-mono mt-0.5">{data.client.preferred_currency}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Registration Date</div>
                      <div className="text-slate-300 font-mono mt-0.5">
                        {new Date(data.client.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Last Authentication</div>
                      <div className="text-slate-300 font-mono mt-0.5">
                        {data.client.last_login_at
                          ? new Date(data.client.last_login_at).toLocaleString()
                          : 'Never logged in'}
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone: Client Deletion / Deactivation */}
                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Danger Zone — Client Deletion & Regulatory Retention
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setConfirmDeleteEmail('');
                          setDeleteClientModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Client Account</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Safely delete or deactivate this client account. If financial transactions, active wallet balance, or transfer history exist, the account is safely deactivated and trading accounts archived to retain immutable regulatory records. If zero financial history exists, all associated records are permanently purged.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB: FINANCIAL WALLET & LEDGER */}
              {activeTab === 'financial' && (
                <div className="space-y-5 text-xs">
                  {/* Balance Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#07090e] border border-[#1b222d]">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Total Balance</div>
                      <div className="text-base font-bold text-white font-mono mt-1">
                        ${Number(data.wallet.balance).toFixed(2)} {data.wallet.currency}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#07090e] border border-[#1b222d]">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">In-Flight Reserved</div>
                      <div className="text-base font-bold text-amber-400 font-mono mt-1">
                        ${Number(data.wallet.reserved_balance).toFixed(2)} {data.wallet.currency}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#07090e] border border-[#1b222d]">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">Available to Withdraw</div>
                      <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                        $
                        {(
                          Number(data.wallet.balance) - Number(data.wallet.reserved_balance)
                        ).toFixed(2)}{' '}
                        {data.wallet.currency}
                      </div>
                    </div>
                  </div>

                  {/* Recent Deposits */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase">
                      Recent Deposits ({data.recent_deposits.length})
                    </h4>
                    {data.recent_deposits.length === 0 ? (
                      <div className="p-3 bg-[#07090e] border border-[#1b222d] rounded-lg text-slate-500 text-center text-[11px]">
                        No deposit records found for this client.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {data.recent_deposits.map((d) => (
                          <div
                            key={d.id}
                            className="p-2.5 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between"
                          >
                            <div>
                              <div className="font-mono text-white text-xs">{d.reference_no}</div>
                              <div className="text-[10px] text-slate-400">{d.payment_method_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-400 font-mono text-xs">
                                +${Number(d.amount).toFixed(2)} {d.currency}
                              </div>
                              <span className="text-[10px] text-slate-400 uppercase">{d.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Withdrawals */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase">
                      Recent Withdrawals ({data.recent_withdrawals.length})
                    </h4>
                    {data.recent_withdrawals.length === 0 ? (
                      <div className="p-3 bg-[#07090e] border border-[#1b222d] rounded-lg text-slate-500 text-center text-[11px]">
                        No withdrawal records found for this client.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {data.recent_withdrawals.map((w) => (
                          <div
                            key={w.id}
                            className="p-2.5 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between"
                          >
                            <div>
                              <div className="font-mono text-white text-xs">{w.reference_no}</div>
                              <div className="text-[10px] text-slate-400">{w.payment_method_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-rose-400 font-mono text-xs">
                                -${Number(w.amount).toFixed(2)} {w.currency}
                              </div>
                              <span className="text-[10px] text-slate-400 uppercase">{w.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: TRADING ACCOUNTS */}
              {activeTab === 'trading' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-slate-400 text-xs">
                      Persisted trading platform accounts registered to this client:
                    </div>
                    <button
                      onClick={() => {
                        setAssignAccountId('');
                        setAssignAccountModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign / Link Account</span>
                    </button>
                  </div>

                  {data.trading_accounts.length === 0 ? (
                    <div className="p-8 text-center bg-[#07090e] border border-[#1b222d] rounded-xl text-slate-500">
                      This client has not linked or created any trading accounts yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {data.trading_accounts.map((acc) => (
                        <div key={acc.id} className="p-3.5 rounded-xl bg-[#07090e] border border-[#1b222d] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {acc.platform}
                              </span>
                              {acc.is_demo ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  DEMO
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  LIVE
                                </span>
                              )}
                              <span className="font-bold text-white font-mono">#{acc.account_number}</span>
                              {acc.nickname && <span className="text-slate-400 text-[11px]">({acc.nickname})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {acc.terminal_url && (
                                <a
                                  href={acc.terminal_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px] font-medium transition"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Terminal</span>
                                </a>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                  acc.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : acc.status === 'archived'
                                    ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {acc.status}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 bg-[#0b0e14] p-2.5 rounded-lg border border-[#161c26]">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase">Type</span>
                              <span className="text-white capitalize">{acc.account_type}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase">Leverage</span>
                              <span className="text-white font-mono">{acc.leverage}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase">Server</span>
                              <span className="text-white">{acc.server_name || 'Standard'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase">Balance</span>
                              <span className="text-emerald-400 font-bold font-mono">
                                ${acc.balance || (acc.is_demo ? '10,000.00' : '0.00')} {acc.currency}
                              </span>
                            </div>
                          </div>

                          {/* Password Display for Admin */}
                          {acc.password && (
                            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
                              <div className="flex items-center gap-2 font-mono">
                                <Key className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                <span className="text-slate-400">Password:</span>
                                <span className="text-white font-bold">
                                  {visiblePasswords[acc.id] ? acc.password : '••••••••••••'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisiblePasswords((prev) => ({
                                      ...prev,
                                      [acc.id]: !prev[acc.id],
                                    }))
                                  }
                                  className="text-slate-400 hover:text-slate-200 p-1"
                                  title={visiblePasswords[acc.id] ? 'Hide password' : 'Show password'}
                                >
                                  {visiblePasswords[acc.id] ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(acc.password!, `d_pwd_${acc.id}`)}
                                  className="text-slate-400 hover:text-slate-200 p-1"
                                  title="Copy password"
                                >
                                  {copiedId === `d_pwd_${acc.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Account Card Action Footer */}
                          <div className="pt-2 border-t border-[#1b222d] flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono text-[10px]">
                              ID: {acc.id.slice(0, 12)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAccountToDelete(acc);
                                setDeleteAccountModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-medium transition"
                              title="Delete or Archive Trading Account"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete / Archive</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: KYC & DOCUMENTS */}
              {activeTab === 'kyc' && (
                <div className="space-y-4 text-xs">
                  {data.kyc_profile ? (
                    <div className="p-4 bg-[#07090e] border border-[#1b222d] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white uppercase">Profile Data</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {data.kyc_profile.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 block">ID Document Type</span>
                          <span className="font-semibold text-white uppercase">{data.kyc_profile.id_type}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Document ID Number</span>
                          <span className="font-mono text-white">{data.kyc_profile.id_number}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Nationality</span>
                          <span className="text-white">{data.kyc_profile.nationality}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 block">Residential Address</span>
                          <span className="text-white">
                            {data.kyc_profile.address_line1}, {data.kyc_profile.city}, {data.kyc_profile.postal_code}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#07090e] border border-[#1b222d] rounded-xl text-slate-500 text-center">
                      No KYC profile submitted yet.
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-white uppercase mt-4">
                    Submitted KYC Verification Documents ({data.kyc_documents.length})
                  </h4>

                  {data.kyc_documents.length === 0 ? (
                    <div className="p-6 bg-[#07090e] border border-[#1b222d] rounded-xl text-slate-500 text-center">
                      Zero documents on file.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.kyc_documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-amber-400" />
                            <div>
                              <div className="font-semibold text-white">{doc.original_filename}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {doc.document_type} • {(doc.file_size / 1024).toFixed(1)} KB • {doc.mime_type}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              doc.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : doc.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: SUPPORT */}
              {activeTab === 'support' && (
                <div className="space-y-2.5 text-xs">
                  {data.support_tickets.length === 0 ? (
                    <div className="p-8 text-center bg-[#07090e] border border-[#1b222d] rounded-xl text-slate-500">
                      This client has never opened any support tickets.
                    </div>
                  ) : (
                    data.support_tickets.map((st) => (
                      <div
                        key={st.id}
                        className="p-3 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">{st.subject}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {st.ticket_no} • {st.category} • Priority: {st.priority}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {st.status}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(st.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: AUDIT */}
              {activeTab === 'audit' && (
                <div className="space-y-2 text-xs">
                  {data.audit_logs.length === 0 ? (
                    <div className="p-8 text-center bg-[#07090e] border border-[#1b222d] rounded-xl text-slate-500">
                      Zero administrative audit logs recorded for this client.
                    </div>
                  ) : (
                    data.audit_logs.map((log) => (
                      <div key={log.id} className="p-3 rounded-lg bg-[#07090e] border border-[#1b222d] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-purple-300">{log.action}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.details && (
                          <pre className="text-[10px] text-slate-400 font-mono bg-[#0b0e14] p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Status Modal */}
        {statusModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-[#0b0e14] border border-[#1b222d] rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white uppercase">Confirm Account Status Modification</h4>
                </div>
                <button onClick={() => setStatusModalOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p>
                  You are updating the client status to{' '}
                  <span className="font-bold text-white uppercase font-mono">{targetStatus}</span>.
                </p>
                <p className="text-slate-400 text-[11px]">
                  This mutation is recorded in the permanent audit trail and the client will be notified.
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Administrative Reason / Justification
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={2}
                  placeholder="e.g., Compliance review completed, suspicious activity flag, client request..."
                  className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b222d]">
                <button
                  onClick={() => setStatusModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 text-xs font-medium hover:bg-[#1b222d]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={mutatingStatus}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 ${
                    targetStatus === 'active' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {mutatingStatus ? 'Saving Status...' : `Confirm ${targetStatus.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Client Modal */}
        {deleteClientModalOpen && data && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-[#0b0e14] border border-rose-500/30 rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">Confirm Client Deletion</h4>
                    <span className="text-[10px] text-slate-400">Administrative client removal action</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeleteClientModalOpen(false);
                    setConfirmDeleteEmail('');
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Client Summary Box */}
              <div className="bg-[#07090e] border border-[#1b222d] rounded-lg p-3 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-semibold text-white">
                    {data.client.first_name} {data.client.last_name}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-purple-300">{data.client.email}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Wallet Balance:</span>
                  <span className="text-emerald-400 font-bold">
                    ${Number(data.wallet.balance).toFixed(2)} {data.wallet.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trading Accounts:</span>
                  <span className="text-white">{data.trading_accounts.length} registered</span>
                </div>
              </div>

              {/* Policy Explainer */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-200/90 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300 uppercase text-[10px]">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Audit & Financial Retention Policy</span>
                </div>
                <p>
                  • If this client has historical transactions, wallet balances, or account transfers, access is deactivated/suspended and trading accounts archived to retain immutable regulatory audit compliance.
                </p>
                <p>
                  • If the client has zero financial history, all associated records are permanently purged.
                </p>
              </div>

              {/* Verification Input */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300 block mb-1">
                  Type client email to authorize deletion:
                </label>
                <div className="font-mono text-[10px] text-slate-500 mb-1.5">
                  Confirm email: <span className="text-slate-300 font-semibold">{data.client.email}</span>
                </div>
                <input
                  type="email"
                  value={confirmDeleteEmail}
                  onChange={(e) => setConfirmDeleteEmail(e.target.value)}
                  placeholder={data.client.email}
                  className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b222d]">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteClientModalOpen(false);
                    setConfirmDeleteEmail('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 text-xs font-medium hover:bg-[#1b222d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClient}
                  disabled={
                    deletingClient ||
                    confirmDeleteEmail.trim().toLowerCase() !== data.client.email.toLowerCase()
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingClient ? 'Processing...' : 'Confirm Client Deletion'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Trading Account Modal */}
        {deleteAccountModalOpen && accountToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-[#0b0e14] border border-rose-500/30 rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">
                      Delete / Archive Account #{accountToDelete.account_number}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Platform: {accountToDelete.platform} • {accountToDelete.is_demo ? 'Demo' : 'Live'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeleteAccountModalOpen(false);
                    setAccountToDelete(null);
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-[#07090e] border border-[#1b222d] rounded-lg p-3 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Account #:</span>
                  <span className="text-white font-bold">#{accountToDelete.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Server:</span>
                  <span className="text-white">{accountToDelete.server_name || 'Standard'}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Balance:</span>
                  <span className="text-emerald-400 font-bold">
                    ${accountToDelete.balance || (accountToDelete.is_demo ? '10,000.00' : '0.00')} {accountToDelete.currency}
                  </span>
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-200/90 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-300 uppercase text-[10px] mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Transfer Audit Integrity</span>
                </div>
                <p>
                  If this trading account has executed prior transfers, it will be safely updated to <strong className="text-white">archived</strong> status to retain immutable ledger audit trails. If zero transfer history exists, the account record will be permanently deleted.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b222d]">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAccountModalOpen(false);
                    setAccountToDelete(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 text-xs font-medium hover:bg-[#1b222d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingAccount ? 'Processing...' : 'Confirm Account Deletion'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Trading Account Modal */}
        {assignAccountModalOpen && data && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-[#0b0e14] border border-[#1b222d] rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">Assign Trading Account</h4>
                    <span className="text-[10px] text-slate-400">Map an existing account to this client</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAssignAccountModalOpen(false);
                    setAssignAccountId('');
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                Transfer ownership of an existing trading account to{' '}
                <strong className="text-white">{data.client.first_name} {data.client.last_name}</strong> ({data.client.email}).
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Trading Account ID (UUID)
                </label>
                <input
                  type="text"
                  value={assignAccountId}
                  onChange={(e) => setAssignAccountId(e.target.value)}
                  placeholder="e.g., c9241b9c-7201-443b-8526-b8db257d0f91"
                  className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b222d]">
                <button
                  type="button"
                  onClick={() => {
                    setAssignAccountModalOpen(false);
                    setAssignAccountId('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 text-xs font-medium hover:bg-[#1b222d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignAccount}
                  disabled={assigningAccount || !assignAccountId.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{assigningAccount ? 'Assigning...' : 'Assign Account'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
