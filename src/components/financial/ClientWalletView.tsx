import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { parseApiResponse } from '../../lib/api-client';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
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
  Search,
  Sliders,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface WalletData {
  id: string;
  currency: string;
  balance: string;
  reserved_balance: string;
  available_balance: string;
}

interface TradingAccountSummary {
  id: string;
  account_number: string;
  platform: string;
  currency: string;
  balance: string;
  equity: string;
  leverage: number;
  status: string;
  is_demo: boolean;
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
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountSummary[]>([]);

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'transfers' | 'ledger'>('deposits');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Transfer Form state
  const [transferDirection, setTransferDirection] = useState<'wallet_to_trading' | 'trading_to_wallet'>('wallet_to_trading');
  const [selectedTradingAccountId, setSelectedTradingAccountId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Ledger Filter states
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerDateFilter, setLedgerDateFilter] = useState('all');

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

      const [resWallet, resMethods, resDeposits, resWithdrawals, resTxns, resAccounts] = await Promise.all([
        fetch('/api/financial/wallet', { headers }),
        fetch('/api/financial/payment-methods'),
        fetch('/api/financial/deposits', { headers }),
        fetch('/api/financial/withdrawals', { headers }),
        fetch('/api/financial/transactions', { headers }),
        fetch('/api/trading/accounts', { headers }),
      ]);

      const [dataWallet, dataMethods, dataDeposits, dataWithdrawals, dataTxns, dataAccounts] = await Promise.all([
        parseApiResponse(resWallet),
        parseApiResponse(resMethods),
        parseApiResponse(resDeposits),
        parseApiResponse(resWithdrawals),
        parseApiResponse(resTxns),
        parseApiResponse(resAccounts),
      ]);

