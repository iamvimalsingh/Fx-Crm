import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Lock,
  Mail,
  User as UserIcon,
  Globe,
  DollarSign,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';

interface AuthViewsProps {
  key?: React.Key;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialRole?: 'client' | 'admin';
  onSuccessRedirect?: (role: 'client' | 'admin') => void;
  brokerName?: string;
}

export function AuthViews({
  initialMode = 'login',
  initialRole = 'client',
  onSuccessRedirect,
  brokerName = 'Forex Broker CRM',
}: AuthViewsProps) {
  const { login, register, forgotPassword, resetPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    initialRole === 'admin' && initialMode === 'register' ? 'login' : initialMode
  );
  const [authRole, setAuthRole] = useState<'client' | 'admin'>(initialRole);
  const [adminInitialized, setAdminInitialized] = useState<boolean | null>(null);
  const [isAdminSetupMode, setIsAdminSetupMode] = useState(false);
  const [adminSetupSecret, setAdminSetupSecret] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/auth/admin-status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.initialized !== undefined) {
          setAdminInitialized(data.data.initialized);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isAdminSetupMode && authRole === 'admin') {
        const res = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            first_name: firstName || 'System',
            last_name: lastName || 'Admin',
            country,
            preferred_currency: currency,
            setup_secret: adminSetupSecret || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.data?.token) {
          localStorage.setItem('crm_token', data.data.token);
          setAdminInitialized(true);
          setIsAdminSetupMode(false);
          setSuccessMsg('Administrator initialized successfully! Redirecting...');
          setTimeout(() => {
            window.location.reload();
          }, 400);
        } else {
          setErrorMsg(data?.message || 'Admin initialization failed');
        }
        return;
      }

      if (mode === 'login') {
        const res = await login(email, password);
        if (res.ok) {
          setSuccessMsg('Authentication successful. Redirecting to workspace...');
          setTimeout(() => {
            if (onSuccessRedirect) onSuccessRedirect(res.role as any || authRole);
          }, 350);
        } else {
          setErrorMsg(res.message || 'Invalid credentials');
        }
      } else if (mode === 'register' && authRole === 'client') {
        const res = await register({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          country,
          preferred_currency: currency,
        });
        if (res.ok) {
          setSuccessMsg('Client account created successfully! Redirecting...');
          setTimeout(() => {
            if (onSuccessRedirect) onSuccessRedirect('client');
          }, 350);
        } else {
          setErrorMsg(res.message || 'Registration failed');
        }
      } else if (mode === 'forgot') {
        const res = await forgotPassword(email);
        if (res.ok) {
          setSuccessMsg(res.message || 'Password reset link sent to your email.');
        } else {
          setErrorMsg(res.message || 'Unable to process reset request');
        }
      } else if (mode === 'reset') {
        const res = await resetPassword(resetToken, newPassword);
        if (res.ok) {
          setSuccessMsg(res.message || 'Password updated successfully! Please log in.');
          setTimeout(() => {
            setMode('login');
            setPassword(newPassword);
            setSuccessMsg('You can now log in with your new password.');
          }, 1200);
        } else {
          setErrorMsg(res.message || 'Reset token is invalid or expired');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Broker Branding Card */}
      <div className="bg-[#0f1523] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 mb-1">
            {authRole === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {authRole === 'admin'
                ? isAdminSetupMode
                  ? 'Administrator Setup'
                  : 'Broker Administration Portal'
                : brokerName}
            </h2>
            <p className="text-xs text-slate-400">
              {authRole === 'admin'
                ? isAdminSetupMode
                  ? 'Initialize the primary administrator account'
                  : 'Authorized staff & risk management login'
                : mode === 'login'
                ? 'Sign in to access your trading wallet & portal'
                : mode === 'register'
                ? 'Open a live client trading account'
                : mode === 'forgot'
                ? 'Recover your portal access'
                : 'Define a new secure password'}
            </p>
          </div>
        </div>

        {/* Portal Separation Tabs */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setAuthRole('client');
              setIsAdminSetupMode(false);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-md transition ${
              authRole === 'client'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Client Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthRole('admin');
              setMode('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-md transition ${
              authRole === 'admin'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin Backoffice
          </button>
        </div>

        {/* Initial Admin Bootstrap Notice if not yet initialized */}
        {authRole === 'admin' && adminInitialized === false && (
          <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-lg space-y-2 text-xs">
            <div className="font-semibold text-purple-300">Initial Setup Mode Active</div>
            <p className="text-slate-400 text-[11px]">
              No administrator account has been created yet. You can bootstrap the primary administrator account below.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsAdminSetupMode(!isAdminSetupMode);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold rounded transition"
            >
              {isAdminSetupMode ? 'Switch to Standard Admin Login' : 'Bootstrap Primary Administrator'}
            </button>
          </div>
        )}

        {/* Alerts & Feedback */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-lg flex items-start gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-lg flex items-start gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Admin Setup Secret Field (if in bootstrap mode) */}
          {authRole === 'admin' && isAdminSetupMode && (
            <div>
              <label className="block text-xs font-medium text-purple-300 mb-1">
                Admin Setup Secret (ADMIN_SETUP_SECRET)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={adminSetupSecret}
                  onChange={(e) => setAdminSetupSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                  placeholder="Leave blank if not configured"
                />
              </div>
            </div>
          )}

          {/* Client Registration Extra Fields */}
          {authRole === 'client' && mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">First Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      placeholder="First name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Last Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      placeholder="Last name"
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. US, GB, DE"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Base Currency</label>
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

          {/* Email field (for login, register, forgot) */}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  placeholder={authRole === 'admin' ? 'admin@broker.com' : 'client@domain.com'}
                />
              </div>
            </div>
          )}

          {/* Password field (for login, register) */}
          {(mode === 'login' || (authRole === 'client' && mode === 'register') || (authRole === 'admin' && isAdminSetupMode)) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  placeholder={mode === 'register' ? 'Min 8 chars, 1 uppercase, 1 number' : '••••••••'}
                />
              </div>
            </div>
          )}

          {/* Reset Password fields */}
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="Enter security token"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg transition ${
              authRole === 'admin'
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
            } disabled:opacity-50`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>
                  {isAdminSetupMode && authRole === 'admin' && 'Initialize Primary Admin'}
                  {!isAdminSetupMode && mode === 'login' && (authRole === 'admin' ? 'Sign In as Administrator' : 'Sign In to Client Portal')}
                  {mode === 'register' && authRole === 'client' && 'Complete Client Registration'}
                  {mode === 'forgot' && 'Send Reset Link'}
                  {mode === 'reset' && 'Confirm New Password'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Mode Switcher Links */}
        <div className="text-center pt-2 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
          {mode === 'login' && authRole === 'client' && (
            <p>
              Don't have a trading account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Register here
              </button>
            </p>
          )}

          {authRole === 'admin' && (
            <p className="text-[11px] text-slate-500">
              Admin access is restricted to authorized personnel. Registration is disabled.
            </p>
          )}

          {mode === 'register' && authRole === 'client' && (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Sign in instead
              </button>
            </p>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
