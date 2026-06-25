// src/adapters/ClickHouseAdapter.ts
// ClickHouse analytics sink adapter.
// Requires: npm install @clickhouse/client
// See docs/ANALYTICS_SETUP.md for setup.

export class ClickHouseAdapter {
  private url: string;
  private client: any = null;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    throw new Error('ClickHouseAdapter: ClickHouse client setup required.');
  }
}
