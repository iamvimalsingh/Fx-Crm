import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../lib/router';
import { ClientDashboardShell } from './ClientDashboardShell';
import { AdminDashboardShell } from './AdminDashboardShell';
import { AuthViews } from './AuthViews';
import { RefreshCw } from 'lucide-react';

interface CRMAppExperienceProps {
  brokerName?: string;
  brokerCurrency?: string;
}

export function CRMAppExperience({
  brokerName = 'ForexCore',
  brokerCurrency = 'USD',
}: CRMAppExperienceProps) {
  const { user, loading } = useAuth();
  const { path } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a10] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Validating session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070a10] flex items-center justify-center p-4">
        <AuthViews brokerName={brokerName} />
      </div>
    );
  }

  if (user.role === 'admin') {
    return <AdminDashboardShell brokerName={brokerName} />;
  }

  return <ClientDashboardShell brokerName={brokerName} brokerCurrency={brokerCurrency} />;
}
