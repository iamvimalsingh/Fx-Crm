import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface BrokerBranding {
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
  updated_at?: string;
}

const DEFAULT_BRANDING: BrokerBranding = {
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
};

interface BrokerSettingsContextType {
  branding: BrokerBranding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  updateBrandingOptimistic: (newSettings: Partial<BrokerBranding>) => void;
}

const BrokerSettingsContext = createContext<BrokerSettingsContextType>({
  branding: DEFAULT_BRANDING,
  loading: true,
  refreshBranding: async () => {},
  updateBrandingOptimistic: () => {},
});

export const BrokerSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrokerBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/branding');
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.broker_name) {
          setBranding(json.data);
          // Dynamically update document title
          document.title = `${json.data.broker_name} | Client CRM & Back Office`;
        }
      }
    } catch {
      // Fallback silently to default branding
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const updateBrandingOptimistic = useCallback((newSettings: Partial<BrokerBranding>) => {
    setBranding((prev) => {
      const updated = { ...prev, ...newSettings };
      if (updated.broker_name) {
        document.title = `${updated.broker_name} | Client CRM & Back Office`;
      }
      return updated;
    });
  }, []);

  return (
    <BrokerSettingsContext.Provider
      value={{
        branding,
        loading,
        refreshBranding: fetchBranding,
        updateBrandingOptimistic,
      }}
    >
      {children}
    </BrokerSettingsContext.Provider>
  );
};

export function useBrokerSettings(): BrokerSettingsContextType {
  return useContext(BrokerSettingsContext);
}
