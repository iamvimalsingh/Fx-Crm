import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Info,
  Building,
  ShieldAlert,
} from 'lucide-react';

interface WalletData {
  id: string;
  currency: string;
  balance: string;
  reserved_balance: string;
  available_balance: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  type: 'deposit' | 'withdrawal' | 'both';
  currency: string;
  min_amount: string;
  max_amount: string;
  instructions: string;
  account_details: Record<string, any>;
  is_active: boolean;
}

interface DepositRecord {
  id: string;
  reference_no: string;
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

export function ClientWalletView() {
  const { token, user } = useAuth();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'ledger'>('deposits');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states - Deposit
  const [depMethodId, setDepMethodId] = useState('');
  const [depAmount, setDepAmount] = useState('');
  const [depNotes, setDepNotes] = useState('');

  // Form states - Withdrawal
  const [wthMethodId, setWthMethodId] = useState('');
  const [wthAmount, setWthAmount] = useState('');
  const [wthAccountDest, setWthAccountDest] = useState('');
  const [wthNotes, setWthNotes] = useState('');

  const fetchData = async () => {
    if (!token) return;
    try {
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };

      const [resWallet, resMethods, resDeposits, resWithdrawals, resTxns] = await Promise.all([
        fetch('/api/financial/wallet', { headers }),
        fetch('/api/financial/payment-methods'),
        fetch('/api/financial/deposits', { headers }),
        fetch('/api/financial/withdrawals', { headers }),
        fetch('/api/financial/transactions', { headers }),
      ]);

      const dataWallet = await resWallet.json();
      const dataMethods = await resMethods.json();
      const dataDeposits = await resDeposits.json();
      const dataWithdrawals = await resWithdrawals.json();
      const dataTxns = await resTxns.json();

      if (resWallet.ok) setWallet(dataWallet.data);
      if (resMethods.ok) {
        setPaymentMethods(dataMethods.data);
        if (dataMethods.data.length > 0) {
          setDepMethodId(dataMethods.data[0].id);
          setWthMethodId(dataMethods.data[0].id);
        }
      }
      if (resDeposits.ok) setDeposits(dataDeposits.data);
      if (resWithdrawals.ok) setWithdrawals(dataWithdrawals.data);
      if (resTxns.ok) setTransactions(dataTxns.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load financial records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Submit Deposit Request
  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingAction(true);
      setError(null);
      const res = await fetch('/api/financial/deposits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method_id: depMethodId || null,
          amount: depAmount,
          currency: wallet?.currency || 'USD',
          client_notes: depNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit deposit request');
      }

      setSuccessMessage(`Deposit request ${data.data.reference_no} submitted successfully for review.`);
      setShowDepositModal(false);
      setDepAmount('');
      setDepNotes('');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Withdrawal Request
  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingAction(true);
      setError(null);

      const selectedMethod = paymentMethods.find((p) => p.id === wthMethodId);
      const payoutDetails: Record<string, string> = {
        destination: wthAccountDest,
        method: selectedMethod?.name || 'Bank Transfer',
      };

      const res = await fetch('/api/financial/withdrawals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method_id: wthMethodId || null,
          amount: wthAmount,
          currency: wallet?.currency || 'USD',
          payout_details: payoutDetails,
          client_notes: wthNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit withdrawal request');
      }

      setSuccessMessage(`Withdrawal ${data.data.withdrawal.reference_no} requested. Funds placed in reserve.`);
      setShowWithdrawModal(false);
      setWthAmount('');
      setWthAccountDest('');
      setWthNotes('');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Cancel Pending Withdrawal
  const handleCancelWithdrawal = async (withdrawalId: string) => {
    if (!token) return;
    if (!window.confirm('Cancel this pending withdrawal request? Reserved funds will be immediately restored.')) {
      return;
    }
    try {
      setRefreshing(true);
      const res = await fetch(`/api/financial/withdrawals/${withdrawalId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel withdrawal');
      }
      setSuccessMessage('Withdrawal cancelled. Reserved funds returned to your available balance.');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message);
      setRefreshing(false);
    }
  };

  const selectedDepositMethod = paymentMethods.find((p) => p.id === depMethodId);
  const selectedWithdrawalMethod = paymentMethods.find((p) => p.id === wthMethodId);

  return (
    <div className="space-y-6">
      {/* Notifications */}
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

      {/* Header & Balance Cards */}
      <div className="bg-[#121824] border border-[#26334d] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Primary Trading Wallet
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold">
                DECIMAL(15,2) Exact
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              <span>{user?.preferred_currency || 'USD'} Wallet</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-[#182030] hover:bg-[#1f2a3f] border border-[#26334d] text-slate-300 text-xs flex items-center gap-1.5 transition"
              title="Refresh wallet balances"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setShowDepositModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Deposit</span>
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* 3-Column Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#182030] border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Available Balance</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                Withdrawable
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              ${wallet?.available_balance || '0.00'}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Funds immediately available for trade execution or withdrawal.
            </p>
          </div>

          <div className="bg-[#182030] border border-amber-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Reserved Balance</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                Pending Approval
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">
              ${wallet?.reserved_balance || '0.00'}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Protected funds locked during active withdrawal review.
            </p>
          </div>

          <div className="bg-[#182030] border border-[#26334d] rounded-xl p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Wallet Equity</span>
              <span className="text-[10px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
                Sum
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              ${wallet?.balance || '0.00'}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Total holdings across available and pending reserved funds.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs for Financial Logs */}
      <div className="bg-[#121824] border border-[#26334d] rounded-2xl overflow-hidden">
        <div className="border-b border-[#26334d] px-6 pt-4 flex items-center gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'deposits'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposits History ({deposits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'withdrawals'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdrawals History ({withdrawals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Immutable Ledger ({transactions.length})</span>
          </button>
        </div>

        <div className="p-6">
          {/* DEPOSITS TABLE */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              {deposits.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ArrowDownLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No deposit requests recorded yet.</p>
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    Submit First Deposit
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#26334d] text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Reference No</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e273a]">
                      {deposits.map((dep) => (
                        <tr key={dep.id} className="hover:bg-[#182030]/50 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-200">{dep.reference_no}</td>
                          <td className="py-3 px-3 text-slate-300">{dep.payment_method_name}</td>
                          <td className="py-3 px-3 font-bold font-mono text-emerald-400">
                            +${dep.amount} {dep.currency}
                          </td>
                          <td className="py-3 px-3">
                            {dep.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                                <Clock className="w-3 h-3" /> Under Review
                              </span>
                            )}
                            {dep.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Credited
                              </span>
                            )}
                            {dep.status === 'rejected' && (
                              <span
                                title={dep.rejection_reason || 'Rejected by finance'}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold cursor-help"
                              >
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(dep.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                            {dep.rejection_reason ? (
                              <span className="text-rose-400">Reason: {dep.rejection_reason}</span>
                            ) : (
                              dep.client_notes || dep.admin_notes || '—'
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

          {/* WITHDRAWALS TABLE */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              {withdrawals.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ArrowUpRight className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No withdrawal requests recorded yet.</p>
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Request Withdrawal
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#26334d] text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Reference No</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Destination</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e273a]">
                      {withdrawals.map((wth) => (
                        <tr key={wth.id} className="hover:bg-[#182030]/50 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-200">{wth.reference_no}</td>
                          <td className="py-3 px-3 text-slate-300">{wth.payment_method_name}</td>
                          <td className="py-3 px-3 font-bold font-mono text-amber-300">
                            ${wth.amount} {wth.currency}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400 max-w-xs truncate">
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
                                title={wth.rejection_reason || 'Rejected by finance'}
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
                            {wth.status === 'pending' && (
                              <button
                                onClick={() => handleCancelWithdrawal(wth.id)}
                                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition"
                              >
                                Cancel
                              </button>
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

          {/* IMMUTABLE LEDGER TABLE */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-[#26334d]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span>
                    Immutable double-entry balance trail. Every debit, credit, and reservation retains exact balance snapshots.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-indigo-300">{transactions.length} Ledger Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#26334d] text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Txn No</th>
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
                  <tbody className="divide-y divide-[#1e273a]">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                          No ledger transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((txn) => {
                        const isCredit = txn.type === 'deposit' || txn.type === 'adjustment_credit';
                        const isDebit = txn.type === 'withdrawal' || txn.type === 'adjustment_debit';
                        const isReserve = txn.type === 'withdrawal_reserve';

                        return (
                          <tr key={txn.id} className="hover:bg-[#182030]/50 transition text-[11px]">
                            <td className="py-2.5 px-3 font-semibold text-slate-200">{txn.transaction_no}</td>
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-[#121824] border border-[#26334d] rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#26334d] pb-4">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Manual Deposit Request</h3>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeposit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Payment Channel</label>
                <select
                  value={depMethodId}
                  onChange={(e) => setDepMethodId(e.target.value)}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  {paymentMethods
                    .filter((p) => p.type === 'deposit' || p.type === 'both')
                    .map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} (${method.min_amount} - ${method.max_amount} USD)
                      </option>
                    ))}
                </select>
              </div>

              {/* Instructions and Bank/Crypto Details */}
              {selectedDepositMethod && (
                <div className="p-3 bg-[#182030] border border-[#26334d] rounded-xl space-y-2">
                  <div className="text-slate-300 font-medium">{selectedDepositMethod.instructions}</div>
                  <div className="space-y-1.5 pt-2 border-t border-[#26334d]/60 font-mono text-[11px]">
                    {Object.entries(selectedDepositMethod.account_details).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between bg-[#121824] p-1.5 rounded">
                        <span className="text-slate-400 uppercase text-[10px]">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <span className="truncate max-w-[220px]">{String(val)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(String(val), key)}
                            className="text-blue-400 hover:text-blue-300"
                            title="Copy to clipboard"
                          >
                            {copiedKey === key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Deposit Amount (USD) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    placeholder="500.00"
                    className="w-full bg-[#182030] border border-[#26334d] rounded-lg py-2 pl-7 pr-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Exact decimal precision. Subject to administrative escrow verification.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Deposit Proof / Reference Notes
                </label>
                <textarea
                  rows={2}
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  placeholder="e.g. Bank wire transaction ID, sender bank name, or tx hash"
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#182030] hover:bg-[#212b40] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Submit Deposit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-[#121824] border border-[#26334d] rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#26334d] pb-4">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Request Withdrawal</h3>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWithdrawal} className="space-y-4 text-xs">
              {/* Balance Guard Callout */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    Available to Withdraw: ${wallet?.available_balance || '0.00'} USD
                  </div>
                  <div className="text-[11px] text-blue-300/80 mt-0.5">
                    Requested amounts are instantly placed into <strong className="text-amber-300">Reserved Balance</strong> to prevent over-drafting while under finance audit.
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Withdrawal Method</label>
                <select
                  value={wthMethodId}
                  onChange={(e) => setWthMethodId(e.target.value)}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  {paymentMethods
                    .filter((p) => p.type === 'withdrawal' || p.type === 'both')
                    .map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} (Limit: ${method.min_amount} - ${method.max_amount})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Withdrawal Amount (USD) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={wallet?.available_balance || '999999'}
                    required
                    value={wthAmount}
                    onChange={(e) => setWthAmount(e.target.value)}
                    placeholder="250.00"
                    className="w-full bg-[#182030] border border-[#26334d] rounded-lg py-2 pl-7 pr-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Payout Destination Details <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={wthAccountDest}
                  onChange={(e) => setWthAccountDest(e.target.value)}
                  placeholder="e.g. Bank Name, IBAN / Account #, SWIFT/BIC, or Crypto Wallet Address"
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Client Reference Notes (Optional)
                </label>
                <input
                  type="text"
                  value={wthNotes}
                  onChange={(e) => setWthNotes(e.target.value)}
                  placeholder="e.g. Monthly profit disbursement"
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#182030] hover:bg-[#212b40] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                  <span>Confirm & Reserve Funds</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
