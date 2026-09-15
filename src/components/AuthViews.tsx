import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../lib/router';
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
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';

interface AuthViewsProps {
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  brokerName?: string;
  onSuccessRedirect?: (role: 'client' | 'admin') => void;
}

export function AuthViews({
  initialMode = 'login',
  brokerName = 'ForexCore Trader Room',
  onSuccessRedirect,
}: AuthViewsProps) {
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const { navigate } = useRouter();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);

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

  const switchMode = (newMode: 'login' | 'register' | 'forgot' | 'reset', routePath?: string) => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (routePath) {
      navigate(routePath);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.ok) {
          setSuccessMsg('Authentication successful. Redirecting to workspace...');
          setTimeout(() => {
            if (onSuccessRedirect) {
              onSuccessRedirect(res.role as any || 'client');
            } else {
              if (res.role === 'admin') {
                navigate('/admin', { replace: true });
              } else {
                navigate('/app', { replace: true });
              }
            }
          }, 350);
        } else {
          setErrorMsg(res.message || 'Invalid email or password');
        }
      } else if (mode === 'register') {
        const res = await register({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          country,
          preferred_currency: currency,
        });
        if (res.ok) {
          setSuccessMsg('Client account created successfully! Opening Trader Room...');
          setTimeout(() => {
            if (onSuccessRedirect) {
              onSuccessRedirect('client');
            } else {
              navigate('/app', { replace: true });
            }
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
          setSuccessMsg('Password updated successfully! You can now log in.');
          setTimeout(() => {
            switchMode('login', '/login');
            setPassword(newPassword);
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
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 mb-1">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {mode === 'login' && 'Trader Room Login'}
              {mode === 'register' && 'Open Trading Account'}
              {mode === 'forgot' && 'Reset Portal Password'}
              {mode === 'reset' && 'Create New Password'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login' && 'Access your multi-currency wallet & trading accounts'}
              {mode === 'register' && 'Register your verified client profile to start trading'}
              {mode === 'forgot' && 'Enter your account email to receive recovery instructions'}
              {mode === 'reset' && 'Set a secure new password for your client portal'}
            </p>
          </div>
        </div>

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
          {/* Registration Profile Fields */}
          {mode === 'register' && (
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
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  placeholder="client@domain.com"
                />
              </div>
            </div>
          )}

          {/* Password field (for login, register) */}
          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot', '/forgot-password')}
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
                  className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Sign In to Trader Room'}
                  {mode === 'register' && 'Open Trading Account'}
                  {mode === 'forgot' && 'Send Recovery Instructions'}
                  {mode === 'reset' && 'Confirm New Password'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="text-center pt-2 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          {mode === 'login' && (
            <p>
              Don't have a trading account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register', '/register')}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Open an Account
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => switchMode('login', '/login')}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Sign in to Trader Room
              </button>
            </p>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => switchMode('login', '/login')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Return to Trader Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
