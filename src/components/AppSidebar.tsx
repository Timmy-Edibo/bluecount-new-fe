'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useSyncManager } from '@/hooks/useSyncManager';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEVICE_KEY = 'bluecounts_device_id';

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

interface AppSidebarProps {
  onCloseSession?: () => void;
}

export function AppSidebar({ onCloseSession }: AppSidebarProps) {
  const pathname = usePathname();
  const auth = useAuth();
  const session = useSession();
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);

  const tenantId = auth.tenant?.id ?? '';
  const outletId = auth.outletId ?? '';
  const deviceId = getDeviceId();
  const enabled = !!tenantId && !!outletId;

  const {
    isOnline,
    syncState,
    lastError,
    pendingCount,
    sync,
    simulateOffline,
    setSimulateOffline,
  } = useSyncManager({
    tenantId,
    outletId,
    deviceId,
    enabled,
  });

  useEffect(() => {
    if (!auth.token || !auth.tenant || outlets.length > 0) return;
    fetch(`${API_BASE}/outlets`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('Failed to load outlets'))
      )
      .then((data) => setOutlets(data.outlets ?? []))
      .catch(() => {});
  }, [auth.token, auth.tenant, outlets.length]);

  const linkClass = (path: string) =>
    `block w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      pathname === path
        ? 'bg-slate-600 text-slate-100'
        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`;

  if (!auth.token) {
    return (
      <aside className="w-56 shrink-0 border-r border-slate-700 bg-slate-800/50 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link href="/" className="text-lg font-bold text-slate-100">
            Bluecounts
          </Link>
        </div>
        <nav className="p-3 flex-1">
          <Link
            href="/login"
            className="text-sky-400 hover:text-sky-300 text-sm font-medium"
          >
            Sign in
          </Link>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-slate-700 bg-slate-800/50 flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <Link href="/" className="text-lg font-bold text-slate-100">
          Bluecounts
        </Link>
        {auth.tenant && (
          <p className="text-slate-500 text-xs mt-1 truncate">
            {auth.tenant.name}
          </p>
        )}
      </div>

      <div className="p-3 space-y-2 border-b border-slate-700">
        {auth.user && (
          <p
            className="text-slate-400 text-sm truncate px-2"
            title={auth.user.email}
          >
            {auth.user.name || auth.user.email}
          </p>
        )}
        {outlets.length > 0 && (
          <select
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 text-sm"
            value={auth.outletId ?? ''}
            onChange={(e) => auth.setOutletId(e.target.value || null)}
            aria-label="Change outlet"
          >
            <option value="">Select outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="p-3 flex-1 flex flex-col gap-0.5">
        <Link href="/" className={linkClass('/')}>
          POS
        </Link>
        <Link href="/inventory" className={linkClass('/inventory')}>
          Inventory
        </Link>
        {(auth.role === 'OWNER' || auth.role === 'ADMIN') && (
          <Link href="/staff" className={linkClass('/staff')}>
            Staff
          </Link>
        )}
        {session.currentSession && onCloseSession && (
          <button
            type="button"
            onClick={onCloseSession}
            className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Close Session
          </button>
        )}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${
            isOnline
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {pendingCount > 0 && (
          <span className="block text-xs text-sky-400">{pendingCount} pending</span>
        )}
        {syncState !== 'idle' && (
          <span className="block text-xs text-slate-400">
            {syncState === 'pulling'
              ? 'Pulling…'
              : syncState === 'pushing'
                ? 'Pushing…'
                : 'Syncing…'}
          </span>
        )}
        <button
          type="button"
          onClick={sync}
          disabled={!isOnline || syncState === 'pulling' || syncState === 'pushing'}
          className="w-full rounded-lg bg-slate-600 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
        >
          Sync now
        </button>
        {process.env.NODE_ENV === 'development' && (
          <label className="flex items-center gap-2 text-slate-500 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={simulateOffline}
              onChange={(e) => setSimulateOffline(e.target.checked)}
              className="rounded border-slate-500 bg-slate-700 text-sky-500"
            />
            Simulate offline
          </label>
        )}
        {lastError && (
          <p className="text-xs text-red-400 truncate" title={lastError}>
            Sync error
          </p>
        )}
        <button
          type="button"
          onClick={() => auth.logout()}
          className="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
