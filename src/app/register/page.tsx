'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, businessName);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-6">
        <h1 className="text-xl font-bold text-slate-100 mb-4">Register your business</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              placeholder="Acme Inc"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-100"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-white font-medium hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create business'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          Already have an account? <Link href="/login" className="text-sky-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
