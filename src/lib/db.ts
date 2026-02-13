/**
 * Dexie.js - Local-First source of truth.
 * All UI writes go here first; sync engine pushes to server when online.
 */

import Dexie, { type EntityTable } from 'dexie';

export interface ProductRecord {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  version_id: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface InventoryRecord {
  id: string;
  tenant_id: string;
  outlet_id: string;
  product_id: string;
  quantity: number;
  version_id: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface SaleRecord {
  id: string;
  tenant_id: string;
  outlet_id: string;
  device_id: string;
  session_id?: string | null;
  device_transaction_id: string;
  total_amount: number;
  version_id: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PosSessionRecord {
  id: string;
  tenant_id: string;
  outlet_id: string;
  user_id: string;
  device_id?: string | null;
  opening_balance: number;
  closing_balance?: number | null;
  expected_balance?: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  version_id: number;
  deleted_at?: string | null;
}

export interface SaleItemRecord {
  id: string;
  tenant_id: string;
  outlet_id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  version_id: number;
  created_at?: string;
  deleted_at?: string | null;
}

export type SyncActionType = 'SALE' | 'ADJUST_STOCK' | 'ADD_PRODUCT' | 'OPEN_SESSION' | 'CLOSE_SESSION';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncQueueRecord {
  id: string;
  action_type: SyncActionType;
  payload: Record<string, unknown>;
  timestamp: number;
  status: SyncStatus;
  error_message?: string;
}

export interface SyncMetaRecord {
  key: string;
  value: string | number;
}

export class BluecountsDB extends Dexie {
  products!: EntityTable<ProductRecord, 'id'>;
  inventory!: EntityTable<InventoryRecord, 'id'>;
  sales!: EntityTable<SaleRecord, 'id'>;
  sale_items!: EntityTable<SaleItemRecord, 'id'>;
  pos_sessions!: EntityTable<PosSessionRecord, 'id'>;
  sync_queue!: EntityTable<SyncQueueRecord, 'id'>;
  sync_meta!: EntityTable<SyncMetaRecord, 'key'>;

  constructor() {
    super('BluecountsDB');
    this.version(1).stores({
      products: 'id, tenant_id, outlet_id, [tenant_id+outlet_id], [tenant_id+sku], version_id',
      inventory: 'id, tenant_id, outlet_id, product_id, [tenant_id+outlet_id+product_id], version_id',
      sales: 'id, tenant_id, outlet_id, device_id, [tenant_id+device_id+device_transaction_id], version_id, created_at',
      sale_items: 'id, sale_id, tenant_id, outlet_id, product_id',
      sync_queue: 'id, timestamp, status',
      sync_meta: 'key',
    });
    this.version(2).stores({
      products: 'id, tenant_id, outlet_id, [tenant_id+outlet_id], [tenant_id+sku], version_id',
      inventory: 'id, tenant_id, outlet_id, product_id, [tenant_id+outlet_id+product_id], version_id',
      sales: 'id, tenant_id, outlet_id, device_id, session_id, [tenant_id+device_id+device_transaction_id], version_id, created_at',
      sale_items: 'id, sale_id, tenant_id, outlet_id, product_id',
      pos_sessions: 'id, tenant_id, outlet_id, user_id, [outlet_id+status], version_id, opened_at',
      sync_queue: 'id, timestamp, status',
      sync_meta: 'key',
    });
    this.version(3).stores({
      products: 'id, tenant_id, [tenant_id+sku], version_id',
      inventory: 'id, tenant_id, outlet_id, product_id, [tenant_id+outlet_id+product_id], version_id',
      sales: 'id, tenant_id, outlet_id, device_id, session_id, [tenant_id+device_id+device_transaction_id], version_id, created_at',
      sale_items: 'id, sale_id, tenant_id, outlet_id, product_id',
      pos_sessions: 'id, tenant_id, outlet_id, user_id, [outlet_id+status], version_id, opened_at',
      sync_queue: 'id, timestamp, status',
      sync_meta: 'key',
    });
  }
}

export const db = new BluecountsDB();
