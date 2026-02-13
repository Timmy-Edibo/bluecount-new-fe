'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, name: name.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      setAuth({
        user: data.user,
        tenant: data.tenant,
        role: data.role,
        outletId: data.outletId ?? null,
        token: data.token,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-6">
        <h1 className="text-xl font-bold text-slate-100 mb-4">Accept invitation</h1>
        <p className="text-slate-400 text-sm mb-4">
          This invite link is invalid or missing. Ask your admin to send a new one.
        </p>
        <Link href="/login" className="text-sky-400 hover:underline text-sm">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-4">Accept invitation</h1>
      <p className="text-slate-400 text-sm mb-4">
        Set a password to join the business. You’ll be signed in after.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 px-4 py-2 text-white font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? 'Joining…' : 'Join and sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        <Link href="/login" className="text-sky-400 hover:underline">Sign in</Link> if you already have an account
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}
