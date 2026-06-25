// src/adapters/DuckDBAdapter.ts
// Analytics-only adapter. NOT for operational writes.
// Use alongside an operational adapter (SQLite, PostgreSQL).
// Requires: npm install duckdb

export class DuckDBAnalyticsSink {
  // DuckDB excels at analytical queries over the stock_ledger.
  // Use for report endpoints when operational store queries are slow.
  // Can read directly from SQLite files or Parquet exports.
  //
  // Example: GET /api/v1/reports/margin-by-sku queries DuckDB instead
  // of the operational store when DATABASE_ANALYTICS=duckdb is set.
  //
  // See docs/ANALYTICS_SETUP.md for configuration.
}
