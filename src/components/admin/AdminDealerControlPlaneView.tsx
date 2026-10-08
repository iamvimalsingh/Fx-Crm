import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  Shield,
  AlertTriangle,
  RefreshCw,
  Sliders,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Lock,
  Unlock,
  AlertOctagon,
  FileText,
  BarChart2,
  Server,
  Zap,
  Filter,
  Check,
  X,
  Radio,
  Globe,
  Flame,
} from 'lucide-react';

interface PositionItem {
  id: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  marginLocked: number;
  openedAt: number;
  status: 'OPEN' | 'CLOSED';
}

interface OrderItem {
  id: string;
  accountId: string;
  symbol: string;
  type: string;
  side: 'BUY' | 'SELL';
  volume: number;
  price: number;
  status: 'PENDING' | 'WORKING' | 'FILLED' | 'CANCELLED';
  createdAt: number;
}

interface ExecutionItem {
  id: string;
  orderId?: string;
  positionId?: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  price: number;
  realizedPnL?: number;
  executedAt: number;
  liquidityRole?: string;
}

interface InstrumentItem {
  symbol: string;
  name: string;
  category: 'FOREX' | 'CRYPTO' | 'COMMODITIES';
  tradingStatus: 'TRADING' | 'HALTED' | 'CLOSE_ONLY';
  provider: string;
  hasLiveQuote: boolean;
  marketStatus: string;
  digits: number;
  tickSize: number;
  contractSize: number;
}

interface AccountRuntimeData {
  runtime?: {
    id: string;
    accountNumber: string;
    balance: number;
    equity: number;
    usedMargin: number;
    freeMargin: number;
    marginLevel: number;
    status: 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY';
    tradingEnabled: boolean;
    sessionMode: string;
    platform: string;
    currency: string;
    leverage: number;
  };
  risk?: {
    accountId: string;
    balance: number;
    equity: number;
    usedMargin: number;
    freeMargin: number;
    marginLevel: number;
    marginCallLevel: number;
    stopOutLevel: number;
    isMarginCall: boolean;
    isStopOut: boolean;
  };
}

