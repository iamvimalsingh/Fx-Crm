import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Globe,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export function AuthTester() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // API Execution status
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('crm_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adminCheckResult, setAdminCheckResult] = useState<any>(null);

  // Fetch current authenticated user if token exists
  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.data.user);
      } else {
        setCurrentUser(null);
        localStorage.removeItem('crm_token');
        setToken(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    }
  }, [token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setApiResponse(null);
    setAdminCheckResult(null);

    let url = '/api/auth/login';
    let body: any = { email, password };

    if (mode === 'register') {
      url = '/api/auth/register';
      body = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        country,
        preferred_currency: currency,
      };
    } else if (mode === 'forgot') {
      url = '/api/auth/forgot-password';
      body = { email };
    } else if (mode === 'reset') {
      url = '/api/auth/reset-password';
      body = { token: resetToken, password: newPassword };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setApiResponse({ status: res.status, ok: res.ok, data });

      if (res.ok && data?.data?.token) {
        setToken(data.data.token);
        localStorage.setItem('crm_token', data.data.token);
        setCurrentUser(data.data.user);
      }
    } catch (err: any) {
      setApiResponse({ status: 500, ok: false, data: { message: err.message } });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
      setCurrentUser(null);
      localStorage.removeItem('crm_token');
      setApiResponse({ status: 200, ok: true, data: { message: 'Logged out successfully' } });
      setAdminCheckResult(null);
    }
  };

  const testAdminAccess = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/check', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setAdminCheckResult({ status: res.status, ok: res.ok, data });
    } catch (err: any) {
      setAdminCheckResult({ status: 500, ok: false, data: { message: err.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Netlify-Native Authentication & RBAC Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stateless JWT tokens, Bcrypt password hashing, PostgreSQL schema, and Zod server-side validation.
          </p>
        </div>

        {/* Diagnostic Status Indicator */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300 font-mono text-[11px]">API Status: Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Auth Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-6 shadow-xl">
            {/* Mode Switcher */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 mb-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`py-2 rounded-md transition ${
                  mode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`py-2 rounded-md transition ${
                  mode === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className={`py-2 rounded-md transition ${
                  mode === 'forgot' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Forgot
              </button>
              <button
                type="button"
                onClick={() => setMode('reset')}
                className={`py-2 rounded-md transition ${
                  mode === 'reset' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Reset
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {/* Register Extra Fields */}
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">First Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          placeholder="First Name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Last Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          placeholder="Last Name"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Country</label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          placeholder="e.g. US, GB, DE"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <select
                          value={currency}
                          onChange={(e: any) => setCurrency(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Standard Email field */}
              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      placeholder="name@broker.com"
                    />
                  </div>
                </div>
              )}

              {/* Standard Password field */}
              {(mode === 'login' || mode === 'register') && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                    />
                  </div>
                </div>
              )}

              {/* Reset Password Fields */}
              {mode === 'reset' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Reset Token</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                        placeholder="Paste reset token here"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        placeholder="New strong password"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In to Account'}
                      {mode === 'register' && 'Create Client Account'}
                      {mode === 'forgot' && 'Send Password Reset Link'}
                      {mode === 'reset' && 'Confirm Password Reset'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Session & RBAC Inspector */}
        <div className="lg:col-span-6 space-y-4">
          {/* Active Session Card */}
          <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" /> Active Session State
              </h3>
              {currentUser ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">NO ACTIVE SESSION</span>
              )}
            </div>

            {currentUser ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">
                      {currentUser.first_name} {currentUser.last_name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{currentUser.email}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        currentUser.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <div className="text-[10px] text-emerald-400 mt-0.5">● {currentUser.status}</div>
                  </div>
                </div>

                {/* Test RBAC Guard */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300 font-medium">Test Protected Admin Route Guard:</span>
                    <button
                      onClick={testAdminAccess}
                      disabled={loading}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
                    >
                      GET /api/admin/check
                    </button>
                  </div>

                  {adminCheckResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                        adminCheckResult.ok
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : adminCheckResult.status === 403
                          ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {adminCheckResult.ok ? (
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                      )}
                      <div className="overflow-x-auto">
                        <div className="font-bold">
                          HTTP {adminCheckResult.status}:{' '}
                          {adminCheckResult.ok ? 'Access Granted' : 'Access Restricted'}
                        </div>
                        <div className="text-[11px] opacity-80">{JSON.stringify(adminCheckResult.data)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800/80 text-center text-xs text-slate-400">
                You are currently not logged in. Sign in or register above to generate a stateless JWT session.
              </div>
            )}
          </div>

          {/* Last API Response Inspector */}
          {apiResponse && (
            <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Raw API Output (HTTP {apiResponse.status})
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    apiResponse.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {apiResponse.ok ? 'SUCCESS' : 'ERROR'}
                </span>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-48">
                {JSON.stringify(apiResponse.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
