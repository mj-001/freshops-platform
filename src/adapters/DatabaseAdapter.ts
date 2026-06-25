// src/adapters/DatabaseAdapter.ts

export interface QueryFilter {
  [field: string]: any;
}

export interface DatabaseAdapter {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Generic CRUD
  findAll<T>(collection: string, filter?: QueryFilter): Promise<T[]>;
  findById<T>(collection: string, id: string): Promise<T | null>;
  findOne<T>(collection: string, filter: QueryFilter): Promise<T | null>;
  create<T>(collection: string, data: Omit<T, 'id'> & { id: string }): Promise<T>;
  update<T>(collection: string, id: string, updates: Partial<T>): Promise<T | null>;
  delete(collection: string, id: string): Promise<boolean>;

  // Ledger-specific (append-only, never update/delete)
  appendToLedger(entry: any): Promise<any>;
  queryLedger(filter: {
    sku_id?: string;
    batch_id?: string;
    location_id?: string;
    warehouse_id?: string;
    transaction_type?: string | string[];
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;

  // Transaction support
  runTransaction<T>(fn: () => Promise<T>): Promise<T>;

  // State management (for JSON adapter compatibility)
  loadAll(): Promise<Record<string, any[]>>;
  saveAll(state: Record<string, any[]>): Promise<void>;
}
