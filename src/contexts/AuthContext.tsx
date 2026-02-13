'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const STORAGE_KEY = 'bluecounts_auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthTenant {
  id: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  role: string;
  outletId: string | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, businessName: string) => Promise<void>;
  logout: () => void;
  setOutletId: (outletId: string | null) => void;
  setAuth: (state: AuthState) => void;
}

const defaultState: AuthState = {
  user: null,
  tenant: null,
  role: '',
  outletId: null,
  token: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): AuthState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const data = JSON.parse(raw);
    if (data?.token && data?.tenant?.id) {
      return {
        user: data.user ?? null,
        tenant: data.tenant ?? null,
        role: data.role ?? '',
        outletId: data.outletId ?? null,
        token: data.token,
      };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

function saveStored(state: AuthState) {
  if (typeof window === 'undefined') return;
  if (state.token && state.tenant) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);

  useEffect(() => {
    setState(loadStored());
  }, []);

  const setAuth = useCallback((next: AuthState) => {
    setState(next);
    saveStored(next);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setAuth({
      user: data.user,
      tenant: data.tenant,
      role: data.role,
      outletId: data.outletId ?? null,
      token: data.token,
    });
  }, [setAuth]);

  const register = useCallback(async (email: string, password: string, businessName: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, businessName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    setAuth({
      user: data.user,
      tenant: data.tenant,
      role: data.role,
      outletId: null,
      token: data.token,
    });
  }, [setAuth]);

  const logout = useCallback(() => {
    setAuth(defaultState);
  }, [setAuth]);

  const setOutletId = useCallback((outletId: string | null) => {
    setState((prev) => {
      const next = { ...prev, outletId };
      saveStored(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        setOutletId,
        setAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.token ?? null;
  } catch {
    return null;
  }
}
