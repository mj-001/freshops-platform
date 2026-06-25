-- FreshOpsPlatform Initial Schema
-- Compatible with PostgreSQL, MariaDB, SQLite (with minor syntax adjustments)

-- Stock ledger (append-only, never UPDATE or DELETE)
CREATE TABLE stock_ledger (
  id VARCHAR(100) PRIMARY KEY ,
  timestamp TIMESTAMP,
  sku_id VARCHAR(100) NOT NULL,
  batch_id VARCHAR(100) NOT NULL,
  location_id VARCHAR(100) NOT NULL,
  warehouse_id VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL, -- positive = added, negative = removed
  transaction_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  reference_type VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  notes TEXT
);

-- Indices for rapid queries
CREATE INDEX idx_ledger_sku ON stock_ledger (sku_id);
CREATE INDEX idx_ledger_batch_time ON stock_ledger (batch_id, timestamp);
CREATE INDEX idx_ledger_sku_wh_time ON stock_ledger (sku_id, warehouse_id, timestamp);
CREATE INDEX idx_ledger_location ON stock_ledger (location_id, transaction_type);
