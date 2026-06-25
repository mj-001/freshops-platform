// src/adapters/JsonFileAdapter.ts
import { DatabaseAdapter, QueryFilter } from './DatabaseAdapter';
import fs from 'fs';

export class JsonFileAdapter implements DatabaseAdapter {
  private db: Record<string, any[]> = {};
  private filePath: string;
  private connected = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async connect(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.db = JSON.parse(raw);
      } else {
        this.db = {};
      }
    } catch {
      this.db = {};
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  async findAll<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    const items = (this.db[collection] || []) as T[];
    if (!filter) return items;
    return items.filter(item =>
      Object.entries(filter).every(([k, v]) => (item as any)[k] === v)
    );
  }

  async findById<T>(collection: string, id: string): Promise<T | null> {
    const items = (this.db[collection] || []) as T[];
    return items.find((i: any) => i.id === id) || null;
  }

  async findOne<T>(collection: string, filter: QueryFilter): Promise<T | null> {
    const results = await this.findAll<T>(collection, filter);
    return results[0] || null;
  }

  async create<T>(collection: string, data: any): Promise<T> {
    if (!this.db[collection]) this.db[collection] = [];
    this.db[collection].push(data);
    await this.saveAll(this.db);
    return data as T;
  }

  async update<T>(collection: string, id: string, updates: Partial<T>): Promise<T | null> {
    const idx = (this.db[collection] || []).findIndex((i: any) => i.id === id);
    if (idx === -1) return null;
    this.db[collection][idx] = { ...this.db[collection][idx], ...updates };
    await this.saveAll(this.db);
    return this.db[collection][idx] as T;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const before = (this.db[collection] || []).length;
    this.db[collection] = (this.db[collection] || []).filter((i: any) => i.id !== id);
    await this.saveAll(this.db);
    return this.db[collection].length < before;
  }

  async appendToLedger(entry: any): Promise<any> {
    if (!this.db['stock_ledger']) this.db['stock_ledger'] = [];
    // Check for duplicates
    const dup = this.db['stock_ledger'].find(
      (e: any) => e.reference_id === entry.reference_id &&
        e.transaction_type === entry.transaction_type &&
        e.batch_id === entry.batch_id &&
        e.id !== entry.id
    );
    if (dup) {
      console.warn('DOUBLE_TRANSACTION detected:', entry.reference_id);
    }
    this.db['stock_ledger'].push(entry);
    await this.saveAll(this.db);
    return entry;
  }

  async queryLedger(filter: any): Promise<any[]> {
    let entries = this.db['stock_ledger'] || [];
    if (filter.sku_id) entries = entries.filter((e: any) => e.sku_id === filter.sku_id);
    if (filter.batch_id) entries = entries.filter((e: any) => e.batch_id === filter.batch_id);
    if (filter.warehouse_id) entries = entries.filter((e: any) => e.warehouse_id === filter.warehouse_id);
    if (filter.location_id) entries = entries.filter((e: any) => e.location_id === filter.location_id);
    if (filter.transaction_type) {
      const types = Array.isArray(filter.transaction_type)
        ? filter.transaction_type : [filter.transaction_type];
      entries = entries.filter((e: any) => types.includes(e.transaction_type));
    }
    if (filter.from) entries = entries.filter((e: any) => e.timestamp >= filter.from);
    if (filter.to) entries = entries.filter((e: any) => e.timestamp <= filter.to);
    if (filter.limit) entries = entries.slice(filter.offset || 0, (filter.offset || 0) + filter.limit);
    return entries;
  }

  async runTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  async loadAll(): Promise<Record<string, any[]>> {
    return this.db;
  }

  async saveAll(state: Record<string, any[]>): Promise<void> {
    this.db = state;
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }
}
