import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  Maximize2,
  Minimize2,
  ExternalLink,
  RefreshCw,
  Wallet,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  Layers,
  ArrowUpRight,
  Plus,
  Server,
  Zap,
} from 'lucide-react';

interface TradingAccount {
  id: string;
  account_number: string;
  user_id: string;
  platform: string;
  account_type: string;
  server_name: string;
  currency: string;
  leverage: string;
  status: 'pending_approval' | 'active' | 'read_only' | 'disabled' | 'archived';
  nickname?: string | null;
  is_demo: boolean;
  balance?: string | null;
  equity?: string | null;
  terminal_url?: string | null;
}

interface SsoResponseData {
  token: string;
  account: TradingAccount | null;
  terminal_url: string;
}

interface ClientWebTraderViewProps {
  onNavigate: (tab: string, contextId?: string) => void;
  initialAccountId?: string;
}

export function ClientWebTraderView({ onNavigate, initialAccountId }: ClientWebTraderViewProps) {
  const { user, token: authToken } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || '');
  const [ssoData, setSsoData] = useState<SsoResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState<boolean>(false);

  // 1. Fetch user accounts
  useEffect(() => {
    if (!authToken) return;

    fetch('/api/trading-accounts', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          const list: TradingAccount[] = resData.data;
          setAccounts(list);

          // Select account: prefer initialAccountId, or first active account, or first account
          if (!selectedAccountId && list.length > 0) {
            const matched = initialAccountId ? list.find((a) => a.id === initialAccountId) : null;
            const activeAcc = list.find((a) => a.status === 'active');
            setSelectedAccountId((matched || activeAcc || list[0]).id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load trading accounts:', err);
      });
  }, [authToken, initialAccountId, selectedAccountId]);

  // 2. Request SSO token when account changes or mounts
  const fetchSsoToken = useCallback(
    async (accId?: string) => {
      if (!authToken) return;
      setLoading(true);
      setError(null);
      setIframeLoading(true);

      try {
        const targetId = accId || selectedAccountId;
        const endpoint = targetId ? `/api/trading-accounts/${targetId}/sso-token` : '/api/trading-accounts/sso-token';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setSsoData(json.data);
          if (json.data.account?.id && !selectedAccountId) {
            setSelectedAccountId(json.data.account.id);
          }
        } else {
          setError(json.message || 'Failed to authenticate trading terminal session.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error requesting Single Sign-On credentials.');
      } finally {
        setLoading(false);
      }
    },
    [authToken, selectedAccountId]
  );

  useEffect(() => {
    fetchSsoToken(selectedAccountId);
  }, [fetchSsoToken, selectedAccountId]);

  // 3. Construct terminal URL with SSO token & context query params
  const currentAccount = accounts.find((a) => a.id === selectedAccountId) || ssoData?.account;

  const defaultBaseUrl =
    (import.meta as any).env?.VITE_TRADING_PLATFORM_URL ||
    currentAccount?.terminal_url ||
    ssoData?.terminal_url ||
    'https://trading-platform-two-mu.vercel.app';

  const terminalUrl = (() => {
    if (!defaultBaseUrl) return '';
    try {
      const u = new URL(defaultBaseUrl);
      if (ssoData?.token) {
        u.searchParams.set('token', ssoData.token);
      }
      if (currentAccount?.account_number) {
        u.searchParams.set('account', currentAccount.account_number);
        u.searchParams.set('account_number', currentAccount.account_number);
      }
      if (currentAccount?.currency) {
        u.searchParams.set('currency', currentAccount.currency);
      }
      if (currentAccount?.server_name) {
        u.searchParams.set('server', currentAccount.server_name);
      }
      if (currentAccount?.platform) {
        u.searchParams.set('platform', currentAccount.platform);
      }
      if (user?.id) {
        u.searchParams.set('user_id', String(user.id));
      }
      if (user?.email) {
        u.searchParams.set('email', String(user.email));
      }
      u.searchParams.set('theme', 'dark');
      u.searchParams.set('embedded', 'true');
      u.searchParams.set('origin', window.location.origin);

      return u.toString();
    } catch {
      return defaultBaseUrl;
    }
  })();

  // 4. Two-way postMessage integration with embedded terminal
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      // Validate origin if desired, or accept structured messages from embedded iframe
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const type = String(data.type || data.action || '');

      switch (type) {
        case 'CRM_DEPOSIT':
        case 'OPEN_DEPOSIT':
        case 'TRADING_DEPOSIT':
          onNavigate('wallet');
          break;
        case 'CRM_ACCOUNTS':
        case 'OPEN_ACCOUNTS':
          onNavigate('accounts');
          break;
        case 'CRM_SUPPORT':
        case 'OPEN_SUPPORT':
          onNavigate('support');
          break;
        case 'GET_SESSION':
        case 'REQUEST_HANDSHAKE':
          if (iframeRef.current?.contentWindow && ssoData) {
            iframeRef.current.contentWindow.postMessage(
              {
                type: 'CRM_HANDSHAKE_RESPONSE',
                token: ssoData.token,
                account: currentAccount,
                user: { id: user?.id, email: user?.email, name: `${user?.first_name || ''} ${user?.last_name || ''}` },
              },
              '*'
            );
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [currentAccount, onNavigate, ssoData, user]);

  // 5. Send handshake when iframe loads
  const handleIFrameLoad = () => {
    setIframeLoading(false);
    try {
      if (iframeRef.current?.contentWindow && ssoData) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'CRM_HANDSHAKE',
            token: ssoData.token,
            account: currentAccount,
            user: { id: user?.id, email: user?.email, name: `${user?.first_name || ''} ${user?.last_name || ''}` },
          },
          '*'
        );
      }
    } catch {
      // Cross-origin protection prevents reading iframe content, postMessage is safe
    }
  };

  // 6. Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleRefreshTerminal = () => {
    setIframeLoading(true);
    setIframeReloadKey((k) => k + 1);
  };

  const handlePopOut = () => {
    if (terminalUrl) {
      window.open(terminalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#070a10] border border-[#1b2333] rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen' : 'w-full h-[calc(100vh-8.5rem)] min-h-[580px]'
      }`}
    >
      {/* Top Embedded Terminal Control Bar */}
      <header className="h-14 bg-[#0c1018] border-b border-[#1b2333] px-3 sm:px-4 flex items-center justify-between flex-shrink-0 gap-2">
        {/* Left: Platform Badge & Account Switcher */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div className="hidden lg:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight">WebTrader Terminal</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  DMA Live
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Market Bridge Online</span>
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>

          {/* Account Selector Dropdown */}
          {accounts.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#141b29] hover:bg-[#1a2336] border border-[#232d40] text-xs font-semibold text-white transition text-left"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-cyan-300">
                      {currentAccount?.account_number || 'Select Account'}
                    </span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">
                      {currentAccount?.platform || 'WebTrader'}
                    </span>
                    {currentAccount?.is_demo && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                        DEMO
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {currentAccount?.server_name || 'Direct Execution'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {accountDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAccountDropdownOpen(false)}
                  ></div>
                  <div className="absolute left-0 mt-1 w-64 bg-[#0e131f] border border-[#232d40] rounded-xl shadow-2xl py-1.5 z-50 divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Switch Trading Account
                    </div>
                    {accounts.map((acc) => {
                      const isSelected = acc.id === selectedAccountId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(acc.id);
                            setAccountDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-[#161f30] transition ${
                            isSelected ? 'bg-blue-600/10 text-white font-semibold' : 'text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span>{acc.account_number}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                                {acc.platform}
                              </span>
                              {acc.is_demo && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                                  DEMO
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {acc.server_name} • {acc.currency}
                            </div>
                          </div>
                          {acc.balance && (
                            <div className="text-right">
                              <span className="font-mono text-xs font-semibold text-emerald-400">
                                ${parseFloat(acc.balance).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onNavigate('accounts');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Open New Account
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          )}
        </div>

        {/* Center: Live Account Metrics (if selected) */}
        {currentAccount && (
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141b29] border border-[#1b2333]">
              <span className="text-slate-400 text-[11px]">Balance:</span>
              <span className="font-mono font-bold text-white">
                {currentAccount.currency || 'USD'}{' '}
                {currentAccount.balance ? parseFloat(currentAccount.balance).toFixed(2) : '0.00'}
              </span>
            </div>
            {currentAccount.equity && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141b29] border border-[#1b2333]">
                <span className="text-slate-400 text-[11px]">Equity:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {currentAccount.currency || 'USD'} {parseFloat(currentAccount.equity).toFixed(2)}
                </span>
              </div>
            )}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141b29] border border-[#1b2333]">
              <span className="text-slate-400 text-[11px]">Leverage:</span>
              <span className="font-mono font-semibold text-slate-200">
                {currentAccount.leverage || '1:100'}
              </span>
            </div>
          </div>
        )}

        {/* Right: Quick Actions (Deposit, Reload, Fullscreen, Pop Out) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Deposit Button */}
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
            title="Deposit funds to trade"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deposit</span>
          </button>

          {/* Refresh Frame */}
          <button
            type="button"
            onClick={handleRefreshTerminal}
            className="p-1.5 sm:p-2 rounded-lg bg-[#141b29] hover:bg-[#1f293d] border border-[#232d40] text-slate-300 hover:text-white transition"
            title="Reload Terminal Interface"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg bg-[#141b29] hover:bg-[#1f293d] border border-[#232d40] text-slate-300 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Trading Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* External Popout */}
          <button
            type="button"
            onClick={handlePopOut}
            className="p-1.5 sm:p-2 rounded-lg bg-[#141b29] hover:bg-[#1f293d] border border-[#232d40] text-slate-300 hover:text-white transition"
            title="Open WebTrader in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Embedded Terminal Frame Container */}
      <div className="relative flex-grow w-full bg-[#09090b] overflow-hidden">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-[#09090b]/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
              <Activity className="w-6 h-6 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-white">Connecting WebTrader Gateway</h4>
              <p className="text-xs text-slate-400">Authenticating Single Sign-On session & account security...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 bg-[#09090b] flex flex-col items-center justify-center z-20 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center max-w-md space-y-2">
              <h4 className="text-sm font-bold text-white">Terminal Connection Error</h4>
              <p className="text-xs text-slate-400">{error}</p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchSsoToken(selectedAccountId)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                >
                  Retry Connection
                </button>
                <a
                  href={defaultBaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#141b29] hover:bg-[#1a2336] border border-[#232d40] text-slate-200 text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  Open Directly <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Zero-Account Prompt */}
        {!loading && accounts.length === 0 && !error && (
          <div className="absolute inset-0 bg-[#09090b] flex flex-col items-center justify-center z-20 p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="w-7 h-7" />
            </div>
            <div className="text-center max-w-sm space-y-1">
              <h4 className="text-base font-bold text-white">No Trading Account Found</h4>
              <p className="text-xs text-slate-400">
                You need an active MT4, MT5, or WebTrader account to trade with live market execution.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition"
            >
              Open Trading Account <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Embedded IFrame */}
        {terminalUrl && (
          <iframe
            key={iframeReloadKey}
            ref={iframeRef}
            src={terminalUrl}
            title="WebTrader Platform"
            className="w-full h-full border-0 bg-[#09090b]"
            onLoad={handleIFrameLoad}
            allow="fullscreen; clipboard-read; clipboard-write; display-capture"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        )}
      </div>

      {/* Terminal Footer Status Bar */}
      <footer className="h-8 bg-[#090d14] border-t border-[#1b2333] px-3 sm:px-4 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            SSL 256-Bit Encrypted
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">Server: {currentAccount?.server_name || 'Primary Gateway'}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline">Account: {currentAccount?.account_number || 'N/A'}</span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="text-cyan-400 font-medium">SSO Active</span>
        </div>
      </footer>
    </div>
  );
}
