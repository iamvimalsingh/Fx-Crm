import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
  PlusCircle,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Edit2,
  TrendingUp,
  Shield,
  Server,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface TradingAccount {
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
  created_at: string;
}

export function ClientTradingAccountsView() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'demo'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingNicknameAccount, setEditingNicknameAccount] = useState<TradingAccount | null>(null);
  const [leverageRequestAccount, setLeverageRequestAccount] = useState<TradingAccount | null>(null);
  const [inspectAccount, setInspectAccount] = useState<TradingAccount | null>(null);

  // Form states - Registration
  const [regPlatform, setRegPlatform] = useState<'MT4' | 'MT5' | 'cTrader' | 'WebTrader'>('MT5');
  const [regType, setRegType] = useState<'standard' | 'raw_spread' | 'pro' | 'islamic'>('standard');
  const [regCurrency, setRegCurrency] = useState('USD');
  const [regLeverage, setRegLeverage] = useState('1:100');
  const [regNickname, setRegNickname] = useState('');
  const [regIsDemo, setRegIsDemo] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);

  // Form states - Link
  const [linkNumber, setLinkNumber] = useState('');
  const [linkPlatform, setLinkPlatform] = useState<'MT4' | 'MT5' | 'cTrader' | 'WebTrader'>('MT5');
  const [linkServer, setLinkServer] = useState('');
  const [linkType, setLinkType] = useState<'standard' | 'raw_spread' | 'pro' | 'islamic'>('standard');
  const [linkCurrency, setLinkCurrency] = useState('USD');
  const [linkLeverage, setLinkLeverage] = useState('1:100');
  const [linkNickname, setLinkNickname] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  // Form states - Nickname
  const [newNickname, setNewNickname] = useState('');
  const [submittingNickname, setSubmittingNickname] = useState(false);

  // Form states - Leverage
  const [newLeverage, setNewLeverage] = useState('1:200');
  const [leverageReason, setLeverageReason] = useState('');
  const [submittingLeverage, setSubmittingLeverage] = useState(false);

  const fetchAccounts = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/trading-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAccounts(data.data);
      } else {
        setErrorMessage(data.message || 'Failed to load trading accounts');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching trading accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingReg(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/trading-accounts/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: regPlatform,
          account_type: regType,
          currency: regCurrency,
          leverage: regLeverage,
          nickname: regNickname.trim() || undefined,
          is_demo: regIsDemo,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(
          regIsDemo
            ? `Demo account ${data.data.account_number} created and ready!`
            : `Account registration ${data.data.account_number} submitted for broker approval.`
        );
        setShowRegisterModal(false);
        setRegNickname('');
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to register account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during registration');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingLink(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/trading-accounts/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_number: linkNumber.trim(),
          platform: linkPlatform,
          server_name: linkServer.trim(),
          account_type: linkType,
          currency: linkCurrency,
          leverage: linkLeverage,
          nickname: linkNickname.trim() || undefined,
          investor_notes: linkNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Account ${linkNumber} submitted for linking review.`);
        setShowLinkModal(false);
        setLinkNumber('');
        setLinkServer('');
        setLinkNickname('');
        setLinkNotes('');
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to link account');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error linking account');
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingNicknameAccount) return;
    setSubmittingNickname(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/trading-accounts/${editingNicknameAccount.id}/nickname`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: newNickname.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(`Nickname updated for account ${editingNicknameAccount.account_number}`);
        setEditingNicknameAccount(null);
        await fetchAccounts();
      } else {
        setErrorMessage(data.message || 'Failed to update nickname');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error updating nickname');
    } finally {
      setSubmittingNickname(false);
    }
  };

  const handleRequestLeverage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !leverageRequestAccount) return;
    setSubmittingLeverage(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/trading-accounts/${leverageRequestAccount.id}/request-leverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requested_leverage: newLeverage,
          reason: leverageReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(data.data.message || 'Leverage change request submitted to admin');
        setLeverageRequestAccount(null);
        setLeverageReason('');
      } else {
        setErrorMessage(data.message || 'Failed to submit leverage request');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error submitting leverage request');
    } finally {
      setSubmittingLeverage(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (filter === 'live') return !acc.is_demo;
    if (filter === 'demo') return acc.is_demo;
    return true;
  });

  const liveCount = accounts.filter((a) => !a.is_demo).length;
  const demoCount = accounts.filter((a) => a.is_demo).length;
  const activeCount = accounts.filter((a) => a.status === 'active').length;
  const pendingCount = accounts.filter((a) => a.status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      {/* Header & Isolation Notice */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Trading Accounts Registry</h2>
                <p className="text-xs text-slate-400">
                  Manage your MT4, MT5, and cTrader login registrations, leverage, and server metadata.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRegIsDemo(false);
                setShowRegisterModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Open New Account</span>
            </button>
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Link Existing Account</span>
            </button>
          </div>
        </div>

        {/* Informational Banner on CRM Scope */}
        <div className="mt-4 p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Registry Notice:</strong> This CRM acts as the broker account registry and authorization portal. Actual trade execution and order routing take place directly inside your native MetaTrader or cTrader client using your assigned login credentials.
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
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
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Accounts</span>
          <div className="text-xl font-bold text-white mt-1">{accounts.length}</div>
          <span className="text-[11px] text-slate-500">{liveCount} Live • {demoCount} Demo</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">{activeCount}</div>
          <span className="text-[11px] text-slate-500">Trading authorized</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Review</span>
          <div className="text-xl font-bold text-amber-400 mt-1">{pendingCount}</div>
          <span className="text-[11px] text-slate-500">Admin verification</span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sync Status</span>
            <div className="text-xs font-semibold text-slate-300 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Live Registry
            </div>
          </div>
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          All Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setFilter('live')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'live'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Live ({liveCount})
        </button>
        <button
          onClick={() => setFilter('demo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'demo'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Demo ({demoCount})
        </button>
      </div>

      {/* Accounts List / Cards */}
      {loading && accounts.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          <p className="text-xs">Loading registered trading accounts...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center bg-slate-900/20">
          <Layers className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Trading Accounts Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {filter === 'all'
              ? 'You have not registered or linked any trading accounts yet.'
              : `You have no ${filter} accounts registered.`}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setRegIsDemo(filter === 'demo');
                setShowRegisterModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
            >
              Open Your First Account
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAccounts.map((account) => {
            const isLive = !account.is_demo;
            const statusConfig = {
              active: {
                label: 'Active',
                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                icon: CheckCircle2,
              },
              pending_approval: {
                label: 'Pending Review',
                badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: Clock,
              },
              read_only: {
                label: 'Read Only',
                badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                icon: AlertCircle,
              },
              disabled: {
                label: 'Disabled',
                badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                icon: AlertCircle,
              },
              archived: {
                label: 'Archived',
                badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                icon: AlertCircle,
              },
            }[account.status];

            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={account.id}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white tracking-wide">
                          #{account.account_number}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isLive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {isLive ? 'Live' : 'Demo'}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {account.platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {account.nickname ? (
                            <span className="text-slate-200 font-medium">{account.nickname}</span>
                          ) : (
                            <span className="text-slate-500 italic">No nickname set</span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            setEditingNicknameAccount(account);
                            setNewNickname(account.nickname || '');
                          }}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                          title="Edit Nickname"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusConfig.badge}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>

                  {/* Card Spec Details */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/80 text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Account Type</span>
                      <span className="font-medium text-slate-200 capitalize">
                        {account.account_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Currency</span>
                      <span className="font-medium text-slate-200">{account.currency}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Leverage</span>
                      <span className="font-medium text-blue-400">{account.leverage}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Server</span>
                      <span className="font-medium text-slate-300 truncate block" title={account.server_name}>
                        {account.server_name}
                      </span>
                    </div>
                  </div>

                  {/* Rejection / Note feedback if any */}
                  {account.rejection_reason && (
                    <div className="mb-3 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                      <strong>Rejection Note:</strong> {account.rejection_reason}
                    </div>
                  )}
                  {account.admin_notes && (
                    <div className="mb-3 p-2 rounded bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-300">
                      <strong>Broker Note:</strong> {account.admin_notes}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      setLeverageRequestAccount(account);
                      setNewLeverage(account.leverage);
                    }}
                    disabled={account.status === 'archived' || account.status === 'disabled'}
                    className="text-blue-400 hover:text-blue-300 font-medium disabled:text-slate-600 flex items-center gap-1"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Change Leverage</span>
                  </button>

                  <button
                    onClick={() => setInspectAccount(account)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <span>View Specifications</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Register New Trading Account */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>Open New Trading Account</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Demo vs Live switch */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Account Environment</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRegIsDemo(false)}
                    className={`py-1.5 text-xs font-semibold rounded-md transition ${
                      !regIsDemo ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegIsDemo(true)}
                    className={`py-1.5 text-xs font-semibold rounded-md transition ${
                      regIsDemo ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Demo Account
                  </button>
                </div>
              </div>

              {/* Platform */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Trading Platform</label>
                <select
                  value={regPlatform}
                  onChange={(e) => setRegPlatform(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="MT5">MetaTrader 5 (MT5)</option>
                  <option value="MT4">MetaTrader 4 (MT4)</option>
                  <option value="cTrader">cTrader</option>
                  <option value="WebTrader">WebTrader Direct</option>
                </select>
              </div>

              {/* Account Type */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Account Type</label>
                <select
                  value={regType}
                  onChange={(e) => setRegType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="standard">Standard Account (Zero Commission)</option>
                  <option value="raw_spread">Raw Spread Account (Institutional Spreads)</option>
                  <option value="pro">Pro Account (High Volume Traders)</option>
                  <option value="islamic">Islamic Account (Swap-Free)</option>
                </select>
              </div>

              {/* Leverage & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account Currency</label>
                  <select
                    value={regCurrency}
                    onChange={(e) => setRegCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Initial Leverage</label>
                  <select
                    value={regLeverage}
                    onChange={(e) => setRegLeverage(e.target.value)}
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

              {/* Nickname */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Account Nickname <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scalping Strategy #1"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                  maxLength={100}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReg}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingReg ? 'Processing...' : regIsDemo ? 'Create Demo Account' : 'Submit Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Link Existing Account */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-400" />
                <span>Link Existing External Account</span>
              </h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleLink} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Account / Login Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5082194"
                  value={linkNumber}
                  onChange={(e) => setLinkNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Platform</label>
                  <select
                    value={linkPlatform}
                    onChange={(e) => setLinkPlatform(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="MT5">MetaTrader 5</option>
                    <option value="MT4">MetaTrader 4</option>
                    <option value="cTrader">cTrader</option>
                    <option value="WebTrader">WebTrader</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Server Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broker-Live-1"
                    value={linkServer}
                    onChange={(e) => setLinkServer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Account Type</label>
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value as any)}
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
                    value={linkLeverage}
                    onChange={(e) => setLinkLeverage(e.target.value)}
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

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nickname (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. London Server Account"
                  value={linkNickname}
                  onChange={(e) => setLinkNickname(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Verification Notes <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context for broker account verification..."
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLink}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingLink ? 'Submitting...' : 'Link Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Nickname */}
      {editingNicknameAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              Edit Nickname (#{editingNicknameAccount.account_number})
            </h3>
            <form onSubmit={handleSaveNickname} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Display Nickname</label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="e.g. Swing Strategy"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingNicknameAccount(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNickname}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {submittingNickname ? 'Saving...' : 'Save Nickname'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Leverage Change */}
      {leverageRequestAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span>Request Leverage Change (#{leverageRequestAccount.account_number})</span>
              </h3>
              <button
                onClick={() => setLeverageRequestAccount(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestLeverage} className="space-y-3.5">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">Current Leverage:</span>
                <span className="font-bold text-slate-200">{leverageRequestAccount.leverage}</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Requested Leverage</label>
                <select
                  value={newLeverage}
                  onChange={(e) => setNewLeverage(e.target.value)}
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
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Reason for Adjustment <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why you are requesting higher or lower leverage..."
                  value={leverageReason}
                  onChange={(e) => setLeverageReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLeverageRequestAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeverage}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {submittingLeverage ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Specifications */}
      {inspectAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Account Specifications</h3>
                <p className="text-[11px] font-mono text-slate-400">#{inspectAccount.account_number}</p>
              </div>
              <button onClick={() => setInspectAccount(null)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Platform</span>
                <span className="font-semibold text-white">{inspectAccount.platform}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Account Type</span>
                <span className="font-semibold text-white capitalize">{inspectAccount.account_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Currency</span>
                <span className="font-semibold text-white">{inspectAccount.currency}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Leverage</span>
                <span className="font-semibold text-blue-400">{inspectAccount.leverage}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Server</span>
                <span className="font-semibold text-white">{inspectAccount.server_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Group Tier</span>
                <span className="font-mono text-slate-300">{inspectAccount.group_tier || 'Default'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Registered Date</span>
                <span className="text-slate-300">{new Date(inspectAccount.created_at).toLocaleDateString()}</span>
              </div>
              {inspectAccount.approved_at && (
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Approved Date</span>
                  <span className="text-emerald-400">{new Date(inspectAccount.approved_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setInspectAccount(null)}
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
