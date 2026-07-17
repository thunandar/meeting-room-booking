'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import type { User } from './types';

interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  session: Session | null;
  /** True until the persisted session has been read from localStorage. */
  loading: boolean;
  login: (userId: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'meeting-room-session';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored) as Session);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // The cached session can go stale (an admin may have changed this user's
  // role since login), so reconcile it with the server whenever a token
  // becomes active. A deleted user's 401 is handled globally in apiRequest.
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiRequest<{ user: User }>('/auth/me', { token })
      .then(({ user }) => {
        if (cancelled) return;
        setSession((current) => {
          if (!current || current.token !== token) return current;
          if (JSON.stringify(current.user) === JSON.stringify(user)) return current;
          const next = { ...current, user };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        // Network failure or 401 (auto-logout) — keep the cached session.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (userId: string) => {
    const { token, user } = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { userId },
    });
    const next = { token, user };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, loading, login, logout }), [session, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
