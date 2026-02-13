'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';

interface CloseSessionModalProps {
  sessionId: string;
  openingBalance: number;
  onClose: (closingBalance: number) => Promise<{ variance?: number } | void>;
  onDismiss: () => void;
}

export function CloseSessionModal({
  sessionId,
  openingBalance,
  onClose,
  onDismiss,
}: CloseSessionModalProps) {
  const [closingBalance, setClosingBalance] = useState('');
  const [expectedBalance, setExpectedBalance] = useState<number>(openingBalance);
  const [variance, setVariance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    db.sales
      .where('session_id')
      .equals(sessionId)
      .toArray()
      .then((sales) => {
        if (cancelled) return;
        const sum = sales.reduce((a, s) => a + s.total_amount, 0);
        setExpectedBalance(openingBalance + sum);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, openingBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const balance = parseFloat(closingBalance);
    if (Number.isNaN(balance) || balance < 0) {
      setError('Enter a valid closing balance (0 or more).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onClose(balance);
      if (result?.variance != null) setVariance(result.variance);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close session');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold text-slate-200 mb-2">Session closed</h3>
          {variance != null && (
            <p className={`text-sm mb-4 ${variance === 0 ? 'text-slate-400' : 'text-amber-400'}`}>
              Variance: {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
            </p>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Close Session</h3>
        <p className="text-slate-400 text-sm mb-2">Opening balance: ${openingBalance.toFixed(2)}</p>
        <p className="text-slate-400 text-sm mb-4">Expected (opening + sales): ${expectedBalance.toFixed(2)}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="closing_balance" className="block text-sm font-medium text-slate-300 mb-1">
              Actual cash count *
            </label>
            <input
              id="closing_balance"
              type="number"
              step="0.01"
              min="0"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
              placeholder="0.00"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {submitting ? 'Closing…' : 'Close Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
