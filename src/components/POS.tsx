"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useSyncManager } from "@/hooks/useSyncManager";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { OpenSessionScreen } from "@/components/OpenSessionScreen";
import {
  AddProductModal,
  type AddProductFormValues,
} from "@/components/AddProductModal";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const DEMO_OUTLET = "00000000-0000-0000-0000-000000000002";
const DEMO_DEVICE = "00000000-0000-0000-0000-000000000003";
const DEVICE_KEY = "bluecounts_device_id";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getDeviceId(): string {
  if (typeof window === "undefined") return DEMO_DEVICE;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function POS() {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deviceId] = useState(() => getDeviceId());
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const LOW_STOCK_THRESHOLD = 5;

  const auth = useAuth();
  const session = useSession();
  const tenantId = auth.tenant?.id ?? DEMO_TENANT;
  const outletId = auth.tenant ? (auth.outletId ?? "") : DEMO_OUTLET;
  const enabled = !!tenantId && !!outletId;
  const sessionRequired = !!auth.tenant && !!auth.outletId;
  const showOpenSession =
    sessionRequired && !session.loading && !session.currentSession;

  useEffect(() => {
    if (!auth.token || !auth.tenant || outlets.length > 0) return;
    fetch(`${API_BASE}/outlets`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Failed to load outlets")),
      )
      .then((data) => setOutlets(data.outlets ?? []))
      .catch(() => {});
  }, [auth.token, auth.tenant, outlets.length]);

  const { lastError } = useSyncManager({
    tenantId,
    outletId,
    deviceId,
    enabled,
  });

  const products = useLiveQuery(
    () =>
      db.products
        .where("tenant_id")
        .equals(tenantId)
        .filter((p) => p.deleted_at == null)
        .toArray(),
    [tenantId],
  );

  const inventory = useLiveQuery(
    () =>
      db.inventory
        .where("[tenant_id+outlet_id]")
        .equals([tenantId, outletId])
        .filter((i) => i.deleted_at == null)
        .toArray(),
    [tenantId, outletId],
  );

  const getQty = useCallback(
    (productId: string) => {
      const forProduct =
        inventory?.filter((i) => i.product_id === productId) ?? [];
      const inv =
        forProduct.length === 0
          ? null
          : forProduct.reduce((a, b) => (a.version_id > b.version_id ? a : b));
      const qty = inv?.quantity ?? 0;
      return Math.max(0, qty);
    },
    [inventory],
  );

  const addToCart = useCallback((productId: string) => {
    setSelectedProductIds((prev) => [...prev, productId]);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const i = prev.indexOf(productId);
      if (i === -1) return prev;
      const next = [...prev];
      next.splice(i, 1);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setSelectedProductIds([]), []);

  const checkout = useCallback(async () => {
    if (!products?.length || selectedProductIds.length === 0) return;
    if (sessionRequired && !session.currentSession) return;
    const deviceTransactionId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const lines: {
      product_id: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[] = [];
    let totalAmount = 0;
    const countByProduct: Record<string, number> = {};
    for (const id of selectedProductIds) {
      countByProduct[id] = (countByProduct[id] || 0) + 1;
    }
    for (const [productId, qty] of Object.entries(countByProduct)) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;
      const unitPrice = product.price;
      const lineTotal = unitPrice * qty;
      totalAmount += lineTotal;
      lines.push({
        product_id: productId,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
    }
    const queueId = crypto.randomUUID();
    const salePayload: Record<string, unknown> = {
      device_transaction_id: deviceTransactionId,
      total_amount: totalAmount,
      items: lines,
    };
    if (session.currentSession)
      salePayload.session_id = session.currentSession.id;
    await db.sync_queue.add({
      id: queueId,
      action_type: "SALE",
      payload: salePayload,
      timestamp: Date.now(),
      status: "pending",
    });
    const saleId = crypto.randomUUID();
    const versionId = 0;
    await db.sales.add({
      id: saleId,
      tenant_id: tenantId,
      outlet_id: outletId,
      device_id: deviceId,
      session_id: session.currentSession?.id ?? null,
      device_transaction_id: deviceTransactionId,
      total_amount: totalAmount,
      version_id: versionId,
      created_at: new Date().toISOString(),
    });
    for (const line of lines) {
      await db.sale_items.add({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        outlet_id: outletId,
        sale_id: saleId,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
        version_id: versionId,
      });
      const inv = inventory?.find((i) => i.product_id === line.product_id);
      if (inv) {
        await db.inventory.update(inv.id, {
          quantity: inv.quantity - line.quantity,
        });
      }
    }
    clearCart();
  }, [
    products,
    selectedProductIds,
    inventory,
    clearCart,
    tenantId,
    outletId,
    deviceId,
    sessionRequired,
    session.currentSession,
  ]);

  const addProduct = useCallback(
    async (values: AddProductFormValues) => {
      const id = crypto.randomUUID();
      const { name, sku, price, description, initial_quantity } = values;
      const priceNum = parseFloat(price);
      const qty = parseInt(initial_quantity, 10) || 0;

      const existingProduct = await db.products.get(id);
      if (!existingProduct) {
        await db.products.add({
          id,
          tenant_id: tenantId,
          sku,
          name,
          description: description || null,
          price: priceNum,
          version_id: 0,
        });
      }
      const invKey = [tenantId, outletId, id] as [string, string, string];
      const existingInv = await db.inventory
        .where("[tenant_id+outlet_id+product_id]")
        .equals(invKey)
        .first();
      if (!existingInv) {
        await db.inventory.add({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          outlet_id: outletId,
          product_id: id,
          quantity: qty,
          version_id: 0,
        });
      } else {
        await db.inventory.update(existingInv.id, {
          quantity: existingInv.quantity + qty,
        });
      }

      await db.sync_queue.add({
        id: crypto.randomUUID(),
        action_type: "ADD_PRODUCT",
        payload: { id, sku, name, price: priceNum, initial_quantity: qty },
        timestamp: Date.now(),
        status: "pending",
      });
    },
    [tenantId, outletId],
  );

  const filteredProducts = (products ?? []).filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const cartCount = selectedProductIds.length;
  const cartTotal =
    products?.reduce((sum, p) => {
      const qty = selectedProductIds.filter((id) => id === p.id).length;
      return sum + p.price * qty;
    }, 0) ?? 0;

  if (showOpenSession) {
    const outletName = outlets.find((o) => o.id === outletId)?.name;
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-slate-600 pb-4">
          <h1 className="text-2xl font-bold text-slate-100">Bluecounts POS</h1>
          {auth.tenant && (
            <span className="text-slate-400 text-sm">{auth.tenant.name}</span>
          )}
        </header>
        <p className="text-slate-400 text-sm -mt-2">
          No register open for <strong className="text-slate-300">{outletName || "this outlet"}</strong>. Open a session to start selling.
        </p>
        <OpenSessionScreen
          outletId={outletId}
          outletName={outletName}
          onOpen={async (openingBalance, deviceIdOpt) => {
            await session.openSession(outletId, openingBalance, deviceIdOpt);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {showAddProductModal && (
        <AddProductModal
          onSubmit={addProduct}
          onDismiss={() => setShowAddProductModal(false)}
        />
      )}
      <header className="border-b border-slate-600 pb-4">
        <h1 className="text-2xl font-bold text-slate-100">Bluecounts POS</h1>
        {auth.tenant && (
          <span className="text-slate-400 text-sm">{auth.tenant.name}</span>
        )}
      </header>

      {lastError && (
        <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-2 text-sm text-red-400">
          {lastError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-200">Products</h2>
            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              + Add product
            </button>
          </div>
          <input
            type="search"
            placeholder="Search by name, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm mb-3"
            aria-label="Search products"
          />
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const qty = getQty(p.id);
              const inCart = selectedProductIds.filter(
                (id) => id === p.id,
              ).length;
              const isOutOfStock = qty <= 0;
              const isLowStock = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
              const stockClass = isOutOfStock
                ? "border-red-500/60 bg-red-500/10"
                : isLowStock
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-slate-600 bg-slate-800";
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border p-3 flex flex-col ${stockClass}`}
                >
                  <span className="font-medium text-slate-200 truncate">
                    {p.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    ${p.price.toFixed(2)}
                  </span>
                  <span
                    className={`text-xs mt-1 ${
                      isOutOfStock
                        ? "text-red-400 font-medium"
                        : isLowStock
                          ? "text-amber-400"
                          : "text-slate-500"
                    }`}
                  >
                    Stock: {qty}
                    {isLowStock && !isOutOfStock && " (low)"}
                    {isOutOfStock && " (out)"}
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    {inCart > 0 && (
                      <button
                        type="button"
                        onClick={() => removeFromCart(p.id)}
                        className="rounded bg-slate-600 px-2 py-1 text-xs text-white"
                      >
                        −
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => addToCart(p.id)}
                      disabled={qty <= inCart}
                      className="rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                      + Add
                    </button>
                    {inCart > 0 && (
                      <span className="text-xs text-sky-400">×{inCart}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {(!products || products.length === 0) && (
            <p className="text-slate-500 text-sm py-4">
              No products. Add a product to start.
            </p>
          )}
          {products && products.length > 0 && filteredProducts.length === 0 && (
            <p className="text-slate-500 text-sm py-4">
              No products match &quot;{searchQuery.trim()}&quot;.
            </p>
          )}
        </section>

        <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Cart</h2>
          {cartCount === 0 ? (
            <p className="text-slate-500 text-sm">Cart is empty.</p>
          ) : (
            <>
              <ul className="space-y-2 mb-4">
                {Object.entries(
                  selectedProductIds.reduce<Record<string, number>>(
                    (acc, id) => {
                      acc[id] = (acc[id] || 0) + 1;
                      return acc;
                    },
                    {},
                  ),
                ).map(([id, count]) => {
                  const product = products?.find((p) => p.id === id);
                  return product ? (
                    <li key={id} className="flex justify-between text-sm">
                      <span className="text-slate-300">
                        {product.name} × {count}
                      </span>
                      <span className="text-slate-200">
                        ${(product.price * count).toFixed(2)}
                      </span>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="flex justify-between font-semibold text-slate-100 border-t border-slate-600 pt-2">
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={checkout}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Checkout
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
