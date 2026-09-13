import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthViews } from './components/AuthViews';
import { ClientDashboardShell } from './components/ClientDashboardShell';
import { AdminDashboardShell } from './components/AdminDashboardShell';
import { AuthTester } from './components/AuthTester';
import {
  Activity,
  Shield,
  Smartphone,
  Lock,
  LogOut,
  Sliders,
} from 'lucide-react';

export default function App() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    | 'crm_live'
    | 'client_shell'
    | 'admin_shell'
    | 'auth_tester'
  >('crm_live');

  const [brokerName, setBrokerName] = useState('Forex Broker CRM');
  const [brokerCurrency, setBrokerCurrency] = useState('USD');

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="border-b border-slate-800 bg-[#0d131f]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">{brokerName}</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  PRODUCTION
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Netlify-Native Serverless • PostgreSQL • Financial Ledger</p>
            </div>
          </div>

          {/* User Session Quick Indicator in Header */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-semibold">{user.first_name || user.email} ({user.role})</span>
                <button
                  onClick={() => logout()}
                  title="Sign Out"
                  className="text-slate-500 hover:text-rose-400 ml-1 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab('crm_live')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'crm_live' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Live CRM App
              </button>
              <button
                onClick={() => setActiveTab('client_shell')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'client_shell' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Client Portal
              </button>
              <button
                onClick={() => setActiveTab('admin_shell')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'admin_shell' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Admin Terminal
              </button>
              <button
                onClick={() => setActiveTab('auth_tester')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'auth_tester' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> API Diagnostics
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* TAB 0: LIVE CRM EXPERIENCE (CONNECTED ONLY TO NETLIFY BACKEND) */}
        {activeTab === 'crm_live' && (
          <div className="space-y-6">
            {!user ? (
              <div className="py-8">
                <AuthViews brokerName={brokerName} />
              </div>
            ) : user.role === 'admin' ? (
              <AdminDashboardShell brokerName={brokerName} />
            ) : (
              <ClientDashboardShell
                brokerName={brokerName}
                brokerCurrency={brokerCurrency}
              />
            )}
          </div>
        )}

        {/* TAB 1: CLIENT APP SHELL DIRECT VIEW */}
        {activeTab === 'client_shell' && (
          <ClientDashboardShell
            brokerName={brokerName}
            brokerCurrency={brokerCurrency}
          />
        )}

        {/* TAB 2: ADMIN APP SHELL DIRECT VIEW */}
        {activeTab === 'admin_shell' && (
          <AdminDashboardShell brokerName={brokerName} />
        )}

        {/* TAB 3: NETLIFY NATIVE AUTH & RBAC TESTER */}
        {activeTab === 'auth_tester' && <AuthTester />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0d131f] text-slate-500 text-xs py-4 px-6 text-center">
        {brokerName} — Netlify-Native Full-Stack CRM Architecture
      </footer>
    </div>
  );
}
