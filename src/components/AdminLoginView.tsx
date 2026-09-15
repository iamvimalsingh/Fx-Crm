import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../lib/router';
import { parseApiResponse } from '../lib/api-client';
import {
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

interface AdminLoginViewProps {
  brokerName?: string;
}

export function AdminLoginView({ brokerName = 'ForexCore' }: AdminLoginViewProps) {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin bootstrap state
  const [adminInitialized, setAdminInitialized] = useState<boolean | null>(null);
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    fetch('/api/auth/admin-status')
      .then((res) => parseApiResponse(res))
      .then((result) => {
        if (result.data?.initialized !== undefined) {
          setAdminInitialized(result.data.initialized);
          if (result.data.initialized === false) {
            setIsBootstrapMode(true);
          }
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
      if (isBootstrapMode) {
        const res = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            first_name: firstName || 'System',
            last_name: lastName || 'Admin',
            country: 'US',
            preferred_currency: 'USD',
            setup_secret: setupSecret || undefined,
          }),
        });
        const result = await parseApiResponse(res);
        if (result.ok && result.data?.token) {
          localStorage.setItem('crm_token', result.data.token);
          setAdminInitialized(true);
          setIsBootstrapMode(false);
          setSuccessMsg('Primary administrator initialized successfully. Accessing Back Office...');
          setTimeout(() => {
            navigate('/admin', { replace: true });
          }, 400);
        } else {
          setErrorMsg(result.message || 'Administrator initialization failed');
        }
        return;
      }

      const res = await login(email, password);
      if (res.ok) {
        if (res.role !== 'admin') {
          setErrorMsg('Access denied: Provided credentials do not possess administrator back office privileges.');
          return;
        }
        setSuccessMsg('Authentication verified. Accessing Back Office...');
        setTimeout(() => {
          navigate('/admin', { replace: true });
        }, 350);
      } else {
        setErrorMsg(res.message || 'Invalid administrator credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Office Card */}
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 text-white shadow-xl shadow-purple-600/20 mb-2 border border-purple-500/30">
              <Shield className="w-7 h-7 text-purple-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isBootstrapMode ? 'Initialize Administrator' : 'Broker Back Office'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {isBootstrapMode
                  ? 'Bootstrap the primary system administrator account'
                  : 'Authorized operations, compliance & risk management staff only'}
              </p>
            </div>
          </div>

          {/* Initial Setup Banner (Only if system has 0 admins) */}
          {adminInitialized === false && (
            <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl space-y-2 text-xs">
              <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Initial Setup Required
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                No administrator account exists yet. Enter your administrative credentials to bootstrap the system.
              </p>
            </div>
          )}

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isBootstrapMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                      placeholder="System"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-[#070a10] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                      placeholder="Admin"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
                    Setup Secret Key
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      className="w-full bg-[#070a10] border border-purple-500/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500"
                      placeholder="Enter ADMIN_SETUP_SECRET"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Staff Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  placeholder="admin@broker.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#070a10] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{isBootstrapMode ? 'Bootstrap Administrator' : 'Staff Secure Login'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Notice */}
          <div className="pt-2 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500">
              Restricted system. All authentication attempts and operational sessions are logged in the audit ledger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
