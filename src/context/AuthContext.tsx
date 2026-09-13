import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string | number;
  email: string;
  role: 'client' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  first_name: string;
  last_name: string;
  country?: string;
  preferred_currency?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string; role?: string }>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    country?: string;
    preferred_currency?: string;
  }) => Promise<{ ok: boolean; message?: string; role?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  checkAdminAccess: () => Promise<{ ok: boolean; data?: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('crm_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize and verify existing token on load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('crm_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await res.json();
        if (res.ok && data?.data?.user) {
          setUser(data.data.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem('crm_token');
          setToken(null);
          setUser(null);
        }
      } catch {
        localStorage.removeItem('crm_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data?.data?.token) {
        const receivedToken = data.data.token;
        const receivedUser = data.data.user;
        localStorage.setItem('crm_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        return { ok: true, role: receivedUser.role };
      } else {
        return { ok: false, message: data.message || 'Invalid credentials' };
      }
    } catch (err: any) {
      return { ok: false, message: err.message || 'Network error occurred' };
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    country?: string;
    preferred_currency?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data?.data?.token) {
        const receivedToken = data.data.token;
        const receivedUser = data.data.user;
        localStorage.setItem('crm_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        return { ok: true, role: receivedUser.role };
      } else {
        const msg = data.errors?.length
          ? data.errors.map((e: any) => e.message).join(', ')
          : data.message || 'Registration failed';
        return { ok: false, message: msg };
      }
    } catch (err: any) {
      return { ok: false, message: err.message || 'Network error occurred' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network logout errors
    } finally {
      localStorage.removeItem('crm_token');
      setToken(null);
      setUser(null);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      return {
        ok: res.ok,
        message: data.message || (res.ok ? 'Reset instructions sent.' : 'Failed to send reset link.'),
      };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Network error occurred' };
    }
  };

  const resetPassword = async (tokenStr: string, password: string) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenStr, password }),
      });
      const data = await res.json();
      return {
        ok: res.ok,
        message: data.message || (res.ok ? 'Password reset successfully. You can now login.' : 'Password reset failed.'),
      };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Network error occurred' };
    }
  };

  const checkAdminAccess = async () => {
    if (!token) return { ok: false, data: { message: 'Unauthenticated' } };
    try {
      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (err: any) {
      return { ok: false, data: { message: err.message } };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        checkAdminAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
