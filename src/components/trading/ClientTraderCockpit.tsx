import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { parseApiResponse } from '../../lib/api-client';
import {
  Wallet,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Server,
  Activity,
  Terminal,
  FileText,
  MessageSquare,
  ChevronRight,
  Info,
  RefreshCw,
  X,
  AlertTriangle,
  ArrowLeft,
  Send,
} from 'lucide-react';

export interface WalletData {
  id: string;
  currency: string;
  balance: string;
  reserved_balance: string;
  available_balance: string;
}

export interface TradingAccount {
  id: string;
  account_number: string;
  user_id: string;
  platform: 'MT4' | 'MT5' | 'cTrader' | 'WebTrader' | 'TradeLocker';
  account_type: 'standard' | 'raw_spread' | 'pro' | 'islamic';
  server_name: string;
  currency: string;
  leverage: string;
  status: 'pending_approval' | 'active' | 'read_only' | 'disabled' | 'archived';
  nickname?: string | null;
  is_demo: boolean;
  group_tier?: string | null;
  approved_at?: string | null;
  created_at: string;
  balance?: string | null;
  equity?: string | null;
}

export interface KycProfile {
  id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  currency: string;
  min_amount: string;
  max_amount: string;
  instructions: string;
  is_active: boolean;
}

export interface TransactionRecord {
  id: string;
  transaction_no: string;
  type: string;
  amount: string;
  currency: string;
  balance_before: string;
  balance_after: string;
  status: string;
  description: string;
  created_at: string;
}

export interface SupportTicketItem {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_client' | 'resolved' | 'closed';
  last_reply_at: string;
  created_at: string;
}

interface ClientTraderCockpitProps {
  onNavigate: (tab: string, contextId?: string) => void;
  brokerName?: string;
  brokerCurrency?: string;
  kycStatus?: 'not_started' | 'action_required' | 'under_review' | 'verified' | 'rejected';
  kycRejectionReason?: string | null;
}

