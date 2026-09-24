import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Layers,
  FileText,
  HelpCircle,
  X,
  CreditCard,
  ChevronRight,
  UserCheck,
  UserX,
  Trash2,
} from 'lucide-react';
import { Client360Drawer } from './Client360Drawer';

interface ClientListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  country: string;
  phone: string | null;
  preferred_currency: string;
  status: 'active' | 'suspended' | 'pending';
  kyc_status: string;
  wallet_balance: string;
  wallet_reserved_balance: string;
  trading_accounts_count: number;
  created_at: string;
  last_login_at?: string | null;
}

export function AdminClientDirectoryView() {
  const { token } = useAuth();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [kycFilter, setKycFilter] = useState<'all' | 'unsubmitted' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');

  // Selected Client for 360 Drawer
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Client Deletion Modal State
  const [deleteModalClient, setDeleteModalClient] = useState<ClientListItem | null>(null);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState('');
  const [deletingClient, setDeletingClient] = useState(false);
  const [deleteActionMessage, setDeleteActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchClients = async () => {
    if (!token) return;
    try {
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (kycFilter !== 'all') params.set('kycStatus', kycFilter);

      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch client accounts');
      setClients(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Error communicating with broker server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [token, statusFilter, kycFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const handleDeleteClient = async () => {
    if (!token || !deleteModalClient || deletingClient) return;

    if (confirmDeleteEmail.trim().toLowerCase() !== deleteModalClient.email.toLowerCase()) {
      setDeleteActionMessage({
        type: 'error',
        text: 'Confirmation email does not match the client email address.',
      });
      return;
    }

    setDeletingClient(true);
    try {
      const res = await fetch(`/api/admin/clients/${deleteModalClient.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmEmail: confirmDeleteEmail.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to delete client account');
      }

      if (json.action === 'deleted') {
        setDeleteActionMessage({
          type: 'success',
          text: json.message || `Client account ${deleteModalClient.first_name} ${deleteModalClient.last_name} (${deleteModalClient.email}) permanently deleted.`,
        });
      } else if (json.action === 'deactivated') {
        setDeleteActionMessage({
          type: 'success',
          text: json.message || `Client account ${deleteModalClient.first_name} ${deleteModalClient.last_name} (${deleteModalClient.email}) deactivated and archived.`,
        });
      } else {
        setDeleteActionMessage({
          type: 'success',
          text: json.message || 'Client account processed successfully.',
        });
      }

      setDeleteModalClient(null);
      setConfirmDeleteEmail('');
      await fetchClients();
    } catch (err: any) {
      setDeleteActionMessage({
        type: 'error',
        text: err.message || 'Error communicating with broker server',
      });
    } finally {
      setDeletingClient(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Client Directory & Inspector</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search verified traders, inspect 360° operational profiles, and manage compliance standing.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1b222d] border border-[#232c3b] text-slate-200 text-xs font-medium transition disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Directory'}</span>
          </button>
        </div>

        {/* Filter Controls */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or client UUID..."
              className="w-full bg-[#07090e] border border-[#1b222d] focus:border-purple-500/50 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">Status: All Records</option>
              <option value="active">Active Traders</option>
              <option value="suspended">Suspended Accounts</option>
              <option value="pending">Pending Onboarding</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value as any)}
              className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">KYC: All States</option>
              <option value="approved">KYC: Approved</option>
              <option value="pending">KYC: Pending Review</option>
              <option value="under_review">KYC: Under Review</option>
              <option value="rejected">KYC: Rejected</option>
              <option value="unsubmitted">KYC: Unsubmitted</option>
            </select>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {deleteActionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
            deleteActionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteActionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{deleteActionMessage.text}</span>
          </div>
          <button onClick={() => setDeleteActionMessage(null)} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1b222d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white uppercase">Client Accounts ({clients.length})</span>
          </div>
          <span className="text-[11px] text-slate-400">Click &quot;Inspect 360°&quot; to open deep operational profile</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Loading registered client accounts...</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No client accounts match the specified criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e121a] text-slate-400 text-[10px] uppercase font-semibold border-b border-[#1b222d]">
                <tr>
                  <th className="px-4 py-3">Trader Name</th>
                  <th className="px-4 py-3">Email / ID</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">KYC State</th>
                  <th className="px-4 py-3">Wallet Balance</th>
                  <th className="px-4 py-3">Accounts</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161c26]">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-[#10141d] transition">
                    <td className="px-4 py-3 font-semibold text-white">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 truncate max-w-[180px]">{c.email}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{c.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.country || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          c.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : c.status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          c.kyc_status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : c.kyc_status === 'under_review' || c.kyc_status === 'pending'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : c.kyc_status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {c.kyc_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {Number(c.wallet_balance).toFixed(2)} {c.preferred_currency}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{c.trading_accounts_count} linked</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedClientId(c.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/20 text-[11px] font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect 360°</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModalClient(c);
                            setConfirmDeleteEmail('');
                            setDeleteActionMessage(null);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] transition"
                          title="Delete or Deactivate Client Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 360° Client Inspector Drawer */}
      <Client360Drawer
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onClientUpdated={fetchClients}
      />

      {/* Client Deletion Confirmation Modal */}
      {deleteModalClient && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0b0e14] border border-rose-500/30 rounded-xl p-5 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Client Deletion</h4>
                  <span className="text-[10px] text-slate-400">Administrative client removal action</span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!deletingClient) {
                    setDeleteModalClient(null);
                    setConfirmDeleteEmail('');
                  }
                }}
                disabled={deletingClient}
                className="text-slate-500 hover:text-white transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client Summary */}
            <div className="bg-[#07090e] border border-[#1b222d] rounded-lg p-3 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-semibold text-white">
                  {deleteModalClient.first_name} {deleteModalClient.last_name}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Email:</span>
                <span className="text-purple-300">{deleteModalClient.email}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Wallet Balance:</span>
                <span className="text-emerald-400 font-bold">
                  {Number(deleteModalClient.wallet_balance).toFixed(2)} {deleteModalClient.preferred_currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trading Accounts:</span>
                <span className="text-white">{deleteModalClient.trading_accounts_count} linked</span>
              </div>
            </div>

            {/* Policy Explainer */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-200/90 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300 uppercase text-[10px]">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Audit & Financial Retention Policy</span>
              </div>
              <p>
                • <strong>Zero-history test clients</strong> with no prior transactions or transfers are permanently purged.
              </p>
              <p>
                • <strong>Clients with financial history</strong> are safely deactivated and trading accounts archived to retain immutable regulatory audit compliance.
              </p>
              <p>
                • Clients with active wallet balances or pending financial operations must be settled before deletion.
              </p>
            </div>

            {/* Verification Input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-300 block mb-1">
                Type client email to authorize deletion:
              </label>
              <div className="font-mono text-[10px] text-slate-500 mb-1.5">
                Target: <span className="text-slate-300 font-semibold">{deleteModalClient.email}</span>
              </div>
              <input
                type="email"
                value={confirmDeleteEmail}
                onChange={(e) => setConfirmDeleteEmail(e.target.value)}
                placeholder={deleteModalClient.email}
                disabled={deletingClient}
                className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-rose-500/50 disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b222d]">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalClient(null);
                  setConfirmDeleteEmail('');
                }}
                disabled={deletingClient}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 text-xs font-medium hover:bg-[#1b222d] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={
                  deletingClient ||
                  confirmDeleteEmail.trim().toLowerCase() !== deleteModalClient.email.toLowerCase()
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingClient ? 'Processing...' : 'Confirm Delete Client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