export function AdminDealerControlPlaneView() {
  const { token, user } = useAuth();

  // Active Control Sub-Tab
  const [activeTab, setActiveTab] = useState<'cockpit' | 'positions' | 'orders' | 'blotter' | 'instruments'>('cockpit');

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live Data States
  const [overview, setOverview] = useState<any>(null);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [instruments, setInstruments] = useState<InstrumentItem[]>([]);

  // Search & Filter state
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('acc_uuid_57775_live');
  const [accountRuntime, setAccountRuntime] = useState<AccountRuntimeData | null>(null);
  const [loadingRuntime, setLoadingRuntime] = useState(false);

  // Modals
  const [closePositionModal, setClosePositionModal] = useState<PositionItem | null>(null);
  const [closeReason, setCloseReason] = useState('Dealer administrative close');
  const [submittingClose, setSubmittingClose] = useState(false);

  const [closeAllModal, setCloseAllModal] = useState<string | null>(null);
  const [closeAllReason, setCloseAllReason] = useState('Emergency liquidation by Dealer');
  const [submittingCloseAll, setSubmittingCloseAll] = useState(false);

  const [cancelOrderModal, setCancelOrderModal] = useState<OrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState('Dealer cancelled order');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [cancelAllOrdersModal, setCancelAllOrdersModal] = useState<string | null>(null);
  const [cancelAllReason, setCancelAllReason] = useState('Emergency cancellation by Dealer');
  const [submittingCancelAll, setSubmittingCancelAll] = useState(false);

  const [instrumentModal, setInstrumentModal] = useState<{ symbol: string; targetStatus: 'TRADING' | 'HALTED' | 'CLOSE_ONLY' } | null>(null);
  const [instrumentReason, setInstrumentReason] = useState('Surveillance circuit breaker');
  const [submittingInstrument, setSubmittingInstrument] = useState(false);

  const [statusModal, setStatusModal] = useState<{
    accountId: string;
    currentStatus: string;
    currentTrading: boolean;
  } | null>(null);
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'READ_ONLY'>('ACTIVE');
  const [targetTradingEnabled, setTargetTradingEnabled] = useState(true);
  const [statusReason, setStatusReason] = useState('Operational rights change by Dealer');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Fetch all dealer control data
  const fetchData = async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [ovRes, posRes, ordRes, execRes, instRes] = await Promise.all([
        fetch('/api/admin/trading-control/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/trading-control/positions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/trading-control/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/trading-control/executions?limit=50', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/trading-control/instruments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [ovJson, posJson, ordJson, execJson, instJson] = await Promise.all([
        ovRes.json().catch(() => ({})),
        posRes.json().catch(() => ({})),
        ordRes.json().catch(() => ({})),
        execRes.json().catch(() => ({})),
        instRes.json().catch(() => ({})),
      ]);

      if (ovJson.status === 'success') setOverview(ovJson.data);
      if (posJson.status === 'success') setPositions(Array.isArray(posJson.data) ? posJson.data : []);
      if (ordJson.status === 'success') setOrders(Array.isArray(ordJson.data) ? ordJson.data : []);
      if (execJson.status === 'success') {
        const blotterList = execJson.data?.executions || (Array.isArray(execJson.data) ? execJson.data : []);
        setExecutions(blotterList);
      }
      if (instJson.status === 'success') setInstruments(Array.isArray(instJson.data) ? instJson.data : []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to communicate with Trading Platform Control Plane');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch specific account runtime
  const fetchAccountRuntime = async (accId: string) => {
    if (!token || !accId) return;
    setLoadingRuntime(true);
    try {
      const res = await fetch(`/api/admin/trading-control/accounts/${accId}/runtime`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setAccountRuntime(json.data);
      } else {
        setAccountRuntime(null);
      }
    } catch {
      setAccountRuntime(null);
    } finally {
      setLoadingRuntime(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountRuntime(selectedAccountId);
    }
  }, [selectedAccountId, token]);

  // Handle Position Emergency Close
  const handleClosePosition = async () => {
    if (!closePositionModal || !token) return;
    setSubmittingClose(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/positions/${closePositionModal.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: closeReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to close position');
      setSuccessMessage(`Position ${closePositionModal.id} successfully closed by Dealer.`);
      setClosePositionModal(null);
      await fetchData(true);
      if (selectedAccountId) await fetchAccountRuntime(selectedAccountId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to close position on Trading Engine');
    } finally {
      setSubmittingClose(false);
    }
  };

  // Handle Close All Positions
  const handleCloseAllPositions = async () => {
    if (!closeAllModal || !token) return;
    setSubmittingCloseAll(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/accounts/${closeAllModal}/close-all-positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: closeAllReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to close all positions');
      setSuccessMessage(`All positions for account ${closeAllModal} successfully closed.`);
      setCloseAllModal(null);
      await fetchData(true);
      if (selectedAccountId) await fetchAccountRuntime(selectedAccountId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to close positions on Trading Engine');
    } finally {
      setSubmittingCloseAll(false);
    }
  };

  // Handle Cancel Order
  const handleCancelOrder = async () => {
    if (!cancelOrderModal || !token) return;
    setSubmittingCancel(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/orders/${cancelOrderModal.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to cancel order');
      setSuccessMessage(`Order ${cancelOrderModal.id} successfully cancelled.`);
      setCancelOrderModal(null);
      await fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel order on Trading Engine');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Handle Cancel All Orders
  const handleCancelAllOrders = async () => {
    if (!cancelAllOrdersModal || !token) return;
    setSubmittingCancelAll(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/accounts/${cancelAllOrdersModal}/cancel-all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelAllReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to cancel all orders');
      setSuccessMessage(`All orders for account ${cancelAllOrdersModal} cancelled.`);
      setCancelAllOrdersModal(null);
      await fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel orders on Trading Engine');
    } finally {
      setSubmittingCancelAll(false);
    }
  };

  // Handle Instrument Status Change
  const handleSetInstrumentStatus = async () => {
    if (!instrumentModal || !token) return;
    setSubmittingInstrument(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/instruments/${instrumentModal.symbol}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: instrumentModal.targetStatus, reason: instrumentReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update instrument status');
      setSuccessMessage(`Instrument ${instrumentModal.symbol} status updated to ${instrumentModal.targetStatus}.`);
      setInstrumentModal(null);
      await fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update instrument status on Trading Engine');
    } finally {
      setSubmittingInstrument(false);
    }
  };

  // Handle Account Operational Status Change
  const handleUpdateOperationalStatus = async () => {
    if (!statusModal || !token) return;
    setSubmittingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/trading-control/accounts/${statusModal.accountId}/operational-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status: targetStatus,
          tradingEnabled: targetTradingEnabled,
          reason: statusReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update operational status');
      setSuccessMessage(`Account ${statusModal.accountId} operational rights updated.`);
      setStatusModal(null);
      await fetchData(true);
      if (selectedAccountId) await fetchAccountRuntime(selectedAccountId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update account status on Trading Engine');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Filtered positions
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const matchSymbol = symbolFilter === 'ALL' || p.symbol === symbolFilter;
      const matchSearch =
        !searchQuery ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.accountId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSymbol && matchSearch;
    });
  }, [positions, symbolFilter, searchQuery]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSymbol = symbolFilter === 'ALL' || o.symbol === symbolFilter;
      const matchSearch =
        !searchQuery ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.accountId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSymbol && matchSearch;
    });
  }, [orders, symbolFilter, searchQuery]);

  if (loading) {
    return (
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Connecting to Authoritative Trading Engine Control Plane...</p>
      </div>
    );
  }

  const engineHealth = overview?.engineHealth?.status || 'CONNECTED';
  const openPositionsCount = overview?.metrics?.openPositionsCount ?? positions.filter((p) => p.status === 'OPEN').length;
  const workingOrdersCount = overview?.metrics?.workingOrdersCount ?? orders.filter((o) => o.status === 'PENDING' || o.status === 'WORKING').length;
  const totalVolumeLots = overview?.metrics?.totalVolumeLots ?? positions.reduce((acc, p) => acc + (p.volume || 0), 0);
  const totalUnrealizedPnL = overview?.metrics?.totalUnrealizedPnL ?? positions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
  const haltedInstrumentsCount = overview?.metrics?.haltedInstrumentsCount ?? instruments.filter((i) => i.tradingStatus !== 'TRADING').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Plane Status Bar */}
      <div className="bg-[#0b0e14] border border-[#1b222d] p-4 sm:p-5 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Manager & Dealer Control Plane
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine Authoritative
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
              M2M HMAC Secure
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time exposure surveillance, dealer position interventions, order book cancellations, and market circuit breakers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141a24] border border-[#232c3b] text-xs">
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Trading Runtime:</span>
            <span className="font-semibold text-emerald-400">{engineHealth}</span>
          </div>
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1b222d] border border-[#232c3b] text-slate-200 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Engine'}</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Tiles (Live Authoritative Engine Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#0b0e14] border border-[#1b222d] p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Open Positions</span>
            <Layers className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-2">{openPositionsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total lots: {totalVolumeLots.toFixed(2)}</div>
        </div>

        <div className="bg-[#0b0e14] border border-[#1b222d] p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Unrealized P/L</span>
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${totalUnrealizedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Live floating market state</div>
        </div>

        <div className="bg-[#0b0e14] border border-[#1b222d] p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Working Orders</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-2">{workingOrdersCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pending Limit/Stop orders</div>
        </div>

        <div className="bg-[#0b0e14] border border-[#1b222d] p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Surveillance Breakers</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              haltedInstrumentsCount > 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {haltedInstrumentsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {haltedInstrumentsCount > 0 ? 'Halted / Close-only symbols' : 'All symbols trading normally'}
          </div>
        </div>

        <div className="bg-[#0b0e14] border border-[#1b222d] p-3.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Market Instruments</span>
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-2">{instruments.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Forex, Crypto, Commodities</div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1b222d] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('cockpit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            activeTab === 'cockpit'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Dealing Desk & Risk Cockpit
        </button>

        <button
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            activeTab === 'positions'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Positions Blotter ({positions.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            activeTab === 'orders'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Working Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('blotter')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            activeTab === 'blotter'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Execution Journal ({executions.length})
        </button>

        <button
          onClick={() => setActiveTab('instruments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            activeTab === 'instruments'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-[#141a24]'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Market Surveillance ({instruments.length})
        </button>
      </div>

      {/* TAB 1: DEALING DESK & RISK COCKPIT */}
      {activeTab === 'cockpit' && (
        <div className="space-y-6">
          {/* Account Inspector Card */}
          <div className="bg-[#0b0e14] border border-[#1b222d] p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Account Risk & Authoritative Runtime Inspector
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect real-time equity, free margin, margin calls, and enforce dealer operational restrictions.
                </p>
              </div>

              {/* Account Quick Switcher */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter Account ID / Number..."
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs font-mono focus:outline-none focus:border-purple-500 w-56"
                />
                <button
                  onClick={() => fetchAccountRuntime(selectedAccountId)}
                  disabled={loadingRuntime}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {loadingRuntime ? 'Querying...' : 'Query Engine'}
                </button>
              </div>
            </div>

            {/* Authoritative Risk Metrics Grid */}
            {accountRuntime?.runtime ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Balance</div>
                    <div className="text-lg font-bold text-white font-mono mt-1">
                      ${Number(accountRuntime.runtime.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Authoritative Equity</div>
                    <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                      ${Number(accountRuntime.runtime.equity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Used Margin</div>
                    <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                      ${Number(accountRuntime.runtime.usedMargin).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Free Margin</div>
                    <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
                      ${Number(accountRuntime.runtime.freeMargin).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Margin Level</div>
                    <div
                      className={`text-lg font-bold font-mono mt-1 ${
                        Number(accountRuntime.runtime.marginLevel) > 200
                          ? 'text-emerald-400'
                          : Number(accountRuntime.runtime.marginLevel) >= 100
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {Number(accountRuntime.runtime.marginLevel) > 0
                        ? `${Number(accountRuntime.runtime.marginLevel).toFixed(1)}%`
                        : '∞ (0 Margin)'}
                    </div>
                  </div>

                  <div className="bg-[#141a24] border border-[#232c3b] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">Operational Status</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          accountRuntime.runtime.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {accountRuntime.runtime.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dealer Control Actions Bar for this Account */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1b222d]">
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>Account: #{accountRuntime.runtime.accountNumber}</span>
                    <span>Platform: {accountRuntime.runtime.platform}</span>
                    <span>Leverage: 1:{accountRuntime.runtime.leverage}</span>
                    <span>
                      Trading Allowed:{' '}
                      <strong className={accountRuntime.runtime.tradingEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                        {accountRuntime.runtime.tradingEnabled ? 'YES' : 'NO'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setStatusModal({
                          accountId: accountRuntime.runtime!.id,
                          currentStatus: accountRuntime.runtime!.status,
                          currentTrading: accountRuntime.runtime!.tradingEnabled,
                        });
                        setTargetStatus(accountRuntime.runtime!.status);
                        setTargetTradingEnabled(accountRuntime.runtime!.tradingEnabled);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Operational Rights & Status
                    </button>

                    <button
                      onClick={() => setCancelAllOrdersModal(accountRuntime.runtime!.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel All Orders
                    </button>

                    <button
                      onClick={() => setCloseAllModal(accountRuntime.runtime!.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      Emergency Liquidate All
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-[#1b222d] rounded-lg">
                Enter an active Trading Account identifier to query live runtime equity and risk parameters.
              </div>
            )}
          </div>

          {/* Open Exposure Table for Quick Dealer Monitoring */}
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1b222d] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Active Market Exposure (Top 5 Positions)
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('positions')}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
              >
                View All Positions ({positions.length}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#141a24] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1b222d]">
                    <th className="py-2.5 px-4">Position ID</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-4">Symbol</th>
                    <th className="py-2.5 px-4">Side</th>
                    <th className="py-2.5 px-4">Lots</th>
                    <th className="py-2.5 px-4">Open Price</th>
                    <th className="py-2.5 px-4">Mark Price</th>
                    <th className="py-2.5 px-4">Floating PnL</th>
                    <th className="py-2.5 px-4 text-right">Dealer Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b222d]">
                  {positions.slice(0, 5).map((pos) => (
                    <tr key={pos.id} className="hover:bg-[#141a24]/50 transition">
                      <td className="py-2.5 px-4 font-mono text-purple-300 text-[11px]">{pos.id}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">{pos.accountId}</td>
                      <td className="py-2.5 px-4 font-bold text-white">{pos.symbol}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pos.side === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-200">{Number(pos.volume).toFixed(2)}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">{Number(pos.openPrice).toFixed(4)}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">{Number(pos.currentPrice).toFixed(4)}</td>
                      <td className="py-2.5 px-4 font-mono font-bold">
                        <span className={Number(pos.unrealizedPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ${Number(pos.unrealizedPnL).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => setClosePositionModal(pos)}
                          className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                  {positions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500 text-xs">
                        No active open positions in the Trading Engine runtime.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL POSITIONS BLOTTER */}
      {activeTab === 'positions' && (
        <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Live Positions Blotter (Authoritative Trading Engine)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative position records with mark-to-market prices and dealer emergency closure capabilities.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by Symbol or Account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <select
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Symbols</option>
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1b222d]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#141a24] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1b222d]">
                  <th className="py-2.5 px-4">Position ID</th>
                  <th className="py-2.5 px-4">Account ID</th>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Side</th>
                  <th className="py-2.5 px-4">Volume (Lots)</th>
                  <th className="py-2.5 px-4">Open Price</th>
                  <th className="py-2.5 px-4">Current Price</th>
                  <th className="py-2.5 px-4">Margin Locked</th>
                  <th className="py-2.5 px-4">Floating P/L</th>
                  <th className="py-2.5 px-4">Opened At</th>
                  <th className="py-2.5 px-4 text-right">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222d]">
                {filteredPositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-[#141a24]/50 transition">
                    <td className="py-2.5 px-4 font-mono text-purple-300 text-[11px]">{pos.id}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{pos.accountId}</td>
                    <td className="py-2.5 px-4 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-200">{Number(pos.volume).toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{Number(pos.openPrice).toFixed(4)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{Number(pos.currentPrice).toFixed(4)}</td>
                    <td className="py-2.5 px-4 font-mono text-amber-400">${Number(pos.marginLocked).toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold">
                      <span className={Number(pos.unrealizedPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        ${Number(pos.unrealizedPnL).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(pos.openedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setClosePositionModal(pos)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition"
                      >
                        Close Position
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 text-xs">
                      No open positions match the query criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WORKING ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Working Order Book
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pending Limit and Stop orders stored authoritatively in the Trading Engine.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1b222d]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#141a24] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1b222d]">
                  <th className="py-2.5 px-4">Order ID</th>
                  <th className="py-2.5 px-4">Account ID</th>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Side</th>
                  <th className="py-2.5 px-4">Lots</th>
                  <th className="py-2.5 px-4">Target Price</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created At</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222d]">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#141a24]/50 transition">
                    <td className="py-2.5 px-4 font-mono text-amber-300 text-[11px]">{ord.id}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{ord.accountId}</td>
                    <td className="py-2.5 px-4 font-bold text-white">{ord.symbol}</td>
                    <td className="py-2.5 px-4 font-mono text-purple-300">{ord.type}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {ord.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-200">{Number(ord.volume).toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{Number(ord.price).toFixed(4)}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(ord.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setCancelOrderModal(ord)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                      No active working orders in the order book.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EXECUTIONS BLOTTER */}
      {activeTab === 'blotter' && (
        <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Authoritative Trade Executions Journal
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable trade fills, fills timestamps, execution role, and realized profit/loss.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1b222d]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#141a24] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1b222d]">
                  <th className="py-2.5 px-4">Execution ID</th>
                  <th className="py-2.5 px-4">Account ID</th>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Side</th>
                  <th className="py-2.5 px-4">Lots</th>
                  <th className="py-2.5 px-4">Price</th>
                  <th className="py-2.5 px-4">Realized PnL</th>
                  <th className="py-2.5 px-4">Role / Reason</th>
                  <th className="py-2.5 px-4">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222d]">
                {executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-[#141a24]/50 transition">
                    <td className="py-2.5 px-4 font-mono text-cyan-300 text-[11px]">{exec.id}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{exec.accountId}</td>
                    <td className="py-2.5 px-4 font-bold text-white">{exec.symbol}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          exec.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {exec.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-200">{Number(exec.volume).toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{Number(exec.price).toFixed(4)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold">
                      {exec.realizedPnL !== undefined ? (
                        <span className={Number(exec.realizedPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ${Number(exec.realizedPnL).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">{exec.liquidityRole || 'MARKET'}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(exec.executedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {executions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                      No executions recorded in this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MARKET SURVEILLANCE & INSTRUMENT CIRCUIT BREAKER */}
      {activeTab === 'instruments' && (
        <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Market Surveillance & Instrument Circuit Breakers
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Emergency volatility halts, Close-Only risk reduction, and live market quote surveillance.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1b222d]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#141a24] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1b222d]">
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Asset Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Data Provider</th>
                  <th className="py-2.5 px-4">Contract / Tick</th>
                  <th className="py-2.5 px-4">Current Trading Status</th>
                  <th className="py-2.5 px-4 text-right">Circuit Breaker Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222d]">
                {instruments.map((inst) => (
                  <tr key={inst.symbol} className="hover:bg-[#141a24]/50 transition">
                    <td className="py-2.5 px-4 font-bold text-white font-mono text-sm">{inst.symbol}</td>
                    <td className="py-2.5 px-4 text-slate-300">{inst.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {inst.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{inst.provider}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {inst.contractSize} / {inst.tickSize}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          inst.tradingStatus === 'TRADING'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inst.tradingStatus === 'CLOSE_ONLY'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {inst.tradingStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inst.tradingStatus !== 'TRADING' && (
                          <button
                            onClick={() =>
                              setInstrumentModal({ symbol: inst.symbol, targetStatus: 'TRADING' })
                            }
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition"
                          >
                            Resume
                          </button>
                        )}
                        {inst.tradingStatus !== 'CLOSE_ONLY' && (
                          <button
                            onClick={() =>
                              setInstrumentModal({ symbol: inst.symbol, targetStatus: 'CLOSE_ONLY' })
                            }
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition"
                          >
                            Close-Only
                          </button>
                        )}
                        {inst.tradingStatus !== 'HALTED' && (
                          <button
                            onClick={() =>
                              setInstrumentModal({ symbol: inst.symbol, targetStatus: 'HALTED' })
                            }
                            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition"
                          >
                            Halt Symbol
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE POSITION */}
      {closePositionModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#232c3b] max-w-md w-full rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Confirm Emergency Position Close
              </h3>
              <button
                onClick={() => setClosePositionModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#141a24] rounded-lg border border-[#232c3b] text-xs space-y-1.5 font-mono">
              <div>Position ID: <strong className="text-purple-300">{closePositionModal.id}</strong></div>
              <div>Account ID: <strong className="text-white">{closePositionModal.accountId}</strong></div>
              <div>Symbol: <strong className="text-white">{closePositionModal.symbol}</strong> ({closePositionModal.side})</div>
              <div>Lots: <strong className="text-white">{Number(closePositionModal.volume).toFixed(2)}</strong></div>
              <div>Floating PnL: <strong className={Number(closePositionModal.unrealizedPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${Number(closePositionModal.unrealizedPnL).toFixed(2)}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Administrative Audit Reason (Mandatory)
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="State regulatory or risk intervention rationale..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setClosePositionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClosePosition}
                disabled={submittingClose}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {submittingClose ? 'Closing...' : 'Close Position Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE ALL POSITIONS */}
      {closeAllModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#232c3b] max-w-md w-full rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Emergency Close All Positions
              </h3>
              <button onClick={() => setCloseAllModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-rose-300 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              Warning: This will immediately liquidate all open market positions for account #{closeAllModal} at current mark prices.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Intervention Reason
              </label>
              <textarea
                value={closeAllReason}
                onChange={(e) => setCloseAllReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCloseAllModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseAllPositions}
                disabled={submittingCloseAll}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {submittingCloseAll ? 'Closing All...' : 'Confirm Liquidation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL ORDER */}
      {cancelOrderModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#232c3b] max-w-md w-full rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <XCircle className="w-4 h-4 text-amber-400" />
                Cancel Working Order
              </h3>
              <button onClick={() => setCancelOrderModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#141a24] rounded-lg border border-[#232c3b] text-xs font-mono space-y-1">
              <div>Order ID: <strong className="text-amber-300">{cancelOrderModal.id}</strong></div>
              <div>Account: <strong className="text-white">{cancelOrderModal.accountId}</strong></div>
              <div>Symbol: <strong className="text-white">{cancelOrderModal.symbol}</strong> ({cancelOrderModal.side} {cancelOrderModal.volume} lots)</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cancellation Reason
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelOrderModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white text-xs font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={submittingCancel}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {submittingCancel ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSTRUMENT CIRCUIT BREAKER */}
      {instrumentModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#232c3b] max-w-md w-full rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-purple-400" />
                Change Instrument Status: {instrumentModal.symbol}
              </h3>
              <button onClick={() => setInstrumentModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Setting <strong className="text-white">{instrumentModal.symbol}</strong> status to{' '}
              <strong className="text-purple-300">{instrumentModal.targetStatus}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Surveillance / Administrative Justification
              </label>
              <textarea
                value={instrumentReason}
                onChange={(e) => setInstrumentReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setInstrumentModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSetInstrumentStatus}
                disabled={submittingInstrument}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {submittingInstrument ? 'Updating...' : `Set to ${instrumentModal.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ACCOUNT OPERATIONAL RIGHTS */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#232c3b] max-w-md w-full rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                Account Operational Rights: {statusModal.accountId}
              </h3>
              <button onClick={() => setStatusModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Operational Status</label>
                <select
                  value={targetStatus}
                  onChange={(e: any) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="ACTIVE">ACTIVE (Full execution allowed)</option>
                  <option value="READ_ONLY">READ_ONLY (Close only / view only)</option>
                  <option value="SUSPENDED">SUSPENDED (All trading locked)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Trading Enabled Boolean</label>
                <div className="flex items-center gap-4 text-xs text-white">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tradingEnabled"
                      checked={targetTradingEnabled === true}
                      onChange={() => setTargetTradingEnabled(true)}
                    />
                    <span>Enabled (true)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tradingEnabled"
                      checked={targetTradingEnabled === false}
                      onChange={() => setTargetTradingEnabled(false)}
                    />
                    <span>Disabled (false)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason</label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#141a24] border border-[#232c3b] text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setStatusModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[#141a24] text-slate-300 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateOperationalStatus}
                disabled={submittingStatus}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {submittingStatus ? 'Saving...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
