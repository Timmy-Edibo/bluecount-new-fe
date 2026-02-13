'use client';

import { useState } from 'react';

export interface AddProductFormValues {
  name: string;
  sku: string;
  price: string;
  description: string;
  initial_quantity: string;
}

interface AddProductModalProps {
  onSubmit: (values: AddProductFormValues) => Promise<void>;
  onDismiss: () => void;
}

export function AddProductModal({ onSubmit, onDismiss }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    const skuTrim = sku.trim();
    const priceNum = parseFloat(price);
    if (!nameTrim) {
      setError('Name is required.');
      return;
    }
    if (!skuTrim) {
      setError('SKU is required.');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Enter a valid price (0 or more).');
      return;
    }
    const qty = parseInt(initialQuantity, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setError('Initial quantity must be 0 or more.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: nameTrim,
        sku: skuTrim,
        price: String(priceNum),
        description: description.trim() || '',
        initial_quantity: String(qty),
      });
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Add product</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-product-name" className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <input
              id="add-product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cola 330ml"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="add-product-sku" className="block text-sm font-medium text-slate-300 mb-1">
              SKU *
            </label>
            <input
              id="add-product-sku"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-COLA-330"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="add-product-price" className="block text-sm font-medium text-slate-300 mb-1">
              Price *
            </label>
            <input
              id="add-product-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500"
              required
            />
          </div>
          <div>
            <label htmlFor="add-product-desc" className="block text-sm font-medium text-slate-300 mb-1">
              Description (optional)
            </label>
            <textarea
              id="add-product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              rows={2}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500 resize-none"
            />
          </div>
          <div>
            <label htmlFor="add-product-qty" className="block text-sm font-medium text-slate-300 mb-1">
              Initial quantity (this outlet)
            </label>
            <input
              id="add-product-qty"
              type="number"
              min="0"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
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
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
