'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  outlet_id: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  outlet_id: string | null;
  expires_at: string;
  created_at: string;
}

interface Outlet {
  id: string;
  name: string;
  address: string | null;
}

interface AccessEntry {
  user_id: string;
  email: string;
  name: string | null;
}

export default function StaffPage() {
  const auth = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [accessByOutlet, setAccessByOutlet] = useState<Record<string, AccessEntry[]>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER'>('CASHIER');
  const [inviteOutletId, setInviteOutletId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [addUserName, setAddUserName] = useState('');
  const [addUserRole, setAddUserRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER'>('CASHIER');
  const [addUserOutletId, setAddUserOutletId] = useState('');
  const [addUserSubmitting, setAddUserSubmitting] = useState(false);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [outletName, setOutletName] = useState('');
  const [outletAddress, setOutletAddress] = useState('');
  const [addOutletSubmitting, setAddOutletSubmitting] = useState(false);
  const [addOutletSuccess, setAddOutletSuccess] = useState<string | null>(null);

  const canManage = auth.role === 'OWNER' || auth.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!auth.token || !canManage) return;
    const headers: HeadersInit = { Authorization: `Bearer ${auth.token}` };
    try {
      const [membersRes, invitationsRes, outletsRes] = await Promise.all([
        fetch(`${API_BASE}/staff/members`, { headers }),
        fetch(`${API_BASE}/staff/invitations`, { headers }),
        fetch(`${API_BASE}/outlets`, { headers }),
      ]);
      if (membersRes.ok) {
        const d = await membersRes.json();
        setMembers(d.members ?? []);
      }
      if (invitationsRes.ok) {
        const d = await invitationsRes.json();
        setInvitations(d.invitations ?? []);
      }
      if (outletsRes.ok) {
        const d = await outletsRes.json();
        const list: Outlet[] = d.outlets ?? [];
        setOutlets(list);
        const access: Record<string, AccessEntry[]> = {};
        await Promise.all(
          list.map(async (o: Outlet) => {
            const r = await fetch(`${API_BASE}/outlets/${o.id}/access`, { headers });
            if (r.ok) {
              const data = await r.json();
              access[o.id] = data.access ?? [];
            } else {
              access[o.id] = [];
            }
          })
        );
        setAccessByOutlet(access);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [auth.token, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const assignToOutlet = useCallback(
    async (outletId: string, userId: string) => {
      if (!auth.token) return;
      setAssigning(`${outletId}-${userId}`);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/outlets/${outletId}/access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Assign failed');
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Assign failed');
      } finally {
        setAssigning(null);
      }
    },
    [auth.token, load]
  );

  const removeFromOutlet = useCallback(
    async (outletId: string, userId: string) => {
      if (!auth.token) return;
      setAssigning(`${outletId}-${userId}`);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/outlets/${outletId}/access/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Remove failed');
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Remove failed');
      } finally {
        setAssigning(null);
      }
    },
    [auth.token, load]
  );

  const inviteStaff = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setInviteSuccess(null);
      const email = inviteEmail.trim().toLowerCase();
      if (!email) {
        setError('Email is required.');
        return;
      }
      if (inviteRole === 'MANAGER' && !inviteOutletId) {
        setError('Outlet is required for Manager role.');
        return;
      }
      setInviting(true);
      try {
        const res = await fetch(`${API_BASE}/auth/invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            email,
            role: inviteRole,
            outletId: inviteRole === 'MANAGER' ? inviteOutletId : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Invite failed');
        }
        const data = await res.json();
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const inviteLink = data.invite_token
          ? `${base}/accept-invite?token=${encodeURIComponent(data.invite_token)}`
          : '';
        setInviteSuccess(`Invitation created for ${email}. Share the link below with them.`);
        setLastInviteLink(inviteLink || null);
        setInviteEmail('');
        setInviteRole('CASHIER');
        setInviteOutletId('');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invite failed');
      } finally {
        setInviting(false);
      }
    },
    [auth.token, inviteEmail, inviteRole, inviteOutletId, load]
  );

  const addUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setAddUserSuccess(null);
      const email = addUserEmail.trim();
      if (!email || !addUserPassword) {
        setError('Email and password are required.');
        return;
      }
      if (addUserRole === 'MANAGER' && !addUserOutletId) {
        setError('Outlet is required for Manager role.');
        return;
      }
      setAddUserSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/staff/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            email,
            password: addUserPassword,
            name: addUserName.trim() || undefined,
            role: addUserRole,
            outletId: addUserRole === 'MANAGER' ? addUserOutletId : undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Add user failed');
        }
        setAddUserSuccess('User added. They can sign in with that email and password.');
        setAddUserEmail('');
        setAddUserPassword('');
        setAddUserName('');
        setAddUserRole('CASHIER');
        setAddUserOutletId('');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Add user failed');
      } finally {
        setAddUserSubmitting(false);
      }
    },
    [auth.token, addUserEmail, addUserPassword, addUserName, addUserRole, addUserOutletId, load]
  );

  const addOutlet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setAddOutletSuccess(null);
      if (!outletName.trim()) {
        setError('Outlet name is required.');
        return;
      }
      setAddOutletSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/outlets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            name: outletName.trim(),
            address: outletAddress.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Add outlet failed');
        }
        setAddOutletSuccess('Outlet created.');
        setOutletName('');
        setOutletAddress('');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Add outlet failed');
      } finally {
        setAddOutletSubmitting(false);
      }
    },
    [auth.token, outletName, outletAddress, load]
  );

  if (!auth.token) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-400">Sign in to manage staff.</p>
        <Link href="/login" className="text-sky-400 hover:underline mt-2 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-400">Only Owner or Admin can access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="border-b border-slate-600 pb-4">
        <h1 className="text-2xl font-bold text-slate-100">Staff &amp; Outlet Access</h1>
      </header>

      {error && (
        <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      {inviteSuccess && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 space-y-2">
          <p>{inviteSuccess}</p>
          {lastInviteLink && (
            <input
              type="text"
              readOnly
              value={lastInviteLink}
              className="w-full rounded bg-slate-800/80 border border-slate-600 px-2 py-1.5 text-slate-300 text-xs font-mono"
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
      )}
      {addUserSuccess && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400">
          {addUserSuccess}
        </div>
      )}
      {addOutletSuccess && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400">
          {addOutletSuccess}
        </div>
      )}

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Add outlet</h2>
        <p className="text-slate-400 text-sm mb-4">
          Create a new outlet (e.g. a second location). You can then assign staff to it below.
        </p>
        <form onSubmit={addOutlet} className="flex flex-wrap items-end gap-3 max-w-md">
          <div>
            <label htmlFor="outlet-name" className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <input
              id="outlet-name"
              type="text"
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
              placeholder="e.g. Downtown Store"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="outlet-address" className="block text-sm font-medium text-slate-300 mb-1">
              Address (optional)
            </label>
            <input
              id="outlet-address"
              type="text"
              value={outletAddress}
              onChange={(e) => setOutletAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={addOutletSubmitting}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {addOutletSubmitting ? 'Creating…' : 'Add outlet'}
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Invite staff (by email)</h2>
        <p className="text-slate-400 text-sm mb-4">
          Send an invitation by email. Choose a role: Admin (full access), Manager (single outlet), or Cashier. After they accept, assign Cashiers to outlets below.
        </p>
        <form onSubmit={inviteStaff} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-300 mb-1">
              Email address *
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-300 mb-1">
              Role *
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MANAGER' | 'CASHIER')}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            >
              <option value="CASHIER">Cashier</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <p className="text-slate-500 text-xs mt-1">
              Cashier: POS and sessions. Manager: one outlet. Admin: all outlets and settings.
            </p>
          </div>
          {inviteRole === 'MANAGER' && (
            <div>
              <label htmlFor="invite-outlet" className="block text-sm font-medium text-slate-300 mb-1">
                Outlet (required for Manager) *
              </label>
              <select
                id="invite-outlet"
                value={inviteOutletId}
                onChange={(e) => setInviteOutletId(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
                required={inviteRole === 'MANAGER'}
              >
                <option value="">Select outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={inviting}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Add user (email + password)</h2>
        <p className="text-slate-400 text-sm mb-4">
          Create a user account directly with email and password. They can sign in immediately. For Manager, pick an outlet.
        </p>
        <form onSubmit={addUser} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="add-user-email" className="block text-sm font-medium text-slate-300 mb-1">
              Email *
            </label>
            <input
              id="add-user-email"
              type="email"
              value={addUserEmail}
              onChange={(e) => setAddUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="add-user-password" className="block text-sm font-medium text-slate-300 mb-1">
              Password *
            </label>
            <input
              id="add-user-password"
              type="password"
              value={addUserPassword}
              onChange={(e) => setAddUserPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="add-user-name" className="block text-sm font-medium text-slate-300 mb-1">
              Name (optional)
            </label>
            <input
              id="add-user-name"
              type="text"
              value={addUserName}
              onChange={(e) => setAddUserName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div>
            <label htmlFor="add-user-role" className="block text-sm font-medium text-slate-300 mb-1">
              Role *
            </label>
            <select
              id="add-user-role"
              value={addUserRole}
              onChange={(e) => setAddUserRole(e.target.value as 'ADMIN' | 'MANAGER' | 'CASHIER')}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            >
              <option value="CASHIER">Cashier</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {addUserRole === 'MANAGER' && (
            <div>
              <label htmlFor="add-user-outlet" className="block text-sm font-medium text-slate-300 mb-1">
                Outlet (required for Manager) *
              </label>
              <select
                id="add-user-outlet"
                value={addUserOutletId}
                onChange={(e) => setAddUserOutletId(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
                required={addUserRole === 'MANAGER'}
              >
                <option value="">Select outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={addUserSubmitting}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {addUserSubmitting ? 'Adding…' : 'Add user'}
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Team members</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{m.email}</span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Pending invitations</h2>
        <ul className="space-y-2">
          {invitations.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{i.email}</span>
              <span className="text-slate-500">{i.role}</span>
            </li>
          ))}
          {invitations.length === 0 && (
            <p className="text-slate-500 text-sm">No pending invitations.</p>
          )}
        </ul>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Outlet access</h2>
        <p className="text-slate-400 text-sm mb-4">
          Assign team members to outlets. Owner and Admin have access to all outlets.
        </p>
        <div className="space-y-4">
          {outlets.map((outlet) => (
            <div key={outlet.id} className="border border-slate-600 rounded-lg p-3">
              <h3 className="font-medium text-slate-200 mb-2">{outlet.name}</h3>
              <ul className="space-y-1 mb-3">
                {(accessByOutlet[outlet.id] ?? []).map((a) => (
                  <li key={a.user_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{a.email}</span>
                    <button
                      type="button"
                      onClick={() => removeFromOutlet(outlet.id, a.user_id)}
                      disabled={assigning !== null}
                      className="text-red-400 hover:underline text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 text-sm">Add:</span>
                {members
                  .filter((m) => m.role !== 'OWNER' && m.role !== 'ADMIN')
                  .filter((m) => !(accessByOutlet[outlet.id] ?? []).some((a) => a.user_id === m.user_id))
                  .map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => assignToOutlet(outlet.id, m.user_id)}
                      disabled={assigning !== null}
                      className="rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                      {m.email}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
