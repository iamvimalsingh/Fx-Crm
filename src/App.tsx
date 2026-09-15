import React, { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './lib/router';
import { BrokerSettingsProvider, useBrokerSettings } from './context/BrokerSettingsContext';
import { AuthViews } from './components/AuthViews';
import { AdminLoginView } from './components/AdminLoginView';
import { ClientDashboardShell } from './components/ClientDashboardShell';
import { AdminDashboardShell } from './components/AdminDashboardShell';
import {
  ShieldAlert,
  ArrowRight,
  LogOut,
  RefreshCw,
  Activity,
  Shield,
} from 'lucide-react';

function AppRouter() {
  const { user, loading, logout } = useAuth();
  const { path, navigate } = useRouter();
  const { branding } = useBrokerSettings();

  // Normalize path without trailing slash (except root '/')
  const currentPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  // Handle automatic route redirects based on authentication state
  useEffect(() => {
    if (loading) return;

    if (user) {
      if (user.role === 'admin') {
        // If an admin visits root, login, register, or client portal -> route to /admin
        if (
          currentPath === '/' ||
          currentPath === '/login' ||
          currentPath === '/register' ||
          currentPath === '/forgot-password' ||
          currentPath === '/reset-password' ||
          currentPath === '/admin/login' ||
          currentPath.startsWith('/app')
        ) {
          navigate('/admin', { replace: true });
        }
      } else if (user.role === 'client') {
        // If an authenticated client visits public auth pages -> route to /app
        if (
          currentPath === '/' ||
          currentPath === '/login' ||
          currentPath === '/register' ||
          currentPath === '/forgot-password' ||
          currentPath === '/reset-password'
        ) {
          navigate('/app', { replace: true });
        }
      }
    } else {
      // Unauthenticated access to protected routes
      if (currentPath.startsWith('/admin') && currentPath !== '/admin/login') {
        navigate('/admin/login', { replace: true });
      } else if (currentPath.startsWith('/app')) {
        navigate('/login', { replace: true });
      } else if (currentPath === '/') {
        navigate('/login', { replace: true });
      }
    }
  }, [user, loading, currentPath, navigate]);

  // Loading state while validating session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-2">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          <span>Verifying broker authentication...</span>
        </div>
      </div>
    );
  }

  // 1. ISOLATED ADMIN LOGIN: /admin/login
  if (currentPath === '/admin/login') {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between">
        <main className="flex-grow flex items-center justify-center p-4">
          <AdminLoginView brokerName={branding.broker_name || 'ForexCore'} />
        </main>
        <footer className="border-t border-slate-900 bg-[#05070a] text-slate-600 text-xs py-4 px-6 text-center">
          {branding.legal_entity_name || branding.broker_name || 'ForexCore'} Back Office — Internal Operations & Risk Management Console
        </footer>
      </div>
    );
  }

  // 2. ADMIN BACK OFFICE: /admin and subpaths
  if (currentPath.startsWith('/admin')) {
    if (!user) {
      return (
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
          <AdminLoginView brokerName={branding.broker_name || 'ForexCore'} />
        </div>
      );
    }

    // Role Guard: Strict 403 Forbidden if user is NOT an admin
    if (user.role !== 'admin') {
      return (
        <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0b0e14] border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                403 Forbidden — Back Office Access Restricted
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Your account (<code className="text-rose-300 font-mono">{user.email}</code>) is registered with the role{' '}
                <code className="text-rose-300 font-bold uppercase">{user.role}</code>. Access to the broker Back Office is restricted exclusively to authorized administrative personnel.
              </p>
            </div>
            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/app', { replace: true })}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
              >
                <span>Return to Trader Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/admin/login', { replace: true });
                }}
                className="px-4 py-2.5 rounded-xl bg-[#141a24] hover:bg-[#1a2230] text-slate-300 hover:text-white font-semibold text-xs border border-slate-800 transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Staff Sign In</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <AdminDashboardShell brokerName={branding.broker_name || 'ForexCore'} />;
  }

  // 3. CLIENT TRADER ROOM: /app and subpaths
  if (currentPath.startsWith('/app')) {
    if (!user) {
      return (
        <div className="min-h-screen bg-[#070a10] flex items-center justify-center p-4">
          <AuthViews initialMode="login" brokerName={`${branding.broker_name || 'ForexCore'} Trader Room`} />
        </div>
      );
    }

    return (
      <ClientDashboardShell
        brokerName={branding.broker_name || 'ForexCore'}
        brokerCurrency={branding.default_currency || 'USD'}
      />
    );
  }

  // 4. PUBLIC AUTH ROUTES: /login, /register, /forgot-password, /reset-password, /
  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col justify-between">
      {/* Clean Broker Navigation Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0a0e17]/80 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">{branding.broker_name || 'ForexCore'}</span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Trader Room
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {currentPath === '/register' ? (
            <button
              onClick={() => navigate('/login')}
              className="text-slate-300 hover:text-white font-medium px-3 py-1.5 rounded-lg transition"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => navigate('/register')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 rounded-lg transition shadow-md shadow-blue-600/20"
            >
              Open Live Account
            </button>
          )}
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6">
        {currentPath === '/register' && (
          <AuthViews initialMode="register" brokerName={`${branding.broker_name || 'ForexCore'} Trader Room`} />
        )}
        {currentPath === '/forgot-password' && (
          <AuthViews initialMode="forgot" brokerName={`${branding.broker_name || 'ForexCore'} Trader Room`} />
        )}
        {currentPath === '/reset-password' && (
          <AuthViews initialMode="reset" brokerName={`${branding.broker_name || 'ForexCore'} Trader Room`} />
        )}
        {(currentPath === '/login' || currentPath === '/') && (
          <AuthViews initialMode="login" brokerName={`${branding.broker_name || 'ForexCore'} Trader Room`} />
        )}
      </main>

      {/* Professional Footer */}
      <footer className="border-t border-slate-900 bg-[#05070c] text-slate-600 text-xs py-4 px-6 text-center">
        {branding.legal_entity_name || branding.broker_name || 'ForexCore'} — Regulated Multi-Asset Trading Platform & Client Portal
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <BrokerSettingsProvider>
        <AppRouter />
      </BrokerSettingsProvider>
    </RouterProvider>
  );
}
