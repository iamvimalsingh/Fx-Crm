import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBrokerSettings } from '../../context/BrokerSettingsContext';
import {
  Sliders,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Mail,
  Phone,
  Scale,
  DollarSign,
  Lock,
} from 'lucide-react';

interface BrokerSettingsPayload {
  broker_name: string;
  legal_entity_name: string;
  support_email: string;
  contact_phone: string;
  default_currency: string;
  default_leverage: string;
  max_leverage: string;
  accent_color: string;
  allowed_registrations: boolean;
  kyc_required_for_withdrawals: boolean;
}

export function AdminBrokerSettingsView() {
  const { token } = useAuth();
  const { updateBrandingOptimistic, refreshBranding } = useBrokerSettings();

  const [settings, setSettings] = useState<BrokerSettingsPayload>({
    broker_name: 'ForexCore Broker',
    legal_entity_name: 'ForexCore Financial Services Ltd',
    support_email: 'support@forexcore.com',
    contact_phone: '+44 20 7946 0912',
    default_currency: 'USD',
    default_leverage: '1:100',
    max_leverage: '1:500',
    accent_color: '#8b5cf6',
    allowed_registrations: true,
    kyc_required_for_withdrawals: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/broker-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const d = json.data;
        setSettings({
          broker_name: d.broker_name || d.brokerName || 'ForexCore Broker',
          legal_entity_name: d.legal_entity_name || d.legalEntityName || 'ForexCore Financial Services Ltd',
          support_email: d.support_email || d.supportEmail || 'support@forexcore.com',
          contact_phone: d.contact_phone || d.contactPhone || '+44 20 7946 0912',
          default_currency: d.default_currency || d.baseCurrency || 'USD',
          default_leverage: d.default_leverage || d.defaultLeverage || '1:100',
          max_leverage: d.max_leverage || d.maxLeverage || '1:500',
          accent_color: d.accent_color || d.accentColor || '#8b5cf6',
          allowed_registrations: d.allowed_registrations !== undefined ? d.allowed_registrations : true,
          kyc_required_for_withdrawals:
            d.kyc_required_for_withdrawals !== undefined ? d.kyc_required_for_withdrawals : true,
        });
      }
    } catch (err: any) {
      // Use defaults if initial load fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/broker-settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save operational settings');

      // Update global client branding state immediately
      updateBrandingOptimistic(settings);
      await refreshBranding();

      setFeedback({
        type: 'success',
        text: 'Broker configuration & dynamic branding updated and permanently stored in database. Logged in audit trail.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to persist settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
        <span>Loading operational broker configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Broker Operational Governance & Dynamic Branding
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure single-broker authoritative branding, leverage thresholds, and regulatory compliance rules with durable persistence.
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
          <Sliders className="w-4 h-4" />
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Identity & Contact */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase border-b border-[#1b222d] pb-2">
              Authoritative Brokerage Identity & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Brokerage Display Name
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={settings.broker_name}
                    onChange={(e) => setSettings({ ...settings, broker_name: e.target.value })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Legal Entity / Operating Company Name
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={settings.legal_entity_name}
                    onChange={(e) => setSettings({ ...settings, legal_entity_name: e.target.value })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Base Vault Currency
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={settings.default_currency}
                    onChange={(e) => setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Primary Brand Accent Color (HEX)
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg border border-[#1b222d] flex-shrink-0"
                    style={{ backgroundColor: settings.accent_color || '#8b5cf6' }}
                  />
                  <input
                    type="text"
                    required
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    placeholder="#8b5cf6"
                    value={settings.accent_color}
                    onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Support Desk Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={settings.support_email}
                    onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Support Phone / Desk Contact
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={settings.contact_phone}
                    onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Risk & Leverage Policies */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase border-b border-[#1b222d] pb-2">
              Risk & Leverage Boundaries
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Default Retail Leverage
                </label>
                <select
                  value={settings.default_leverage}
                  onChange={(e) => setSettings({ ...settings, default_leverage: e.target.value })}
                  className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                >
                  <option value="1:30">1:30 (Strict ESMA Standard)</option>
                  <option value="1:50">1:50 (Standard Retail)</option>
                  <option value="1:100">1:100 (Default Standard)</option>
                  <option value="1:200">1:200 (Active Trader)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Maximum Allowable Leverage
                </label>
                <select
                  value={settings.max_leverage}
                  onChange={(e) => setSettings({ ...settings, max_leverage: e.target.value })}
                  className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                >
                  <option value="1:100">1:100 Maximum Ceiling</option>
                  <option value="1:200">1:200 Maximum Ceiling</option>
                  <option value="1:400">1:400 Maximum Ceiling</option>
                  <option value="1:500">1:500 Maximum Ceiling</option>
                  <option value="1:1000">1:1000 Maximum Ceiling</option>
                </select>
              </div>
            </div>
          </div>

          {/* Compliance & Verification Governance */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase border-b border-[#1b222d] pb-2">
              Regulatory Compliance Enforcements
            </h3>
            <div className="space-y-3">
              <label className="p-3 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Require KYC Verification for Capital Withdrawals</div>
                  <div className="text-[11px] text-slate-400">
                    Require verified identity document approval before client withdrawal requests can be approved and processed.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.kyc_required_for_withdrawals}
                  onChange={(e) => setSettings({ ...settings, kyc_required_for_withdrawals: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700"
                />
              </label>

              <label className="p-3 rounded-lg bg-[#07090e] border border-[#1b222d] flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Public Client Registrations Allowed</div>
                  <div className="text-[11px] text-slate-400">
                    Permit new public clients to open live trader accounts via the public onboarding registration portal.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowed_registrations}
                  onChange={(e) => setSettings({ ...settings, allowed_registrations: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700"
                />
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end border-t border-[#1b222d]">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-purple-600/20"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : 'Save & Broadcast Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
