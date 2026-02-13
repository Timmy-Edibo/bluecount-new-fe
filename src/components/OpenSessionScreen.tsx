'use client';

import { useState } from 'react';

interface OpenSessionScreenProps {
  outletId: string;
  outletName?: string;
  onOpen: (openingBalance: number, deviceId?: string) => Promise<void>;
}

export function OpenSessionScreen({ outletId, outletName, onOpen }: OpenSessionScreenProps) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const balance = parseFloat(openingBalance);
    if (Number.isNaN(balance) || balance < 0) {
      setError('Enter a valid opening balance (0 or more).');
      return;
    }
    setSubmitting(true);
    try {
      await onOpen(balance, deviceId.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto rounded-xl bg-slate-800/50 border border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-slate-200 mb-2">Open Session</h2>
      {outletName && (
        <p className="text-slate-400 text-sm mb-4">Outlet: {outletName}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="opening_balance" className="block text-sm font-medium text-slate-300 mb-1">
            Opening balance (float) *
          </label>
          <input
            id="opening_balance"
            type="number"
            step="0.01"
            min="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label htmlFor="device_id" className="block text-sm font-medium text-slate-300 mb-1">
            Device (optional)
          </label>
          <input
            id="device_id"
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            placeholder="Register / device name"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Opening…' : 'Open Session'}
        </button>
      </form>
    </div>
  );
}