export function ClientTraderCockpit({
  onNavigate,
  brokerCurrency = 'USD',
  kycStatus: propKycStatus,
  kycRejectionReason: propKycRejectionReason,
}: ClientTraderCockpitProps) {
  const { user, token } = useAuth();

  // Core Data States (Strictly from real backend APIs)
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [kycProfile, setKycProfile] = useState<KycProfile | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
  const [recentTickets, setRecentTickets] = useState<SupportTicketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Quick Action Modals
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showNewAccountModal, setShowNewAccountModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);

  // Account Modals
  const [inspectAccount, setInspectAccount] = useState<TradingAccount | null>(null);
  const [leverageRequestAccount, setLeverageRequestAccount] = useState<TradingAccount | null>(null);
  const [launchpadAccount, setLaunchpadAccount] = useState<TradingAccount | null>(null);
  const [selectedWorkspaceAccountId, setSelectedWorkspaceAccountId] = useState<string | null>(null);
  const [workspaceSubTab, setWorkspaceSubTab] = useState<'positions' | 'orders' | 'specifications'>('positions');

  // Form states - Deposit
  const [depMethodId, setDepMethodId] = useState<string>('');
  const [depAmount, setDepAmount] = useState<string>('');
  const [depNotes, setDepNotes] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);

  // Form states - Withdrawal
  const [wthMethodId, setWthMethodId] = useState<string>('');
  const [wthAmount, setWthAmount] = useState<string>('');
  const [wthDestination, setWthDestination] = useState<string>('');
  const [wthNotes, setWthNotes] = useState<string>('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState<boolean>(false);

  // Form states - New Account
  const [newPlatform, setNewPlatform] = useState<'MT4' | 'MT5' | 'cTrader' | 'WebTrader'>('MT5');
  const [newAccountType, setNewAccountType] = useState<'standard' | 'raw_spread' | 'pro' | 'islamic'>('standard');
  const [newCurrency, setNewCurrency] = useState<string>('USD');
  const [newLeverage, setNewLeverage] = useState<string>('1:100');
  const [newNickname, setNewNickname] = useState<string>('');
  const [newIsDemo, setNewIsDemo] = useState<boolean>(false);
  const [submittingNewAccount, setSubmittingNewAccount] = useState<boolean>(false);

  // Form states - Leverage Request
  const [reqLeverageValue, setReqLeverageValue] = useState<string>('1:200');
  const [reqLeverageReason, setReqLeverageReason] = useState<string>('');
  const [submittingLeverage, setSubmittingLeverage] = useState<boolean>(false);

  // Form states - Support Ticket
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketCategory, setTicketCategory] = useState<string>('general');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [submittingTicket, setSubmittingTicket] = useState<boolean>(false);

  // Copy tracking
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Integrated Workflows Tab Selection
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'ledger' | 'kyc' | 'support'>('ledger');

  // Inline Support Thread State (Inside Cockpit)
  const [inlineActiveTicketId, setInlineActiveTicketId] = useState<string | null>(null);
  const [inlineTicketDetail, setInlineTicketDetail] = useState<{
    ticket: SupportTicketItem;
    messages: Array<{
      id: string;
      ticket_id: string;
      sender_id: string;
      sender_role: 'client' | 'admin' | 'system';
      is_internal: boolean;
      message: string;
      created_at: string;
      sender?: { first_name: string; last_name: string; email: string };
      attachments?: Array<{ id: string; original_filename: string; file_size: number; mime_type: string; storage_key: string }>;
    }>;
  } | null>(null);
  const [loadingInlineTicket, setLoadingInlineTicket] = useState<boolean>(false);
  const [inlineReplyText, setInlineReplyText] = useState<string>('');
  const [submittingInlineReply, setSubmittingInlineReply] = useState<boolean>(false);
  const [updatingInlineStatus, setUpdatingInlineStatus] = useState<boolean>(false);

  // 5-State KYC Progression Mapping
  const effectiveKycStatus: 'not_started' | 'action_required' | 'under_review' | 'verified' | 'rejected' = (() => {
    if (propKycStatus) return propKycStatus;
    if (!kycProfile || !kycProfile.status) return 'not_started';
    if (kycProfile.status === 'approved') return 'verified';
    if (kycProfile.status === 'rejected') return 'rejected';
    if (kycProfile.status === 'under_review') return 'under_review';
    if (kycProfile.status === 'pending') return 'action_required';
    return 'not_started';
  })();

  const effectiveRejectionReason = propKycRejectionReason ?? kycProfile?.rejection_reason ?? null;

  const loadInlineTicket = async (ticketId: string) => {
    if (!token) return;
    setInlineActiveTicketId(ticketId);
    setLoadingInlineTicket(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        // STRICT STAFF NOTE ISOLATION (ZERO CLIENT LEAKAGE):
        // Filter out any messages where is_internal === true
        const rawMessages = json.data.messages || [];
        const clientSafeMessages = rawMessages.filter((m: any) => !m.is_internal);
        setInlineTicketDetail({
          ticket: json.data.ticket,
          messages: clientSafeMessages,
        });
      } else {
        setApiError(json.message || 'Unable to load ticket messages');
      }
    } catch (err: any) {
      setApiError(err.message || 'Error loading ticket conversation');
    } finally {
      setLoadingInlineTicket(false);
    }
  };

  const handleInlineReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !inlineActiveTicketId || !inlineReplyText.trim()) return;
    setSubmittingInlineReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${inlineActiveTicketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: inlineReplyText.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setInlineReplyText('');
        loadInlineTicket(inlineActiveTicketId);
        loadCockpitData(true);
      } else {
        setApiError(json.message || 'Failed to submit response');
      }
    } catch (err: any) {
      setApiError(err.message || 'Network error while sending reply');
    } finally {
      setSubmittingInlineReply(false);
    }
  };

  const handleCloseInlineTicket = async () => {
    if (!token || !inlineActiveTicketId) return;
    setUpdatingInlineStatus(true);
    try {
      const res = await fetch(`/api/support/tickets/${inlineActiveTicketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'closed' }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setActionSuccess('Support ticket closed.');
        loadInlineTicket(inlineActiveTicketId);
        loadCockpitData(true);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setApiError(json.message || 'Failed to close ticket');
      }
    } catch (err: any) {
      setApiError(err.message || 'Error updating ticket status');
    } finally {
      setUpdatingInlineStatus(false);
    }
  };

  // Load all verified data without duplicate endpoints
  const loadCockpitData = async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    setApiError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [
        walletRes,
        accountsRes,
        kycRes,
        methodsRes,
        transactionsRes,
        ticketsRes,
      ] = await Promise.all([
        fetch('/api/financial/wallet', { headers }),
        fetch('/api/trading-accounts', { headers }),
        fetch('/api/kyc/profile', { headers }),
        fetch('/api/financial/payment-methods'),
        fetch('/api/financial/transactions', { headers }),
        fetch('/api/support/tickets?limit=5', { headers }),
      ]);

      const [
        walletData,
        accountsData,
        kycData,
        methodsData,
        transactionsData,
        ticketsData,
      ] = await Promise.all([
        parseApiResponse<WalletData>(walletRes),
        parseApiResponse<TradingAccount[]>(accountsRes),
        parseApiResponse<{ profile: KycProfile | null }>(kycRes),
        parseApiResponse<PaymentMethod[]>(methodsRes),
        parseApiResponse<TransactionRecord[]>(transactionsRes),
        parseApiResponse<{ tickets: SupportTicketItem[] }>(ticketsRes),
      ]);

      if (walletData.ok && walletData.data) {
        setWallet(walletData.data);
      }
      if (accountsData.ok && Array.isArray(accountsData.data)) {
        setAccounts(accountsData.data);
      }
      if (kycData.ok && kycData.data?.profile) {
        setKycProfile(kycData.data.profile);
      }
      if (methodsData.ok && Array.isArray(methodsData.data)) {
        setPaymentMethods(methodsData.data);
        if (methodsData.data.length > 0 && !depMethodId) {
          setDepMethodId(methodsData.data[0].id);
          setWthMethodId(methodsData.data[0].id);
        }
      }
      if (transactionsData.ok && Array.isArray(transactionsData.data)) {
        setRecentTransactions(transactionsData.data);
      }
      if (ticketsData.ok && Array.isArray(ticketsData.data?.tickets)) {
        setRecentTickets(ticketsData.data.tickets);
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to load cockpit metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCockpitData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCockpitData(true);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Submit Deposit Workflow
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingDeposit(true);
      setApiError(null);
      const res = await fetch('/api/financial/deposits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method_id: depMethodId || null,
          amount: depAmount,
          currency: wallet?.currency || brokerCurrency,
          client_notes: depNotes || null,
        }),
      });

      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Deposit request failed');
      }

      setActionSuccess(`Deposit request #${result.data?.reference_no} submitted. Funds will reflect upon broker receipt verification.`);
      setShowDepositModal(false);
      setDepAmount('');
      setDepNotes('');
      loadCockpitData(true);
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      setApiError(err.message || 'Failed to submit deposit');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // 2. Submit Withdrawal Workflow
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingWithdrawal(true);
      setApiError(null);

      const selectedMethod = paymentMethods.find((p) => p.id === wthMethodId);
      const payoutDetails = {
        destination: wthDestination,
        payment_method_name: selectedMethod?.name || 'Bank Wire / Crypto Transfer',
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
          currency: wallet?.currency || brokerCurrency,
          payout_details: payoutDetails,
          client_notes: wthNotes || null,
        }),
      });

      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Withdrawal reservation failed');
      }

      setActionSuccess(`Withdrawal #${result.data?.withdrawal?.reference_no || result.data?.reference_no} placed in reserve. Balance safely reserved pending compliance verification.`);
      setShowWithdrawModal(false);
      setWthAmount('');
      setWthDestination('');
      setWthNotes('');
      loadCockpitData(true);
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      setApiError(err.message || 'Failed to submit withdrawal');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  // 3. Submit New Trading Account Request
  const handleNewAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingNewAccount(true);
      setApiError(null);

      const res = await fetch('/api/trading-accounts/register', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: newPlatform,
          account_type: newAccountType,
          currency: newCurrency,
          leverage: newLeverage,
          nickname: newNickname || null,
          is_demo: newIsDemo,
        }),
      });

      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to register trading account');
      }

      setActionSuccess(`Trading Account #${result.data?.account_number} created successfully.`);
      setShowNewAccountModal(false);
      setNewNickname('');
      loadCockpitData(true);
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      setApiError(err.message || 'Failed to register trading account');
    } finally {
      setSubmittingNewAccount(false);
    }
  };

  // 4. Submit Leverage Change Request
  const handleLeverageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !leverageRequestAccount) return;
    try {
      setSubmittingLeverage(true);
      setApiError(null);

      const res = await fetch(`/api/trading-accounts/${leverageRequestAccount.id}/request-leverage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requested_leverage: reqLeverageValue,
          reason: reqLeverageReason || null,
        }),
      });

      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit leverage request');
      }

      setActionSuccess(`Leverage change request to ${reqLeverageValue} submitted for review.`);
      setLeverageRequestAccount(null);
      setReqLeverageReason('');
      loadCockpitData(true);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setApiError(err.message || 'Failed to request leverage');
    } finally {
      setSubmittingLeverage(false);
    }
  };

  // 5. Submit Support Ticket
  const handleSupportTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSubmittingTicket(true);
      setApiError(null);

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: ticketSubject,
          category: ticketCategory,
          priority: ticketPriority,
          message: ticketMessage,
        }),
      });

      const result = await parseApiResponse(res);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit support ticket');
      }

      setActionSuccess(`Ticket ${result.data?.ticket_number || ''} submitted successfully.`);
      setShowSupportModal(false);
      setTicketSubject('');
      setTicketMessage('');
      loadCockpitData(true);
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      setApiError(err.message || 'Failed to create support ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Derived Account Counts & Active Workspace Account
  const activeAccountsCount = accounts.filter((a) => a.status === 'active').length;
  const pendingAccountsCount = accounts.filter((a) => a.status === 'pending_approval').length;
  const activeWorkspaceAccount =
    accounts.find((a) => a.id === selectedWorkspaceAccountId) || accounts[0] || null;

  return (
    <div className="space-y-6">
      {/* Dynamic Feedback Banner */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {apiError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{apiError}</span>
          </div>
          <button onClick={() => setApiError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Greeting & Cockpit Status Strip */}
      <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Welcome, {user?.first_name || 'Trader'}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#141b29] text-slate-300 border border-[#232d40]">
              ID: {user?.id?.slice(0, 8) || 'Active'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Request-Mode Client Trader Room & Multi-Platform Terminal Cockpit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* KYC 5-State Status Badge */}
          {effectiveKycStatus === 'verified' && (
            <button
              onClick={() => onNavigate('kyc')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/20 transition"
              title="KYC identity verified"
            >
              <ShieldCheck className="w-4 h-4" /> Verified KYC
            </button>
          )}

          {effectiveKycStatus === 'under_review' && (
            <button
              onClick={() => onNavigate('kyc')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/20 transition"
              title="Documents submitted and awaiting compliance review"
            >
              <Clock className="w-4 h-4" /> KYC Under Review
            </button>
          )}

          {effectiveKycStatus === 'action_required' && (
            <button
              onClick={() => onNavigate('kyc')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/20 transition"
              title="KYC requires document submission"
            >
              <AlertCircle className="w-4 h-4" /> Action Required
            </button>
          )}

          {effectiveKycStatus === 'rejected' && (
            <button
              onClick={() => onNavigate('kyc')}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/20 transition"
              title={effectiveRejectionReason ? `KYC Rejected: ${effectiveRejectionReason}` : 'KYC documents rejected'}
            >
              <XCircle className="w-4 h-4" /> KYC Rejected
            </button>
          )}

          {effectiveKycStatus === 'not_started' && (
            <button
              onClick={() => onNavigate('kyc')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition"
              title="Identity verification uncompleted"
            >
              <AlertCircle className="w-4 h-4 text-amber-400" /> KYC Not Started
            </button>
          )}

          {/* Refresh Cockpit Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-300 hover:text-white border border-[#232d40] text-xs font-medium transition disabled:opacity-50"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5-State KYC Progression Banner */}
      {effectiveKycStatus === 'rejected' && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-rose-200 text-sm flex items-center gap-2">
                <span>KYC Identity Verification Rejected</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono uppercase font-bold">
                  Action Required
                </span>
              </h4>
              <p className="text-rose-300 mt-1 leading-relaxed">
                {effectiveRejectionReason ? (
                  <>
                    <strong className="text-white">Compliance Feedback:</strong> "{effectiveRejectionReason}"
                  </>
                ) : (
                  'Your submitted identification documents could not be approved by compliance. Please review your documents and resubmit.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('kyc')}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition flex-shrink-0 shadow"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Re-upload / Resubmit Documents</span>
          </button>
        </div>
      )}

      {effectiveKycStatus === 'action_required' && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-amber-200 text-sm">KYC Action Required</h4>
              <p className="text-amber-300 mt-1 leading-relaxed">
                Please complete your identity and proof of address document submissions to fulfill Tier 1 regulatory requirements.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('kyc')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition flex-shrink-0 shadow"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit Verification Documents</span>
          </button>
        </div>
      )}

      {effectiveKycStatus === 'not_started' && (
        <div className="bg-[#121824] border border-[#232d40] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Verify Identity for Higher Limits</h4>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Identity verification (KYC) has not been started. Verify your account to unlock higher deposit limits, live trading leverage, and fast withdrawals.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('kyc')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition flex-shrink-0 shadow"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Start KYC Verification</span>
          </button>
        </div>
      )}

      {effectiveKycStatus === 'under_review' && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-amber-200 text-sm">KYC Verification In Review</h4>
              <p className="text-amber-300 mt-1 leading-relaxed">
                Your submitted identity documents are currently under review by our compliance team. You will be notified once reviewed.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('kyc')}
            className="px-3.5 py-1.5 rounded-xl bg-[#182030] hover:bg-[#222c42] border border-[#2b3954] text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition flex-shrink-0"
          >
            <span>View KYC Status</span>
          </button>
        </div>
      )}

      {/* Financial Metric Strip (STRICT REAL PERSISTED VALUES ONLY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Wallet Balance */}
        <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Wallet Balance</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
            ${wallet?.balance || '0.00'}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Currency</span>
            <span className="font-semibold text-slate-200 font-mono">
              {wallet?.currency || user?.preferred_currency || brokerCurrency}
            </span>
          </div>
        </div>

        {/* Metric 2: Available for Withdrawal */}
        <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Available Funds</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
            ${wallet?.available_balance || (wallet ? (parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance)).toFixed(2) : '0.00')}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Free for Withdrawal</span>
            <span className="text-emerald-400 font-semibold font-mono">Unencumbered</span>
          </div>
        </div>

        {/* Metric 3: In-Flight / Reserved Balance */}
        <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reserved / In-Flight</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 tracking-tight">
            ${wallet?.reserved_balance || '0.00'}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Pending Payouts</span>
            <span className="text-slate-300 font-medium">
              {parseFloat(wallet?.reserved_balance || '0') > 0 ? 'Active Hold' : 'No Holds'}
            </span>
          </div>
        </div>

        {/* Metric 4: Total Registered Accounts */}
        <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Trading Accounts</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
            {accounts.length}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Status Breakdown</span>
            <span className="text-slate-300 font-mono">
              <span className="text-emerald-400">{activeAccountsCount} active</span>
              {pendingAccountsCount > 0 && <span className="text-amber-400 ml-1.5">• {pendingAccountsCount} pend</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Trading Equity & Engine Sync Integrity Strip */}
      <div className="bg-[#0a0d14] border border-[#1b2333] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex-shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Aggregated Trading Equity & Floating PnL:</span>
              <span className="font-mono font-bold text-slate-400 text-sm">—</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold font-mono">
                Not synced yet
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live MT4/MT5/cTrader bridge adapter not configured. CRM displays persistent registration metadata only.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('trade')}
          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold text-xs py-1 px-3 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 transition flex-shrink-0 self-start md:self-auto"
        >
          <Terminal className="w-3.5 h-3.5" /> WebTrader Platform Bridge
        </button>
      </div>

      {/* Quick Actions Bar (Connected to Verified Workflows) */}
      <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">
          Quick Workflows
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Quick Action: Deposit */}
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit</span>
          </button>

          {/* Quick Action: Withdraw */}
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold transition"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Withdraw</span>
          </button>

          {/* Quick Action: New Account */}
          <button
            onClick={() => setShowNewAccountModal(true)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>New Account</span>
          </button>

          {/* Quick Action: Complete KYC */}
          <button
            onClick={() => onNavigate('kyc')}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold transition"
          >
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Complete KYC</span>
          </button>

          {/* Quick Action: Support */}
          <button
            onClick={() => setShowSupportModal(true)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold transition"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Get Support</span>
          </button>
        </div>
      </div>

      {/* Account Cards Section (High Density, Metadata Only, No Simulated Streaming) */}
      <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1b2333] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" /> Registered Trading Accounts
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Persistent CRM account specifications & terminal credentials
            </p>
          </div>
          <button
            onClick={() => setShowNewAccountModal(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Account
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Loading registered accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl bg-[#080b12] border border-[#1b2333] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-white">No trading accounts registered yet</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Request a live or demo trading account for MT4, MT5, cTrader, or WebTrader to begin.
            </p>
            <button
              onClick={() => setShowNewAccountModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow transition"
            >
              <Plus className="w-3.5 h-3.5" /> Request Trading Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trading Account Deep-Dive Workspace */}
            {activeWorkspaceAccount && (
              <div className="rounded-2xl bg-[#080c14] border border-[#1b263b] p-5 space-y-4 shadow-xl">
                {/* Workspace Top Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1b2333] pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-blue-400 font-bold uppercase tracking-wider font-mono">
                        Trading Workspace
                      </span>
                      <span className="text-slate-600">•</span>
                      <h4 className="text-base font-bold text-white font-mono flex items-center gap-1.5">
                        #{activeWorkspaceAccount.account_number}
                        <button
                          onClick={() => copyText(activeWorkspaceAccount.account_number, `ws_acc_${activeWorkspaceAccount.id}`)}
                          className="text-slate-400 hover:text-white transition"
                          title="Copy account login ID"
                        >
                          {copiedKey === `ws_acc_${activeWorkspaceAccount.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {activeWorkspaceAccount.platform}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                        {activeWorkspaceAccount.account_type.replace('_', ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          activeWorkspaceAccount.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : activeWorkspaceAccount.status === 'pending_approval'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {activeWorkspaceAccount.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 flex-wrap">
                      <span>Server: <span className="font-mono text-white font-medium">{activeWorkspaceAccount.server_name}</span></span>
                      <span className="text-slate-600">•</span>
                      <span>Leverage: <span className="font-mono text-blue-400 font-semibold">{activeWorkspaceAccount.leverage}</span></span>
                      <span className="text-slate-600">•</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Manual Request Mode (V1)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        Bridge Not Configured
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setLeverageRequestAccount(activeWorkspaceAccount);
                        setReqLeverageValue(activeWorkspaceAccount.leverage || '1:200');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#141b29] hover:bg-[#1a2335] text-slate-300 hover:text-white border border-[#232d40] text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      <span>Adjust Leverage</span>
                    </button>
                    <button
                      onClick={() => setLaunchpadAccount(activeWorkspaceAccount)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        activeWorkspaceAccount.status === 'active'
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Trade / Open Terminal</span>
                    </button>
                  </div>
                </div>

                {/* Account Quick Selector if multiple accounts */}
                {accounts.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                    <span className="text-[11px] text-slate-400 font-semibold flex-shrink-0">Switch Workspace:</span>
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedWorkspaceAccountId(acc.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition flex-shrink-0 flex items-center gap-1.5 border ${
                          activeWorkspaceAccount.id === acc.id
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 font-bold'
                            : 'bg-[#0e1422] text-slate-400 hover:text-slate-200 border-[#1c2436]'
                        }`}
                      >
                        <span>#{acc.account_number}</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal">({acc.platform})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Persisted Financials Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#06090f] border border-[#161f30]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Persisted Balance</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-white mt-1">
                      {activeWorkspaceAccount.balance ? `${activeWorkspaceAccount.balance} ${activeWorkspaceAccount.currency}` : 'Sync Pending'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Real stored broker balance
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#06090f] border border-[#161f30]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Persisted Equity</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-white mt-1">
                      {activeWorkspaceAccount.equity ? `${activeWorkspaceAccount.equity} ${activeWorkspaceAccount.currency}` : 'Sync Pending'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Real synchronized equity
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#06090f] border border-[#161f30]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Configured Leverage</div>
                    <div className="text-base sm:text-lg font-bold font-mono text-blue-400 mt-1">
                      {activeWorkspaceAccount.leverage}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {activeWorkspaceAccount.currency} Denominated
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#06090f] border border-[#161f30]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Bridge Protocol</div>
                    <div className="text-sm font-bold font-mono text-amber-400 mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Manual Request Mode (V1)
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Bridge Not Configured
                    </div>
                  </div>
                </div>

                {/* Financial Isolation Notice */}
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-slate-400 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Financial Segregation Policy:</span> Trading margin, balance, and equity are strictly isolated from CRM wallet funds. Once an automated broker gateway bridge is established, live balance and equity will synchronize directly from liquidity bridge servers.
                  </div>
                </div>

                {/* Sub-Tabs: Positions | Orders | Specifications */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 border-b border-[#1b2333] pb-2">
                    <button
                      onClick={() => setWorkspaceSubTab('positions')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        workspaceSubTab === 'positions'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
                      }`}
                    >
                      Positions (0)
                    </button>
                    <button
                      onClick={() => setWorkspaceSubTab('orders')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        workspaceSubTab === 'orders'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
                      }`}
                    >
                      Orders (0)
                    </button>
                    <button
                      onClick={() => setWorkspaceSubTab('specifications')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        workspaceSubTab === 'specifications'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
                      }`}
                    >
                      Account Specifications
                    </button>
                  </div>

                  {workspaceSubTab === 'positions' && (
                    <div className="p-8 text-center rounded-xl bg-[#06090f] border border-[#141c2c] space-y-2">
                      <Activity className="w-7 h-7 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-300">
                        No open positions. Live position synchronization will activate upon broker platform bridge connection.
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Provider: {activeWorkspaceAccount.platform} • Bridge: Not Configured (Manual Mode V1)
                      </p>
                    </div>
                  )}

                  {workspaceSubTab === 'orders' && (
                    <div className="p-8 text-center rounded-xl bg-[#06090f] border border-[#141c2c] space-y-2">
                      <Clock className="w-7 h-7 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-300">
                        No pending orders.
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Order queue synchronization will activate upon broker platform bridge connection.
                      </p>
                    </div>
                  )}

                  {workspaceSubTab === 'specifications' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#06090f] border border-[#141c2c] text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Platform</span>
                        <span className="text-slate-200 font-semibold">{activeWorkspaceAccount.platform}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Server Host</span>
                        <span className="text-slate-200 font-semibold">{activeWorkspaceAccount.server_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Account Type</span>
                        <span className="text-slate-200 font-semibold capitalize">{activeWorkspaceAccount.account_type.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Base Currency</span>
                        <span className="text-slate-200 font-semibold">{activeWorkspaceAccount.currency}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Configured Leverage</span>
                        <span className="text-blue-400 font-semibold">{activeWorkspaceAccount.leverage}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Tier / Group</span>
                        <span className="text-slate-200">{activeWorkspaceAccount.group_tier || 'Default Tier'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Registration Date</span>
                        <span className="text-slate-300">{new Date(activeWorkspaceAccount.created_at).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Approval Date</span>
                        <span className="text-emerald-400">{activeWorkspaceAccount.approved_at ? new Date(activeWorkspaceAccount.approved_at).toLocaleDateString() : 'Awaiting Review'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Master Password</span>
                        <span className="text-slate-400 italic text-[11px]">Password retrieval not configured in V1</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Registered Accounts Grid */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>All Registered Accounts ({accounts.length})</span>
                <span className="text-[10px] font-mono text-slate-500 lowercase">Click card or workspace button to inspect</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {accounts.map((acc) => {
                  const isApproved = acc.status === 'active';
                  const isSelected = activeWorkspaceAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`bg-[#080b12] border ${
                        isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-[#1b2333] hover:border-[#2b354c]'
                      } rounded-xl p-4 transition flex flex-col justify-between space-y-3.5 shadow-sm`}
                    >
                      {/* Top: Platform + Account # + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white font-mono text-sm tracking-tight">
                              #{acc.account_number}
                            </span>
                            <button
                              onClick={() => copyText(acc.account_number, `acc_${acc.id}`)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy account number"
                            >
                              {copiedKey === `acc_${acc.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-blue-400">{acc.platform}</span>
                            <span>•</span>
                            <span className="capitalize">{acc.account_type.replace('_', ' ')}</span>
                            {acc.nickname && (
                              <>
                                <span>•</span>
                                <span className="text-slate-300 italic">{acc.nickname}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            acc.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : acc.status === 'pending_approval'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {acc.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Metadata Specs Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-lg bg-[#0c1018] border border-[#171f2e]">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Server</span>
                          <span className="font-medium text-slate-200 truncate block font-mono">
                            {acc.server_name || 'Standard Gateway'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Leverage</span>
                          <span className="font-bold text-blue-400 font-mono">{acc.leverage}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Currency</span>
                          <span className="font-bold text-slate-200 font-mono">{acc.currency}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Bridge Mode</span>
                          <span className="font-mono text-amber-400 text-[10px]">Manual V1</span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-1 flex items-center justify-between gap-1.5 border-t border-[#1b2333]/60">
                        <button
                          onClick={() => setSelectedWorkspaceAccountId(acc.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                            isSelected
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                              : 'bg-[#141b29] hover:bg-[#1a2335] text-slate-300 hover:text-white border border-[#232d40]'
                          }`}
                          title="Open in Workspace"
                        >
                          Workspace
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setLeverageRequestAccount(acc);
                              setReqLeverageValue(acc.leverage || '1:200');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#141b29] hover:bg-[#1a2335] text-slate-300 hover:text-white border border-[#232d40] text-[11px] font-medium transition"
                            title="Request Leverage Adjustment"
                          >
                            <TrendingUp className="w-3 h-3 text-blue-400 inline mr-1" />
                            Leverage
                          </button>

                          <button
                            onClick={() => setLaunchpadAccount(acc)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                              isApproved
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                            title={isApproved ? 'Open terminal launchpad' : 'Account awaiting approval'}
                          >
                            <Terminal className="w-3 h-3" />
                            <span>Trade Now</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Integrated Workflows Section (Tabbed Access Without Navigating Away) */}
      <div className="bg-[#0c1018] border border-[#1b2333] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1b2333] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveWorkflowTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeWorkflowTab === 'ledger'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
              }`}
            >
              Recent Wallet Ledger
            </button>
            <button
              onClick={() => setActiveWorkflowTab('kyc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeWorkflowTab === 'kyc'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
              }`}
            >
              KYC Verification Tracker
            </button>
            <button
              onClick={() => setActiveWorkflowTab('support')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeWorkflowTab === 'support'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b29]'
              }`}
            >
              Support Tickets
            </button>
          </div>

          <button
            onClick={() => {
              if (activeWorkflowTab === 'ledger') onNavigate('wallet');
              if (activeWorkflowTab === 'kyc') onNavigate('kyc');
              if (activeWorkflowTab === 'support') onNavigate('support');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open Full View</span> <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab 1: Recent Ledger */}
        {activeWorkflowTab === 'ledger' && (
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No ledger transactions recorded yet. Deposits and withdrawals will appear here once processed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-[#1b2333] text-[11px]">
                      <th className="pb-2 font-medium">Tx Ref</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Balance After</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b2333]/50">
                    {recentTransactions.slice(0, 5).map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#080b12] transition">
                        <td className="py-2.5 font-mono text-slate-300">{tx.transaction_no}</td>
                        <td className="py-2.5 capitalize text-slate-200">{tx.type.replace('_', ' ')}</td>
                        <td className="py-2.5 font-mono font-bold text-white">
                          ${tx.amount} {tx.currency}
                        </td>
                        <td className="py-2.5 font-mono text-slate-400">${tx.balance_after}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              tx.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400 text-right">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: KYC Tracker */}
        {activeWorkflowTab === 'kyc' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#080b12] border border-[#1b2333]">
                <span className="text-slate-500 block text-[11px] mb-1">Identity Status</span>
                <span
                  className={`font-semibold capitalize flex items-center gap-1.5 ${
                    effectiveKycStatus === 'verified'
                      ? 'text-emerald-400'
                      : effectiveKycStatus === 'under_review'
                      ? 'text-amber-400'
                      : effectiveKycStatus === 'rejected'
                      ? 'text-rose-400'
                      : effectiveKycStatus === 'action_required'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {effectiveKycStatus === 'verified' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : effectiveKycStatus === 'rejected' ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  {effectiveKycStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#080b12] border border-[#1b2333]">
                <span className="text-slate-500 block text-[11px] mb-1">Submitted Date</span>
                <span className="text-slate-300">
                  {kycProfile?.submitted_at
                    ? new Date(kycProfile.submitted_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#080b12] border border-[#1b2333]">
                <span className="text-slate-500 block text-[11px] mb-1">Verification Tier</span>
                <span className="text-blue-400 font-semibold font-mono">
                  {effectiveKycStatus === 'verified' ? 'Tier 1 Standard (Full)' : 'Tier 0 Limited'}
                </span>
              </div>
            </div>

            {effectiveKycStatus === 'rejected' && effectiveRejectionReason && (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300">
                <span className="font-bold text-rose-200 block mb-1">Compliance Rejection Reason:</span>
                <span>{effectiveRejectionReason}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 flex items-center justify-between gap-3 text-xs text-blue-300">
              <span>Need to upload passport, national ID, or utility bill?</span>
              <button
                onClick={() => onNavigate('kyc')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition flex-shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Open KYC Portal
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Support Tickets & Inline Conversation */}
        {activeWorkflowTab === 'support' && (
          <div className="space-y-3">
            {inlineActiveTicketId ? (
              <div className="space-y-3">
                {/* Back to tickets list bar */}
                <div className="flex items-center justify-between bg-[#080b12] border border-[#1b2333] p-3 rounded-xl">
                  <button
                    onClick={() => {
                      setInlineActiveTicketId(null);
                      setInlineTicketDetail(null);
                      setInlineReplyText('');
                    }}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to all tickets</span>
                  </button>

                  {inlineTicketDetail?.ticket && inlineTicketDetail.ticket.status !== 'closed' && (
                    <button
                      onClick={handleCloseInlineTicket}
                      disabled={updatingInlineStatus}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-50"
                    >
                      {updatingInlineStatus ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      <span>Close Ticket</span>
                    </button>
                  )}
                </div>

                {loadingInlineTicket || !inlineTicketDetail ? (
                  <div className="py-10 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading conversation thread...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Ticket Metadata Bar */}
                    <div className="p-3.5 rounded-xl bg-[#080b12] border border-[#1b2333] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-400">
                            #{inlineTicketDetail.ticket.ticket_number}
                          </span>
                          <span className="font-bold text-white">
                            {inlineTicketDetail.ticket.subject}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Category: <span className="text-slate-200 capitalize">{inlineTicketDetail.ticket.category}</span> • Priority: <span className="text-slate-200 capitalize">{inlineTicketDetail.ticket.priority}</span>
                        </div>
                      </div>

                      <div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            inlineTicketDetail.ticket.status === 'open' || inlineTicketDetail.ticket.status === 'in_progress'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : inlineTicketDetail.ticket.status === 'waiting_for_client'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : inlineTicketDetail.ticket.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {inlineTicketDetail.ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Messages Thread */}
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {inlineTicketDetail.messages.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs">
                          No messages in this inquiry.
                        </div>
                      ) : (
                        inlineTicketDetail.messages.map((m) => {
                          const isClient = m.sender_role === 'client';
                          return (
                            <div
                              key={m.id}
                              className={`p-3 rounded-xl border text-xs ${
                                isClient
                                  ? 'bg-[#0b1019] border-[#1b2333] ml-4'
                                  : 'bg-[#131b2c] border-blue-500/30 mr-4'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] mb-1.5 pb-1 border-b border-white/5">
                                <span className={`font-semibold ${isClient ? 'text-slate-300' : 'text-blue-400'}`}>
                                  {isClient ? 'You (Client)' : `${m.sender?.first_name || 'Support Staff'} (Desk)`}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(m.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {m.message}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Reply Composer (Only if ticket not closed) */}
                    {inlineTicketDetail.ticket.status !== 'closed' ? (
                      <form onSubmit={handleInlineReply} className="space-y-2 pt-2 border-t border-[#1b2333]">
                        <textarea
                          rows={2}
                          required
                          value={inlineReplyText}
                          onChange={(e) => setInlineReplyText(e.target.value)}
                          placeholder="Type your response to the support team..."
                          className="w-full bg-[#080b12] border border-[#1b2333] focus:border-blue-500 rounded-xl p-3 text-white text-xs placeholder-slate-500 focus:outline-none resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={submittingInlineReply || !inlineReplyText.trim()}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                          >
                            {submittingInlineReply ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Send Reply</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
                        This support ticket is marked as closed. Open a new ticket if you require further assistance.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {recentTickets.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No active support inquiries. You can open a new ticket whenever you need assistance.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentTickets.map((tk) => (
                      <div
                        key={tk.id}
                        onClick={() => loadInlineTicket(tk.id)}
                        className="p-3 rounded-xl bg-[#080b12] border border-[#1b2333] hover:border-[#2b354c] flex items-center justify-between cursor-pointer transition text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-300">#{tk.ticket_number}</span>
                            <span className="font-semibold text-white">{tk.subject}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Category: {tk.category} • Priority: {tk.priority}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tk.status === 'open' || tk.status === 'in_progress'
                                ? 'bg-blue-500/10 text-blue-400'
                                : tk.status === 'waiting_for_client'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tk.status.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            {new Date(tk.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-1 text-right">
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-400" /> Open New Ticket
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL: DEPOSIT WORKFLOW */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-blue-400" />
                <span>Deposit Funds to Wallet</span>
              </h3>
              <button onClick={() => setShowDepositModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Select Payment Gateway</label>
                <select
                  value={depMethodId}
                  onChange={(e) => setDepMethodId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.currency})
                    </option>
                  ))}
                  {paymentMethods.length === 0 && <option value="">Bank Wire Transfer (USD)</option>}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Deposit Amount ({wallet?.currency || brokerCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 500.00"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Client Notes / Transfer Reference <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Wire reference or wallet transaction hash..."
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">Processing Notice:</span>
                Deposits are recorded immediately in request status and verified against broker bank or custody receipt before balance credit.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDeposit}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submittingDeposit ? 'Submitting...' : 'Submit Deposit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WITHDRAWAL WORKFLOW */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Request Withdrawal</span>
              </h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-3.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Available for Withdrawal:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  ${wallet?.available_balance || '0.00'} {wallet?.currency || brokerCurrency}
                </span>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Payout Gateway</label>
                <select
                  value={wthMethodId}
                  onChange={(e) => setWthMethodId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.currency})
                    </option>
                  ))}
                  {paymentMethods.length === 0 && <option value="">Bank Wire Transfer</option>}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Withdrawal Amount</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 250.00"
                  value={wthAmount}
                  onChange={(e) => setWthAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Destination Account / Wallet Address</label>
                <input
                  type="text"
                  required
                  placeholder="IBAN, Account #, or Crypto Address"
                  value={wthDestination}
                  onChange={(e) => setWthDestination(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Payout Notes <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Bank name, swift code, or routing details..."
                  value={wthNotes}
                  onChange={(e) => setWthNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdrawal}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submittingWithdrawal ? 'Reserving...' : 'Submit Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW TRADING ACCOUNT WORKFLOW */}
      {showNewAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Request New Trading Account</span>
              </h3>
              <button onClick={() => setShowNewAccountModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleNewAccountSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Platform</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['MT4', 'MT5', 'cTrader', 'WebTrader'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPlatform(p)}
                      className={`py-2 rounded-lg font-bold border transition text-center ${
                        newPlatform === p
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Account Type</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="raw_spread">Raw Spread (ECN)</option>
                    <option value="pro">Pro VIP</option>
                    <option value="islamic">Islamic (Swap-Free)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Default Leverage</label>
                  <select
                    value={newLeverage}
                    onChange={(e) => setNewLeverage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="1:50">1:50</option>
                    <option value="1:100">1:100</option>
                    <option value="1:200">1:200</option>
                    <option value="1:400">1:400</option>
                    <option value="1:500">1:500</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Currency</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">
                    Nickname <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scalping MT5"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkDemo"
                  checked={newIsDemo}
                  onChange={(e) => setNewIsDemo(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <label htmlFor="chkDemo" className="text-slate-300 text-xs">
                  Create as Demo Trading Account
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewAccount}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submittingNewAccount ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ACCOUNT INSPECTOR (SPECIFICATIONS) */}
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

            <div className="space-y-2 text-xs">
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
                <span className="text-slate-400">Registration Date</span>
                <span className="text-slate-300">{new Date(inspectAccount.created_at).toLocaleDateString()}</span>
              </div>
              {inspectAccount.approved_at && (
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Approved Date</span>
                  <span className="text-emerald-400">{new Date(inspectAccount.approved_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                onClick={() => {
                  const target = inspectAccount;
                  setInspectAccount(null);
                  setLeverageRequestAccount(target);
                  setReqLeverageValue(target.leverage || '1:200');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#141b29] hover:bg-[#1a2335] text-slate-200 border border-[#232d40] text-xs font-semibold"
              >
                Request Leverage
              </button>
              <button
                onClick={() => {
                  const target = inspectAccount;
                  setInspectAccount(null);
                  setLaunchpadAccount(target);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Open Launchpad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST LEVERAGE CHANGE */}
      {leverageRequestAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span>Request Leverage Change (#{leverageRequestAccount.account_number})</span>
              </h3>
              <button onClick={() => setLeverageRequestAccount(null)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleLeverageSubmit} className="space-y-3.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Current Leverage:</span>
                <span className="font-bold text-slate-200 font-mono">{leverageRequestAccount.leverage}</span>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Requested Leverage</label>
                <select
                  value={reqLeverageValue}
                  onChange={(e) => setReqLeverageValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="1:50">1:50</option>
                  <option value="1:100">1:100</option>
                  <option value="1:200">1:200</option>
                  <option value="1:400">1:400</option>
                  <option value="1:500">1:500</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Reason for Adjustment <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why you are requesting leverage adjustment..."
                  value={reqLeverageReason}
                  onChange={(e) => setReqLeverageReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLeverageRequestAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeverage}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submittingLeverage ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: "TRADE NOW" LAUNCHPAD (STRICT INTEGRATION-READY LAUNCHPAD ONLY - NO LIVE CREDENTIALS/SIMULATION) */}
      {launchpadAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Trading Terminal Launchpad</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Manual Mode (V1)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {launchpadAccount.platform} Account #{launchpadAccount.account_number} • <span className="text-slate-500">Bridge Not Configured</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setLaunchpadAccount(null)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Trading-Ready Architecture (Zero Order Simulation)</span>
                In V1 CRM Request-Mode, real trading execution is conducted directly via broker desktop/mobile terminals or authorized WebTrader gateways. No artificial, simulated, or mock orders are executed.
              </div>
            </div>

            {/* Connection Specifications */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Connection Metadata</span>
                <span className="text-[10px] font-mono text-amber-400">Read-Only Credentials</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Server Host</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 font-semibold">{launchpadAccount.server_name}</span>
                    <button
                      onClick={() => copyText(launchpadAccount.server_name, 'lp_server')}
                      className="text-slate-500 hover:text-slate-300"
                      title="Copy server name"
                    >
                      {copiedKey === 'lp_server' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Login / Account ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 font-semibold">#{launchpadAccount.account_number}</span>
                    <button
                      onClick={() => copyText(launchpadAccount.account_number, 'lp_login')}
                      className="text-slate-500 hover:text-slate-300"
                      title="Copy login ID"
                    >
                      {copiedKey === 'lp_login' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Account Platform</span>
                  <span className="text-slate-200 font-semibold">{launchpadAccount.platform}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Configured Leverage</span>
                  <span className="text-blue-400 font-semibold">{launchpadAccount.leverage}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-900">
                  <span className="text-slate-500 block text-[10px]">Master Trading Password</span>
                  <span className="text-slate-400 italic text-[11px]">Password retrieval not configured in V1</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-900">
                  <span className="text-slate-500 block text-[10px]">Investor Password (Read-Only)</span>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 italic">Password retrieval not configured in V1</span>
                    <span className="text-[10px] text-slate-600 font-mono">(Copy Disabled)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Desktop / Mobile Terminal Access:</span>
              To trade on desktop or mobile, open the {launchpadAccount.platform} application, search for server{' '}
              <span className="text-white font-mono font-semibold">{launchpadAccount.server_name}</span>, and authenticate with your account credentials.
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => {
                  setLaunchpadAccount(null);
                  onNavigate('trade');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                <span>View WebTrader Gateway</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setLaunchpadAccount(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close Launchpad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPORT TICKET WORKFLOW */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-400" />
                <span>Open Support Ticket</span>
              </h3>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSupportTicketSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question regarding deposit verification"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="general">General Support</option>
                    <option value="financial">Deposits & Withdrawals</option>
                    <option value="trading_account">Trading Account</option>
                    <option value="kyc">KYC & Compliance</option>
                    <option value="technical">Technical Issue</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Priority</label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide complete details about your request..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 transition"
                >
                  {submittingTicket ? 'Submitting...' : 'Send Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
