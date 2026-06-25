// src/adapters/SQLiteAdapter.ts
// Full implementation requires: npm install better-sqlite3 @types/better-sqlite3
// This stub documents the interface for community implementation

import { DatabaseAdapter, QueryFilter } from './DatabaseAdapter';

export class SQLiteAdapter implements DatabaseAdapter {
  private dbPath: string;
  private db: any = null; // better-sqlite3 Database instance

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    throw new Error(
      'SQLiteAdapter: Install better-sqlite3 to use SQLite. ' +
      'Run: npm install better-sqlite3 @types/better-sqlite3\n' +
      'Then uncomment the implementation in src/adapters/SQLiteAdapter.ts'
    );
  }

  async disconnect(): Promise<void> { this.db?.close(); }
  isConnected(): boolean { return !!this.db; }
  async findAll<T>(c: string, f?: QueryFilter): Promise<T[]> { throw new Error('Not implemented'); }
  async findById<T>(c: string, id: string): Promise<T | null> { throw new Error('Not implemented'); }
  async findOne<T>(c: string, f: QueryFilter): Promise<T | null> { throw new Error('Not implemented'); }
  async create<T>(c: string, d: any): Promise<T> { throw new Error('Not implemented'); }
  async update<T>(c: string, id: string, u: Partial<T>): Promise<T | null> { throw new Error('Not implemented'); }
  async delete(c: string, id: string): Promise<boolean> { throw new Error('Not implemented'); }
  async appendToLedger(e: any): Promise<any> { throw new Error('Not implemented'); }
  async queryLedger(f: any): Promise<any[]> { throw new Error('Not implemented'); }
  async runTransaction<T>(fn: () => Promise<T>): Promise<T> { throw new Error('Not implemented'); }
  async loadAll(): Promise<Record<string, any[]>> { throw new Error('Not implemented'); }
  async saveAll(s: Record<string, any[]>): Promise<void> { throw new Error('Not implemented'); }
}
