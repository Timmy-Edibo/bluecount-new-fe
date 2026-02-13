'use client';

/**
 * useSyncManager - The Heart of Offline-First Sync.
 * - Listens to navigator.onLine; on reconnection runs pull then push.
 * - Pull: GET /sync/pull?tenant_id=&max_version_id= → apply delta to Dexie (server wins for products).
 * - Push: POST /sync with SyncQueue items → server processes in transaction, returns version_id.
 */

import { useCallback, useEffect, useState } from 'react';
import { db, type SyncQueueRecord } from '@/lib/db';
import { getAuthToken } from '@/contexts/AuthContext';

const SYNC_META_KEY_MAX_VERSION = 'local_max_version_id';
const SIMULATE_OFFLINE_KEY = 'bluecounts_simulate_offline';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getSimulateOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIMULATE_OFFLINE_KEY) === '1';
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (h as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return h;
}

type SyncState = 'idle' | 'pulling' | 'pushing' | 'error';

export interface UseSyncManagerOptions {
  tenantId: string;
  outletId: string;
  deviceId: string;
  enabled?: boolean;
}

export function useSyncManager({ tenantId, outletId, deviceId, enabled = true }: UseSyncManagerOptions) {
  const [simulateOffline, setSimulateOfflineState] = useState(
    () => typeof window !== 'undefined' && getSimulateOffline()
  );
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );
  const isOnline = navigatorOnline && !simulateOffline;

  const setSimulateOffline = useCallback((value: boolean) => {
    if (typeof window === 'undefined') return;
    if (value) localStorage.setItem(SIMULATE_OFFLINE_KEY, '1');
    else localStorage.removeItem(SIMULATE_OFFLINE_KEY);
    setSimulateOfflineState(value);
  }, []);

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const getMaxVersion = useCallback(async (): Promise<number> => {
    const row = await db.sync_meta.get(SYNC_META_KEY_MAX_VERSION);
    const v = row?.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseInt(v, 10) || 0;
    return 0;
  }, []);

  const setMaxVersion = useCallback(async (version: number) => {
    await db.sync_meta.put({ key: SYNC_META_KEY_MAX_VERSION, value: version });
  }, []);

  const pull = useCallback(
    async (forceFullSync = false) => {
      if (!tenantId) return;
      setSyncState('pulling');
      setLastError(null);
      try {
        let maxVer = await getMaxVersion();
        if (forceFullSync) {
          maxVer = 0;
        } else {
          const hasLocalData = await db.products.where('tenant_id').equals(tenantId).count();
          if (hasLocalData === 0) {
            maxVer = 0;
          }
        }
        const url = `${API_BASE}/sync/pull?tenant_id=${encodeURIComponent(tenantId)}&max_version_id=${maxVer}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const data = await res.json();
      const { tables, server_max_version_id } = data;

      if (tables.products?.length) {
        for (const row of tables.products) {
          if (row.deleted_at) {
            await db.products.update(row.id, { deleted_at: row.deleted_at, version_id: row.version_id });
          } else {
            await db.products.put({
              id: row.id,
              tenant_id: row.tenant_id,
              sku: row.sku,
              name: row.name,
              description: row.description ?? null,
              price: Number(row.price),
              version_id: row.version_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
              deleted_at: row.deleted_at ?? null,
            });
          }
        }
      }
      if (tables.inventory?.length) {
        for (const row of tables.inventory) {
          const productKey = [row.tenant_id, row.outlet_id, row.product_id] as [string, string, string];
          const existing = await db.inventory.where('[tenant_id+outlet_id+product_id]').equals(productKey).toArray();
          for (const e of existing) {
            if (e.id !== row.id) await db.inventory.delete(e.id);
          }
          if (row.deleted_at) {
            await db.inventory.update(row.id, { deleted_at: row.deleted_at, version_id: row.version_id });
          } else {
            await db.inventory.put({
              id: row.id,
              tenant_id: row.tenant_id,
              outlet_id: row.outlet_id,
              product_id: row.product_id,
              quantity: Number(row.quantity),
              version_id: row.version_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
              deleted_at: row.deleted_at ?? null,
            });
          }
        }
      }
      if (tables.sales?.length) {
        for (const row of tables.sales) {
          if (row.deleted_at) {
            await db.sales.update(row.id, { deleted_at: row.deleted_at, version_id: row.version_id });
          } else {
            await db.sales.put({
              id: row.id,
              tenant_id: row.tenant_id,
              outlet_id: row.outlet_id,
              device_id: row.device_id,
              session_id: row.session_id ?? null,
              device_transaction_id: row.device_transaction_id,
              total_amount: Number(row.total_amount),
              version_id: row.version_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
              deleted_at: row.deleted_at ?? null,
            });
          }
        }
      }
      if (tables.sale_items?.length) {
        for (const row of tables.sale_items) {
          if (row.deleted_at) {
            await db.sale_items.update(row.id, { deleted_at: row.deleted_at, version_id: row.version_id });
          } else {
            await db.sale_items.put({
              id: row.id,
              tenant_id: row.tenant_id,
              outlet_id: row.outlet_id,
              sale_id: row.sale_id,
              product_id: row.product_id,
              quantity: row.quantity,
              unit_price: Number(row.unit_price),
              line_total: Number(row.line_total),
              version_id: row.version_id,
              created_at: row.created_at,
              deleted_at: row.deleted_at ?? null,
            });
          }
        }
      }
      if (tables.pos_sessions?.length) {
        for (const row of tables.pos_sessions) {
          if (row.deleted_at) {
            await db.pos_sessions.update(row.id, { deleted_at: row.deleted_at, version_id: row.version_id });
          } else {
            await db.pos_sessions.put({
              id: row.id,
              tenant_id: row.tenant_id,
              outlet_id: row.outlet_id,
              user_id: row.user_id,
              device_id: row.device_id ?? null,
              opening_balance: Number(row.opening_balance),
              closing_balance: row.closing_balance != null ? Number(row.closing_balance) : null,
              expected_balance: row.expected_balance != null ? Number(row.expected_balance) : null,
              status: row.status === 'closed' ? 'closed' : 'open',
              opened_at: row.opened_at,
              closed_at: row.closed_at ?? null,
              version_id: row.version_id,
              deleted_at: row.deleted_at ?? null,
            });
          }
        }
      }

      if (typeof server_max_version_id === 'number') {
        await setMaxVersion(server_max_version_id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pull failed';
      setLastError(msg);
      setSyncState('error');
      return;
    }
    setSyncState('idle');
  },
    [tenantId, outletId, getMaxVersion, setMaxVersion]
  );

  const push = useCallback(async () => {
    if (!tenantId || !outletId || !deviceId) return;
    const pending = await db.sync_queue.where('status').equals('pending').toArray();
    if (pending.length === 0) {
      setPendingCount(0);
      return;
    }
    setSyncState('pushing');
    setLastError(null);
    try {
      const items = pending.map((q: SyncQueueRecord) => ({
        id: q.id,
        action_type: q.action_type,
        payload: q.payload,
      }));
      const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          tenant_id: tenantId,
          outlet_id: outletId,
          device_id: deviceId,
          items,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Push failed: ${res.status}`);
      }
      const data = await res.json();
      if (data.version_id != null) await setMaxVersion(data.version_id);
      for (const r of data.results || []) {
        if (r.status === 'accepted' || r.status === 'synced') {
          await db.sync_queue.update(r.queue_id, { status: 'synced' });
        } else if (r.status === 'failed') {
          await db.sync_queue.update(r.queue_id, { status: 'failed', error_message: r.error });
        }
      }
      const stillPending = await db.sync_queue.where('status').equals('pending').count();
      setPendingCount(stillPending);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Push failed';
      setLastError(msg);
      setSyncState('error');
      return;
    }
    setSyncState('idle');
    const stillPending = await db.sync_queue.where('status').equals('pending').count();
    setPendingCount(stillPending);
  }, [tenantId, outletId, deviceId, setMaxVersion]);

  const sync = useCallback(async () => {
    if (!enabled) return;
    await pull(true);
    await push();
    await pull(true);
  }, [enabled, pull, push]);

  // When online (and not simulating offline), do a full pull on page load.
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled || !tenantId || !isOnline) return;
    pull(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, enabled, isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setNavigatorOnline(true);
      if (!getSimulateOffline() && enabled && tenantId) sync();
    };
    const handleOffline = () => setNavigatorOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, tenantId, sync]);

  useEffect(() => {
    let cancelled = false;
    db.sync_queue.where('status').equals('pending').count().then((c) => {
      if (!cancelled) setPendingCount(c);
    });
    const interval = setInterval(() => {
      db.sync_queue.where('status').equals('pending').count().then((c) => {
        if (!cancelled) setPendingCount(c);
      });
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    syncState,
    lastError,
    pendingCount,
    sync,
    pull,
    push,
    simulateOffline,
    setSimulateOffline,
  };
}
