'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncManager } from '@/hooks/useSyncManager';

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

export default function InventoryPage() {
  const auth = useAuth();
  const tenantId = auth.tenant?.id ?? '';
  const outletId = auth.outletId ?? '';
  const deviceId = getDeviceId();
  const [productId, setProductId] = useState('');
  const [quantityChange, setQuantityChange] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useSyncManager({
    tenantId,
    outletId,
    deviceId,
    enabled: !!tenantId && !!outletId,
  });

  const products = useLiveQuery(
    () =>
      db.products
        .where('tenant_id')
        .equals(tenantId)
        .filter((p) => p.deleted_at == null)
        .toArray(),
    [tenantId]
  );

  const inventory = useLiveQuery(
    () =>
      db.inventory
        .where('[tenant_id+outlet_id]')
        .equals([tenantId, outletId])
        .filter((i) => i.deleted_at == null)
        .toArray(),
    [tenantId, outletId]
  );

  const getQty = useCallback(
    (pid: string) => {
      const forProduct = inventory?.filter((i) => i.product_id === pid) ?? [];
      const inv =
        forProduct.length === 0
          ? null
          : forProduct.reduce((a, b) => (a.version_id > b.version_id ? a : b));
      return inv?.quantity ?? 0;
    },
    [inventory]
  );

  const handleAdjust = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);
      const change = parseInt(quantityChange, 10);
      if (!productId || Number.isNaN(change) || change === 0) {
        setMessage('Select a product and enter a non-zero quantity change.');
        return;
      }
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        action_type: 'ADJUST_STOCK',
        payload: { product_id: productId, quantity_change: change },
        timestamp: Date.now(),
        status: 'pending',
      });
      setQuantityChange('');
      setProductId('');
      setMessage('Adjustment queued. It will sync when online.');
    },
    [productId, quantityChange]
  );

  if (!auth.token) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-400">Sign in to manage inventory.</p>
        <Link href="/login" className="text-sky-400 hover:underline mt-2 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  if (!outletId) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-400">Select an outlet in the sidebar to view and adjust inventory.</p>
      </div>
    );
  }

  const productList = products ?? [];
  const inventoryByProduct = productList.map((p) => ({
    product: p,
    quantity: getQty(p.id),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="border-b border-slate-600 pb-4">
        <h1 className="text-2xl font-bold text-slate-100">Inventory</h1>
      </header>

      {message && (
        <div className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-4 py-2 text-sm text-sky-400">
          {message}
        </div>
      )}

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Adjust stock</h2>
        <p className="text-slate-400 text-sm mb-4">
          Changes are queued and synced when online. Use a positive value to add, negative to remove.
        </p>
        <form onSubmit={handleAdjust} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="product" className="block text-sm text-slate-400 mb-1">
              Product
            </label>
            <select
              id="product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            >
              <option value="">Select</option>
              {productList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (current: {getQty(p.id)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qty_change" className="block text-sm text-slate-400 mb-1">
              Quantity change
            </label>
            <input
              id="qty_change"
              type="number"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              placeholder="+10 or -5"
              className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 w-32"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Current stock</h2>
        <ul className="space-y-2">
          {inventoryByProduct.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between text-sm">
              <span className="text-slate-300">{product.name}</span>
              <span className="text-slate-200 font-medium">{quantity}</span>
            </li>
          ))}
          {inventoryByProduct.length === 0 && (
            <p className="text-slate-500 text-sm">No products for this outlet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