      if (dataWallet.ok && dataWallet.data) setWallet(dataWallet.data);
      if (dataMethods.ok && dataMethods.data) {
        setPaymentMethods(dataMethods.data);
        if (dataMethods.data.length > 0) {
          setDepMethodId(dataMethods.data[0].id);
          setWthMethodId(dataMethods.data[0].id);
        }
      }
      if (dataDeposits.ok && dataDeposits.data) setDeposits(dataDeposits.data);
      if (dataWithdrawals.ok && dataWithdrawals.data) setWithdrawals(dataWithdrawals.data);
      if (dataTxns.ok && dataTxns.data) setTransactions(dataTxns.data);
      if (dataAccounts.ok && dataAccounts.data) {
        setTradingAccounts(dataAccounts.data);
        if (dataAccounts.data.length > 0 && !selectedTradingAccountId) {
          setSelectedTradingAccountId(dataAccounts.data[0].id);
        }
      }
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
      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit deposit request');
      }

      setSuccessMessage(`Deposit request ${result.data?.reference_no} submitted successfully for review.`);
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
      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit withdrawal request');
      }

      setSuccessMessage(`Withdrawal ${result.data?.withdrawal?.reference_no || result.data?.reference_no} requested. Funds placed in reserve.`);
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
      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to cancel withdrawal');
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

  const selectedTradingAccount =
    tradingAccounts.find((a) => a.id === selectedTradingAccountId) || tradingAccounts[0];

  // Filtered transactions for client ledger
  const filteredTransactions = transactions.filter((t) => {
    const matchesType = ledgerTypeFilter === 'all' || t.type === ledgerTypeFilter;
    const matchesSearch =
      !ledgerSearch ||
      t.transaction_no.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(ledgerSearch.toLowerCase());

    if (!matchesType || !matchesSearch) return false;

    if (ledgerDateFilter === 'all') return true;
    const date = new Date(t.created_at).getTime();
    const now = Date.now();
    if (ledgerDateFilter === 'today') return now - date <= 24 * 60 * 60 * 1000;
    if (ledgerDateFilter === '7d') return now - date <= 7 * 24 * 60 * 60 * 1000;
    if (ledgerDateFilter === '30d') return now - date <= 30 * 24 * 60 * 60 * 1000;
    return true;
  });

  const transferTransactions = transactions.filter(
    (t) => t.type === 'internal_transfer' || t.type === 'transfer' || t.type.includes('transfer')
  );

  const [showBridgeModal, setShowBridgeModal] = useState(false);

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please specify a valid transfer amount greater than $0.00');
      return;
    }
    const amountNum = parseFloat(transferAmount);
    if (transferDirection === 'wallet_to_trading') {
      const avail = parseFloat(wallet?.available_balance || '0');
      if (amountNum > avail) {
        setError(`Transfer amount ($${amountNum.toFixed(2)}) exceeds available wallet balance ($${avail.toFixed(2)}).`);
        return;
      }
    } else {
      const acctBal = parseFloat(selectedTradingAccount?.balance || '0');
      if (amountNum > acctBal) {
        setError(`Transfer amount ($${amountNum.toFixed(2)}) exceeds trading account balance ($${acctBal.toFixed(2)}).`);
        return;
      }
    }
    setError(null);
    setShowBridgeModal(true);
  };

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
              onClick={() => setActiveTab('transfers')}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Internal Transfer</span>
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
            onClick={() => setActiveTab('transfers')}
            className={`pb-3 text-xs font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'transfers'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Internal Transfers</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px] border border-slate-700">
              Bridge
            </span>
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

          {/* INTERNAL TRANSFERS TAB */}
          {activeTab === 'transfers' && (
            <div className="space-y-6">
              {/* Architectural Notice Banner */}
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mt-0.5">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Internal Account Bridge</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold">
                        Bridge Status: Offline / Gateway Integration Required
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Move capital seamlessly between your primary CRM wallet and live MetaTrader 4/5 trading accounts.
                      Transfers execute with zero internal fees and maintain full audit traceability across ledger systems.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Transfer Form Card */}
                <div className="lg:col-span-7 bg-[#182030] border border-[#26334d] rounded-xl p-5 space-y-5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-[#26334d]">
                    <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                    <span>Initiate Account Transfer</span>
                  </h3>

                  <form onSubmit={handleTransferSubmit} className="space-y-4">
                    {/* Direction Switcher */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Transfer Direction
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTransferDirection('wallet_to_trading')}
                          className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                            transferDirection === 'wallet_to_trading'
                              ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-sm'
                              : 'bg-[#121824] border-[#26334d] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-cyan-300">Wallet → Trading</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Deposit into MetaTrader</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTransferDirection('trading_to_wallet')}
                          className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                            transferDirection === 'trading_to_wallet'
                              ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-sm'
                              : 'bg-[#121824] border-[#26334d] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ArrowDownLeft className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-cyan-300">Trading → Wallet</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Withdraw to CRM Wallet</span>
                        </button>
                      </div>
                    </div>

                    {/* Trading Account Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Target Trading Account
                      </label>
                      {tradingAccounts.length === 0 ? (
                        <div className="p-3 rounded-lg bg-[#121824] border border-[#26334d] text-xs text-slate-400">
                          No active trading accounts found for this profile. Please request or activate a trading account first.
                        </div>
                      ) : (
                        <select
                          value={selectedTradingAccountId || tradingAccounts[0]?.id || ''}
                          onChange={(e) => setSelectedTradingAccountId(e.target.value)}
                          className="w-full bg-[#121824] border border-[#26334d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                        >
                          {tradingAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.platform.toUpperCase()} #{acc.account_number} — Balance: ${acc.balance} {acc.currency} (Eq: ${acc.equity})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Source & Destination Preview */}
                    <div className="p-3 rounded-lg bg-[#121824] border border-[#26334d] grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Source Account</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {transferDirection === 'wallet_to_trading' ? 'CRM Primary Wallet' : `Account #${selectedTradingAccount?.account_number || 'N/A'}`}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                          Avail: ${transferDirection === 'wallet_to_trading' ? (wallet?.available_balance || '0.00') : (selectedTradingAccount?.balance || '0.00')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Destination Account</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {transferDirection === 'wallet_to_trading' ? `Account #${selectedTradingAccount?.account_number || 'N/A'}` : 'CRM Primary Wallet'}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                          Current: ${transferDirection === 'wallet_to_trading' ? (selectedTradingAccount?.balance || '0.00') : (wallet?.available_balance || '0.00')}
                        </div>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Transfer Amount ($)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (transferDirection === 'wallet_to_trading') {
                              setTransferAmount(wallet?.available_balance || '0.00');
                            } else {
                              setTransferAmount(selectedTradingAccount?.balance || '0.00');
                            }
                          }}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition"
                        >
                          Use Max Available
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#121824] border border-[#26334d] rounded-lg pl-7 pr-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                        >
                        </input>
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Transfer Memo (Optional)
                      </label>
                      <input
                        type="text"
                        value={transferNotes}
                        onChange={(e) => setTransferNotes(e.target.value)}
                        placeholder="e.g. Allocation for live trading week"
                        className="w-full bg-[#121824] border border-[#26334d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>Review & Execute Transfer</span>
                    </button>
                  </form>
                </div>

                {/* Architecture & Invariants Card */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#182030] border border-[#26334d] rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Bridge Architecture & Integrity</span>
                    </h4>

                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="p-3 rounded-lg bg-[#121824] border border-[#26334d] space-y-1">
                        <div className="font-bold text-cyan-300 text-[11px]">Domain Isolation Principle</div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          CRM Wallets reside in our ACID-compliant PostgreSQL database as the legal financial single source of truth.
                          Trading account balances live inside MetaTrader trade servers.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#121824] border border-[#26334d] space-y-1">
                        <div className="font-bold text-amber-300 text-[11px]">Two-Phase Commit Protocol</div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Internal transfers execute a two-phase protocol: debiting available balance, holding in transit, invoking the MT4/MT5 Gateway Manager API, and final credit commitment upon gateway acknowledgment.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#121824] border border-[#26334d] space-y-1">
                        <div className="font-bold text-emerald-300 text-[11px]">Zero Fee Guarantee</div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          All internal transfers between registered accounts belonging to the same verified client profile incur $0.00 fee.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transfer Transactions from Ledger */}
              <div className="bg-[#182030] border border-[#26334d] rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Internal Transfer History</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal font-mono">
                    {transferTransactions.length} recorded
                  </span>
                </h4>

                {transferTransactions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No internal transfers have been completed yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="border-b border-[#26334d] text-slate-400 uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3">Txn No</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Balance Before</th>
                          <th className="py-2 px-3">Balance After</th>
                          <th className="py-2 px-3 font-sans">Details</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e273a]">
                        {transferTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-[#121824]/50 text-[11px]">
                            <td className="py-2 px-3 font-semibold text-cyan-300">{tx.transaction_no}</td>
                            <td className="py-2 px-3 font-bold text-white">${tx.amount}</td>
                            <td className="py-2 px-3 text-slate-400">${tx.balance_before}</td>
                            <td className="py-2 px-3 text-emerald-400">${tx.balance_after}</td>
                            <td className="py-2 px-3 font-sans text-slate-300 max-w-xs truncate">{tx.description}</td>
                            <td className="py-2 px-3 text-slate-500 text-[10px]">{new Date(tx.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IMMUTABLE LEDGER TABLE WITH FILTERS & SEARCH */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pb-2 border-b border-[#26334d]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span>
                    Immutable double-entry balance trail. Every debit, credit, and reservation retains exact balance snapshots.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-indigo-300">
                  Showing {filteredTransactions.length} of {transactions.length} Ledger Records
                </span>
              </div>

              {/* Filter Controls Bar */}
              <div className="p-3 rounded-xl bg-[#182030] border border-[#26334d] flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search by transaction no or description..."
                    className="w-full bg-[#121824] border border-[#26334d] rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Type:</span>
                  <select
                    value={ledgerTypeFilter}
                    onChange={(e) => setLedgerTypeFilter(e.target.value)}
                    className="bg-[#121824] border border-[#26334d] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="deposit">Deposits</option>
                    <option value="withdrawal">Withdrawals</option>
                    <option value="withdrawal_reserve">Reservations</option>
                    <option value="adjustment_credit">Credit Adjustments</option>
                    <option value="adjustment_debit">Debit Adjustments</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Period:</span>
                  <select
                    value={ledgerDateFilter}
                    onChange={(e) => setLedgerDateFilter(e.target.value)}
                    className="bg-[#121824] border border-[#26334d] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today (24h)</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>

                {(ledgerSearch || ledgerTypeFilter !== 'all' || ledgerDateFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setLedgerSearch('');
                      setLedgerTypeFilter('all');
                      setLedgerDateFilter('all');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    Reset Filters
                  </button>
                )}
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
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                          {transactions.length === 0 ? 'No ledger transactions recorded yet.' : 'No transactions match the selected filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((txn) => {
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

      {/* INTERNAL TRANSFER BRIDGE NOTICE MODAL */}
      {showBridgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-[#121824] border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26334d] pb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Internal Transfer Bridge Status</h3>
              </div>
              <button
                onClick={() => setShowBridgeModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-2 text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Gateway Integration Required</span>
                </div>
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  Transfer of <strong className="text-white font-mono">${parseFloat(transferAmount || '0').toFixed(2)}</strong> from{' '}
                  <strong className="text-white">
                    {transferDirection === 'wallet_to_trading' ? 'CRM Primary Wallet' : `Trading Account #${selectedTradingAccount?.account_number}`}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-white">
                    {transferDirection === 'wallet_to_trading' ? `Trading Account #${selectedTradingAccount?.account_number}` : 'CRM Primary Wallet'}
                  </strong>{' '}
                  is queued under Bridge Governance.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#182030] border border-[#26334d] space-y-2 text-slate-300">
                <div className="font-semibold text-white">Why is this request protected?</div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  CRM wallets and trade servers operate in distinct financial state machines. In order to guarantee zero balance discrepancy or double-spending, live execution requires an atomic two-phase commit over the broker&apos;s MetaTrader 4 / MetaTrader 5 Gateway Service.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowBridgeModal(false)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
