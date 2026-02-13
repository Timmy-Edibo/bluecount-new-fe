'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthToken } from '@/contexts/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CurrentSession {
  id: string;
  openingBalance: number;
  outletId: string;
}

interface SessionContextValue {
  currentSession: CurrentSession | null;
  loading: boolean;
  openSession: (outletId: string, openingBalance: number, deviceId?: string) => Promise<void>;
  closeSession: (sessionId: string, closingBalance: number) => Promise<{ variance: number } | void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = auth.tenant?.id ?? '';
  const outletId = auth.outletId ?? '';
  const userId = auth.user?.id ?? '';
  const deviceId = typeof window !== 'undefined' ? localStorage.getItem('bluecounts_device_id') ?? '' : '';

  const refreshSession = useCallback(async () => {
    if (!tenantId || !outletId) {
      setCurrentSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = getAuthToken();
      if (token) {
        const res = await fetch(
          `${API_BASE}/sessions?outlet_id=${encodeURIComponent(outletId)}&status=open`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const open = data.sessions?.find((s: { status: string }) => s.status === 'open');
          if (open) {
            setCurrentSession({
              id: open.id,
              openingBalance: open.opening_balance,
              outletId: open.outlet_id,
            });
            setLoading(false);
            return;
          }
        }
      }
      const local = await db.pos_sessions
        .where('[outlet_id+status]')
        .equals([outletId, 'open'])
        .first();
      if (local) {
        setCurrentSession({
          id: local.id,
          openingBalance: local.opening_balance,
          outletId: local.outlet_id,
        });
      } else {
        setCurrentSession(null);
      }
    } catch {
      const local = await db.pos_sessions
        .where('[outlet_id+status]')
        .equals([outletId, 'open'])
        .first();
      if (local) {
        setCurrentSession({
          id: local.id,
          openingBalance: local.opening_balance,
          outletId: local.outlet_id,
        });
      } else {
        setCurrentSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, outletId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const openSession = useCallback(
    async (outletIdArg: string, openingBalance: number, deviceIdArg?: string) => {
      const devId = deviceIdArg || deviceId;
      const token = getAuthToken();
      const sessionId = crypto.randomUUID();
      const openedAt = new Date().toISOString();

      if (token) {
        try {
          const res = await fetch(`${API_BASE}/sessions/open`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              outlet_id: outletIdArg,
              device_id: devId || undefined,
              opening_balance: openingBalance,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const sid = data.session_id;
            setCurrentSession({
              id: sid,
              openingBalance: data.opening_balance ?? openingBalance,
              outletId: outletIdArg,
            });
            await db.pos_sessions.put({
              id: sid,
              tenant_id: tenantId,
              outlet_id: outletIdArg,
              user_id: userId,
              device_id: devId || null,
              opening_balance: data.opening_balance ?? openingBalance,
              status: 'open',
              opened_at: new Date().toISOString(),
              version_id: data.version_id ?? 0,
            });
            return;
          }
        } catch {
          // fall through to offline path
        }
      }

      await db.sync_queue.add({
        id: crypto.randomUUID(),
        action_type: 'OPEN_SESSION',
        payload: {
          id: sessionId,
          outlet_id: outletIdArg,
          device_id: devId || undefined,
          opening_balance: openingBalance,
          opened_at: openedAt,
          user_id: userId,
        },
        timestamp: Date.now(),
        status: 'pending',
      });
      await db.pos_sessions.put({
        id: sessionId,
        tenant_id: tenantId,
        outlet_id: outletIdArg,
        user_id: userId,
        device_id: devId || null,
        opening_balance: openingBalance,
        status: 'open',
        opened_at: openedAt,
        version_id: 0,
      });
      setCurrentSession({ id: sessionId, openingBalance, outletId: outletIdArg });
    },
    [tenantId, userId, deviceId]
  );

  const closeSession = useCallback(
    async (sessionId: string, closingBalance: number) => {
      const token = getAuthToken();
      const closedAt = new Date().toISOString();

      if (token) {
        try {
          const res = await fetch(`${API_BASE}/sessions/${sessionId}/close`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ closing_balance: closingBalance }),
          });
          if (res.ok) {
            const data = await res.json();
            await db.pos_sessions.update(sessionId, {
              closing_balance: closingBalance,
              expected_balance: data.expected_balance ?? null,
              status: 'closed',
              closed_at: closedAt,
              version_id: data.version_id ?? 0,
            });
            setCurrentSession(null);
            return { variance: data.variance ?? 0 };
          }
        } catch {
          // fall through to offline path
        }
      }

      await db.sync_queue.add({
        id: crypto.randomUUID(),
        action_type: 'CLOSE_SESSION',
        payload: {
          session_id: sessionId,
          closing_balance: closingBalance,
          closed_at: closedAt,
        },
        timestamp: Date.now(),
        status: 'pending',
      });
      const session = await db.pos_sessions.get(sessionId);
      const salesSum = await db.sales
        .where('session_id')
        .equals(sessionId)
        .toArray();
      const sum = salesSum.reduce((a, s) => a + s.total_amount, 0);
      const expectedBalance = (session?.opening_balance ?? 0) + sum;
      await db.pos_sessions.update(sessionId, {
        closing_balance: closingBalance,
        expected_balance: expectedBalance,
        status: 'closed',
        closed_at: closedAt,
      });
      setCurrentSession(null);
      const variance = closingBalance - expectedBalance;
      return { variance };
    },
    []
  );

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        loading,
        openSession,
        closeSession,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
