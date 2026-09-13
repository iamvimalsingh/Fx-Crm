import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthViews } from './AuthViews';
import { ClientDashboardShell } from './ClientDashboardShell';
import { AdminDashboardShell } from './AdminDashboardShell';
import {
  Shield,
  Layout,
  Smartphone,
  CheckCircle2,
  Lock,
  LogOut,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface CRMAppExperienceProps {
  brokerName?: string;
  brokerCurrency?: string;
}

export function CRMAppExperience({
  brokerName = 'Forex Broker CRM',
  brokerCurrency = 'USD',
}: CRMAppExperienceProps) {
  const { user, token, loading, logout, checkAdminAccess } = useAuth();
  const [authFormMode, setAuthFormMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [authTargetRole, setAuthTargetRole] = useState<'client' | 'admin'>('client');
  const [activePortalView, setActivePortalView] = useState<'auto' | 'client' | 'admin' | 'auth'>('auto');
  const [adminTestResult, setAdminTestResult] = useState<any>(null);
  const [testingAdmin, setTestingAdmin] = useState(false);

  const handleTestAdminRoute = async () => {
    setTestingAdmin(true);
    const res = await checkAdminAccess();
    setAdminTestResult(res);
    setTestingAdmin(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Validating backend session...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session State Banner & Quick Portal Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
              user?.role === 'admin'
                ? 'bg-gradient-to-br from-purple-600 to-indigo-700 shadow-purple-500/20'
                : user?.role === 'client'
                ? 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/20'
                : 'bg-slate-800'
            }`}
          >
            {user?.role === 'admin' ? (
              <Shield className="w-5 h-5" />
            ) : user?.role === 'client' ? (
              <UserCheck className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {user ? `${user.first_name} ${user.last_name}` : 'Unauthenticated Session'}
              </span>
              {user && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    user.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {user ? user.email : 'No active JWT token. Please sign in or register below.'}
            </p>
          </div>
        </div>

        {/* View Toggle / Protected Route Switcher */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActivePortalView('client')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold transition ${
                  (activePortalView === 'auto' && user.role === 'client') || activePortalView === 'client'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Client Portal
              </button>
              <button
                onClick={() => setActivePortalView('admin')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold transition ${
                  (activePortalView === 'auto' && user.role === 'admin') || activePortalView === 'admin'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Admin Portal
              </button>
            </div>
          )}

          {!user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAuthTargetRole('client');
                  setAuthFormMode('login');
                  setActivePortalView('auth');
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-xs font-semibold shadow transition"
              >
                Client Sign In
              </button>
              <button
                onClick={() => {
                  setAuthTargetRole('client');
                  setAuthFormMode('register');
                  setActivePortalView('auth');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold border border-slate-700 transition"
              >
                Register
              </button>
              <button
                onClick={() => {
                  setAuthTargetRole('admin');
                  setAuthFormMode('login');
                  setActivePortalView('auth');
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 hover:bg-purple-600/50 text-xs font-semibold transition"
              >
                Admin Login
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW CONDITIONAL RENDERING */}
      {/* 1. If NO USER is logged in, show AuthViews */}
      {!user && (
        <div className="py-6">
          <AuthViews
            initialMode={authFormMode}
            initialRole={authTargetRole}
            brokerName={brokerName}
            onSuccessRedirect={(role) => {
              setActivePortalView(role);
            }}
          />
        </div>
      )}

      {/* 2. If USER is logged in, handle Client or Admin Protected Portals */}
      {user && (
        <>
          {/* Admin Protected Route Check for Admin View */}
          {((activePortalView === 'auto' && user.role === 'admin') || activePortalView === 'admin') && (
            <>
              {user.role === 'admin' ? (
                <AdminDashboardShell
                  brokerName={brokerName}
                  onLogoutRequested={() => setActivePortalView('auth')}
                />
              ) : (
                /* Protected Route Access Denied Banner for Non-Admins */
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-6 text-center space-y-3">
                  <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">403 Forbidden — Admin Access Required</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Your account (<code className="text-rose-300 font-mono">{user.email}</code>) has the role{' '}
                    <code className="text-rose-300 font-bold">{user.role}</code>. Only authorized administrators with{' '}
                    <code className="text-purple-300 font-mono">role: admin</code> can access the broker management shell.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => setActivePortalView('client')}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs"
                    >
                      Return to Client Portal
                    </button>
                    <button
                      onClick={() => logout()}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700"
                    >
                      Sign In with Admin Account
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Client Portal View */}
          {((activePortalView === 'auto' && user.role === 'client') || activePortalView === 'client') && (
            <ClientDashboardShell
              brokerName={brokerName}
              brokerCurrency={brokerCurrency}
              onLogoutRequested={() => setActivePortalView('auth')}
            />
          )}

          {/* Live RBAC Guard Live Inspector */}
          <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 font-medium">Verify Protected Serverless Route Guard:</span>
              <button
                onClick={handleTestAdminRoute}
                disabled={testingAdmin}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition flex items-center gap-1"
              >
                {testingAdmin ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                GET /api/admin/check
              </button>
            </div>

            {adminTestResult && (
              <div
                className={`px-3 py-1 rounded border font-mono text-[11px] ${
                  adminTestResult.ok
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                }`}
              >
                {adminTestResult.ok ? '✓ 200 OK — Admin Verified' : '✗ 403 Forbidden — Denied'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
