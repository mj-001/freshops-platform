// src/adapters/MariaDBAdapter.ts
// Full implementation requires: npm install mysql2
// This stub documents the interface for community implementation

import { DatabaseAdapter, QueryFilter } from './DatabaseAdapter';

export class MariaDBAdapter implements DatabaseAdapter {
  private connectionString: string;
  private client: any = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    throw new Error(
      'MariaDBAdapter: Install mysql2 to use MariaDB. ' +
      'Run: npm install mysql2\n' +
      'Set DATABASE_URL=mysql://user:pass@host:3306/freshops\n' +
      'Then uncomment the implementation in src/adapters/MariaDBAdapter.ts'
    );
  }

  async disconnect(): Promise<void> { await this.client?.end(); }
  isConnected(): boolean { return !!this.client; }
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
