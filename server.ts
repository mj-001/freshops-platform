import 'dotenv/config' 
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { 
  User, 
  Warehouse, 
  Zone, 
  Location, 
  Supplier, 
  Category, 
  SKU, 
  Batch, 
  StockLedgerEntry, 
  PurchaseOrder, 
  PurchaseOrderLine, 
  GoodsReceipt, 
  GoodsReceiptLine, 
  CustomerOrder, 
  CustomerOrderLine, 
  Customer, 
  PickList, 
  PickListLine, 
  Transfer, 
  TransferLine, 
  TransferStatus,
  CycleCount, 
  CycleCountLine, 
  WriteOff, 
  WriteOffLine, 
  Delivery, 
  TempLog,
  TransactionType,
  Asset,
  DeliveryAsset,
  ProductRecall,
  RecallAction,
  AssemblyTemplate,
  AssemblyOrder,
  ProductionRecipe,
  ProductionRun,
  LoadingManifest,
  ManifestLine,
  ManifestAsset,
  ManifestType,
  ManifestStatus,
  RejectionReason,
  DispositionType,
  FPORejectionLine,
  FPOClosureReport,
  StockReservation,
  CycleCountSuggestion,
  ReplenishmentRule,
  WMSNotification,
  NotificationWebhook,
  MarkdownApproval,
  APIKey,
  WebhookDelivery,
  APIKeyScope,
  BundleComponent,
  BundleDefinition,
  SetupConfig,
  CustomerReturn,
  VendorCard,
  CrossDockEODCheck,
  ZoningSeparationRule,
  ProductClass,
  EthyleneProfile,
  PublicationStatus,
  PackingAsset,
  CustomRole,
  Permission,
  AuditLog,
  PriceHistory,
  WorkflowApproval,
  WorkflowTemplate,
  CountingSection,
  CycleCountItem,
  AssetType,
  AssetEvent,
  AssetStatus,
  BinLocation
} from './src/types';

import { DatabaseAdapter } from './src/adapters/DatabaseAdapter';
import { JsonFileAdapter } from './src/adapters/JsonFileAdapter';
import { SQLiteAdapter } from './src/adapters/SQLiteAdapter';
import { PostgreSQLAdapter } from './src/adapters/PostgreSQLAdapter';
import { MariaDBAdapter } from './src/adapters/MariaDBAdapter';
import { FirestoreAdapter } from './src/adapters/FirestoreAdapter';

import { 
  INITIAL_USERS, 
  INITIAL_WAREHOUSES, 
  INITIAL_ZONES, 
  INITIAL_LOCATIONS, 
  INITIAL_SUPPLIERS, 
  INITIAL_CATEGORIES, 
  INITIAL_SKUS, 
  INITIAL_CUSTOMERS, 
  INITIAL_POS, 
  INITIAL_PO_LINES, 
  INITIAL_CUSTOMER_ORDERS, 
  INITIAL_CUSTOMER_ORDER_LINES, 
  INITIAL_BATCHES, 
  INITIAL_LEDGER,
  INITIAL_WORKFLOW_TEMPLATES,
  INITIAL_ASSETS
} from './src/db_initial_state';

import { runBrtTestSuite } from './src/brt_test_runner';

const CONFIG = {
  PLATFORM_NAME:
    process.env.PLATFORM_NAME || 'FreshOpsPlatform',
  TENANT_NAME:
    process.env.TENANT_NAME || 'Default Operator',
  TENANT_ID:
    process.env.TENANT_ID || 'default',

  // Notification thresholds
  EXPIRY_ALERT_DAYS_DEFAULT:
    parseInt(process.env.EXPIRY_ALERT_DAYS_DEFAULT || '3'),
  DELIVERY_LATE_HOURS:
    parseFloat(process.env.DELIVERY_LATE_HOURS || '3'),
  WRITE_OFF_HIGH_VALUE_KES:
    parseInt(process.env.WRITE_OFF_HIGH_VALUE_KES || '1000000'),

  // API
  API_KEY_PREFIX:
    process.env.API_KEY_PREFIX || 'fop',
  SESSION_SECRET:
    process.env.SESSION_SECRET || 'change-this-in-production',

  // Rate limiting (requests per minute)
  RATE_LIMIT_EXTERNAL:
    parseInt(process.env.RATE_LIMIT_EXTERNAL || '60'),
  RATE_LIMIT_INTERNAL:
    parseInt(process.env.RATE_LIMIT_INTERNAL || '300'),

  // Operations
  SCHEDULED_CHECK_INTERVAL_MS:
    parseInt(process.env.SCHEDULED_CHECK_INTERVAL_MS
      || String(15 * 60 * 1000)),
  NOTIFICATION_RETENTION:
    parseInt(process.env.NOTIFICATION_RETENTION || '500'),
  STATE_FILE_PATH:
    process.env.STATE_FILE_PATH || './state.json',
};

const STATE_FILE = path.resolve(process.cwd(), CONFIG.STATE_FILE_PATH);

function createAdapter(): DatabaseAdapter {
  const adapterType = process.env.DATABASE_ADAPTER || 'json';
  const url = process.env.DATABASE_URL || STATE_FILE;

  switch (adapterType) {
    case 'json':
      return new JsonFileAdapter(url);
    case 'sqlite':
      return new SQLiteAdapter(url);
    case 'postgres':
      return new PostgreSQLAdapter(url);
    case 'mariadb':
      return new MariaDBAdapter(url);
    case 'firestore':
      return new FirestoreAdapter(url);
    default:
      console.warn(`Unknown adapter: ${adapterType}. Falling back to name-based JSON adapter.`);
      return new JsonFileAdapter(STATE_FILE);
  }
}

export const dbAdapter = createAdapter();

// Memory Database Schema
interface DbState {
  users: User[];
  warehouses: Warehouse[];
  zones: Zone[];
  locations: Location[];
  suppliers: Supplier[];
  categories: Category[];
  skus: SKU[];
  batches: Batch[];
  stock_ledger: StockLedgerEntry[];
  purchase_orders: PurchaseOrder[];
  purchase_order_lines: PurchaseOrderLine[];
  goods_receipts: GoodsReceipt[];
  goods_receipt_lines: GoodsReceiptLine[];
  customer_orders: CustomerOrder[];
  customer_order_lines: CustomerOrderLine[];
  customers: Customer[];
  pick_lists: PickList[];
  pick_list_lines: PickListLine[];
  transfers: Transfer[];
  transfer_lines: TransferLine[];
  cycle_counts: CycleCount[];
  cycle_count_lines: CycleCountLine[];
  write_offs: WriteOff[];
  write_off_lines: WriteOffLine[];
  deliveries: Delivery[];
  temp_logs: TempLog[];
  assets: Asset[];
  delivery_assets: DeliveryAsset[];
  product_recalls: ProductRecall[];
  recall_actions: RecallAction[];
  assembly_templates: AssemblyTemplate[];
  assembly_orders: AssemblyOrder[];
  production_recipes: ProductionRecipe[];
  production_runs: ProductionRun[];
  loading_manifests: LoadingManifest[];
  manifest_counter_delivery: number;
  manifest_counter_transfer: number;
  stock_reservations: StockReservation[];
  replenishment_rules: ReplenishmentRule[];
  replenishment_order_counter: number;
  currentUser: User | null;

  // New modules
  notifications: WMSNotification[];
  notification_webhooks: NotificationWebhook[];
  markdown_approvals: MarkdownApproval[];
  notification_counter: number;
  api_keys: APIKey[];
  webhook_deliveries: WebhookDelivery[];
  tenant_id: string;
  setup_complete: boolean;
  bundle_definitions: BundleDefinition[];
  setup_config: SetupConfig | null;

  // Round 14A additions
  customer_returns: CustomerReturn[];
  return_counter: number;
  vendor_cards: VendorCard[];
  cross_dock_eod_checks: CrossDockEODCheck[];
  zoning_separation_rules: ZoningSeparationRule[];
  packing_assets: PackingAsset[];
  custom_roles: CustomRole[];
  audit_logs: AuditLog[];
  idempotency_keys: Record<string, { response: any; created_at: string }>;
  price_history: PriceHistory[];
  workflow_approvals: WorkflowApproval[];
  workflow_templates: WorkflowTemplate[];
  counting_sections: CountingSection[];
  asset_types: AssetType[];
  asset_events: AssetEvent[];
  bin_locations: BinLocation[];
}

// Global In-Memory Database
let db: DbState = {
  users: [],
  warehouses: [],
  zones: [],
  locations: [],
  suppliers: [],
  categories: [],
  skus: [],
  batches: [],
  stock_ledger: [],
  purchase_orders: [],
  purchase_order_lines: [],
  goods_receipts: [],
  goods_receipt_lines: [],
  customer_orders: [],
  customer_order_lines: [],
  customers: [],
  pick_lists: [],
  pick_list_lines: [],
  transfers: [],
  transfer_lines: [],
  cycle_counts: [],
  cycle_count_lines: [],
  write_offs: [],
  write_off_lines: [],
  deliveries: [],
  temp_logs: [],
  assets: [],
  delivery_assets: [],
  product_recalls: [],
  recall_actions: [],
  assembly_templates: [],
  assembly_orders: [],
  production_recipes: [],
  production_runs: [],
  loading_manifests: [],
  manifest_counter_delivery: 0,
  manifest_counter_transfer: 0,
  stock_reservations: [],
  replenishment_rules: [],
  replenishment_order_counter: 0,
  currentUser: null,

  // New modules defaults
  notifications: [],
  notification_webhooks: [],
  markdown_approvals: [],
  notification_counter: 0,
  api_keys: [],
  webhook_deliveries: [],
  tenant_id: CONFIG.TENANT_ID,
  setup_complete: false,
  bundle_definitions: [],
  setup_config: null,

  // Round 14A additions
  customer_returns: [],
  return_counter: 0,
  vendor_cards: [],
  cross_dock_eod_checks: [],
  zoning_separation_rules: [],
  packing_assets: [],
  custom_roles: [],
  audit_logs: [],
  idempotency_keys: {},
  price_history: [],
  workflow_approvals: [],
  workflow_templates: [],
  counting_sections: [],
  asset_types: [],
  asset_events: [],
  bin_locations: []
};

// State persistence
function runDefensiveMigrations() {
      if (!db.assembly_templates) db.assembly_templates = [];
      if (!db.assembly_orders) db.assembly_orders = [];
      if (!db.production_recipes) db.production_recipes = [];
      if (!db.production_runs) db.production_runs = [];
      if (!db.loading_manifests) db.loading_manifests = [];
      if (db.manifest_counter_delivery === undefined) db.manifest_counter_delivery = 0;
      if (db.manifest_counter_transfer === undefined) db.manifest_counter_transfer = 0;
      if (!db.stock_reservations) db.stock_reservations = [];
      if (!db.replenishment_rules) db.replenishment_rules = [];
      if (db.replenishment_order_counter === undefined) db.replenishment_order_counter = 0;
      if (!db.notifications) db.notifications = [];
      if (!db.notification_webhooks) db.notification_webhooks = [];
      if (!db.markdown_approvals) db.markdown_approvals = [];
      if (db.notification_counter === undefined) db.notification_counter = 0;
      if (!db.api_keys) db.api_keys = [];
      if (!db.webhook_deliveries) db.webhook_deliveries = [];
      if (db.tenant_id === undefined) db.tenant_id = CONFIG.TENANT_ID;
      if (db.setup_complete === undefined) db.setup_complete = false;

      // Round 14A additions load fallback
      if (!db.customer_returns) db.customer_returns = [];
      if (db.return_counter === undefined) db.return_counter = 0;
      if (!db.vendor_cards) db.vendor_cards = [];
      if (!db.cross_dock_eod_checks) db.cross_dock_eod_checks = [];
      if (!db.zoning_separation_rules) db.zoning_separation_rules = [];
      if (!db.packing_assets) db.packing_assets = [];
      if (!db.custom_roles) db.custom_roles = [];
      if (!db.audit_logs) db.audit_logs = [];
      if (!db.idempotency_keys) db.idempotency_keys = {};
      if (!db.price_history) db.price_history = [];
      if (!db.workflow_approvals) db.workflow_approvals = [];
      if (!db.counting_sections) db.counting_sections = [];

      // Defensive migrations for assets
      if (!db.asset_events) db.asset_events = [];
      if (!db.asset_types) db.asset_types = [];
      if (!db.bin_locations) db.bin_locations = [];

      // Ensure is_active on all warehouses and zones
      db.warehouses.forEach((w: any) => { if (w.is_active === undefined) w.is_active = true; });
      db.zones.forEach((z: any) => { if (z.is_active === undefined) z.is_active = true; });

      // Migrate existing Asset records to new schema
      (db.assets || []).forEach((a: any) => {
        if (a.type !== undefined && !a.asset_type_id) {
          // Old schema had type as string, new schema uses asset_type_id.
          // Create a corresponding AssetType if it doesn't exist yet,
          // then link this asset to it.
          const existingType = db.asset_types.find(
            (t: any) => t.name.toLowerCase() === a.type.replace(/_/g, ' ')
          );
          if (!existingType) {
            const newType = {
              id: `AT-${a.type.toUpperCase().replace(/_/g, '-')}`,
              name: a.type.replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase()),
              description: null,
              requires_uid: true,
              is_active: true,
              created_by: 'SYSTEM',
              created_at: new Date().toISOString()
            };
            db.asset_types.push(newType);
            a.asset_type_id = newType.id;
          } else {
            a.asset_type_id = existingType.id;
          }
        }
        if (a.current_status === undefined) a.current_status = a.status || 'available';
        if (a.current_warehouse_id === undefined) {
          a.current_warehouse_id = a.warehouse_id || null;
        }
      });

      // Backfill reports_to_user_id, granted_permissions, revoked_permissions
      (db.users || []).forEach((u: any) => {
        if (u.reports_to_user_id === undefined) u.reports_to_user_id = null;
        if (!u.granted_permissions) u.granted_permissions = [];
        if (!u.revoked_permissions) u.revoked_permissions = [];
      });

      // Backfill actual_unit_cost_kes etc. on existing GRN lines
      (db.goods_receipt_lines || []).forEach((l: any) => {
        if (l.actual_unit_cost_kes === undefined) l.actual_unit_cost_kes = null;
        if (l.price_variance_kes === undefined) l.price_variance_kes = null;
        if (l.variance_workflow_id === undefined) l.variance_workflow_id = null;
      });

      // Seed initial PriceHistory for all existing SKUs
      if (!db.price_history) db.price_history = [];
      (db.skus || []).forEach((sku: any) => {
        const existing = (db.price_history || []).find((p: any) => p.sku_id === sku.id);
        if (!existing && sku.cost_price_kes) {
          db.price_history.push({
            id: `PH-INIT-${sku.id}`,
            sku_id: sku.id,
            effective_from: sku.created_at || new Date().toISOString(),
            cost_price_kes: sku.cost_price_kes,
            selling_price_kes: sku.selling_price_kes || 0,
            reason: 'initial',
            notes: 'Initial price at product creation',
            changed_by: 'SYSTEM',
            source_po_id: null,
            created_at: sku.created_at || new Date().toISOString()
          });
        }
      });

      if (db.users) {
        db.users.forEach(u => {
          if (u.custom_role_id === undefined) u.custom_role_id = null;
          if (u.phone === undefined) u.phone = null;
          if (u.password_hash === undefined || u.password_hash === null) {
             u.password_hash = hashPassword('changeme123');
          }
          if (u.must_reset_password === undefined) u.must_reset_password = true;
        });
      }

      if (db.customer_orders) {
        db.customer_orders.forEach(o => {
          if (o.picked_by === undefined) o.picked_by = null;
          if (o.packed_by === undefined) o.packed_by = null;
          if (o.packed_at === undefined) o.packed_at = null;
          if (o.cold_chain_confirmed === undefined) o.cold_chain_confirmed = false;
          if (o.packed_tote_count === undefined) o.packed_tote_count = null;
        });
      }

      if (db.skus) {
        db.skus.forEach(s => {
          if (s.publication_status === undefined) s.publication_status = 'draft';
          if (s.published_at === undefined) s.published_at = null;
          if (s.published_by === undefined) s.published_by = null;
          if (s.requires_barcode === undefined) s.requires_barcode = null;
          if (s.image_urls === undefined) s.image_urls = [];
          if (s.description === undefined) s.description = null;
          if (s.readiness_pct === undefined) s.readiness_pct = 0;
          if (s.product_class === undefined) s.product_class = null;
          if (s.ethylene_profile === undefined) s.ethylene_profile = 'neutral';
          if (s.moq === undefined || s.moq === null) s.moq = 1;
        });
      }
      if (db.categories) {
        db.categories.forEach(c => {
          if (c.requires_barcode === undefined) c.requires_barcode = false;
          if (c.default_product_class === undefined) c.default_product_class = null;
          if (c.numeric_code === undefined || c.numeric_code === null) {
            const fallbackMap: Record<string, number> = {
              'CAT-DAIRY': 100,
              'CAT-PRODUCE': 200,
              'CAT-MEAT': 300,
              'CAT-PACKAGED': 400,
              'CAT-FROZEN': 500
            };
            c.numeric_code = fallbackMap[c.id] || 900;
          }
        });
      }
      if (db.zones) {
        db.zones.forEach(z => {
          if (z.permitted_product_classes === undefined) z.permitted_product_classes = [];
          if (z.is_quarantine_zone === undefined) z.is_quarantine_zone = false;
          if (z.max_capacity_kg === undefined) z.max_capacity_kg = null;
        });
      }
      if (db.locations) {
        db.locations.forEach(l => {
          if (l.is_cross_dock === undefined) l.is_cross_dock = false;
          if (l.is_entry_point === undefined) l.is_entry_point = false;
          if (l.is_exit_point === undefined) l.is_exit_point = false;
        });
      }
      if (db.transfers) {
        db.transfers.forEach(t => {
          if (!t.transfer_scope) t.transfer_scope = 'inter_site';
          if (t.replenishment_order_number === undefined) t.replenishment_order_number = null;
          if (t.manifest_id === undefined) t.manifest_id = null;
          if (t.packed_by === undefined) t.packed_by = null;
          if (t.packed_at === undefined) t.packed_at = null;
          if (!t.rejection_lines) t.rejection_lines = [];
          if (t.closure_report === undefined) t.closure_report = null;
          if (t.closure_report_sent_at === undefined) t.closure_report_sent_at = null;
          if (t.under_pick_flagged_user === undefined) t.under_pick_flagged_user = null;
        });
      }
      if (db.batches) {
        db.batches.forEach(b => {
          if (!b.parent_batch_ids) b.parent_batch_ids = [];
          if (!b.child_batch_ids) b.child_batch_ids = [];
          if (b.assembly_order_id === undefined) b.assembly_order_id = null;
        });
      }
}

async function loadState() {
  const adapterType = process.env.DATABASE_ADAPTER || 'json';

  if (adapterType === 'json') {
    // Original JSON file behaviour — unchanged
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf8');
        db = JSON.parse(data);
        runDefensiveMigrations();
      } else {
        await resetState();
      }
    } catch (err) {
      console.error('Failed to load state from JSON file:', err);
      await resetState();
    }
  } else {
    // Adapter mode — load all collections from the adapter
    try {
      const state = await dbAdapter.loadAll();
      if (state && Object.keys(state).length > 0) {
        // Merge loaded state into db, keeping any missing collections
        // at their defaults from resetState()
        await resetState(); // start with defaults
        Object.keys(state).forEach(collection => {
          if (state[collection] && state[collection].length > 0) {
            (db as any)[collection] = state[collection];
          }
        });
        runDefensiveMigrations();
        console.log('[loadState] State loaded from adapter successfully.');
      } else {
        // Empty database — start fresh with seed data
        await resetState();
        console.log('[loadState] Empty database — starting with seed data.');
        // Save seed data to the adapter so it persists
        await saveState();
      }
    } catch (err) {
      console.error('[loadState] Failed to load from adapter:', err);
      await resetState();
    }
  }
}

async function saveState() {
  const adapterType = process.env.DATABASE_ADAPTER || 'json';

  if (adapterType === 'json') {
    // Original JSON file behaviour — unchanged
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save WMS state to disk:', error);
    }
  } else {
    // Adapter mode — save entire state through the adapter
    try {
      // Build a plain object of all collections from db
      const state: Record<string, any[]> = {};
      const collectionKeys = [
        'users', 'warehouses', 'zones', 'locations', 'suppliers',
        'categories', 'skus', 'batches', 'stock_ledger',
        'purchase_orders', 'purchase_order_lines',
        'goods_receipts', 'goods_receipt_lines',
        'customer_orders', 'customer_order_lines', 'customers',
        'pick_lists', 'pick_list_lines', 'transfers', 'transfer_lines',
        'cycle_counts', 'cycle_count_lines', 'write_offs', 'write_off_lines',
        'deliveries', 'temp_logs', 'assets', 'asset_types', 'asset_events',
        'delivery_assets', 'product_recalls', 'recall_actions',
        'assembly_templates', 'assembly_orders',
        'production_recipes', 'production_runs',
        'loading_manifests', 'stock_reservations', 'replenishment_rules',
        'notifications', 'notification_webhooks', 'markdown_approvals',
        'api_keys', 'webhook_deliveries', 'bundle_definitions',
        'customer_returns', 'vendor_cards', 'cross_dock_eod_checks',
        'zoning_separation_rules', 'packing_assets', 'custom_roles',
        'audit_logs', 'price_history', 'workflow_approvals',
        'workflow_templates', 'counting_sections'
      ];
      collectionKeys.forEach(key => {
        const value = (db as any)[key];
        if (Array.isArray(value)) {
          state[key] = value;
        }
      });
      await dbAdapter.saveAll(state);
    } catch (error) {
      console.error('[saveState] Failed to save via adapter:', error);
    }
  }
}

async function logAudit(
  action: string,
  entity_type: string,
  entity_id: string | null,
  description: string,
  details?: any
) {
  try {
    const activeUser = db.currentUser;
    const entry: AuditLog = {
      id: 'LOG-' + crypto.randomUUID().substring(0, 8).toUpperCase(),
      timestamp: new Date().toISOString(),
      user_id: activeUser ? activeUser.id : 'SYSTEM',
      user_name: activeUser ? activeUser.name : 'System Scheduler',
      user_email: activeUser ? activeUser.email : 'system@wms.local',
      user_role: activeUser ? activeUser.role : 'system',
      action,
      entity_type,
      entity_id,
      description,
      details: details ? details : null,
    };
    db.audit_logs.unshift(entry);
    if (db.audit_logs.length > 500) {
      db.audit_logs = db.audit_logs.slice(0, 500);
    }
    await saveState();

    const streamPayload = {
      type: 'AUDIT_LOG_ADDED',
      data: entry
    };
    sseClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(streamPayload)}\n\n`);
      } catch (err) {
        // ignore closed connections
      }
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function hashPassword(plaintext: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plaintext, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(plaintext: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(plaintext, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function generateTempPassword(): string {
  // 12 characters, mixed case + digits, no ambiguous characters
  // (no 0/O, 1/l/I) to reduce transcription errors when an admin
  // reads this aloud or types it for a new hire.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

async function handleWorkflowCompletion(approval: any) {
  if (approval.type === 'PRICE_VARIANCE') {
    const snapshot = approval.entity_snapshot;
    // snapshot contains: sku_id, po_id, grn_date, actual_unit_cost_kes,
    // po_unit_cost_kes, selling_price_kes_current

    const sku = db.skus.find((s: any) => s.id === snapshot.sku_id);
    if (!sku) return;

    // Create PriceHistory record effective from the GRN date
    // of the specific PO — NOT today. This makes the correction
    // retroactive to that PO only.
    if (!db.price_history) db.price_history = [];
    const priceRecord = {
      id: `PH-VAR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      sku_id: snapshot.sku_id,
      effective_from: snapshot.grn_date,  // the GRN date, not today
      cost_price_kes: snapshot.actual_unit_cost_kes,
      selling_price_kes: sku.selling_price_kes, // selling price unchanged
                                                  // unless explicitly set
      reason: 'variance_approved' as const,
      notes: `Price variance approved on PO ${snapshot.po_id}. ` +
             `PO price: ${snapshot.po_unit_cost_kes}, ` +
             `Actual: ${snapshot.actual_unit_cost_kes}`,
      changed_by: approval.stages[approval.stages.length - 1]?.actioned_by || 'SYSTEM',
      source_po_id: snapshot.po_id,
      created_at: new Date().toISOString()
    };
    db.price_history.push(priceRecord);

    // Keep SKU in sync (so current prices reflect reality)
    sku.cost_price_kes = snapshot.actual_unit_cost_kes;

    // Fire webhook for ERP/accounting integration
    fireWebhooks('PRICE_VARIANCE_ACCEPTED', {
      sku_id: sku.id,
      sku_code: sku.code,
      sku_name: sku.name,
      po_id: snapshot.po_id,
      po_unit_cost_kes: snapshot.po_unit_cost_kes,
      actual_unit_cost_kes: snapshot.actual_unit_cost_kes,
      variance_kes: snapshot.actual_unit_cost_kes - snapshot.po_unit_cost_kes,
      effective_from: snapshot.grn_date,
      approved_workflow_id: approval.id
    });

    // Notify finance and the person who raised it
    createNotification(
      'PRICE_VARIANCE_ACCEPTED',
      `Price Variance Approved: ${sku.name}`,
      `Cost price updated from KES ${(snapshot.po_unit_cost_kes/100).toFixed(2)} ` +
      `to KES ${(snapshot.actual_unit_cost_kes/100).toFixed(2)} ` +
      `effective from GRN date of PO ${snapshot.po_id}.`,
      'info',
      {
        reference_id: snapshot.po_id,
        reference_type: 'purchase_order',
        target_roles: ['admin', 'ops_manager']
      }
    );

    saveState();
  }
  // Other workflow types (NEW_SUPPLIER, PRICE_CHANGE etc.)
  // handled here in future rounds
}

function getPriceAtDate(skuId: string, asOfDate: string) {
  const history = (db.price_history || [])
    .filter(p => p.sku_id === skuId && p.effective_from <= asOfDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  if (history.length === 0) {
    const sku = db.skus.find(s => s.id === skuId);
    return { cost_price_kes: sku?.cost_price_kes || 0,
             selling_price_kes: sku?.selling_price_kes || 0 };
  }
  return { cost_price_kes: history[0].cost_price_kes,
           selling_price_kes: history[0].selling_price_kes };
}

function userHasPermission(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  // 1. Admins always have every permission, no overrides needed.
  if (user.role === 'admin') return true;
  // 2. Per-user revoke takes priority over everything else.
  if ((user.revoked_permissions || []).includes(permission)) return false;
  // 3. Per-user grant overrides role/custom-role.
  if ((user.granted_permissions || []).includes(permission)) return true;
  // 4. Custom role check.
  if (user.custom_role_id) {
    const customRole = (db.custom_roles || []).find(r => r.id === user.custom_role_id);
    return customRole ? customRole.permissions.includes(permission) : false;
  }
  // 5. No custom role — built-in role legacy checks govern this user
  // at scattered call sites; this function returns false for them.
  return false;
}

function computeReadinessPct(sku: SKU, categories: Category[]): number {
  const cat = categories.find(c => c.id === sku.category_id);
  const effectiveRequiresBarcode =
    sku.requires_barcode !== null && sku.requires_barcode !== undefined
      ? sku.requires_barcode
      : (cat?.requires_barcode ?? false);

  const checks = [
    !!sku.name,
    !!sku.category_id,
    !!sku.temp_zone,
    !!sku.unit,
    sku.shelf_life_days > 0,
    sku.selling_price_kes > 0,
    sku.cost_price_kes > 0,
    sku.image_urls && sku.image_urls.length > 0,
    // Vendor card: at least one active preferred vendor card
    (db.vendor_cards || []).some(
      v => v.sku_id === sku.id && v.is_preferred && v.is_active
    ),
    // Barcode: only required if requires_barcode is true
    effectiveRequiresBarcode ? !!sku.barcode : true,
  ];

  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function computeLocationWeightKg(locationId: string): number {
  const batchQtys = new Map<string, number>();
  (db.stock_ledger || [])
    .filter(e => e.location_id === locationId)
    .forEach(e => {
      batchQtys.set(e.batch_id, (batchQtys.get(e.batch_id) || 0) + e.quantity);
    });
  let totalKg = 0;
  batchQtys.forEach((qty, batchId) => {
    if (qty <= 0) return;
    const batch = db.batches.find(b => b.id === batchId);
    const sku = batch ? db.skus.find(s => s.id === batch.sku_id) : null;
    if (sku?.weight_kg) {
      totalKg += (qty / (sku.display_divisor || 1)) * sku.weight_kg;
    }
  });
  return Math.round(totalKg * 100) / 100;
}

function getEffectiveProductClass(skuId: string): string | null {
  const sku = db.skus.find(s => s.id === skuId);
  if (!sku) return null;
  if (sku.product_class) return sku.product_class;
  const cat = (db.categories || []).find(c => c.id === sku.category_id);
  return (cat?.default_product_class as string) ?? null;
}

function canPublish(sku: SKU): { ok: boolean; missing: string[] } {
  const cat = db.categories.find(c => c.id === sku.category_id);
  const effectiveRequiresBarcode =
    sku.requires_barcode !== null && sku.requires_barcode !== undefined
      ? sku.requires_barcode
      : (cat?.requires_barcode ?? false);

  const missing: string[] = [];
  if (!sku.name) missing.push('Name');
  if (!sku.category_id) missing.push('Category');
  if (!sku.temp_zone) missing.push('Temperature Zone');
  if (!sku.unit) missing.push('Unit');
  if (!(sku.shelf_life_days > 0)) missing.push('Shelf Life');
  if (!(sku.selling_price_kes > 0)) missing.push('Selling Price');
  if (!(sku.cost_price_kes > 0)) missing.push('Cost Price');
  if (!sku.image_urls || sku.image_urls.length === 0) missing.push('Image');

  const hasPreferredVendor = (db.vendor_cards || []).some(
    v => v.sku_id === sku.id && v.is_preferred && v.is_active
  );
  if (!hasPreferredVendor) missing.push('Preferred Vendor Card');

  if (effectiveRequiresBarcode && !sku.barcode) {
    missing.push('Barcode');
  }

  return {
    ok: missing.length === 0,
    missing
  };
}

async function resetState() {
  db = {
    users: INITIAL_USERS.map(u => ({
      ...u,
      custom_role_id: null,
      password_hash: hashPassword('changeme123'),
      must_reset_password: true
    })),
    warehouses: [...INITIAL_WAREHOUSES],
    zones: [...INITIAL_ZONES],
    locations: [...INITIAL_LOCATIONS],
    suppliers: [...INITIAL_SUPPLIERS],
    categories: [...INITIAL_CATEGORIES],
    skus: [...INITIAL_SKUS],
    batches: INITIAL_BATCHES.map(b => ({
      ...b,
      parent_batch_ids: b.parent_batch_ids || [],
      child_batch_ids: b.child_batch_ids || [],
      assembly_order_id: b.assembly_order_id || null
    })),
    stock_ledger: [...INITIAL_LEDGER],
    purchase_orders: [...INITIAL_POS],
    purchase_order_lines: [...INITIAL_PO_LINES],
    goods_receipts: [],
    goods_receipt_lines: [],
    customer_orders: [...INITIAL_CUSTOMER_ORDERS],
    customer_order_lines: [...INITIAL_CUSTOMER_ORDER_LINES],
    customers: [...INITIAL_CUSTOMERS],
    pick_lists: [],
    pick_list_lines: [],
    transfers: [],
    transfer_lines: [],
    cycle_counts: [],
    cycle_count_lines: [],
    write_offs: [],
    write_off_lines: [],
    deliveries: [],
    temp_logs: [],
    assets: [],
    delivery_assets: [],
    product_recalls: [],
    recall_actions: [],
    assembly_templates: [],
    assembly_orders: [],
    production_recipes: [],
    production_runs: [],
    loading_manifests: [],
    manifest_counter_delivery: 0,
    manifest_counter_transfer: 0,
    stock_reservations: [],
    replenishment_rules: [],
    replenishment_order_counter: 0,
    currentUser: {
      ...INITIAL_USERS[0],
      custom_role_id: null,
      password_hash: hashPassword('changeme123'),
      must_reset_password: true
    }, // default to Admin
    notifications: [],
    notification_webhooks: [],
    markdown_approvals: [],
    notification_counter: 0,
    api_keys: [],
    webhook_deliveries: [],
    tenant_id: CONFIG.TENANT_ID,
    setup_complete: false,
    bundle_definitions: [
      {
        id: 'BD-001',
        name: 'Chicken & Rice Meal Bundle',
        bundle_sku_id: 'SKU-BUNDLE-DEMO',
        components: [
          { sku_id: 'SKU-CHICK', sku_name: 'Chicken Breast 500g', qty: 1 },
          { sku_id: 'SKU-RICE', sku_name: 'Brown Rice 2kg', qty: 1 }
        ],
        is_active: true,
        valid_from: null,
        valid_until: null,
        created_by: 'U-ADMIN',
        created_at: new Date().toISOString(),
        notes: 'Demo bundle: one chicken + one rice pack.'
      }
    ],
    setup_config: null,
    customer_returns: [],
    return_counter: 0,
    vendor_cards: [],
    cross_dock_eod_checks: [],
    zoning_separation_rules: [],
    packing_assets: [],
    custom_roles: [
      {
        id: 'ROLE-DISPATCHER-DEMO',
        name: 'Dispatcher',
        description: 'Can view and dispatch outbound deliveries only. No access to picking, packing, inventory, or admin functions.',
        permissions: ['dispatch:execute', 'deliveries:view'],
        created_by: 'U-ADMIN',
        created_at: new Date().toISOString()
      }
    ],
    audit_logs: [],
    idempotency_keys: {},
    price_history: [],
    workflow_approvals: [],
    workflow_templates: [...INITIAL_WORKFLOW_TEMPLATES],
    counting_sections: [],
    asset_types: [],
    asset_events: [],
    bin_locations: []
  };

  db.notifications = [
    {
      id: 'NOTIF-00001',
      trigger: 'EXPIRY_ALERT',
      title: 'Expiry Alert: Brookside Chilled Milk 1L',
      message: 'Batch BTC-20260613-M is short-dated. Qty: 35 units at Main Warehouse.',
      severity: 'critical',
      reference_id: 'B-MILK-EXP-EARLY',
      reference_type: 'batch',
      warehouse_id: 'RGN',
      target_roles: ['admin', 'ops_manager'],
      is_read: false,
      created_at: new Date().toISOString(),
      read_at: null,
      read_by: null
    },
    {
      id: 'NOTIF-00002',
      trigger: 'REORDER_LEVEL_BREACHED',
      title: 'Reorder Alert: Brookside Chilled Milk 1L',
      message: 'Stock at 35 units, below reorder level of 50. Suggested reorder: 100 units.',
      severity: 'warning',
      reference_id: 'SKU-MILK',
      reference_type: 'sku',
      warehouse_id: null,
      target_roles: ['admin', 'ops_manager'],
      is_read: false,
      created_at: new Date().toISOString(),
      read_at: null,
      read_by: null
    },
    {
      id: 'NOTIF-00003',
      trigger: 'FPO_DISPATCHED',
      title: 'FPO Dispatched: FPO-TRF-001',
      message: '1 FPO(s) dispatched on manifest MN-001. Stock integrity holds at transit.',
      severity: 'info',
      reference_id: 'TRF-001',
      reference_type: 'transfer',
      warehouse_id: 'RGL',
      target_roles: ['admin', 'ops_manager', 'receiver'],
      is_read: false,
      created_at: new Date().toISOString(),
      read_at: null,
      read_by: null
    }
  ];
  db.notification_counter = 3;
  // Seed Assets
  db.assets = [...INITIAL_ASSETS];

  db.delivery_assets = [];

  // Seed Product Recalls
  db.product_recalls = [
    {
      id: 'REC-2026-001',
      scope: 'sku',
      sku_id: 'SKU-CHICK',
      supplier_id: null,
      batch_ids: ['B-CHICK-EXP-EARLY'],
      reason: 'QUALITY',
      disposition: 'hold',
      initiated_by: 'U-OPS-A',
      status: 'draft',
      exposure_snapshot: {
        units_in_stock: 12,
        units_in_transit: 0,
        units_delivered: 18,
        customers_affected: 1,
        estimated_value_kes: 12 * 45000
      },
      customers_to_contact: [],
      created_at: new Date().toISOString(),
      resolved_at: null
    }
  ];

  db.recall_actions = [];

  // Seed Assembly Templates
  db.assembly_templates = [
    {
      id: 'AT-AVO-RIPEN',
      name: 'Avocado Ripening',
      type: 'state_change',
      status: 'active',
      input_sku_id: 'SKU-AVO',
      output_sku_id: 'SKU-AVO',
      expected_yield_pct: 92,
      required_zone: 'cool',
      stages: [
        { stage_number:0, name:'Unripe', min_dwell_hours:0, max_dwell_hours:24, inspection_required:false },
        { stage_number:1, name:'Breaking', min_dwell_hours:48, max_dwell_hours:96, inspection_required:true },
        { stage_number:2, name:'Ready', min_dwell_hours:0, max_dwell_hours:48, inspection_required:true }
      ],
      requires_temperature_log: true,
      approved_by: 'U-ADMIN', 
      approved_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      created_by: 'U-OPS-A', 
      created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      notes: 'Ready stage triggers move to chilled for dispatch.'
    },
    {
      id: 'AT-CHICK-PORT',
      name: 'Chicken Portioning',
      type: 'portioning',
      status: 'active',
      input_sku_id: 'SKU-CHICK',
      output_sku_id: 'SKU-CHICK',
      expected_yield_pct: 85,
      required_zone: 'chilled',
      stages: [
        { stage_number:0, name:'Whole', min_dwell_hours:0, max_dwell_hours:4, inspection_required:false },
        { stage_number:1, name:'Portioned', min_dwell_hours:0, max_dwell_hours:2, inspection_required:true }
      ],
      requires_temperature_log: true,
      approved_by: 'U-ADMIN', 
      approved_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      created_by: 'U-OPS-A', 
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      notes: 'Max 4h from whole to portioned. QC must inspect before sealing.'
    }
  ];

  // Seed BOM / Recipes
  db.production_recipes = [
    {
      id: 'RCP-STIR-FRY',
      name: 'Chicken Stir Fry Ready Meal',
      status: 'active',
      output_sku_id: 'SKU-CHICK',
      output_qty_per_batch: 10,
      components: [
        { id:'BC-001', sku_id:'SKU-CHICK', qty_per_batch:3000, notes:'3kg chicken breast' },
        { id:'BC-002', sku_id:'SKU-RICE', qty_per_batch:500, notes:'500g rice' }
      ],
      standard_cost_kes: 0, // dynamic
      approved_by: 'U-ADMIN', 
      approved_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      created_by: 'U-OPS-A', 
      created_at: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
      notes: 'Weekend meal prep. Scale batches_planned as needed.'
    }
  ];

  // Seed Assembly Active Order (ASM-001)
  const coolLoc = db.locations.find(l => l.zone_id === 'RGN-COOL' || l.id.includes('COOL')) || db.locations[0];
  const avoBatch = db.batches.find(b => b.sku_id === 'SKU-AVO') || db.batches[0];
  if (avoBatch) {
    avoBatch.assembly_order_id = 'ASM-001';
  }

  db.assembly_orders = [
    {
      id: 'ASM-001',
      template_id: 'AT-AVO-RIPEN',
      template_name: 'Avocado Ripening',
      type: 'state_change',
      status: 'in_progress',
      warehouse_id: 'RGN',
      location_id: coolLoc ? coolLoc.id : 'RGN-CHL-01',
      input_sku_id: 'SKU-AVO',
      output_sku_id: 'SKU-AVO',
      input_batch_id: avoBatch ? avoBatch.id : 'B-AVO-01',
      output_batch_id: null,
      qty_input: 30,
      qty_output_planned: 28,
      qty_output_actual: null,
      yield_variance_pct: null,
      current_stage: 1,
      stage_history: [
        { 
          stage_number: 0, 
          stage_name: 'Unripe', 
          entered_at: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
          approved_by: 'U-OPS-A', 
          approved_by_name: 'Ops Manager',
          temperature_celsius: 10.2, 
          notes: 'Received. Firm texture.' 
        },
        { 
          stage_number: 1, 
          stage_name: 'Breaking', 
          entered_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          approved_by: 'U-ADMIN', 
          approved_by_name: 'Admin',
          temperature_celsius: 11.0, 
          notes: 'Softening detected. Colour change at stem.' 
        }
      ],
      initiated_by: 'U-OPS-A',
      scheduled_start: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      actual_start: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
      completed_at: null,
      notes: null
    }
  ];

  db.production_runs = [];

  // --- Round 14A Additions & Seeding ---
  db.categories = db.categories.map(c => ({
    ...c,
    requires_barcode: false,
    default_product_class: null
  }));

  db.skus = db.skus.map(s => ({
    ...s,
    publication_status: 'draft',
    published_at: null,
    published_by: null,
    requires_barcode: null,
    image_urls: [],
    description: null,
    readiness_pct: 0,
    product_class: null,
    ethylene_profile: 'neutral'
  }));

  db.zones = db.zones.map(z => {
    let classes: ProductClass[] = [];
    if (z.type === 'frozen') {
      classes = ['frozen_protein', 'dry_goods'];
    } else if (z.type === 'chilled') {
      classes = ['raw_protein', 'ready_to_eat', 'dairy', 'fresh_produce'];
    } else if (z.type === 'cool') {
      classes = ['fresh_produce', 'dry_goods'];
    } else if (z.type === 'ambient') {
      classes = ['dry_goods', 'packaging', 'allergen'];
    }
    return {
      ...z,
      permitted_product_classes: classes,
      is_quarantine_zone: false,
      max_capacity_kg: null
    };
  });

  db.locations = db.locations.map(l => ({
    ...l,
    is_cross_dock: l.warehouse_id === (db.warehouses[1]?.id || ''),
    is_entry_point: false,
    is_exit_point: false
  }));

  // Seed quarantine zones for RGN and RGL
  db.zones.push({
    id: 'ZONE-QRN-RGN',
    warehouse_id: 'RGN',
    name: 'Quarantine RGN',
    type: 'ambient',
    min_temp_celsius: 15,
    max_temp_celsius: 25,
    permitted_product_classes: [],
    is_quarantine_zone: true,
    max_capacity_kg: null,
    is_active: true
  });
  db.zones.push({
    id: 'ZONE-QRN-RGL',
    warehouse_id: 'RGL',
    name: 'Quarantine RGL',
    type: 'ambient',
    min_temp_celsius: 15,
    max_temp_celsius: 25,
    permitted_product_classes: [],
    is_quarantine_zone: true,
    max_capacity_kg: null,
    is_active: true
  });

  // Seed dedicated locations in quarantine zones
  db.locations.push({
    id: 'L-RGN-QRN-01',
    zone_id: 'ZONE-QRN-RGN',
    warehouse_id: 'RGN',
    code: 'QRN-RGN-01',
    aisle: 'Q',
    rack: 'QRN',
    shelf: '01',
    bin: 'A',
    capacity_kg: 500,
    is_active: true,
    is_cross_dock: false,
    is_entry_point: false,
    is_exit_point: false
  });
  db.locations.push({
    id: 'L-RGL-QRN-01',
    zone_id: 'ZONE-QRN-RGL',
    warehouse_id: 'RGL',
    code: 'QRN-RGL-01',
    aisle: 'Q',
    rack: 'QRN',
    shelf: '01',
    bin: 'A',
    capacity_kg: 500,
    is_active: true,
    is_cross_dock: false,
    is_entry_point: false,
    is_exit_point: false
  });

  // Seed vendor cards
  db.vendor_cards = [
    {
      id: 'VC-01',
      sku_id: 'SKU-CHICK',
      supplier_id: 'S-KENCHIC',
      supplier_sku_code: 'KEN-WCH-1.2',
      supplier_unit: 'case',
      units_per_supplier_unit: 10,
      moq: 5,
      lead_time_days: 2,
      price_kes: 400000,
      is_preferred: true,
      is_active: true,
      notes: 'Kenchic direct whole chicken supply',
      created_by: 'U-ADMIN',
      created_at: new Date().toISOString()
    },
    {
      id: 'VC-02',
      sku_id: 'SKU-CHICK',
      supplier_id: 'S-NAIROBI-GREENS',
      supplier_sku_code: 'VAL-CHICK-LB',
      supplier_unit: 'each',
      units_per_supplier_unit: 1,
      moq: 20,
      lead_time_days: 1,
      price_kes: 48000,
      is_preferred: false,
      is_active: true,
      notes: 'Valley Fresh fallback poultry',
      created_by: 'U-ADMIN',
      created_at: new Date().toISOString()
    }
  ];

  // Seed zoning separation rules
  db.zoning_separation_rules = [
    {
      id: 'RULE-ETH-01',
      warehouse_id: 'RGN',
      rule_type: 'ethylene_separation',
      class_a: 'fresh_produce',
      class_b: 'fresh_produce',
      require_different_zones: false,
      minimum_distance_m: 2,
      notes: 'Separate ethylene producers from sensitive produce',
      created_by: 'U-ADMIN',
      created_at: new Date().toISOString()
    }
  ];

  // Deliver order ORD-2001 & add successful delivery
  const ord2001 = db.customer_orders.find(o => o.id === 'ORD-2001');
  if (ord2001) {
    ord2001.status = 'delivered';
  }
  const demoDelivery = {
    id: 'DEL-2001',
    order_id: 'ORD-2001',
    driver_id: 'U-DRIVER',
    vehicle_id: 'VEH-01',
    tote_count: 3,
    status: 'delivered' as const,
    dispatched_at: '2026-06-15T09:00:00Z',
    delivered_at: '2026-06-15T10:00:00Z',
    delivery_latitude: -1.265,
    delivery_longitude: 36.801,
    signature_url: 'https://signature.url',
    failure_reason: null
  };
  db.deliveries.push(demoDelivery);

  // Seed demo return in 'received_at_warehouse' status
  db.return_counter = 1;
  db.customer_returns = [
    {
      id: 'RET-DEMO-01',
      return_number: 'RET-0001',
      order_id: 'ORD-2001',
      delivery_id: 'DEL-2001',
      customer_id: 'C-01',
      customer_name: 'Carrefour Sarit Centre',
      return_type: 'post_delivery',
      status: 'received_at_warehouse',
      raised_by: 'U-OPS-A',
      raised_at: '2026-06-16T11:00:00Z',
      reason_summary: 'Product arrived damaged',
      physical_collection_required: true,
      collection_driver_id: 'U-DRIVER',
      collection_scheduled_at: '2026-06-16T12:00:00Z',
      collected_at: '2026-06-16T14:00:00Z',
      collection_temp_celsius: 3.5,
      received_at_warehouse_id: 'RGN',
      received_by: 'U-RECEIVER',
      received_at: '2026-06-16T15:00:00Z',
      receipt_temp_celsius: 4.0,
      total_credit_value_kes: 58000,
      credit_issued: false,
      credit_issued_at: null,
      closed_at: null,
      notes: 'Customer reported whole chicken packaging torn.',
      lines: [
        {
          id: 'RETL-0001-A',
          order_line_id: 'OL-2001-B',
          sku_id: 'SKU-CHICK',
          sku_name: 'Kenchic Whole Chicken 1.2kg',
          batch_id: 'B-CHICK-EXP-EARLY',
          batch_number: 'BTC-20260612-C',
          qty_returned: 1,
          reason: 'Product arrived damaged',
          temp_zone: 'chilled',
          cold_chain_intact: true,
          disposition: null,
          restocked_to_location_id: null,
          write_off_id: null,
          credit_value_kes: 58000,
          inspected_by: null,
          inspected_at: null
        }
      ]
    }
  ];

  db.skus.forEach(s => {
    s.readiness_pct = computeReadinessPct(s, db.categories);
  });

  // Recalculate Batch available totals based on Ledger entries
  db.batches.forEach(b => {
    b.quantity_available = getStockForBatch(b.id);
  });
  await saveState();
  console.log('WMS state initialized and persists to state.json');
}

// --- DYNAMIC STOCK CALCULATION ENGINE ---
// Authoritative stock counts always sum the Stock Ledger entries
function getStockForBatchAndLocation(batchId: string, locationId: string): number {
  return db.stock_ledger
    .filter(entry => entry.batch_id === batchId && entry.location_id === locationId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function getStockForBatch(batchId: string): number {
  return db.stock_ledger
    .filter(entry => entry.batch_id === batchId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function getStockForLocation(locationId: string): number {
  return db.stock_ledger
    .filter(entry => entry.location_id === locationId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

// SKU total stock across a warehouse or entire system
function getSKUTotalStock(skuId: string, warehouseId?: string): number {
  return db.stock_ledger
    .filter(entry => entry.sku_id === skuId && (!warehouseId || entry.warehouse_id === warehouseId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

// Enforce Centralized Ledger Write (Core Rule verification inside transactions)
function writeLedgerEntry(entry: {
  sku_id: string;
  batch_id: string;
  location_id: string;
  warehouse_id: string;
  quantity: number; // positive = added, negative = removed
  transaction_type: TransactionType;
  reference_id: string;
  reference_type: 'goods_receipt' | 'transfer' | 'pick_list' | 'cycle_count' | 'write_off' | 'return' | 'production_run' | 'assembly_order';
  user_id: string;
  notes: string | null;
}) {
  const sku = db.skus.find(s => s.id === entry.sku_id);
  if (sku?.is_bundle) {
    throw {
      code: 'BUNDLES_CANNOT_HAVE_STOCK',
      message: `SKU ${entry.sku_id} is a bundle and cannot have physical stock written to the ledger.`,
      status: 400
    };
  }

  // Check negative stock boundary
  const currentStock = getStockForBatchAndLocation(entry.batch_id, entry.location_id);
  const projectedStock = currentStock + entry.quantity;
  
  if (projectedStock < 0) {
    throw {
      code: 'INSUFFICIENT_STOCK',
      message: `Cannot write ledger entry: transaction of ${entry.quantity} would result in negative stock (${projectedStock}) at Location ${entry.location_id} for Batch ${entry.batch_id}`,
      details: { current: currentStock, requested: entry.quantity, location_id: entry.location_id }
    };
  }

  // Create absolute ledger line
  const newEntry: StockLedgerEntry = {
    id: `LED-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  db.stock_ledger.push(newEntry);

  // Synchronize batch availability cache immediately!
  const batch = db.batches.find(b => b.id === entry.batch_id);
  if (batch) {
    batch.quantity_available = getStockForBatch(entry.batch_id);
    if (batch.quantity_available <= 0) {
      batch.status = 'depleted';
    } else if (batch.status !== 'quarantine') {
      batch.status = 'active';
    }
  }

  return newEntry;
}

// Enforce Cold Chain Temperature Zones
function validateTemperatureZone(skuId: string, locationId: string): { allowed: boolean; details?: string } {
  const sku = db.skus.find(s => s.id === skuId);
  const location = db.locations.find(l => l.id === locationId);
  if (!sku || !location) return { allowed: false, details: 'SKU or Location not found' };

  const zone = db.zones.find(z => z.id === location.zone_id);
  if (!zone) return { allowed: false, details: 'Zone not found' };

  const skuTemp = sku.temp_zone;
  const zoneTemp = zone.type;

  // Rule: Chilled/frozen can ONLY go in chilled/frozen zones. Ambient can ONLY go in ambient/cool zones.
  if ((skuTemp === 'chilled' || skuTemp === 'frozen') && (zoneTemp === 'ambient' || zoneTemp === 'cool')) {
    return { allowed: false, details: `Mismatched temperature zones: SKU category is '${skuTemp}', but targeted zone is '${zoneTemp}'.` };
  }
  if ((skuTemp === 'ambient' || skuTemp === 'cool') && (zoneTemp === 'chilled' || zoneTemp === 'frozen')) {
    return { allowed: false, details: `Mismatched temperature zones: SKU category is '${skuTemp}', but targeted zone is '${zoneTemp}'.` };
  }

  return { allowed: true };
}

// Rate Limit tracking store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function handleRateLimit(keyId: string, limit: number, res: any): boolean {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000) * 60000;
  const resetAt = currentMinute + 60000;

  const storeKey = `${keyId}-${currentMinute}`;
  let clientLimit = rateLimitStore.get(storeKey);

  if (!clientLimit) {
    clientLimit = { count: 0, resetAt };
    rateLimitStore.set(storeKey, clientLimit);
  }

  clientLimit.count++;

  const remaining = Math.max(0, limit - clientLimit.count);

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetAt));

  if (clientLimit.count > limit) {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Try again in the next minute.'
      }
    });
    return false;
  }
  return true;
}

// Generate secure API Keys
function generateAPIKey(): { rawKey: string; keyHash: string } {
  const bytes = crypto.randomBytes(24);
  const rawKey = CONFIG.API_KEY_PREFIX + '_' + bytes.toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyHash };
}

// Active Server-Sent Events clients
const sseClients = new Set<any>();

// Dispatch alerts to Webhooks
async function fireWebhooks(trigger: string, payload: any) {
  const active = (db.notification_webhooks || []).filter(
    (w: any) => w.is_active && w.triggers?.includes(trigger)
  );

  active.forEach(async (webhook: any) => {
    const deliveryId = 'WD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const delivery: any = {
      id: deliveryId,
      webhook_id: webhook.id,
      trigger,
      payload_summary: JSON.stringify(payload).slice(0, 200),
      status: 'pending',
      http_status: null,
      attempted_at: new Date().toISOString(),
      response_ms: null
    };

    if (!db.webhook_deliveries) db.webhook_deliveries = [];
    db.webhook_deliveries.unshift(delivery);
    if (db.webhook_deliveries.length > 1000) {
      db.webhook_deliveries = db.webhook_deliveries.slice(0, 1000);
    }
    saveState();

    const startMs = Date.now();
    fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FreshOps-Event': trigger,
        'X-FreshOps-Tenant': db.tenant_id || CONFIG.TENANT_ID,
        'X-FreshOps-Delivery': deliveryId,
      },
      body: JSON.stringify({
        event: trigger,
        tenant_id: db.tenant_id || CONFIG.TENANT_ID,
        timestamp: new Date().toISOString(),
        data: payload
      })
    })
    .then(async r => {
      delivery.status = r.ok ? 'delivered' : 'failed';
      delivery.http_status = r.status;
      delivery.response_ms = Date.now() - startMs;
      saveState();
    })
    .catch(async () => {
      delivery.status = 'failed';
      delivery.response_ms = Date.now() - startMs;
      saveState();
    });
  });
}

// Standard helper to create a system notification
async function createNotification(
  trigger: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'critical',
  options: {
    reference_id?: string;
    reference_type?: string;
    warehouse_id?: string;
    target_roles?: string[];
  } = {}
): Promise<WMSNotification> {
  db.notification_counter = (db.notification_counter || 0) + 1;
  const notif: WMSNotification = {
    id: 'NOTIF-' + String(db.notification_counter).padStart(5, '0'),
    trigger: trigger as any,
    title,
    message,
    severity,
    reference_id: options.reference_id || null,
    reference_type: options.reference_type || null,
    warehouse_id: options.warehouse_id || null,
    target_roles: options.target_roles || ['admin', 'ops_manager'],
    is_read: false,
    created_at: new Date().toISOString(),
    read_at: null,
    read_by: null
  };

  if (!db.notifications) db.notifications = [];
  db.notifications.unshift(notif);

  if (db.notifications.length > CONFIG.NOTIFICATION_RETENTION) {
    db.notifications = db.notifications.slice(0, CONFIG.NOTIFICATION_RETENTION);
  }
  await saveState();

  // Broadcast to Server-Sent Event (SSE) clients
  const ssePayload = `event: wms_notification\ndata: ${JSON.stringify(notif)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(ssePayload);
    } catch (err) {
      console.error('Failed to write to SSE client:', err);
    }
  });

  // Fire Webhooks
  try {
    fireWebhooks(trigger, notif);
  } catch (err) {
    console.error('Failed to trigger webhooks:', err);
  }

  return notif;
}

function buildStagesFromTemplate(template: WorkflowTemplate, raisedByUserId: string): any[] {
  return template.stages.map(ts => {
    // Resolve 'REPORTS_TO_CREATOR' at runtime
    let resolvedUserId = ts.required_user_id;
    if (ts.required_user_id === 'REPORTS_TO_CREATOR') {
      const creator = (db.users || []).find(u => u.id === raisedByUserId);
      resolvedUserId = creator?.reports_to_user_id || null;
    }
    return {
      stage: ts.stage,
      label: ts.label,
      required_user_id: resolvedUserId,
      required_role: ts.required_role || (resolvedUserId ? null : 'ops_manager'), // fallback
      required_permission: ts.required_permission,
      status: 'pending',
      actioned_by: null,
      actioned_at: null,
      notes: null
    };
  });
}

function getBundleAvailability(bd: BundleDefinition): number {
  let virtualStock = Infinity;
  for (const comp of (bd.components || [])) {
    const compAvail = (db.batches || [])
      .filter(b => b.sku_id === comp.sku_id && b.status === 'active')
      .reduce((sum, b) => {
        const reservations = (db.stock_reservations || [])
          .filter(r => r.batch_id === b.id && r.status === 'active')
          .reduce((s, r) => s + r.qty_reserved, 0);
        return sum + Math.max(0, b.quantity_available - reservations);
      }, 0);
    
    const skuLevelReservations = (db.stock_reservations || [])
      .filter(r => r.sku_id === comp.sku_id && r.status === 'active' && !r.batch_id)
      .reduce((sum, r) => sum + r.qty_reserved, 0);

    const actualAvail = Math.max(0, compAvail - skuLevelReservations);
    const maxFromComp = Math.floor(actualAvail / comp.qty);
    if (maxFromComp < virtualStock) {
      virtualStock = maxFromComp;
    }
  }
  return virtualStock === Infinity ? 0 : virtualStock;
}

function checkBundleDeactivationCascades() {
  const now = new Date();
  (db.bundle_definitions || []).forEach(bd => {
    if (!bd.is_active) return;
    
    let virtualStock = Infinity;
    for (const comp of (bd.components || [])) {
      const compAvail = (db.batches || [])
        .filter(b => b.sku_id === comp.sku_id && b.status === 'active' && new Date(b.expiry_date) > now)
        .reduce((sum, b) => sum + b.quantity_available, 0);
      
      const maxFromComp = Math.floor(compAvail / comp.qty);
      if (maxFromComp < virtualStock) {
        virtualStock = maxFromComp;
      }
    }
    if (virtualStock === Infinity) virtualStock = 0;

    if (virtualStock === 0) {
      const bundleSku = db.skus.find(s => s.id === bd.bundle_sku_id);
      if (bundleSku) {
        createNotification(
          'BUNDLE_DEACTIVATION_WARNING',
          'Bundle Deactivation Warning',
          `Bundle SKU ${bundleSku.id} (${bundleSku.name}) can no longer be fulfilled due to component shortage.`,
          'critical',
          { reference_id: bd.id, reference_type: 'bundle_definition' }
        );
      }
    }
  });
}

function getExpiryAlertDays(skuId: string): number {
  const sku = db.skus.find((s: any) => s.id === skuId);
  if (sku?.expiry_alert_days != null) return sku.expiry_alert_days;
  const cat = db.categories?.find((c: any) => c.id === sku?.category_id);
  if (cat?.expiry_alert_days != null) return cat.expiry_alert_days;
  return CONFIG.EXPIRY_ALERT_DAYS_DEFAULT;
}

// Scheduled check processor
function runScheduledNotificationChecks() {
  const now = new Date();

  // EXPIRY_ALERT — batches with 1 to X days to expiry, qty > 0
  (db.batches || [])
    .filter(b => b.status === 'active' && b.quantity_available > 0)
    .forEach(b => {
      const alertDays = getExpiryAlertDays(b.sku_id);
      const daysLeft = (new Date(b.expiry_date).getTime() - now.getTime()) / 86400000;
      if (daysLeft > 0 && daysLeft <= alertDays) {
        const recentExists = (db.notifications || []).some(n =>
          n.trigger === 'EXPIRY_ALERT' &&
          n.reference_id === b.id &&
          (now.getTime() - new Date(n.created_at).getTime()) < 12 * 3600000
        );
        if (!recentExists) {
          const sku = db.skus.find(s => s.id === b.sku_id);
          const affectedBundles = (db.bundle_definitions || []).filter(bd =>
            bd.is_active &&
            bd.components.some(c => c.sku_id === b.sku_id)
          );
          let extraMsg = '';
          if (affectedBundles.length > 0) {
            const bundleNames = affectedBundles.map(bd => bd.name);
            extraMsg = ' This is a component of: ' + bundleNames.join(', ');
          }
          createNotification(
            'EXPIRY_ALERT',
            `Expiry Alert: ${sku?.name || b.sku_id}`,
            `Batch ${b.batch_number} expires in ${Math.ceil(daysLeft)} day(s). ` +
            `Qty: ${b.quantity_available} units at ${b.warehouse_id}.` + extraMsg,
            daysLeft <= 1 ? 'critical' : 'warning',
            { reference_id: b.id, reference_type: 'batch', warehouse_id: b.warehouse_id }
          );
        }
      }
    });

  // EXPIRED_STOCK_IN_BIN — batches past expiry still active with qty > 0
  (db.batches || [])
    .filter(b => b.status === 'active' && b.quantity_available > 0 && new Date(b.expiry_date) < now)
    .forEach(b => {
      const recentExists = (db.notifications || []).some(n =>
        n.trigger === 'EXPIRED_STOCK_IN_BIN' &&
        n.reference_id === b.id &&
        (now.getTime() - new Date(n.created_at).getTime()) < 12 * 3600000
      );
      if (!recentExists) {
        const sku = db.skus.find(s => s.id === b.sku_id);
        createNotification(
          'EXPIRED_STOCK_IN_BIN',
          `Expired Stock in Bin: ${sku?.name || b.sku_id}`,
          `Batch ${b.batch_number} expired on ${new Date(b.expiry_date).toLocaleDateString()}. ` +
          `${b.quantity_available} units still showing as active at ${b.warehouse_id}.`,
          'critical',
          { reference_id: b.id, reference_type: 'batch', warehouse_id: b.warehouse_id }
        );
      }
    });

  // REORDER_LEVEL_BREACHED — SKUs where total stock < reorder_level
  (db.skus || [])
    .filter(s => s.is_active)
    .forEach(s => {
      const totalStock = getSKUTotalStock(s.id);
      if (totalStock < s.reorder_level) {
        const recentExists = (db.notifications || []).some(n =>
          n.trigger === 'REORDER_LEVEL_BREACHED' &&
          n.reference_id === s.id &&
          (now.getTime() - new Date(n.created_at).getTime()) < 24 * 3600000
        );
        if (!recentExists) {
          createNotification(
            'REORDER_LEVEL_BREACHED',
            `Reorder Alert: ${s.name}`,
            `Stock at ${totalStock} units, below reorder level of ${s.reorder_level}. ` +
            `Suggested order qty: ${s.reorder_qty} units.`,
            'warning',
            { reference_id: s.id, reference_type: 'sku' }
          );
        }
      }
    });

  // OVERSTOCKED_SKU — SKUs where total stock > max_stock_level (if set)
  (db.skus || [])
    .filter(s => s.is_active && s.max_stock_level != null)
    .forEach(s => {
      const totalStock = getSKUTotalStock(s.id);
      if (s.max_stock_level && totalStock > s.max_stock_level) {
        const recentExists = (db.notifications || []).some(n =>
          n.trigger === 'OVERSTOCKED_SKU' &&
          n.reference_id === s.id &&
          (now.getTime() - new Date(n.created_at).getTime()) < 24 * 3600000
        );
        if (!recentExists) {
          createNotification(
            'OVERSTOCKED_SKU',
            `Overstock Alert: ${s.name}`,
            `Stock at ${totalStock} units, above max of ${s.max_stock_level}.`,
            'info',
            { reference_id: s.id, reference_type: 'sku' }
          );
        }
      }
    });

  // CATALOGUE_STOCK_NO_PUBLISH — active stock for SKU not published
  (db.skus || [])
    .filter(s => s.is_active && (s as any).publication_status && (s as any).publication_status !== 'published')
    .forEach(s => {
      const totalStock = getSKUTotalStock(s.id);
      if (totalStock > 0) {
        const recentExists = (db.notifications || []).some(n =>
          n.trigger === 'CATALOGUE_STOCK_NO_PUBLISH' &&
          n.reference_id === s.id &&
          (now.getTime() - new Date(n.created_at).getTime()) < 24 * 3600000
        );
        if (!recentExists) {
          createNotification(
            'CATALOGUE_STOCK_NO_PUBLISH',
            `Stock without live listing: ${s.name}`,
            `${totalStock} units in stock but SKU is not published.`,
            'warning',
            { reference_id: s.id, reference_type: 'sku' }
          );
        }
      }
    });

  // DELIVERY_LATE — dispatched deliveries not confirmed after X hours
  (db.deliveries || [])
    .filter(d => d.status === 'dispatched')
    .forEach(d => {
      if (d.dispatched_at) {
        const hoursSince = (now.getTime() - new Date(d.dispatched_at).getTime()) / 3600000;
        if (hoursSince > CONFIG.DELIVERY_LATE_HOURS) {
          const recentExists = (db.notifications || []).some(n =>
            n.trigger === 'DELIVERY_LATE' &&
            n.reference_id === d.id &&
            (now.getTime() - new Date(n.created_at).getTime()) < 3 * 3600000
          );
          if (!recentExists) {
            createNotification(
              'DELIVERY_LATE',
              'Late Delivery Alert',
              `Delivery ${d.id} dispatched ${hoursSince.toFixed(1)} hours ago with no confirmation.`,
              'warning',
              { reference_id: d.id, reference_type: 'delivery' }
            );
          }
        }
      }
    });
}

// Setup Express application
async function startServer() {
// Connect the database adapter before loading state
  const adapterType = process.env.DATABASE_ADAPTER || 'json';
  if (adapterType !== 'json') {
    try {
      console.log(`[startup] Connecting via ${adapterType} adapter...`);
      await dbAdapter.connect();
      console.log(`[startup] Adapter connected.`);
    } catch (err) {
      console.error(`[startup] FATAL: Could not connect adapter:`, err);
      process.exit(1);
    }
  }

  await loadState();

  const app = express();
  app.use(express.json());

  // Removed API versioning redirection shim - native V1 mapping active

  // Global API Key Authentication & Rate Limiting Middleware
  async function apiKeyAuth(req: any, res: any, next: any) {
    const pathPart = req.path;

    // Exclusions: auth simulation, diagnostics, SSE and config endpoints bypass API key checks
    const isExcluded = 
      pathPart.includes('/auth/') ||
      pathPart.includes('/admin/config') ||
      pathPart.includes('/openapi.json') ||
      pathPart.includes('/tests/') ||
      pathPart.includes('/state/') ||
      pathPart.includes('/events');

    if (isExcluded) {
      return next();
    }

    // Bypass check if active browser simulated user session exists
    if (db.currentUser) {
      return next();
    }

    let rawKey = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      rawKey = authHeader.substring(7).trim();
    } else if (req.query.api_key) {
      rawKey = String(req.query.api_key).trim();
    }

    if (!rawKey) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization required. Please log in or provide an API Key.'
        }
      });
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKeyRecord = (db.api_keys || []).find(k => k.key_hash === keyHash);

    if (!apiKeyRecord) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API Key provided.'
        }
      });
    }

    if (!apiKeyRecord.is_active) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'This API Key is deactivated.'
        }
      });
    }

    // Enforce rate limiter
    const isInternal = apiKeyRecord.scopes.includes('admin');
    const limit = isInternal ? CONFIG.RATE_LIMIT_INTERNAL : CONFIG.RATE_LIMIT_EXTERNAL;

    if (!handleRateLimit(apiKeyRecord.id, limit, res)) {
      return;
    }

    apiKeyRecord.last_used_at = new Date().toISOString();
    apiKeyRecord.usage_count = (apiKeyRecord.usage_count || 0) + 1;
    await saveState();

    req.apiKey = apiKeyRecord;
    req.scopes = apiKeyRecord.scopes;

    // Map to virtualCurrentUser so standard role checking passes downstream
    let virtualRole = 'receiver';
    if (apiKeyRecord.scopes.includes('admin')) {
      virtualRole = 'admin';
    } else if (apiKeyRecord.scopes.some(s => s.startsWith('orders:'))) {
      virtualRole = 'ops_manager';
    }

    const previousUser = db.currentUser;
    db.currentUser = {
      id: 'api-key-user-' + apiKeyRecord.id,
      email: 'api-key-' + apiKeyRecord.id + '@freshops.local',
      name: apiKeyRecord.name,
      role: virtualRole as any,
      primary_warehouse_id: 'W-MAIN',
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      is_active: true,
      phone: null,
      password_hash: null,
      must_reset_password: false,
      reports_to_user_id: null
    };

    res.on('finish', async () => {
      db.currentUser = previousUser;
      await saveState();
    });

    next();
  }

  app.use(apiKeyAuth);

  // --- REST ENDPOINTS (API CONTRACT) ---

  // Auth Simulation & Login
  app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }
    if (!user.is_active) {
      return res.status(401).json({
        error: { code: 'ACCOUNT_DISABLED', message: 'This account is deactivated by an administrator' }
      });
    }
    if (!password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }
    db.currentUser = user;
    user.last_login_at = new Date().toISOString();
    logAudit('USER_LOGIN', 'User', user.id, `User ${user.name} logged in from portal`);
    await saveState();
    res.json({
      token: `simulated-jwt-${user.id}`,
      expires_at: new Date(Date.now() + 3600*1000).toISOString(),
      user,
      must_reset_password: user.must_reset_password === true
    });
  });

  app.get('/api/v1/auth/current', (req, res) => {
    res.json({ user: db.currentUser });
  });

  app.post('/api/v1/auth/current', (req, res) => {
    const { userId } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (user) {
      db.currentUser = user;
      logAudit('ROLE_SESSION_SWITCHED', 'User', user.id, `Switched backend active session to user ${user.name} (${user.role})`);
      return res.json({ success: true, user });
    }
    res.status(404).json({ error: 'User not found' });
  });

  app.post('/api/v1/auth/session', async (req, res) => {
    const { userId } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (user) {
      db.currentUser = user;
      await saveState();
      return res.json({ success: true, user });
    }
    res.status(404).json({ error: 'User not found' });
  });

  app.post('/api/v1/auth/logout', async (req, res) => {
    db.currentUser = null;
    await saveState();
    res.json({ success: true });
  });

  // Users management (for setting active/inactive or roles in UI)
  app.get('/api/v1/users', (req, res) => {
    res.json({ data: db.users });
  });

  app.patch('/api/v1/users/:id', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only an administrator can modify user accounts.' }
      });
    }
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Only allow specific fields to be changed via this endpoint —
    // do not allow arbitrary Object.assign of the full request body,
    // which could otherwise be used to overwrite id, created_at, or
    // other fields that should never change after creation.
    const allowedFields = ['role', 'is_active', 'primary_warehouse_id', 'name', 'email', 'custom_role_id', 'reports_to_user_id'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        (user as any)[field] = req.body[field] || null;
      }
    });

    await saveState();
    res.json({ data: user });
  });

  app.post('/api/v1/users', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only an administrator can create user accounts.' }
      });
    }

    const { name, email, phone, role, custom_role_id, primary_warehouse_id, reports_to_user_id } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Name is required and must be at least 2 characters.', field: 'name' }
      });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.', field: 'email' }
      });
    }
    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists.', field: 'email' }
      });
    }
    if (!primary_warehouse_id || !db.warehouses.find(w => w.id === primary_warehouse_id)) {
      return res.status(400).json({
        error: { code: 'INVALID_WAREHOUSE', message: 'A valid primary warehouse is required.', field: 'primary_warehouse_id' }
      });
    }

    // Exactly one of role (built-in) or custom_role_id must be set
    const VALID_ROLES = ['admin', 'ops_manager', 'receiver', 'picker', 'driver', 'auditor'];
    const hasBuiltInRole = role && VALID_ROLES.includes(role);
    const hasCustomRole = custom_role_id && (db.custom_roles || []).find(r => r.id === custom_role_id);

    if (!hasBuiltInRole && !hasCustomRole) {
      return res.status(400).json({
        error: { code: 'INVALID_ROLE', message: 'A valid built-in role or an existing custom role must be assigned.', field: 'role' }
      });
    }

    const tempPassword = generateTempPassword();

    const newUser = {
      id: `U-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      password_hash: hashPassword(tempPassword),
      must_reset_password: true,
      role: hasBuiltInRole ? role : 'picker', // safe minimal-privilege
        // fallback label when a custom role is assigned — the
        // actual access is governed entirely by custom_role_id
        // once set (see userHasPermission), this field is only a
        // display/legacy fallback in that case
      custom_role_id: hasCustomRole ? custom_role_id : null,
      primary_warehouse_id,
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null,
      reports_to_user_id: reports_to_user_id || null
    };

    db.users.push(newUser);
    logAudit('USER_CREATED', 'User', newUser.id, `User account created for ${newUser.name} (${newUser.email}) by ${db.currentUser.name}`);
    await saveState();

    // Return the temp password ONCE, in this response only. It is
    // never stored in plaintext and never retrievable again after
    // this response — same one-time-reveal pattern already used
    // for API key generation elsewhere in this file.
    res.json({
      data: newUser,
      temp_password: tempPassword
    });
  });

  app.post('/api/v1/auth/reset-password', async (req, res) => {
    const { user_id, current_password, new_password } = req.body;

    const user = db.users.find(u => u.id === user_id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    if (!verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' }
      });
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({
        error: { code: 'PASSWORD_TOO_SHORT', message: 'New password must be at least 8 characters.', field: 'new_password' }
      });
    }

    if (verifyPassword(new_password, user.password_hash)) {
      return res.status(400).json({
        error: { code: 'PASSWORD_UNCHANGED', message: 'New password must be different from your current password.', field: 'new_password' }
      });
    }

    user.password_hash = hashPassword(new_password);
    user.must_reset_password = false;
    logAudit('PASSWORD_RESET', 'User', user.id, `User ${user.name} changed their password`);
    await saveState();

    res.json({ data: { success: true } });
  });



  // Custom role CRUD endpoints
  app.get('/api/v1/custom-roles', (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can view custom roles.' } });
    }
    res.json({ data: db.custom_roles || [] });
  });

  app.post('/api/v1/custom-roles', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can create custom roles.' } });
    }
    const { name, description, permissions } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Role name is required and must be at least 2 characters.', field: 'name' }
      });
    }
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        error: { code: 'PERMISSIONS_REQUIRED', message: 'At least one permission must be selected for this role.', field: 'permissions' }
      });
    }
    const VALID_PERMISSIONS = [
      'receiving:view', 'receiving:create', 'catalogue:view', 'bundles:manage',
      'cycle_counts:create', 'cycle_counts:approve', 'write_offs:create', 'write_offs:approve',
      'transfers:create', 'transfers:approve', 'picking:execute', 'packing:execute',
      'dispatch:execute', 'deliveries:view', 'returns:manage', 'eod_check:execute',
      'traceability:view', 'recalls:initiate', 'recalls:execute',
      'assembly_templates:approve', 'production:execute', 'margin_report:view',
      'api_keys:manage', 'webhooks:manage', 'settings:manage', 'users:manage', 'finance:approve'
    ];
    const invalidPerms = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      return res.status(400).json({
        error: { code: 'INVALID_PERMISSIONS', message: `Unrecognised permission(s): ${invalidPerms.join(', ')}` }
      });
    }
    const newRole = {
      id: `ROLE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      description: description || null,
      permissions,
      created_by: db.currentUser.id,
      created_at: new Date().toISOString()
    };
    if (!db.custom_roles) db.custom_roles = [];
    db.custom_roles.push(newRole);
    await saveState();
    res.json({ data: newRole });
  });

  app.patch('/api/v1/custom-roles/:id', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can modify custom roles.' } });
    }
    const customRole = (db.custom_roles || []).find(r => r.id === req.params.id);
    if (!customRole) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom role not found' } });
    if (req.body.name !== undefined) customRole.name = req.body.name;
    if (req.body.description !== undefined) customRole.description = req.body.description;
    if (req.body.permissions !== undefined) {
      if (!Array.isArray(req.body.permissions) || req.body.permissions.length === 0) {
        return res.status(400).json({
          error: { code: 'PERMISSIONS_REQUIRED', message: 'At least one permission must remain selected.' }
        });
      }
      customRole.permissions = req.body.permissions;
    }
    await saveState();
    res.json({ data: customRole });
  });

  app.delete('/api/v1/custom-roles/:id', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can delete custom roles.' } });
    }
    const usersWithRole = db.users.filter(u => u.custom_role_id === req.params.id);
    if (usersWithRole.length > 0) {
      return res.status(422).json({
        error: { code: 'ROLE_IN_USE', message: `Cannot delete: ${usersWithRole.length} user(s) currently have this role assigned. Reassign them first.` }
      });
    }
    db.custom_roles = (db.custom_roles || []).filter(r => r.id !== req.params.id);
    await saveState();
    res.json({ data: { deleted: true } });
  });

  // Clone a custom role
  app.post('/api/v1/custom-roles/:id/clone', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can clone custom roles.' } });
    }
    const source = (db.custom_roles || []).find(r => r.id === req.params.id);
    if (!source) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom role not found' } });
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'NAME_REQUIRED', message: 'A name is required for the cloned role.', field: 'name' } });
    }
    if ((db.custom_roles || []).some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ error: { code: 'NAME_EXISTS', message: 'A custom role with that name already exists.', field: 'name' } });
    }
    const clone = {
      id: `ROLE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      description: source.description,
      permissions: [...source.permissions],
      created_by: db.currentUser.id,
      created_at: new Date().toISOString()
    };
    if (!db.custom_roles) db.custom_roles = [];
    db.custom_roles.push(clone);
    await saveState();
    res.json({ data: clone });
  });

  // List users assigned to a custom role
  app.get('/api/v1/custom-roles/:id/users', (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only.' } });
    }
    const role = (db.custom_roles || []).find(r => r.id === req.params.id);
    if (!role) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom role not found' } });
    const users = (db.users || []).filter(u => u.custom_role_id === req.params.id)
      .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    res.json({ data: users });
  });

  // Bulk-reassign all users off a custom role
  app.post('/api/v1/custom-roles/:id/bulk-reassign', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an administrator can bulk-reassign roles.' } });
    }
    const role = (db.custom_roles || []).find(r => r.id === req.params.id);
    if (!role) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom role not found' } });
    const { new_role_id, new_custom_role_id } = req.body;
    if (!new_role_id && !new_custom_role_id) {
      return res.status(400).json({ error: { code: 'REPLACEMENT_REQUIRED', message: 'Provide new_role_id or new_custom_role_id.' } });
    }
    const VALID_ROLES = ['admin', 'ops_manager', 'receiver', 'picker', 'driver', 'auditor'];
    if (new_role_id && !VALID_ROLES.includes(new_role_id)) {
      return res.status(400).json({ error: { code: 'INVALID_ROLE', message: `Unknown built-in role: ${new_role_id}` } });
    }
    if (new_custom_role_id && !(db.custom_roles || []).find(r => r.id === new_custom_role_id)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Target custom role not found' } });
    }
    let count = 0;
    (db.users || []).forEach(u => {
      if (u.custom_role_id === req.params.id) {
        if (new_custom_role_id) {
          u.custom_role_id = new_custom_role_id;
        } else {
          u.role = new_role_id as any;
          u.custom_role_id = null;
        }
        count++;
      }
    });
    await saveState();
    res.json({ data: { reassigned: count } });
  });

  // GET /api/v1/users/:id/permissions — effective permissions for a user
  app.get('/api/v1/users/:id/permissions', (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only.' } });
    }
    const user = (db.users || []).find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    const ALL_PERMISSIONS: Permission[] = [
      'receiving:view', 'receiving:create', 'catalogue:view', 'bundles:manage',
      'cycle_counts:create', 'cycle_counts:approve', 'write_offs:create', 'write_offs:approve',
      'transfers:create', 'transfers:approve', 'picking:execute', 'packing:execute',
      'dispatch:execute', 'deliveries:view', 'returns:manage', 'eod_check:execute',
      'traceability:view', 'recalls:initiate', 'recalls:execute',
      'assembly_templates:approve', 'production:execute', 'margin_report:view',
      'api_keys:manage', 'webhooks:manage', 'settings:manage', 'users:manage', 'finance:approve'
    ];
    const customRole = user.custom_role_id ? (db.custom_roles || []).find(r => r.id === user.custom_role_id) : null;
    const effective = user.role === 'admin'
      ? [...ALL_PERMISSIONS]
      : ALL_PERMISSIONS.filter(p => userHasPermission(user, p));
    res.json({
      data: {
        base_role: user.role,
        custom_role_id: user.custom_role_id || null,
        custom_role_permissions: customRole ? customRole.permissions : [],
        granted_permissions: user.granted_permissions || [],
        revoked_permissions: user.revoked_permissions || [],
        effective_permissions: effective
      }
    });
  });

  // PATCH /api/v1/users/:id/permissions — update per-user overrides
  app.patch('/api/v1/users/:id/permissions', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only.' } });
    }
    const user = (db.users || []).find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    if (user.role === 'admin') {
      return res.status(422).json({ error: { code: 'CANNOT_MODIFY_ADMIN', message: 'Cannot set permission overrides on admin users.' } });
    }
    const VALID_PERMISSIONS: Permission[] = [
      'receiving:view', 'receiving:create', 'catalogue:view', 'bundles:manage',
      'cycle_counts:create', 'cycle_counts:approve', 'write_offs:create', 'write_offs:approve',
      'transfers:create', 'transfers:approve', 'picking:execute', 'packing:execute',
      'dispatch:execute', 'deliveries:view', 'returns:manage', 'eod_check:execute',
      'traceability:view', 'recalls:initiate', 'recalls:execute',
      'assembly_templates:approve', 'production:execute', 'margin_report:view',
      'api_keys:manage', 'webhooks:manage', 'settings:manage', 'users:manage', 'finance:approve'
    ];
    const { granted_permissions, revoked_permissions } = req.body;
    if (granted_permissions !== undefined) {
      if (!Array.isArray(granted_permissions)) {
        return res.status(400).json({ error: { code: 'INVALID', message: 'granted_permissions must be an array' } });
      }
      const bad = granted_permissions.filter((p: string) => !VALID_PERMISSIONS.includes(p as Permission));
      if (bad.length) return res.status(400).json({ error: { code: 'INVALID_PERMISSIONS', message: `Unknown permission(s): ${bad.join(', ')}` } });
    }
    if (revoked_permissions !== undefined) {
      if (!Array.isArray(revoked_permissions)) {
        return res.status(400).json({ error: { code: 'INVALID', message: 'revoked_permissions must be an array' } });
      }
      const bad = revoked_permissions.filter((p: string) => !VALID_PERMISSIONS.includes(p as Permission));
      if (bad.length) return res.status(400).json({ error: { code: 'INVALID_PERMISSIONS', message: `Unknown permission(s): ${bad.join(', ')}` } });
    }
    // Ensure no permission appears in both arrays
    if (granted_permissions && revoked_permissions) {
      const overlap = granted_permissions.filter((p: string) => revoked_permissions.includes(p));
      if (overlap.length) {
        return res.status(400).json({ error: { code: 'OVERLAP', message: `Permission(s) cannot be in both granted and revoked: ${overlap.join(', ')}` } });
      }
    }
    if (granted_permissions !== undefined) user.granted_permissions = granted_permissions;
    if (revoked_permissions !== undefined) user.revoked_permissions = revoked_permissions;
    await saveState();
    await logAudit('USER_PERMISSIONS_UPDATED', 'User', user.id, `Permission overrides updated for ${user.name}`, { granted_permissions: user.granted_permissions, revoked_permissions: user.revoked_permissions });
    res.json({ data: { id: user.id, granted_permissions: user.granted_permissions, revoked_permissions: user.revoked_permissions } });
  });

  // List all workflow approvals — filterable by status and type
  app.get('/api/v1/workflow-approvals', (req, res) => {
    let approvals = db.workflow_approvals || [];
    if (req.query.status) {
      approvals = approvals.filter(a => a.status === req.query.status);
    }
    if (req.query.type) {
      approvals = approvals.filter(a => a.type === req.query.type);
    }
    // Only show approvals relevant to the current user:
    // admins see all; others see only approvals they raised or
    // where they are the required_user_id on the current stage
    const role = db.currentUser?.role;
    const uid = db.currentUser?.id;
    if (role !== 'admin') {
      approvals = approvals.filter(a =>
        a.raised_by === uid ||
        a.stages.some(s =>
          s.status === 'pending' && (
            s.required_user_id === uid ||
            s.required_role === role ||
            (s.required_permission && userHasPermission(db.currentUser, s.required_permission as any))
          )
        )
      );
    }
    // Enrich each approval with entity details for display
    const enriched = approvals.map(a => ({
      ...a,
      raised_by_name: (db.users || []).find(u => u.id === a.raised_by)?.name || a.raised_by,
      current_stage_detail: a.stages.find(s => s.stage === a.current_stage)
    }));
    res.json({ data: enriched });
  });

  app.get('/api/v1/workflow-templates', (req, res) => {
    res.json({ data: db.workflow_templates || [] });
  });

  app.patch('/api/v1/workflow-templates/:id', async (req, res) => {
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only admins can modify workflow templates.' }
      });
    }
    const template = (db.workflow_templates || []).find(t => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    if (req.body.name !== undefined) template.name = req.body.name;
    if (req.body.description !== undefined) template.description = req.body.description;
    if (req.body.is_active !== undefined) template.is_active = req.body.is_active;
    if (req.body.stages !== undefined) {
      // Validate stages: each must have a stage number and label,
      // and exactly one of required_user_id / required_role /
      // required_permission must be non-null (or required_user_id
      // can be 'REPORTS_TO_CREATOR')
      if (!Array.isArray(req.body.stages) || req.body.stages.length === 0) {
        return res.status(400).json({
          error: { code: 'INVALID_STAGES', message: 'At least one stage is required.' }
        });
      }
      template.stages = req.body.stages;
    }
    template.updated_at = new Date().toISOString();
    await saveState();
    res.json({ data: template });
  });

  // Action on a specific stage — approve or reject
  app.post('/api/v1/workflow-approvals/:id/action', async (req, res) => {
    const approval = (db.workflow_approvals || []).find(a => a.id === req.params.id);
    if (!approval) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workflow approval not found' } });
    }
    if (approval.status !== 'pending') {
      return res.status(422).json({ error: { code: 'ALREADY_RESOLVED', message: `This approval is already ${approval.status}.` } });
    }

    const currentStage = approval.stages.find(s => s.stage === approval.current_stage);
    if (!currentStage) {
      return res.status(500).json({ error: { code: 'STAGE_ERROR', message: 'Workflow stage not found' } });
    }

    // Check this user is allowed to action this stage
    const uid = db.currentUser?.id;
    const role = db.currentUser?.role;
    const canAction =
      role === 'admin' ||
      currentStage.required_user_id === uid ||
      currentStage.required_role === role ||
      (currentStage.required_permission &&
        userHasPermission(db.currentUser, currentStage.required_permission as any));

    if (!canAction) {
      return res.status(403).json({
        error: { code: 'NOT_YOUR_STAGE', message: 'You are not the designated approver for this stage.' }
      });
    }

    // Self-approval guard — same principle as all other approval flows
    if (approval.raised_by === uid) {
      return res.status(422).json({
        error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'You cannot approve a workflow you raised yourself.' }
      });
    }

    const { action, notes } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'action must be approve or reject' } });
    }

    currentStage.status = action === 'approve' ? 'approved' : 'rejected';
    currentStage.actioned_by = uid || null;
    currentStage.actioned_at = new Date().toISOString();
    currentStage.notes = notes || null;

    if (action === 'reject') {
      // Any rejection kills the whole workflow
      approval.status = 'rejected';
      approval.resolved_at = new Date().toISOString();
      approval.resolution_notes = notes || null;
      logAudit('WORKFLOW_REJECTED', approval.entity_type, approval.entity_id,
        `Workflow ${approval.id} rejected at stage ${approval.current_stage} by ${db.currentUser?.name}`);
    } else {
      // Move to next stage or complete
      const nextStage = approval.stages.find(s => s.stage === approval.current_stage + 1);
      if (nextStage) {
        approval.current_stage = nextStage.stage;
        // Notify the next approver
        createNotification(
          'WORKFLOW_APPROVAL_REQUIRED',
          `Approval Required: ${approval.type.replace(/_/g, ' ')}`,
          `Stage ${nextStage.stage} approval needed for ${approval.type}. ${nextStage.label}.`,
          'warning',
          {
            reference_id: approval.id,
            reference_type: 'workflow_approval',
            target_roles: nextStage.required_role ? [nextStage.required_role] : ['admin', 'ops_manager']
          }
        );
      } else {
        // All stages approved — complete the workflow
        approval.status = 'approved';
        approval.resolved_at = new Date().toISOString();
        logAudit('WORKFLOW_APPROVED', approval.entity_type, approval.entity_id,
          `Workflow ${approval.id} fully approved by all stages`);
        // Trigger post-approval actions (handled per type below)
        handleWorkflowCompletion(approval);
      }
    }

    await saveState();
    res.json({ data: approval });
  });

  // Warehouses, zones, locations
  app.get('/api/v1/warehouses', (req, res) => {
    res.json({ data: db.warehouses });
  });

  app.get('/api/v1/warehouses/:id', (req, res) => {
    const w = db.warehouses.find(wh => wh.id === req.params.id);
    if (w) return res.json({ data: w });
    res.status(404).json({ error: 'Warehouse not found' });
  });

  app.get('/api/v1/warehouses/:id/zones', (req, res) => {
    const zones = db.zones.filter(z => z.warehouse_id === req.params.id);
    res.json({ data: zones });
  });

  app.get('/api/v1/zones', (req, res) => {
    res.json({ data: db.zones });
  });

  app.get('/api/v1/zones/:id/capacity', (req, res) => {
    const zone = (db.zones || []).find((z: any) => z.id === req.params.id);
    if (!zone) {
      return res.status(404).json({
        error: { code: 'ZONE_NOT_FOUND', message: 'Zone not found' }
      });
    }

    const locsInZone = (db.locations || []).filter(
      (l: any) => l.zone_id === zone.id
    );

    const locationCapacities = locsInZone.map((loc: any) => {
      const currentKg = computeLocationWeightKg(loc.id);
      return {
        location_id: loc.id,
        location_code: loc.code,
        location_name: loc.name || loc.code,
        max_capacity_kg: loc.max_capacity_kg || null,
        current_capacity_kg: currentKg,
        utilisation_pct: loc.max_capacity_kg
          ? Math.round((currentKg / loc.max_capacity_kg) * 100)
          : null
      };
    });

    const zoneCurrent = locationCapacities.reduce(
      (sum: number, l: any) => sum + l.current_capacity_kg, 0
    );

    res.json({
      data: {
        zone_id: zone.id,
        zone_name: zone.name,
        zone_type: zone.type,
        max_capacity_kg: zone.max_capacity_kg || null,
        current_capacity_kg: Math.round(zoneCurrent * 100) / 100,
        utilisation_pct: zone.max_capacity_kg
          ? Math.round((zoneCurrent / zone.max_capacity_kg) * 100)
          : null,
        permitted_product_classes: zone.permitted_product_classes || [],
        is_quarantine_zone: zone.is_quarantine_zone || false,
        locations: locationCapacities
      }
    });
  });

  app.post('/api/v1/zones/:id/temperature', async (req, res) => {
    const { temperature } = req.body;
    const zone = db.zones.find(z => z.id === req.params.id);
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    const tempVal = parseFloat(temperature);
    zone.current_temp_celsius = tempVal;
    
    const is_breach = tempVal < zone.min_temp_celsius || tempVal > zone.max_temp_celsius;
    const recordedAt = new Date().toISOString();
    const userId = db.currentUser?.id || 'U-ADMIN';
    
    db.temp_logs.push({
      id: `TL-${Math.floor(Math.random() * 100000)}`,
      reference_id: zone.id,
      reference_type: 'location',
      temperature_celsius: tempVal,
      zone_type: zone.type,
      is_breach,
      recorded_by: userId,
      recorded_at: recordedAt,
      device_id: `SENSOR-${zone.id}`,
      notes: is_breach
        ? `🚨 Temperature breach: ${tempVal}°C is outside zone '${zone.name}' min/max limit of [${zone.min_temp_celsius}°C, ${zone.max_temp_celsius}°C]`
        : `Temperature within limits: ${tempVal}°C for zone '${zone.name}'`
    });
    
    // Auto save
    await saveState();

    res.json({ data: zone });
  });

  app.get('/api/v1/warehouses/:id/locations', (req, res) => {
    const locations = db.locations.filter(l => l.warehouse_id === req.params.id);
    res.json({ data: locations });
  });

  app.get('/api/v1/locations', (req, res) => {
    res.json({ data: db.locations });
  });

  // ---- Warehouse CRUD & deactivation ----

  app.post('/api/v1/warehouses', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const { name, code, type, address } = req.body;
    if (!name || !code || !type) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name, code and type are required' } });
    }
    const validTypes = ['main_warehouse', 'fulfilment_point'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: { code: 'INVALID_TYPE', message: `type must be one of: ${validTypes.join(', ')}` } });
    }
    if (db.warehouses.find(w => w.id === code || (w as any).code === code)) {
      return res.status(409).json({ error: { code: 'CODE_EXISTS', message: 'A warehouse with that code already exists' } });
    }
    const wh: Warehouse = {
      id: `WH-${Date.now()}`,
      name,
      type,
      address: address || '',
      is_active: true,
      created_at: new Date().toISOString()
    } as any;
    db.warehouses.push(wh);
    await saveState();
    res.status(201).json({ data: wh });
  });

  app.patch('/api/v1/warehouses/:id', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const wh = db.warehouses.find(w => w.id === req.params.id);
    if (!wh) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    const { name, type, address } = req.body;
    if (name) wh.name = name;
    if (address !== undefined) (wh as any).address = address;
    if (type) {
      const validTypes = ['main_warehouse', 'fulfilment_point'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: { code: 'INVALID_TYPE', message: `type must be one of: ${validTypes.join(', ')}` } });
      }
      wh.type = type;
    }
    await saveState();
    res.json({ data: wh });
  });

  app.patch('/api/v1/warehouses/:id/deactivate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const wh = db.warehouses.find(w => w.id === req.params.id);
    if (!wh) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    const activeZones = db.zones.filter(z => z.warehouse_id === wh.id && z.is_active);
    if (activeZones.length > 0) {
      return res.status(422).json({
        error: { code: 'HAS_ACTIVE_ZONES', message: `Cannot deactivate warehouse with ${activeZones.length} active zone(s). Deactivate zones first.` }
      });
    }
    wh.is_active = false;
    await saveState();
    res.json({ data: wh });
  });

  app.patch('/api/v1/warehouses/:id/activate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const wh = db.warehouses.find(w => w.id === req.params.id);
    if (!wh) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Warehouse not found' } });
    wh.is_active = true;
    await saveState();
    res.json({ data: wh });
  });

  // ---- Zone CRUD & deactivation ----

  app.post('/api/v1/zones', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const { name, code, warehouse_id, zone_type, min_temp_celsius, max_temp_celsius, max_capacity_kg } = req.body;
    if (!name || !code || !warehouse_id || !zone_type) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name, code, warehouse_id and zone_type are required' } });
    }
    const validZoneTypes = ['ambient', 'chilled', 'frozen', 'hazmat', 'quarantine'];
    if (!validZoneTypes.includes(zone_type)) {
      return res.status(400).json({ error: { code: 'INVALID_ZONE_TYPE', message: `zone_type must be one of: ${validZoneTypes.join(', ')}` } });
    }
    const wh = db.warehouses.find(w => w.id === warehouse_id);
    if (!wh) return res.status(404).json({ error: { code: 'WAREHOUSE_NOT_FOUND', message: 'Warehouse not found' } });
    const tempDefaults: Record<string, { min: number; max: number }> = {
      ambient: { min: 15, max: 30 },
      chilled: { min: 0, max: 8 },
      frozen: { min: -25, max: -18 },
      hazmat: { min: 10, max: 25 },
      quarantine: { min: 10, max: 25 }
    };
    const temps = tempDefaults[zone_type];
    const zone: Zone = {
      id: `Z-${Date.now()}`,
      warehouse_id,
      name,
      type: zone_type as any,
      min_temp_celsius: min_temp_celsius !== undefined ? min_temp_celsius : temps.min,
      max_temp_celsius: max_temp_celsius !== undefined ? max_temp_celsius : temps.max,
      is_active: true,
      max_capacity_kg: max_capacity_kg || null
    };
    db.zones.push(zone);
    await saveState();
    res.status(201).json({ data: zone });
  });

  app.patch('/api/v1/zones/:id/deactivate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const zone = db.zones.find(z => z.id === req.params.id);
    if (!zone) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Zone not found' } });

    const activeBins = db.bin_locations.filter(b => b.zone_id === zone.id && b.is_active);
    if (activeBins.length > 0) {
      return res.status(422).json({
        error: { code: 'HAS_ACTIVE_BIN_LOCATIONS', message: `Cannot deactivate zone with ${activeBins.length} active bin location(s). Deactivate bin locations first.` }
      });
    }
    const locIds = db.locations.filter(l => l.zone_id === zone.id).map(l => l.id);
    const activeStock = db.stock_ledger
      .filter(e => locIds.includes(e.location_id))
      .reduce((sum, e) => sum + e.quantity, 0);
    if (activeStock > 0) {
      return res.status(422).json({
        error: { code: 'ZONE_HAS_STOCK', message: 'Cannot deactivate zone with stock present. Transfer or write off stock first.' }
      });
    }
    zone.is_active = false;
    await saveState();
    res.json({ data: zone });
  });

  app.patch('/api/v1/zones/:id/activate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const zone = db.zones.find(z => z.id === req.params.id);
    if (!zone) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Zone not found' } });
    zone.is_active = true;
    await saveState();
    res.json({ data: zone });
  });

  // ---- Bin Locations CRUD & deactivation ----

  app.get('/api/v1/bin-locations', (req, res) => {
    let results = db.bin_locations;
    if (req.query.warehouse_id) results = results.filter(b => b.warehouse_id === req.query.warehouse_id);
    if (req.query.zone_id) results = results.filter(b => b.zone_id === req.query.zone_id);
    if (req.query.location_type) results = results.filter(b => b.location_type === req.query.location_type);
    if (req.query.is_active !== undefined) {
      const active = req.query.is_active === 'true';
      results = results.filter(b => b.is_active === active);
    }
    res.json({ data: results });
  });

  app.get('/api/v1/bin-locations/:id', (req, res) => {
    const b = db.bin_locations.find(bl => bl.id === req.params.id);
    if (!b) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bin location not found' } });
    res.json({ data: b });
  });

  app.post('/api/v1/bin-locations', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const { code, warehouse_id, zone_id, location_type, name, capacity_units, capacity_kg } = req.body;
    if (!code || !warehouse_id || !zone_id || !location_type) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'code, warehouse_id, zone_id and location_type are required' } });
    }
    const validTypes = ['pick', 'bulk', 'receiving', 'dispatch', 'quarantine'];
    if (!validTypes.includes(location_type)) {
      return res.status(400).json({ error: { code: 'INVALID_LOCATION_TYPE', message: `location_type must be one of: ${validTypes.join(', ')}` } });
    }
    const zone = db.zones.find(z => z.id === zone_id);
    if (!zone) return res.status(404).json({ error: { code: 'ZONE_NOT_FOUND', message: 'Zone not found' } });
    if (zone.warehouse_id !== warehouse_id) {
      return res.status(422).json({ error: { code: 'ZONE_WAREHOUSE_MISMATCH', message: 'zone_id does not belong to warehouse_id' } });
    }
    if (!zone.is_active) {
      return res.status(422).json({ error: { code: 'ZONE_INACTIVE', message: 'Cannot create bin location in an inactive zone' } });
    }
    const duplicate = db.bin_locations.find(b => b.warehouse_id === warehouse_id && b.code === code);
    if (duplicate) {
      return res.status(409).json({ error: { code: 'CODE_EXISTS', message: 'A bin location with that code already exists in this warehouse' } });
    }
    const now = new Date().toISOString();
    const bl: BinLocation = {
      id: `BL-${Date.now()}`,
      code,
      name,
      warehouse_id,
      zone_id,
      location_type,
      capacity_units: capacity_units !== undefined ? capacity_units : undefined,
      capacity_kg: capacity_kg !== undefined ? capacity_kg : undefined,
      is_active: true,
      created_at: now,
      updated_at: now
    };
    db.bin_locations.push(bl);
    await saveState();
    res.status(201).json({ data: bl });
  });

  app.patch('/api/v1/bin-locations/:id', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const bl = db.bin_locations.find(b => b.id === req.params.id);
    if (!bl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bin location not found' } });
    const { name, code, capacity_units, capacity_kg, location_type } = req.body;
    if (name !== undefined) bl.name = name;
    if (code !== undefined) {
      const dup = db.bin_locations.find(b => b.warehouse_id === bl.warehouse_id && b.code === code && b.id !== bl.id);
      if (dup) return res.status(409).json({ error: { code: 'CODE_EXISTS', message: 'Code already in use in this warehouse' } });
      bl.code = code;
    }
    if (capacity_units !== undefined) bl.capacity_units = capacity_units;
    if (capacity_kg !== undefined) bl.capacity_kg = capacity_kg;
    if (location_type !== undefined) {
      const validTypes = ['pick', 'bulk', 'receiving', 'dispatch', 'quarantine'];
      if (!validTypes.includes(location_type)) {
        return res.status(400).json({ error: { code: 'INVALID_LOCATION_TYPE', message: `location_type must be one of: ${validTypes.join(', ')}` } });
      }
      bl.location_type = location_type;
    }
    bl.updated_at = new Date().toISOString();
    await saveState();
    res.json({ data: bl });
  });

  app.patch('/api/v1/bin-locations/:id/deactivate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const bl = db.bin_locations.find(b => b.id === req.params.id);
    if (!bl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bin location not found' } });
    // Check stock assigned — look for stock ledger entries at matching location code
    const locMatch = db.locations.find(l => l.code === bl.code && l.warehouse_id === bl.warehouse_id);
    if (locMatch) {
      const stock = db.stock_ledger
        .filter(e => e.location_id === locMatch.id)
        .reduce((sum, e) => sum + e.quantity, 0);
      if (stock > 0) {
        return res.status(422).json({
          error: { code: 'BIN_HAS_STOCK', message: 'Cannot deactivate bin location with stock present.' }
        });
      }
    }
    bl.is_active = false;
    bl.updated_at = new Date().toISOString();
    await saveState();
    res.json({ data: bl });
  });

  app.patch('/api/v1/bin-locations/:id/activate', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    const bl = db.bin_locations.find(b => b.id === req.params.id);
    if (!bl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bin location not found' } });
    const zone = db.zones.find(z => z.id === bl.zone_id);
    if (!zone || !zone.is_active) {
      return res.status(422).json({ error: { code: 'ZONE_INACTIVE', message: 'Parent zone is inactive. Activate the zone first.' } });
    }
    bl.is_active = true;
    bl.updated_at = new Date().toISOString();
    await saveState();
    res.json({ data: bl });
  });

  // Dynamically calculate stock on hand by batch and location inside warehouse
  app.get('/api/v1/warehouses/:id/stock', (req, res) => {
    const whId = req.params.id;
    const stockMap: { [key: string]: { sku_id: string; sku_name: string; temp_zone: string; batch_id: string; location_id: string; qty_available: number; expiry_date: string } } = {};

    db.stock_ledger.forEach(entry => {
      if (entry.warehouse_id !== whId) return;
      const key = `${entry.batch_id}_${entry.location_id}`;
      if (!stockMap[key]) {
        const sku = db.skus.find(s => s.id === entry.sku_id);
        const batch = db.batches.find(b => b.id === entry.batch_id);
        stockMap[key] = {
          sku_id: entry.sku_id,
          sku_name: sku?.name || 'Unknown SKU',
          temp_zone: sku?.temp_zone || 'ambient',
          batch_id: entry.batch_id,
          location_id: entry.location_id,
          qty_available: 0,
          expiry_date: batch?.expiry_date || ''
        };
      }
      stockMap[key].qty_available += entry.quantity;
    });

    const activeList = Object.values(stockMap).filter(item => item.qty_available > 0);
    res.json({ data: activeList });
  });

  // SKUs
  app.get(['/api/v1/skus', '/api/v1/skus'], (req, res) => {
    const enriched = db.skus.map(sku => {
      const stock = getSKUTotalStock(sku.id);
      return { 
        ...sku, 
        current_stock: stock,
        expiry_alert_days: sku.expiry_alert_days,
        effective_expiry_alert_days: getExpiryAlertDays(sku.id)
      };
    });
    res.json({ data: enriched });
  });

  app.get('/api/v1/skus/readiness-report', (req, res) => {
    let list = (db.skus || []).filter(s => s.is_active !== false);

    const report = list.map(sku => {
      const { ok, missing } = canPublish(sku);
      return {
        sku_id: sku.id,
        name: sku.name,
        code: sku.code,
        category: db.categories.find(c => c.id === sku.category_id)?.name || null,
        readiness_pct: sku.readiness_pct || 0,
        publication_status: sku.publication_status || 'draft',
        missing_fields: missing
      };
    });

    let filtered = report;
    if (req.query.below) {
      const belowVal = parseInt(req.query.below as string);
      if (!isNaN(belowVal)) {
        filtered = report.filter(x => x.readiness_pct < belowVal);
      }
    }

    filtered.sort((a, b) => a.readiness_pct - b.readiness_pct);

    res.json({ data: filtered });
  });

  app.get(['/api/v1/skus/:id', '/api/v1/skus/:id'], (req, res) => {
    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) return res.status(404).json({ error: 'SKU not found' });
    const stock = getSKUTotalStock(sku.id);
    res.json({
      data: {
        ...sku,
        current_stock: stock,
        expiry_alert_days: sku.expiry_alert_days,
        effective_expiry_alert_days: getExpiryAlertDays(sku.id)
      }
    });
  });

  app.get('/api/v1/skus/:id/price-history', (req, res) => {
    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    const history = (db.price_history || [])
      .filter(p => p.sku_id === req.params.id)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    res.json({ data: history });
  });

  app.post('/api/v1/skus/:id/price-change', async (req, res) => {
    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    const { cost_price_kes, selling_price_kes, effective_from, reason, notes } = req.body;

    if (cost_price_kes === undefined || isNaN(parseInt(cost_price_kes))) {
      return res.status(400).json({ error: { message: 'cost_price_kes is required and must be a number.' } });
    }
    if (selling_price_kes === undefined || isNaN(parseInt(selling_price_kes))) {
      return res.status(400).json({ error: { message: 'selling_price_kes is required and must be a number.' } });
    }
    if (!reason) {
      return res.status(400).json({ error: { message: 'reason is required.' } });
    }

    const priceRecord = {
      id: `PH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      sku_id: sku.id,
      effective_from: effective_from || new Date().toISOString(),
      cost_price_kes: parseInt(cost_price_kes),
      selling_price_kes: parseInt(selling_price_kes),
      reason,
      notes: notes || null,
      changed_by: db.currentUser?.name || 'SYSTEM',
      source_po_id: null,
      created_at: new Date().toISOString()
    };

    if (!db.price_history) db.price_history = [];
    db.price_history.push(priceRecord);

    // Keep SKU in sync
    sku.cost_price_kes = parseInt(cost_price_kes);
    sku.selling_price_kes = parseInt(selling_price_kes);

    logAudit('SKU_PRICE_CHANGED', 'SKU', sku.id,
      `${sku.name} price changed. Cost: ${cost_price_kes}, Selling: ${selling_price_kes} by ${db.currentUser?.name}`
    );

    await saveState();
    res.json({ data: sku });
  });

  app.post('/api/v1/skus/:id/status-change', async (req, res) => {
    const hasPermission =
      db.currentUser?.role === 'admin' ||
      db.currentUser?.role === 'ops_manager' ||
      userHasPermission(db.currentUser, 'catalogue:view');

    if (!hasPermission) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN',
          message: 'You do not have permission to change product status.' }
      });
    }

    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'SKU not found' }
      });
    }

    const { new_status, confirm_stock_warning } = req.body;

    const VALID_STATUSES = ['draft', 'ready', 'published',
                            'blocked', 'delisted', 'archived'];
    if (!new_status || !VALID_STATUSES.includes(new_status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS',
          message: `new_status must be one of: ${VALID_STATUSES.join(', ')}` }
      });
    }

    // If moving away from published, check for stock on hand
    const movingAwayFromPublished =
      sku.publication_status === 'published' &&
      new_status !== 'published';

    if (movingAwayFromPublished && !confirm_stock_warning) {
      const stockOnHand = (db.stock_ledger || [])
        .filter((e: any) => e.sku_id === sku.id)
        .reduce((sum: number, e: any) => sum + (e.quantity !== undefined ? e.quantity : (e.qty_change || 0)), 0);

      if (stockOnHand > 0) {
        // Return 200 with requires_confirmation — NOT a 4xx error.
        // The frontend must check for this flag and show a modal.
        return res.status(200).json({
          requires_confirmation: true,
          stock_on_hand: stockOnHand,
          message: `${sku.name} has ${stockOnHand} units in stock. ` +
            `Setting to '${new_status}' will remove it from active ` +
            `ordering but stock will continue to be tracked at its ` +
            `bin locations and will appear in cycle counts. Confirm?`
        });
      }
    }

    const previousStatus = sku.publication_status;
    sku.publication_status = new_status;

    if (new_status === 'published') {
      sku.published_at = new Date().toISOString();
      sku.published_by = db.currentUser?.id || null;
      sku.is_active = true;
    } else if (new_status === 'delisted' || new_status === 'archived') {
      sku.is_active = false;
    }
    // blocked and draft: is_active stays as-is (stock tracked, not orderable)

    logAudit('SKU_STATUS_CHANGED', 'SKU', sku.id,
      `${sku.name} status: ${previousStatus} → ${new_status} ` +
      `by ${db.currentUser?.name}`
    );

    fireWebhooks('SKU_STATUS_CHANGED', {
      sku_id: sku.id,
      sku_code: sku.code,
      sku_name: sku.name,
      previous_status: previousStatus,
      new_status,
      changed_by: db.currentUser?.id,
      changed_by_name: db.currentUser?.name,
      changed_at: new Date().toISOString()
    });

    // Stock reminder notification if stock exists post-change
    if (['draft', 'blocked', 'delisted', 'archived'].includes(new_status)) {
      const stockOnHand = (db.stock_ledger || [])
        .filter((e: any) => e.sku_id === sku.id)
        .reduce((sum: number, e: any) => sum + (e.quantity !== undefined ? e.quantity : (e.qty_change || 0)), 0);

      if (stockOnHand > 0) {
        createNotification(
          'SKU_STATUS_STOCK_WARNING',
          `Stock exists for ${new_status} item: ${sku.name}`,
          `${sku.name} (${sku.code}) set to '${new_status}' but has ` +
          `${stockOnHand} units in stock. It will appear in cycle ` +
          `counts at its bin location until stock is depleted.`,
          'warning',
          {
            reference_id: sku.id,
            reference_type: 'sku',
            target_roles: ['admin', 'ops_manager']
          }
        );
      }
    }

    await saveState();
    res.json({ data: sku });
  });

  app.get('/api/v1/stock/unlocated', (req, res) => {
    const warehouseId = req.query.warehouse_id as string;

    // Get all ledger entries, optionally filtered by warehouse
    let ledgerEntries = db.stock_ledger || [];
    if (warehouseId) {
      ledgerEntries = ledgerEntries.filter(
        (e: any) => e.warehouse_id === warehouseId
      );
    }

    // Group by SKU — sum quantity per SKU
    const stockBySku: Record<string, number> = {};
    ledgerEntries.forEach((e: any) => {
      const qty = e.quantity !== undefined ? e.quantity : (e.qty_change || 0);
      stockBySku[e.sku_id] = (stockBySku[e.sku_id] || 0) + qty;
    });

    // SKUs with positive stock on hand
    const skuIdsWithStock = Object.entries(stockBySku)
      .filter(([, qty]) => qty > 0)
      .map(([skuId]) => skuId);

    // Of those, find which ones have NO ledger entry with a
    // non-null bin_location_id/location_id at all — meaning they have never
    // been assigned a bin location in this warehouse
    const skuIdsWithBin = new Set(
      ledgerEntries
        .filter((e: any) => e.bin_location_id != null || (e.location_id != null && e.location_id !== 'UNLOCATED'))
        .map((e: any) => e.sku_id)
    );

    const unlocatedSkuIds = skuIdsWithStock.filter(
      id => !skuIdsWithBin.has(id)
    );

    const unlocatedItems = unlocatedSkuIds.map(skuId => {
      const sku = (db.skus || []).find(s => s.id === skuId);
      return {
        sku_id: skuId,
        sku_code: sku?.code || skuId,
        sku_name: sku?.name || 'Unknown',
        sku_temp_zone: sku?.temp_zone || null,
        publication_status: sku?.publication_status || 'draft',
        qty_on_hand: stockBySku[skuId] || 0
      };
    }).filter(item => item.sku_name !== 'Unknown'); // exclude any orphaned ledger entries for deleted SKUs

    res.json({
      data: unlocatedItems,
      count: unlocatedItems.length
    });
  });

  app.get('/api/v1/counting-sections', (req, res) => {
    const warehouseId = req.query.warehouse_id as string;
    let sections = (db.counting_sections || [])
      .filter(s => s.is_active)
      .filter(s => !warehouseId || s.warehouse_id === warehouseId)
      .sort((a, b) => a.display_order - b.display_order);

    // Enrich each section with a live item_count
    const enriched = sections.map(section => {
      let item_count = 0;

      if (section.item_filter && section.item_filter.startsWith('status:')) {
        const status = section.item_filter.split(':')[1];
        item_count = (db.skus || []).filter(s =>
          (s.publication_status || 'draft') === status
        ).length;
      } else if (section.item_filter === 'unlocated') {
        // Count items with stock but no bin location
        const stockBySku: Record<string, number> = {};
        (db.stock_ledger || []).forEach((e: any) => {
          if (!warehouseId || e.warehouse_id === warehouseId) {
            const qty = e.quantity !== undefined ? e.quantity : (e.qty_change || 0);
            stockBySku[e.sku_id] = (stockBySku[e.sku_id] || 0) + qty;
          }
        });
        const skuIdsWithBin = new Set(
          (db.stock_ledger || [])
            .filter((e: any) => e.bin_location_id != null || (e.location_id != null && e.location_id !== 'UNLOCATED'))
            .map((e: any) => e.sku_id)
        );
        item_count = Object.entries(stockBySku)
          .filter(([id, qty]) => qty > 0 && !skuIdsWithBin.has(id))
          .length;
      } else if (section.bin_prefix) {
        // Count SKUs in bins matching this prefix
        const matchingBins = (db.locations || [])
          .filter((b: any) => b.code?.startsWith(section.bin_prefix!));
        const binIds = new Set(matchingBins.map((b: any) => b.id));
        // Count ledger entries in those bins with positive stock
        const skuIds = new Set(
          (db.stock_ledger || [])
            .filter((e: any) => binIds.has(e.bin_location_id || e.location_id))
            .map((e: any) => e.sku_id)
        );
        item_count = skuIds.size;
      } else if (section.zone_ids && section.zone_ids.length > 0) {
        const zoneSet = new Set(section.zone_ids);
        // Count SKUs with stock in these zones
        const skuIds = new Set(
          (db.stock_ledger || [])
            .filter((e: any) => zoneSet.has(e.zone_id))
            .map((e: any) => e.sku_id)
        );
        item_count = skuIds.size;
      } else {
        // No filter configured yet — show total active published SKUs
        // as a starting point until zones/bins are linked
        item_count = (db.skus || []).filter(s =>
          s.is_active && s.publication_status === 'published'
        ).length;
      }

      return { ...section, item_count };
    });

    res.json({ data: enriched });
  });

  app.post('/api/v1/counting-sections', async (req, res) => {
    const allowed =
      db.currentUser?.role === 'admin' ||
      db.currentUser?.role === 'ops_manager';
    if (!allowed) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN',
          message: 'Only managers can create counting sections.' }
      });
    }

    const { name, warehouse_id, icon, zone_ids, bin_prefix,
            item_filter, display_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME',
          message: 'Section name is required.', field: 'name' }
      });
    }
    if (!warehouse_id) {
      return res.status(400).json({
        error: { code: 'INVALID_WAREHOUSE',
          message: 'warehouse_id is required.', field: 'warehouse_id' }
      });
    }

    const existingSections = db.counting_sections || [];
    const newSection = {
      id: `CS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      warehouse_id,
      name: name.trim(),
      icon: icon || 'Package',
      zone_ids: zone_ids || [],
      bin_prefix: bin_prefix || null,
      item_filter: item_filter || null,
      display_order: display_order !== undefined
        ? display_order
        : (existingSections.length > 0
            ? Math.max(...existingSections.map(s => s.display_order)) + 1
            : 1),
      is_active: true,
      created_by: db.currentUser?.id || 'SYSTEM',
      created_at: new Date().toISOString()
    };

    existingSections.push(newSection);
    db.counting_sections = existingSections;
    await saveState();
    res.json({ data: newSection });
  });

  app.patch('/api/v1/counting-sections/:id', async (req, res) => {
    const allowed =
      db.currentUser?.role === 'admin' ||
      db.currentUser?.role === 'ops_manager';
    if (!allowed) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN',
          message: 'Only managers can modify counting sections.' }
      });
    }

    const section = (db.counting_sections || [])
      .find(s => s.id === req.params.id);
    if (!section) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Section not found' }
      });
    }

    const editable = ['name', 'icon', 'zone_ids', 'bin_prefix',
                      'item_filter', 'display_order', 'is_active'];
    editable.forEach(field => {
      if (req.body[field] !== undefined) {
        (section as any)[field] = req.body[field];
      }
    });

    await saveState();
    res.json({ data: section });
  });

  app.post(['/api/v1/skus', '/api/v1/skus'], async (req, res) => {
    if (!db.setup_config) {
      return res.status(400).json({
        error: {
          code: 'SETUP_REQUIRED',
          message: 'The system has not been fully configured yet. Please complete the Setup Wizard first.'
        }
      });
    }

    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }

    // Auto-generate product code from category numeric prefix
    // + next available 3-digit sequence within that category.
    // Format: {category.numeric_code}{zero-padded 3-digit sequence}
    // e.g. category 300 → first product = '300001', second = '300002'
    const category_id = req.body.category_id;
    const category = (db.categories || []).find(c => c.id === category_id);
    if (!category) {
      return res.status(400).json({
        error: { code: 'INVALID_CATEGORY', message: 'Category not found.', field: 'category_id' }
      });
    }

    const prefix = category.numeric_code;
    const existingCodesInCategory = db.skus
      .filter(s => s.category_id === category_id)
      .map(s => parseInt(s.code, 10))
      .filter(n => !isNaN(n));

    let sequence = 1;
    while (existingCodesInCategory.includes(prefix * 1000 + sequence)) {
      sequence++;
      if (sequence > 999) {
        return res.status(500).json({
          error: { code: 'SEQUENCE_EXHAUSTED', message: 'Maximum products reached for this category (999). Create a sub-category.' }
        });
      }
    }

    const generatedCode = String(prefix * 1000 + sequence);
    const moq = req.body.moq !== undefined ? Number(req.body.moq) : 1;

    const newSku: SKU = {
      ...req.body,
      id: `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      expiry_alert_days: req.body.expiry_alert_days !== undefined ? req.body.expiry_alert_days : null,
      is_bundle: req.body.is_bundle !== undefined ? req.body.is_bundle : false,
      bundle_definition_id: req.body.bundle_definition_id !== undefined ? req.body.bundle_definition_id : null,
      code: generatedCode,
      moq: moq
    };
    db.skus.push(newSku);
    await saveState();
    res.json({ data: newSku });
  });

  app.patch(['/api/v1/skus/:id', '/api/v1/skus/:id'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) return res.status(404).json({ error: 'SKU not found' });
    Object.assign(sku, req.body);
    sku.updated_at = new Date().toISOString();
    await saveState();
    res.json({ data: sku });
  });

  // Setup Wizard
  app.get(['/api/v1/setup/status', '/api/v1/setup/status'], (req, res) => {
    res.json({
      data: {
        setup_complete: !!db.setup_complete
      }
    });
  });

  app.post(['/api/v1/setup/complete', '/api/v1/setup/complete'], async (req, res) => {
    const {
      company_name,
      country,
      currency,
      primary_language,
      warehouses,
      admin_user
    } = req.body;

    // Validate company_name
    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      return res.status(400).json({
        error: {
          code: 'INVALID_COMPANY_NAME',
          message: 'Company Name is required and must be at least 2 characters.',
          field: 'company_name'
        }
      });
    }

    // Validate admin_user
    if (!admin_user) {
      return res.status(400).json({
        error: {
          code: 'ADMIN_USER_REQUIRED',
          message: 'Admin user details are required.',
          field: 'admin_user'
        }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!admin_user.email || !emailRegex.test(admin_user.email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ADMIN_EMAIL',
          message: 'Admin email must be a valid email format.',
          field: 'admin_user.email'
        }
      });
    }

    if (!admin_user.password || typeof admin_user.password !== 'string' || admin_user.password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ADMIN_PASSWORD',
          message: 'Admin password must be at least 8 characters.',
          field: 'admin_user.password'
        }
      });
    }

    // Validate warehouses
    if (!warehouses || !Array.isArray(warehouses) || warehouses.length === 0) {
      return res.status(400).json({
        error: {
          code: 'WAREHOUSES_REQUIRED',
          message: 'At least 1 warehouse is required.',
          field: 'warehouses'
        }
      });
    }

    // Create setupConfig
    const setupConfig: SetupConfig = {
      company_name,
      country: country || 'KE',
      currency: currency || 'KES',
      primary_language: primary_language || 'en',
      configured_at: new Date().toISOString(),
      configured_by_name: admin_user.name || 'Admin',
      configured_by_email: admin_user.email
    };

    db.setup_config = setupConfig;

    // Update CONFIG
    CONFIG.TENANT_NAME = company_name;

    // Replace db.warehouses
    db.warehouses = warehouses.map((w: any, idx: number) => {
      const id = `WH-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      return {
        id,
        name: w.name || `Warehouse ${idx + 1}`,
        type: w.type || 'main_warehouse',
        address: w.area || '',
        is_active: true,
        created_at: new Date().toISOString()
      };
    });

    // Create admin user
    const newAdmin: User = {
      id: 'U-ADMIN',
      name: admin_user.name || 'Admin',
      email: admin_user.email,
      role: 'admin',
      primary_warehouse_id: db.warehouses[0]?.id || '',
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      phone: null,
      password_hash: hashPassword(admin_user.password),
      must_reset_password: false,
      reports_to_user_id: null
    };
    db.users = [newAdmin];

    db.setup_complete = true;

    await saveState();

    res.status(200).json({
      data: {
        success: true,
        redirect: '/dashboard'
      }
    });
  });

  app.post(['/api/v1/setup/reset', '/api/v1/setup/reset'], async (req, res) => {
    // Role: admin only
    if (db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Setup resetting protected for admin role.' });
    }

    db.setup_complete = false;
    db.setup_config = null;
    await saveState();
    res.json({ success: true });
  });

  // Categories
  app.get(['/api/v1/categories', '/api/v1/categories'], (req, res) => {
    res.json({ data: db.categories || [] });
  });

  app.post(['/api/v1/categories', '/api/v1/categories'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }
    const { name, parent_id, default_temp_zone, default_product_class, requires_barcode } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Category name is required and must be at least 2 characters.', field: 'name' }
      });
    }
    if (!default_temp_zone || !['frozen', 'chilled', 'cool', 'ambient'].includes(default_temp_zone)) {
      return res.status(400).json({
        error: { code: 'INVALID_TEMP_ZONE', message: 'A valid default temperature zone is required.', field: 'default_temp_zone' }
      });
    }

    // Auto-assign numeric_code:
    // If parent_id is set, find the parent's numeric_code and add
    // the next available 10-increment offset within that parent
    // (e.g. parent 300 → children use 310, 320, 330...).
    // If no parent_id, assign the next available 100-multiple.
    let numericCode;
    if (parent_id) {
      const parent = (db.categories || []).find(c => c.id === parent_id);
      if (!parent) {
        return res.status(400).json({
          error: { code: 'INVALID_PARENT', message: 'Parent category not found.', field: 'parent_id' }
        });
      }
      const base = Math.floor(parent.numeric_code / 100) * 100;
      const existingSiblings = (db.categories || [])
        .filter(c => c.parent_id === parent_id)
        .map(c => c.numeric_code);
      // Start from base+10, find next unused 10-increment
      let offset = 10;
      while (existingSiblings.includes(base + offset) && offset < 100) {
        offset += 10;
      }
      numericCode = base + offset;
    } else {
      // Top-level: next available 100-multiple starting from 100
      const existingTopLevel = (db.categories || [])
        .filter(c => !c.parent_id)
        .map(c => c.numeric_code)
        .filter(Boolean);
      let hundred = 100;
      while (existingTopLevel.includes(hundred)) {
        hundred += 100;
      }
      numericCode = hundred;
    }

    const newCategory = {
      id: `CAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      parent_id: parent_id || null,
      default_temp_zone,
      expiry_alert_days: null,
      requires_barcode: requires_barcode !== undefined ? requires_barcode : false,
      default_product_class: default_product_class || null,
      numeric_code: numericCode
    };
    if (!db.categories) db.categories = [];
    db.categories.push(newCategory);
    await saveState();
    res.json({ data: newCategory });
  });

  app.patch(['/api/v1/categories/:id', '/api/v1/categories/:id'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cat = db.categories.find(c => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (req.body.expiry_alert_days !== undefined) {
      cat.expiry_alert_days = req.body.expiry_alert_days;
    }
    if (req.body.name !== undefined) cat.name = req.body.name;
    if (req.body.parent_id !== undefined) cat.parent_id = req.body.parent_id;
    if (req.body.default_temp_zone !== undefined) cat.default_temp_zone = req.body.default_temp_zone;
    await saveState();
    res.json({ data: cat });
  });

  // Suppliers
  app.get(['/api/v1/suppliers', '/api/v1/suppliers'], (req, res) => {
    res.json({ data: db.suppliers || [] });
  });

  app.post(['/api/v1/suppliers', '/api/v1/suppliers'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }
    const { name, contact_name, phone, email, lead_time_days, payment_terms } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Supplier name is required and must be at least 2 characters.', field: 'name' }
      });
    }
    const newSupplier = {
      id: `SUP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      contact_name: contact_name || null,
      phone: phone || null,
      email: email || null,
      lead_time_days: lead_time_days !== undefined ? Number(lead_time_days) : 7,
      payment_terms: payment_terms || null,
      is_active: true,
      created_at: new Date().toISOString()
    };
    if (!db.suppliers) db.suppliers = [];
    db.suppliers.push(newSupplier);
    await saveState();
    res.json({ data: newSupplier });
  });

  app.patch(['/api/v1/suppliers/:id', '/api/v1/suppliers/:id'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }
    const sup = (db.suppliers || []).find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
    if (req.body.name !== undefined) sup.name = req.body.name;
    if (req.body.contact_name !== undefined) sup.contact_name = req.body.contact_name;
    if (req.body.phone !== undefined) sup.phone = req.body.phone;
    if (req.body.email !== undefined) sup.email = req.body.email;
    if (req.body.lead_time_days !== undefined) sup.lead_time_days = Number(req.body.lead_time_days);
    if (req.body.payment_terms !== undefined) sup.payment_terms = req.body.payment_terms;
    if (req.body.is_active !== undefined) sup.is_active = req.body.is_active;
    await saveState();
    res.json({ data: sup });
  });

  // Bundle Definitions
  app.get(['/api/v1/bundle-definitions', '/api/v1/bundle-definitions'], (req, res) => {
    let list = db.bundle_definitions || [];
    if (req.query.is_active === 'true') {
      list = list.filter(b => b.is_active);
    }
    const enriched = list.map(bd => {
      const components = (bd.components || []).map(comp => {
        // Find current available stock of this component SKU
        const componentAvailable = (db.batches || [])
          .filter(b => b.sku_id === comp.sku_id && b.status === 'active')
          .reduce((sum, b) => {
            const reservations = (db.stock_reservations || [])
              .filter(r => r.batch_id === b.id && r.status === 'active')
              .reduce((s_res, r) => s_res + r.qty_reserved, 0);
            return sum + Math.max(0, b.quantity_available - reservations);
          }, 0);

        return {
          ...comp,
          current_stock_available: componentAvailable
        };
      });
      return {
        ...bd,
        components
      };
    });
    res.json({ data: enriched });
  });

  app.get(['/api/v1/bundle-definitions/:id', '/api/v1/bundle-definitions/:id'], (req, res) => {
    const bd = (db.bundle_definitions || []).find(b => b.id === req.params.id);
    if (!bd) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bundle definition not found' } });
    res.json({ data: bd });
  });

  app.get(['/api/v1/bundle-definitions/:id/availability', '/api/v1/bundle-definitions/:id/availability'], (req, res) => {
    const bd = (db.bundle_definitions || []).find(b => b.id === req.params.id);
    if (!bd) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bundle definition not found' } });

    const warehouse_id = (req.query.warehouse_id as string) || db.warehouses[0]?.id || '';

    const componentsList: any[] = [];
    let bundle_available = Infinity;

    for (const component of bd.components) {
      // Find all active batches for component.sku_id at warehouse_id
      const compBatches = (db.batches || []).filter(
        b => b.sku_id === component.sku_id && b.warehouse_id === warehouse_id && b.status === 'active'
      );

      // Sum their quantity_available minus active reservations
      let sumOfBatches = 0;
      for (const b of compBatches) {
        const reservations = (db.stock_reservations || [])
          .filter(r => r.batch_id === b.id && r.warehouse_id === warehouse_id && r.status === 'active')
          .reduce((sum, r) => sum + r.qty_reserved, 0);
        sumOfBatches += Math.max(0, b.quantity_available - reservations);
      }

      // Subtract any active reservations for this component at this warehouse (Sku-level reservation check)
      const skuLevelReservations = (db.stock_reservations || [])
        .filter(r => r.sku_id === component.sku_id && r.warehouse_id === warehouse_id && r.status === 'active' && !r.batch_id)
        .reduce((sum, r) => sum + r.qty_reserved, 0);

      const stock_available = Math.max(0, sumOfBatches - skuLevelReservations);
      const bundles_possible = Math.floor(stock_available / component.qty);

      if (bundles_possible < bundle_available) {
        bundle_available = bundles_possible;
      }

      componentsList.push({
        sku_id: component.sku_id,
        sku_name: component.sku_name,
        qty_needed_per_bundle: component.qty,
        stock_available,
        bundles_possible
      });
    }

    if (bundle_available === Infinity) {
      bundle_available = 0;
    }

    // Determine limiting component (smallest ratio of stock_available / component.qty)
    let limiting_component: any = null;
    let minRatio = Infinity;
    for (const comp of componentsList) {
      const ratio = comp.stock_available / comp.qty_needed_per_bundle;
      if (ratio < minRatio) {
        minRatio = ratio;
        limiting_component = {
          sku_id: comp.sku_id,
          sku_name: comp.sku_name,
          available: comp.stock_available,
          needed: comp.qty_needed_per_bundle
        };
      }
    }

    // effective_expiry_date: earliest expiry_date across all FEFO-selected batches for one bundle unit.
    let earliestExpiryAcrossAllComponents: string | null = null;
    for (const component of bd.components) {
      const sortedBatches = (db.batches || [])
        .filter(b => b.sku_id === component.sku_id && b.warehouse_id === warehouse_id && b.status === 'active' && b.quantity_available > 0)
        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

      let qtyNeeded = component.qty;
      for (const batch of sortedBatches) {
        if (qtyNeeded <= 0) break;
        const reservations = (db.stock_reservations || [])
          .filter(r => r.batch_id === batch.id && r.warehouse_id === warehouse_id && r.status === 'active')
          .reduce((sum, r) => sum + r.qty_reserved, 0);
        const avail = Math.max(0, batch.quantity_available - reservations);
        if (avail <= 0) continue;

        const taken = Math.min(qtyNeeded, avail);
        qtyNeeded -= taken;

        if (!earliestExpiryAcrossAllComponents || new Date(batch.expiry_date) < new Date(earliestExpiryAcrossAllComponents)) {
          earliestExpiryAcrossAllComponents = batch.expiry_date;
        }
      }
    }

    res.json({
      data: {
        bundle_id: bd.id,
        bundle_name: bd.name,
        warehouse_id,
        qty_available: bundle_available,
        effective_expiry_date: earliestExpiryAcrossAllComponents,
        limiting_component,
        components: componentsList
      }
    });
  });

  app.post(['/api/v1/bundle-definitions', '/api/v1/bundle-definitions'], async (req, res) => {
    if (!db.setup_config) {
      return res.status(400).json({
        error: {
          code: 'SETUP_REQUIRED',
          message: 'The system has not been fully configured yet. Please complete the Setup Wizard first.'
        }
      });
    }

    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }

    const { name, bundle_sku_id, components, valid_from, valid_until, notes } = req.body;

    // Validate bundle_sku_id must exist and have is_bundle=true
    const bSku = db.skus.find(s => s.id === bundle_sku_id);
    if (!bSku) {
      return res.status(400).json({
        error: {
          code: 'SKU_NOT_BUNDLE',
          message: `The bundle SKU ${bundle_sku_id} was not found.`
        }
      });
    }
    if (!bSku.is_bundle) {
      return res.status(400).json({
        error: {
          code: 'SKU_NOT_BUNDLE',
          message: `The requested SKU ${bundle_sku_id} is not configured as is_bundle=true.`
        }
      });
    }

    if (!components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_COMPONENTS', message: 'Components array is required and must not be empty.' }
      });
    }

    // Check duplicate sku_id in components
    const componentSkuIds = components.map(c => c.sku_id);
    const hasDuplicates = componentSkuIds.some((id, index) => componentSkuIds.indexOf(id) !== index);
    if (hasDuplicates) {
      return res.status(400).json({
        error: {
          code: 'DUPLICATE_COMPONENT',
          message: 'Duplicate sku_id in components.'
        }
      });
    }

    // Validate component SKUs
    for (const comp of components) {
      const referencedSku = db.skus.find(s => s.id === comp.sku_id);
      if (!referencedSku) {
        return res.status(400).json({
          error: { code: 'SKU_NOT_FOUND', message: `Component SKU ${comp.sku_id} not found.` }
        });
      }
      if (referencedSku.is_bundle) {
        return res.status(400).json({
          error: { code: 'CANNOT_NEST_BUNDLES', message: 'Nested bundle definitions are forbidden.' }
        });
      }
    }

    const id = `BD-${Date.now().toString().slice(-4)}`;

    const activeComponents = components.map(c => {
      const referencedSku = db.skus.find(s => s.id === c.sku_id);
      return {
        sku_id: c.sku_id,
        sku_name: referencedSku?.name || 'Component SKU',
        qty: c.qty
      };
    });

    const newBd: BundleDefinition = {
      id,
      name,
      bundle_sku_id,
      components: activeComponents,
      is_active: true,
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      created_by: db.currentUser?.id || 'U-ADMIN',
      created_at: new Date().toISOString(),
      notes: notes || null
    };

    if (!db.bundle_definitions) db.bundle_definitions = [];
    db.bundle_definitions.push(newBd);

    // Link SKU back to bundle definition ID
    bSku.bundle_definition_id = id;

    await saveState();
    res.status(201).json({ data: newBd });
  });

  app.patch(['/api/v1/bundle-definitions/:id', '/api/v1/bundle-definitions/:id'], async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }

    const bd = (db.bundle_definitions || []).find(b => b.id === req.params.id);
    if (!bd) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bundle definition not found' } });

    const { name, components, valid_from, valid_until, is_active, notes } = req.body;

    if (name !== undefined) bd.name = name;
    if (valid_from !== undefined) bd.valid_from = valid_from;
    if (valid_until !== undefined) bd.valid_until = valid_until;
    if (is_active !== undefined) bd.is_active = is_active;
    if (notes !== undefined) bd.notes = notes;

    if (components !== undefined) {
      if (!Array.isArray(components)) {
        return res.status(400).json({ error: { code: 'INVALID_COMPONENTS', message: 'Components must be an array.' } });
      }

      const componentSkuIds = components.map(c => c.sku_id);
      const hasDuplicates = componentSkuIds.some((id, index) => componentSkuIds.indexOf(id) !== index);
      if (hasDuplicates) {
        return res.status(400).json({
          error: {
            code: 'DUPLICATE_COMPONENT',
            message: 'Duplicate sku_id in components.'
          }
        });
      }

      for (const comp of components) {
        const referencedSku = db.skus.find(s => s.id === comp.sku_id);
        if (!referencedSku) {
          return res.status(400).json({
            error: { code: 'SKU_NOT_FOUND', message: `Component SKU ${comp.sku_id} not found.` }
          });
        }
        if (referencedSku.is_bundle) {
          return res.status(400).json({
            error: { code: 'CANNOT_NEST_BUNDLES', message: 'Nested bundle definitions are forbidden.' }
          });
        }
      }

      bd.components = components.map(c => {
        const referencedSku = db.skus.find(s => s.id === c.sku_id);
        return {
          sku_id: c.sku_id,
          sku_name: referencedSku?.name || 'Component SKU',
          qty: c.qty
        };
      });
    }

    await saveState();
    res.json({ data: bd });
  });

  // Purchase orders
  app.get('/api/v1/purchase-orders', (req, res) => {
    const poList = db.purchase_orders.map(po => {
      const supplier = db.suppliers.find(s => s.id === po.supplier_id);
      return {
        ...po,
        supplier_name: supplier?.name || po.supplier_id,
        lines: db.purchase_order_lines.filter(l => l.po_id === po.id)
      };
    });
    res.json({ data: poList });
  });

  app.get('/api/v1/purchase-orders/:id', (req, res) => {
    const po = db.purchase_orders.find(o => o.id === req.params.id);
    if (!po) return res.status(404).json({ error: 'PO not found' });
    const lines = db.purchase_order_lines.filter(l => l.po_id === po.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return { ...line, sku_name: sku?.name, sku_code: sku?.code };
    });
    res.json({ data: { ...po, lines } });
  });

  app.post('/api/v1/purchase-orders', async (req, res) => {
    // Add po logic
    const { supplier_id, warehouse_id, lines } = req.body;

    // Check if any line SKU is a bundle
    for (const l of (lines || [])) {
      const sku = db.skus.find(s => s.id === l.sku_id);
      if (sku?.is_bundle) {
        return res.status(400).json({
          error: 'BUNDLES_CANNOT_BE_PURCHASED',
          message: `SKU ${l.sku_id} is a bundle. You cannot process purchase orders or goods receipts for bundles.`
        });
      }
    }

    // Validate BOM Ingredient Requirements
    const warnings: string[] = [];
    for (const l of (lines || [])) {
      const isSkuInActiveRecipe = (db.production_recipes || [])
        .filter(r => r.status === 'active')
        .some(r => (r.components || []).some(c => c.sku_id === l.sku_id));

      if (l.bom_linked === true) {
        if (!isSkuInActiveRecipe) {
          return res.status(400).json({
            error: 'BOM_INGREDIENT_NOT_APPROVED',
            message: `BOM ingredient lock error: SKU ${l.sku_id} does not appear in any active recipe/BOM.`
          });
        }
      } else { // bom_linked is false or undefined
        if (isSkuInActiveRecipe) {
          warnings.push(`Warning: SKU ${l.sku_id} is approved as an active recipe component but was ordered as not bom-linked.`);
        }
      }
    }

    const newPo: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-4)}`,
      supplier_id,
      warehouse_id,
      status: 'sent',
      expected_date: req.body.expected_date || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      notes: req.body.notes || 'Automated stock order',
      created_by: db.currentUser?.id || 'U-ADMIN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.purchase_orders.push(newPo);

    (lines || []).forEach((l: any) => {
      const line: PurchaseOrderLine = {
        id: `POL-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        po_id: newPo.id,
        sku_id: l.sku_id,
        qty_ordered: l.qty_ordered,
        qty_received: 0,
        unit_cost_kes: l.unit_cost_kes,
        bom_linked: l.bom_linked ?? false
      };
      db.purchase_order_lines.push(line);
    });

    await saveState();
    res.status(201).json({ data: newPo, warnings: warnings.length > 0 ? warnings : undefined });
  });

  // Goods Receipt process
  app.post('/api/v1/purchase-orders/:id/receive', (req, res) => {
    const poId = req.params.id;
    const po = db.purchase_orders.find(p => p.id === poId);
    if (!po) return res.status(404).json({ error: 'PO not found' });
    if (po.status === 'closed') {
      return res.status(422).json({ error: { code: 'PO_CLOSED', message: 'Purchase order is already completely received and closed.' } });
    }

    const { lines, notes, override_over_receipt } = req.body;

    // Build goods receipt
    const grId = `GR-${Date.now().toString().slice(-4)}`;
    const grn_number = `GRN-${Date.now().toString().slice(-7)}`;

    const grLinesSaved: GoodsReceiptLine[] = [];
    const warnings: string[] = [];

    try {
      // Loop lines to validate over-receipt, expiry, zones
      for (const reqLine of lines) {
        const poLine = db.purchase_order_lines.find(l => l.id === reqLine.po_line_id);
        if (!poLine) continue;

        const sku = db.skus.find(s => s.id === poLine.sku_id);
        if (!sku) continue;

        // Expiry date verification
        if (!reqLine.expiry_date) {
          return res.status(400).json({ error: { code: 'EXPIRY_DATE_REQUIRED', message: `Expiry date is mandatory for received batches of SKU ${sku.name}` } });
        }

        // Warn expired
        const isExpired = new Date(reqLine.expiry_date).getTime() < Date.now();
        if (isExpired && db.currentUser?.role === 'receiver') {
          return res.status(422).json({ error: { code: 'EXPIRED_ON_RECEIPT', message: `Batch of ${sku.name} is already expired. Reception declined.` } });
        }

        // Over-receipt check
        const remainingOrdered = poLine.qty_ordered - poLine.qty_received;
        if (reqLine.qty_received > remainingOrdered) {
          const isManager = db.currentUser?.role === 'ops_manager' || db.currentUser?.role === 'admin';
          if (!isManager || !override_over_receipt) {
            return res.status(422).json({
              error: {
                code: 'OVER_RECEIPT_REQUIRES_APPROVAL',
                message: `Qty received (${reqLine.qty_received}) exceeds outstanding PO ordered amount of (${remainingOrdered}). Manager approval required.`
              }
            });
          }
        }

        const putAwayLocation = reqLine.put_away_location_id
          ? db.locations.find(l => l.id === reqLine.put_away_location_id)
          : null;
        const putAwayZone = putAwayLocation
          ? db.zones.find(z => z.id === putAwayLocation.zone_id)
          : null;

        // Zone validation (Put away location selected)
        if (reqLine.put_away_location_id && reqLine.condition === 'good') {
          const checkZone = validateTemperatureZone(poLine.sku_id, reqLine.put_away_location_id);
          if (!checkZone.allowed) {
            return res.status(422).json({ error: { code: 'ZONE_MISMATCH', message: checkZone.details } });
          }
          // Deactivation guards on putaway
          if (putAwayZone && !putAwayZone.is_active) {
            return res.status(422).json({ error: { code: 'ZONE_INACTIVE', message: `Zone '${putAwayZone.name}' is inactive. Choose an active zone.` } });
          }
          if (putAwayLocation && !putAwayLocation.is_active) {
            return res.status(422).json({ error: { code: 'LOCATION_INACTIVE', message: `Location '${putAwayLocation.code}' is inactive. Choose an active location.` } });
          }
          const binLoc = db.bin_locations.find(b => b.code === putAwayLocation?.code && b.warehouse_id === putAwayLocation?.warehouse_id);
          if (binLoc && !binLoc.is_active) {
            return res.status(422).json({ error: { code: 'BIN_LOCATION_INACTIVE', message: `Bin location '${binLoc.code}' is inactive. Choose an active bin location.` } });
          }
        }

        // 1. PRODUCT CLASS CHECK
        const productClass = getEffectiveProductClass(poLine.sku_id);
        if (putAwayZone &&
            putAwayZone.permitted_product_classes &&
            putAwayZone.permitted_product_classes.length > 0 &&
            productClass &&
            !putAwayZone.permitted_product_classes.includes(productClass as ProductClass)) {
          return res.status(422).json({
            error: {
              code: 'PRODUCT_CLASS_NOT_PERMITTED',
              message: `${productClass} is not permitted in zone ${putAwayZone.name}. Permitted classes: ${putAwayZone.permitted_product_classes.join(', ')}`
            }
          });
        }

        // 2. QUARANTINE ROUTING
        const batchStatus = reqLine.condition === 'good' ? 'active' : 'quarantine';
        if (batchStatus === 'quarantine') {
          if (reqLine.put_away_location_id && !putAwayZone?.is_quarantine_zone) {
            return res.status(422).json({
              error: {
                code: 'QUARANTINE_ITEMS_MUST_GO_TO_QUARANTINE_ZONE',
                message: 'Quarantined items must be placed in a designated quarantine zone.'
              }
            });
          }
        }

        // 3. CAPACITY CHECK
        if (putAwayLocation &&
            putAwayLocation.capacity_kg !== null &&
            putAwayLocation.capacity_kg !== undefined) {
          const currentKg = computeLocationWeightKg(putAwayLocation.id);
          const addedKg = sku?.weight_kg
            ? (reqLine.qty_received / (sku.display_divisor || 1)) * sku.weight_kg
            : 0;
          if (currentKg + addedKg > putAwayLocation.capacity_kg) {
            return res.status(422).json({
              error: {
                code: 'LOCATION_CAPACITY_EXCEEDED',
                message: `Location ${putAwayLocation.code} would exceed capacity. Current: ${currentKg}kg, Adding: ${addedKg.toFixed(2)}kg, Max: ${putAwayLocation.capacity_kg}kg`
              }
            });
          }
        }

        // 4. ETHYLENE SEPARATION WARNING
        const skuForEthylene = db.skus.find(s => s.id === poLine.sku_id);
        if (skuForEthylene?.ethylene_profile === 'producer' && putAwayZone) {
          const sensitiveInZone = (db.stock_ledger || []).some(e => {
            const locsInZone = (db.locations || [])
              .filter(l => l.zone_id === putAwayZone.id)
              .map(l => l.id);
            if (!locsInZone.includes(e.location_id)) return false;
            const eBatch = db.batches.find(b => b.id === e.batch_id);
            const eSku = eBatch ? db.skus.find(s => s.id === eBatch.sku_id) : null;
            return eSku?.ethylene_profile === 'sensitive';
          });
          if (sensitiveInZone) {
            warnings.push(
              `Ethylene producer placed near sensitive produce in same zone. Consider moving to a separate area to prevent premature ripening.`
            );
          }
        }
        if (skuForEthylene?.ethylene_profile === 'sensitive' && putAwayZone) {
          const producerInZone = (db.stock_ledger || []).some(e => {
            const locsInZone = (db.locations || [])
              .filter(l => l.zone_id === putAwayZone.id)
              .map(l => l.id);
            if (!locsInZone.includes(e.location_id)) return false;
            const eBatch = db.batches.find(b => b.id === e.batch_id);
            const eSku = eBatch ? db.skus.find(s => s.id === eBatch.sku_id) : null;
            return eSku?.ethylene_profile === 'producer';
          });
          if (producerInZone) {
            warnings.push(
              `Ethylene-sensitive product placed near ethylene producers in same zone. Risk of accelerated ripening or damage.`
            );
          }
        }
      }

      // Loop second time to actually commit inside "isolated state transaction"
      const createdBatches: Batch[] = [];
      const receivedAt = new Date().toISOString();

      for (const reqLine of lines) {
        const poLine = db.purchase_order_lines.find(l => l.id === reqLine.po_line_id)!;
        poLine.qty_received += reqLine.qty_received;

        // Create Batch
        const batchId = `BTC-${skuShortName(poLine.sku_id)}-${Date.now().toString().slice(-4)}`;
        const newBatch: Batch = {
          id: batchId,
          sku_id: poLine.sku_id,
          batch_number: reqLine.batch_number || `BAT-${Date.now().toString().slice(-6)}`,
          expiry_date: reqLine.expiry_date,
          production_date: reqLine.production_date || null,
          received_date: receivedAt,
          quantity_received: reqLine.qty_received,
          quantity_available: reqLine.qty_received,
          status: reqLine.condition === 'good' ? 'active' : 'quarantine',
          goods_receipt_id: grId,
          warehouse_id: po.warehouse_id,
          created_at: receivedAt
        };
        db.batches.push(newBatch);
        createdBatches.push(newBatch);

        // Record in ledger ONLY if not rejected
        if (reqLine.condition === 'good' && reqLine.put_away_location_id) {
          writeLedgerEntry({
            sku_id: poLine.sku_id,
            batch_id: batchId,
            location_id: reqLine.put_away_location_id,
            warehouse_id: po.warehouse_id,
            quantity: reqLine.qty_received,
            transaction_type: 'receipt',
            reference_id: grId,
            reference_type: 'goods_receipt',
            user_id: db.currentUser?.id || 'U-RECEIVER',
            notes: `PO Receive ${poId} - GRN ${grn_number}`
          });
        }

        // Determine price variance
        const inputActualUnitCost = reqLine.actual_unit_cost_kes;
        const actual_unit_cost_kes = (inputActualUnitCost !== null && inputActualUnitCost !== undefined)
          ? Number(inputActualUnitCost)
          : poLine.unit_cost_kes;
        const price_variance_kes = actual_unit_cost_kes - poLine.unit_cost_kes;
        let variance_workflow_id: string | null = null;

        const sku = db.skus.find(s => s.id === poLine.sku_id)!;
        const grLineId = `GRL-${Math.floor(Math.random()*100000)}`;

        if (price_variance_kes !== 0) {
          const template = (db.workflow_templates || []).find(
            t => t.type === 'PRICE_VARIANCE' && t.is_active
          );
          if (!template) {
            logAudit('PRICE_VARIANCE_NO_TEMPLATE', 'PurchaseOrder', poId,
              `Price variance on ${sku.name} but no active PRICE_VARIANCE template found. Variance recorded but not routed.`);
          } else {
            variance_workflow_id = `WF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            const stages = buildStagesFromTemplate(template, db.currentUser?.id || 'U-RECEIVER');
            const newWorkflow = {
              id: variance_workflow_id,
              type: 'PRICE_VARIANCE',
              entity_id: grLineId,
              entity_type: 'price_variance',
              entity_snapshot: {
                sku_id: poLine.sku_id,
                po_id: po.id,
                grn_date: receivedAt,
                actual_unit_cost_kes: actual_unit_cost_kes,
                po_unit_cost_kes: poLine.unit_cost_kes,
                selling_price_kes_current: sku.selling_price_kes
              },
              status: 'pending',
              raised_by: db.currentUser?.id || 'U-RECEIVER',
              raised_at: receivedAt,
              stages,
              current_stage: 1,
              resolved_at: null,
              resolution_notes: null
            };
            if (!db.workflow_approvals) db.workflow_approvals = [];
            db.workflow_approvals.push(newWorkflow as any);

            // Trigger initial notification for Stage 1 manager
            const stage1 = stages[0];
            const targetUserId = stage1?.required_user_id || 'U-ADMIN';
            createNotification(
              'WORKFLOW_APPROVAL_REQUIRED',
              `Approval Required: Price Variance on SKU ${sku.name}`,
              `Approval required for price variance on PO ${po.id}.`,
              'warning',
              {
                reference_id: variance_workflow_id,
                reference_type: 'workflow_approval',
                target_roles: targetUserId === 'U-ADMIN' ? ['admin'] : []
              }
            );
          }
        }

        // Build line
        const grLine: GoodsReceiptLine = {
          id: grLineId,
          gr_id: grId,
          po_line_id: reqLine.po_line_id,
          sku_id: poLine.sku_id,
          batch_id: batchId,
          qty_received: reqLine.qty_received,
          expiry_date: reqLine.expiry_date,
          condition: reqLine.condition,
          put_away_location_id: reqLine.put_away_location_id || null,
          put_away_at: reqLine.put_away_location_id ? receivedAt : null,
          put_away_by: reqLine.put_away_location_id ? (db.currentUser?.id || 'U-RECEIVER') : null,
          actual_unit_cost_kes,
          price_variance_kes,
          variance_workflow_id
        };
        db.goods_receipt_lines.push(grLine);
        grLinesSaved.push(grLine);
      }

      // Check if PO completes
      const poLines = db.purchase_order_lines.filter(l => l.po_id === poId);
      const isComplete = poLines.every(l => l.qty_received >= l.qty_ordered);
      po.status = isComplete ? 'received' : 'partial';

      // Record Goods Receipt Master Document
      const goodsReceipt: GoodsReceipt = {
        id: grId,
        po_id: poId,
        warehouse_id: po.warehouse_id,
        received_at: receivedAt,
        received_by: db.currentUser?.id || 'U-RECEIVER',
        status: isComplete ? 'completed' : 'partial',
        notes: notes || 'Receipt successful',
        grn_number
      };
      db.goods_receipts.push(goodsReceipt);

      logAudit(
        'GOODS_RECEIPT_COMPLETED',
        'PurchaseOrder',
        poId,
        `Received goods receipt ${grId} (GRN-${Date.now().toString().slice(-4)}) for PO ${poId}`,
        { grId, grn_number, lineCount: grLinesSaved.length }
      );
      res.status(201).json({ data: { ...goodsReceipt, lines: grLinesSaved }, warnings: warnings.length > 0 ? warnings : undefined });

    } catch (transactionError: any) {
      console.error('Goods Receipt transaction rollback prompted:', transactionError);
      return res.status(422).json({ error: transactionError });
    }
  });

  app.get('/api/v1/goods-receipts', (req, res) => {
    res.json({ data: db.goods_receipts });
  });

  app.get('/api/v1/goods-receipts/:id', (req, res) => {
    const gr = db.goods_receipts.find(g => g.id === req.params.id);
    if (!gr) return res.status(404).json({ error: 'Goods receipt not found' });
    const lines = db.goods_receipt_lines.filter(l => l.gr_id === gr.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return { ...line, sku_name: sku?.name, sku_code: sku?.code };
    });
    res.json({ data: { ...gr, lines } });
  });

  // Inter and Intra Warehouse Transfers
  app.get('/api/v1/transfers', (req, res) => {
    res.json({ data: db.transfers });
  });

  app.get('/api/v1/transfers/:id', (req, res) => {
    const tr = db.transfers.find(t => t.id === req.params.id);
    if (!tr) return res.status(404).json({ error: 'Transfer not found' });
    const lines = db.transfer_lines.filter(l => l.transfer_id === tr.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return { ...line, sku_name: sku?.name, sku_code: sku?.code };
    });
    res.json({ data: { ...tr, lines } });
  });

  app.post('/api/v1/transfers', (req, res) => {
    const { from_warehouse_id, to_warehouse_id, lines, notes, transfer_scope } = req.body;
    const scope = transfer_scope || 'inter_site';

    // Role check for replenishment
    if (scope === 'replenishment') {
      if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only managers can create replenishment orders' } });
      }
      const toWh = db.warehouses.find(w => w.id === to_warehouse_id);
      if (!toWh || toWh.type !== 'fulfilment_point') {
        return res.status(422).json({ error: { code: 'REPLENISHMENT_TARGET_NOT_FP', message: 'Target warehouse must be a fulfilment point' } });
      }
    }

    if (scope === 'intra_site') {
      if (from_warehouse_id !== to_warehouse_id) {
        return res.status(422).json({ error: { code: 'INTRA_SITE_WAREHOUSE_MISMATCH', message: 'From and to warehouses must match for intra-site movements' } });
      }
      const sameLoc = lines.some((l: any) => l.from_location_id === l.to_location_id);
      if (sameLoc) {
        return res.status(422).json({ error: { code: 'SAME_LOCATION', message: 'Pick location and destination bin cannot be the same' } });
      }
    }

    const isInterWarehouse = from_warehouse_id !== to_warehouse_id;
    const transferId = `TRF-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*100)}`;
    
    let initialStatus: TransferStatus = 'pending_approval';
    if (scope === 'intra_site') {
      initialStatus = 'completed';
    } else if (scope === 'replenishment') {
      initialStatus = 'draft';
    } else if (!isInterWarehouse) {
      initialStatus = 'completed';
    }

    const newTransfer: Transfer = {
      id: transferId,
      from_warehouse_id,
      to_warehouse_id,
      from_location_id: req.body.from_location_id || null,
      to_location_id: req.body.to_location_id || null,
      status: initialStatus,
      requires_approval: scope === 'replenishment' ? false : (scope === 'intra_site' ? false : isInterWarehouse),
      created_by: db.currentUser?.id || 'U-RECEIVER',
      approved_by: null,
      created_at: new Date().toISOString(),
      approved_at: null,
      completed_at: (scope === 'intra_site' || (scope === 'inter_site' && !isInterWarehouse)) ? new Date().toISOString() : null,
      notes: notes || (scope === 'intra_site' ? 'Intra-site bin movement' : 'Stock re-allocation'),
      transfer_scope: scope,
      replenishment_order_number: scope === 'replenishment' ? nextFPONumber() : null,
      manifest_id: null,
      packed_by: null,
      packed_at: null,
      rejection_lines: [],
      closure_report: null,
      closure_report_sent_at: null,
      under_pick_flagged_user: null
    };

    // Pre-test zone temperature boundaries and batch-SKU linkage for non-replenishment
    for (const l of lines) {
      if (!l.batch_id) {
        return res.status(400).json({ error: { code: 'BATCH_REQUIRED', message: 'All transfers must specify a Batch ID' } });
      }

      const batch = db.batches.find(b => b.id === l.batch_id);
      if (!batch) return res.status(422).json({ error: { code: 'BATCH_INVALID', message: `Batch ${l.batch_id} not found.` } });
      if (batch.sku_id !== l.sku_id) {
        return res.status(422).json({ error: { code: 'BATCH_SKU_MISMATCH', message: `Batch ${l.batch_id} does not hold SKU ${l.sku_id}` } });
      }

      if (l.to_location_id) {
        const checkZone = validateTemperatureZone(l.sku_id, l.to_location_id);
        if (!checkZone.allowed) {
          return res.status(422).json({ error: { code: 'ZONE_MISMATCH', message: `Zone blocked: Destination Location ${l.to_location_id} fails temperature criteria. Detail: ${checkZone.details}` } });
        }
      }
    }

    let stockLedgerBackup: any[] = [];
    let batchesBackup: any[] = [];

    try {
      stockLedgerBackup = [...db.stock_ledger];
      batchesBackup = db.batches.map(b => ({ ...b }));
      const transferLinesAdded: TransferLine[] = [];

      lines.forEach((l: any) => {
        const line: TransferLine = {
          id: `TFL-${Math.floor(Math.random()*10000)}`,
          transfer_id: transferId,
          sku_id: l.sku_id,
          batch_id: l.batch_id,
          from_location_id: l.from_location_id,
          to_location_id: l.to_location_id,
          qty_requested: l.qty_requested,
          qty_transferred: (scope === 'intra_site' || (scope === 'inter_site' && !isInterWarehouse)) ? l.qty_requested : null
        };
        transferLinesAdded.push(line);

        // Execute immediately ONLY if scope === 'intra_site' or (inter_site and !isInterWarehouse)
        const executeImmediate = scope === 'intra_site' || (scope === 'inter_site' && !isInterWarehouse);
        if (executeImmediate) {
          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: l.from_location_id,
            warehouse_id: from_warehouse_id,
            quantity: -l.qty_requested,
            transaction_type: 'transfer_out',
            reference_id: transferId,
            reference_type: 'transfer',
            user_id: db.currentUser?.id || 'U-RECEIVER',
            notes: `Transfer out to ${l.to_location_id}`
          });

          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: l.to_location_id,
            warehouse_id: to_warehouse_id,
            quantity: l.qty_requested,
            transaction_type: 'transfer_in',
            reference_id: transferId,
            reference_type: 'transfer',
            user_id: db.currentUser?.id || 'U-RECEIVER',
            notes: `Transfer in from ${l.from_location_id}`
          });
        }
      });

      db.transfer_lines.push(...transferLinesAdded);
      db.transfers.push(newTransfer);
      logAudit(
        'TRANSFER_CREATED',
        'Transfer',
        transferId,
        `Created transfer reallocation ${transferId} (${scope}) from site ${from_warehouse_id} to ${to_warehouse_id}`,
        { transferId, scope, linesCount: transferLinesAdded.length }
      );
      res.status(201).json({ data: newTransfer });

    } catch (err: any) {
      // rollback ledger & batches caches
      db.stock_ledger = stockLedgerBackup;
      db.batches = db.batches.map((b, idx) => {
        Object.assign(b, batchesBackup[idx]);
        return b;
      });
      return res.status(422).json({ error: err });
    }
  });

  // Approve inter-warehouse transfers
  app.post('/api/v1/transfers/:id/approve', (req, res) => {
    const trId = req.params.id;
    const tr = db.transfers.find(t => t.id === trId);
    if (!tr) return res.status(404).json({ error: 'Transfer not found' });
    if (db.currentUser?.role !== 'ops_manager' && db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only managers can approve inter-warehouse transfer slips' } });
    }
    if (tr.created_by && db.currentUser?.id === tr.created_by) {
      return res.status(422).json({
        error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'You cannot approve a transfer you created yourself. A different manager must approve it.' }
      });
    }

    const lines = db.transfer_lines.filter(l => l.transfer_id === trId);

    try {
      // Execute transfers ATOMICALLY on ledger
      lines.forEach(l => {
        writeLedgerEntry({
          sku_id: l.sku_id,
          batch_id: l.batch_id,
          location_id: l.from_location_id,
          warehouse_id: tr.from_warehouse_id,
          quantity: -l.qty_requested,
          transaction_type: 'transfer_out',
          reference_id: trId,
          reference_type: 'transfer',
          user_id: db.currentUser?.id || 'U-ADMIN',
          notes: `Inter-warehouse to ${tr.to_warehouse_id}`
        });

        writeLedgerEntry({
          sku_id: l.sku_id,
          batch_id: l.batch_id,
          location_id: l.to_location_id,
          warehouse_id: tr.to_warehouse_id,
          quantity: l.qty_requested,
          transaction_type: 'transfer_in',
          reference_id: trId,
          reference_type: 'transfer',
          user_id: db.currentUser?.id || 'U-ADMIN',
          notes: `Inter-warehouse from ${tr.from_warehouse_id}`
        });

        l.qty_transferred = l.qty_requested;
      });

      tr.status = 'completed';
      tr.approved_by = db.currentUser?.id || 'U-ADMIN';
      tr.approved_at = new Date().toISOString();
      tr.completed_at = new Date().toISOString();

      logAudit(
        'TRANSFER_APPROVED',
        'Transfer',
        trId,
        `Approved inter-warehouse stock transfer ${trId}`,
        { trId, from_warehouse_id: tr.from_warehouse_id, to_warehouse_id: tr.to_warehouse_id }
      );
      res.json({ data: tr });
    } catch (ledgerError: any) {
      return res.status(422).json({ error: ledgerError });
    }
  });

  // Customer orders lists
  app.get('/api/v1/orders', (req, res) => {
    const list = db.customer_orders.map(o => {
      const customer = db.customers.find(c => c.id === o.customer_id);
      return {
        ...o,
        customer_name: customer?.name || o.customer_id,
        lines: db.customer_order_lines.filter(l => l.order_id === o.id)
      };
    });
    res.json({ data: list });
  });

  app.get('/api/v1/orders/packing-queue', (req, res) => {
    const queue = db.customer_orders
      .filter(o => o.status === 'packing')
      .map(o => {
        const customer = db.customers.find(c => c.id === o.customer_id);
        const lines = db.customer_order_lines
          .filter(l => l.order_id === o.id)
          .map(l => {
            const sku = db.skus.find(s => s.id === l.sku_id);
            return {
              ...l,
              sku_name: sku?.name || null,
              sku_code: sku?.code || null,
              temp_zone: sku?.temp_zone || 'ambient'
            };
          });
        return {
          ...o,
          customer_name: customer?.name || o.customer_id,
          lines
        };
      });
    res.json({ data: queue });
  });

  app.get('/api/v1/orders/:id/packing-assets', (req, res) => {
    const assets = (db.packing_assets || []).filter(pa => pa.order_id === req.params.id);
    res.json({ data: assets });
  });

  app.get('/api/v1/orders/:id', (req, res) => {
    const order = db.customer_orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const lines = db.customer_order_lines.filter(l => l.order_id === order.id).map(l => {
      const sku = db.skus.find(s => s.id === l.sku_id);
      return { ...l, sku_name: sku?.name, sku_code: sku?.code };
    });
    res.json({ data: { ...order, lines } });
  });

  // Generate FEFO Pick list from an order (FR-PICK-01 & FR-PICK-02)
  app.post(['/api/v1/orders/:id/pick-list', '/api/v1/orders/:id/pick-list'], async (req, res) => {
    const orderId = req.params.id;
    const order = db.customer_orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Ensure only one active Pick List
    const activePickList = db.pick_lists.find(pl => pl.order_id === orderId && pl.status !== 'cancelled' && pl.status !== 'completed');
    if (activePickList) {
      return res.status(422).json({ error: { code: 'PICKLIST_EXISTS', message: `An active pick list (${activePickList.id}) already exists for Order ${orderId}` } });
    }

    const orderLines = db.customer_order_lines.filter(l => l.order_id === orderId);
    const pickListId = `PKL-${orderId.split('-')[1] || Date.now().toString().slice(-4)}`;

    const generatedLines: PickListLine[] = [];
    const logs: string[] = [];

    // Bundle resolution helper within context
    async function resolveOrderLines(linesList: any[], warehouseId: string): Promise<any[]> {
      const resolvedLines: any[] = [];

      for (const line of linesList) {
        const sku = db.skus.find(s => s.id === line.sku_id);

        if (!sku?.is_bundle) {
          // Normal SKU
          resolvedLines.push({
            ...line,
            is_bundle_component: false,
            bundle_sku_id: null,
            bundle_order_line_id: null
          });
          continue;
        }

        // Bundle SKU — resolve to components
        const bundleDef = db.bundle_definitions.find(
          b => b.bundle_sku_id === line.sku_id && b.is_active
        );
        if (!bundleDef) {
          throw {
            code: 'BUNDLE_NOT_CONFIGURED',
            message: `Bundle SKU ${line.sku_id} has no active bundle definition.`
          };
        }

        // Check validity dates
        const now = new Date();
        if (bundleDef.valid_from && new Date(bundleDef.valid_from) > now) {
          throw {
            code: 'BUNDLE_NOT_YET_VALID',
            message: `Bundle ${bundleDef.name} is not valid until ${bundleDef.valid_from}`
          };
        }
        if (bundleDef.valid_until && new Date(bundleDef.valid_until) < now) {
          throw {
            code: 'BUNDLE_EXPIRED',
            message: `Bundle ${bundleDef.name} offer ended on ${bundleDef.valid_until}`
          };
        }

        // Propagate components
        for (const component of bundleDef.components) {
          const totalQtyNeeded = line.qty_ordered * component.qty;
          resolvedLines.push({
            sku_id: component.sku_id,
            qty_ordered: totalQtyNeeded,
            unit_price_kes: 0,
            is_bundle_component: true,
            bundle_sku_id: line.sku_id,
            bundle_sku_name: sku.name,
            bundle_order_line_id: line.id,
            original_bundle_qty: line.qty_ordered
          });
        }
      }

      return resolvedLines;
    }

    let resolved;
    try {
      resolved = resolveOrderLines(orderLines, order.fulfilment_warehouse_id);
    } catch (err: any) {
      return res.status(400).json({
        error: {
          code: err.code || 'BAD_REQUEST',
          message: err.message || String(err)
        }
      });
    }

    try {
      for (const line of resolved) {
        let qtyNeeded = line.qty_ordered;

        const skuBatches = db.batches
          .filter(b => b.sku_id === line.sku_id && b.warehouse_id === order.fulfilment_warehouse_id && b.status === 'active')
          .sort((a, b) => {
            const expA = new Date(a.expiry_date).getTime();
            const expB = new Date(b.expiry_date).getTime();
            if (expA !== expB) return expA - expB;
            return new Date(a.received_date).getTime() - new Date(b.received_date).getTime();
          });

        let totalRaw = 0;
        let totalUnreserved = 0;
        skuBatches.forEach(b => {
          const reservations = db.stock_reservations
            .filter(r => r.batch_id === b.id && r.warehouse_id === order.fulfilment_warehouse_id && r.status === 'active')
            .reduce((sum, r) => sum + r.qty_reserved, 0);
          totalRaw += b.quantity_available;
          totalUnreserved += Math.max(0, b.quantity_available - reservations);
        });

        if (totalUnreserved < qtyNeeded) {
          if (line.is_bundle_component) {
            const compSku = db.skus.find(s => s.id === line.sku_id);
            const compQtyPerBundle = line.qty_ordered / line.original_bundle_qty;
            throw {
              code: 'BUNDLE_COMPONENT_INSUFFICIENT',
              status: 422,
              message: `Cannot fulfil ${line.original_bundle_qty} × ${line.bundle_sku_name}: ${compSku?.name || line.sku_id} needs ${qtyNeeded} units, only ${totalUnreserved} available.`,
              bundle_sku_id: line.bundle_sku_id,
              limiting_component: {
                sku_id: line.sku_id,
                sku_name: compSku?.name || line.sku_id,
                qty_needed: qtyNeeded,
                qty_available: totalUnreserved,
                max_fulfillable: Math.floor(totalUnreserved / compQtyPerBundle)
              }
            };
          } else {
            throw {
              code: 'INSUFFICIENT_STOCK',
              status: 422,
              message: `Unable to generate FEFO Pick List. SKU ${line.sku_id} is short of ${qtyNeeded} units.`
            };
          }
        }

        logs.push(`SKU ${line.sku_id}: Outstanding order quantity = ${qtyNeeded}. Available batches count: ${skuBatches.length}`);

        for (const batch of skuBatches) {
          if (qtyNeeded <= 0) break;

          const reservations = db.stock_reservations
            .filter(r => r.batch_id === batch.id && r.warehouse_id === order.fulfilment_warehouse_id && r.status === 'active')
            .reduce((sum, r) => sum + r.qty_reserved, 0);
          let unreservedBatchQty = Math.max(0, batch.quantity_available - reservations);
          if (unreservedBatchQty <= 0) continue;

          const locationsWithStock = db.locations.filter(l => {
            if (l.warehouse_id !== order.fulfilment_warehouse_id) return false;
            if (l.is_active === false) return false;
            const bl = db.bin_locations.find(b => b.code === l.code && b.warehouse_id === l.warehouse_id);
            if (bl && !bl.is_active) return false;
            return true;
          });
          for (const loc of locationsWithStock) {
            if (qtyNeeded <= 0 || unreservedBatchQty <= 0) break;

            const batchQtyAtLoc = getStockForBatchAndLocation(batch.id, loc.id);
            if (batchQtyAtLoc <= 0) continue;

            const allowable = Math.min(batchQtyAtLoc, unreservedBatchQty);
            if (allowable <= 0) continue;

            const qtyToTake = Math.min(qtyNeeded, allowable);
            qtyNeeded -= qtyToTake;
            unreservedBatchQty -= qtyToTake;

            generatedLines.push({
              id: `PKL-LN-${Math.floor(Math.random()*100000)}`,
              pick_list_id: pickListId,
              order_line_id: line.id || line.bundle_order_line_id,
              sku_id: line.sku_id,
              batch_id: batch.id,
              location_id: loc.id,
              qty_requested: qtyToTake,
              qty_picked: null,
              status: 'pending',
              short_pick_reason: null,
              picked_at: null,
              picked_by: null,
              is_bundle_component: line.is_bundle_component || false,
              bundle_sku_id: line.bundle_sku_id || null,
              bundle_order_line_id: line.bundle_order_line_id || null,
              effective_bundle_expiry_date: null
            });

            logs.push(`Successfully allocated ${qtyToTake} from Batch ${batch.batch_number || batch.id} (Expiry: ${batch.expiry_date.slice(0, 10)}) at Location ${loc.code}.`);
          }
        }

        if (qtyNeeded > 0) {
          if (line.is_bundle_component) {
            const compSku = db.skus.find(s => s.id === line.sku_id);
            const compQtyPerBundle = line.qty_ordered / line.original_bundle_qty;
            throw {
              code: 'BUNDLE_COMPONENT_INSUFFICIENT',
              status: 422,
              message: `Cannot fulfil ${line.original_bundle_qty} × ${line.bundle_sku_name}: ${compSku?.name || line.sku_id} needs ${line.qty_ordered} units, only ${line.qty_ordered - qtyNeeded} available.`,
              bundle_sku_id: line.bundle_sku_id,
              limiting_component: {
                sku_id: line.sku_id,
                sku_name: compSku?.name || line.sku_id,
                qty_needed: line.qty_ordered,
                qty_available: line.qty_ordered - qtyNeeded,
                max_fulfillable: Math.floor((line.qty_ordered - qtyNeeded) / compQtyPerBundle)
              }
            };
          } else {
            throw {
              code: 'INSUFFICIENT_STOCK',
              status: 422,
              message: `Unable to generate FEFO Pick List. SKU ${line.sku_id} is short of ${qtyNeeded} units.`
            };
          }
        }
      }
    } catch (err: any) {
      if (err.code) {
        return res.status(err.status || 422).json({
          error: err,
          code: err.code,
          message: err.message,
          bundle_sku_id: err.bundle_sku_id,
          limiting_component: err.limiting_component,
          details: { logs }
        });
      }
      return res.status(500).json({ error: String(err) });
    }

    // Group bundle component lines by bundle_order_line_id to calculate effective bundle expiry
    const bundleGroups: { [key: string]: any[] } = {};
    generatedLines.forEach(l => {
      if (l.is_bundle_component && l.bundle_order_line_id) {
        if (!bundleGroups[l.bundle_order_line_id]) {
          bundleGroups[l.bundle_order_line_id] = [];
        }
        bundleGroups[l.bundle_order_line_id].push(l);
      }
    });

    const bundleLinesData: any[] = [];

    Object.keys(bundleGroups).forEach(bundleOrderLineId => {
      const linesInGroup = bundleGroups[bundleOrderLineId];
      let earliestExpiry: string | null = null;

      linesInGroup.forEach(line => {
        const batch = db.batches.find(b => b.id === line.batch_id);
        if (batch && batch.expiry_date) {
          if (!earliestExpiry || new Date(batch.expiry_date) < new Date(earliestExpiry)) {
            earliestExpiry = batch.expiry_date;
          }
        }
      });

      // Update lines
      linesInGroup.forEach(line => {
        line.effective_bundle_expiry_date = earliestExpiry;
      });

      const firstLine = linesInGroup[0];
      bundleLinesData.push({
        bundle_order_line_id: bundleOrderLineId,
        bundle_sku_id: firstLine.bundle_sku_id,
        effective_expiry_date: earliestExpiry,
        lines: linesInGroup.map(line => ({
          sku_id: line.sku_id,
          batch_id: line.batch_id,
          qty_requested: line.qty_requested,
          location_id: line.location_id
        }))
      });
    });

    // Save Pick List Master
    const newPickList: PickList = {
      id: pickListId,
      order_id: orderId,
      warehouse_id: order.fulfilment_warehouse_id,
      assigned_to: null,
      status: 'pending',
      created_by: db.currentUser?.id || 'U-ADMIN',
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null
    };

    db.pick_lists.push(newPickList);
    generatedLines.forEach(l => db.pick_list_lines.push(l));

    order.status = 'picking';
    await saveState();

    res.status(201).json({
      data: {
        ...newPickList,
        lines: generatedLines,
        bundle_lines: bundleLinesData
      }
    });
  });

  app.get('/api/v1/pick-lists', (req, res) => {
    const list = db.pick_lists.map(pl => {
      const lines = db.pick_list_lines.filter(l => l.pick_list_id === pl.id).map(line => {
        const sku = db.skus.find(s => s.id === line.sku_id);
        const batch = db.batches.find(b => b.id === line.batch_id);
        return {
          ...line,
          sku_name: sku?.name,
          supplier_id: sku?.supplier_id,
          batch_number: batch?.batch_number || line.batch_id
        };
      });
      return { ...pl, lines };
    });
    res.json({ data: list });
  });

  app.get('/api/v1/pick-lists/:id', (req, res) => {
    const pl = db.pick_lists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Pick list not found' });
    const lines = db.pick_list_lines.filter(l => l.pick_list_id === pl.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      const loc = db.locations.find(l => l.id === line.location_id);
      const batch = db.batches.find(b => b.id === line.batch_id);
      return { ...line, sku_name: sku?.name, location_code: loc?.code, expiry_date: batch?.expiry_date };
    });
    res.json({ data: { ...pl, lines } });
  });

  app.patch('/api/v1/pick-lists/:id/assign', async (req, res) => {
    const pl = db.pick_lists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Pick list not found' });
    pl.assigned_to = req.body.picker_id;
    pl.status = 'in_progress';
    pl.started_at = new Date().toISOString();
    await saveState();
    res.json({ data: pl });
  });

  // Pick single line confirmation
  app.patch('/api/v1/pick-lists/:id/lines/:lineId', async (req, res) => {
    const plId = req.params.id;
    const lineId = req.params.lineId;
    const { qty_picked, short_pick_reason } = req.body;

    const pl = db.pick_lists.find(p => p.id === plId);
    if (!pl) return res.status(404).json({ error: 'Pick List not found' });
    if (pl.status === 'completed') {
      return res.status(422).json({ error: { code: 'PICKLIST_LOCKED', message: 'Pick list is completed and locked. Access denied.' } });
    }

    const line = db.pick_list_lines.find(l => l.id === lineId);
    if (!line) return res.status(404).json({ error: 'Pick Line not found' });

    // Validate short pick reason code
    if (qty_picked < line.qty_requested && !short_pick_reason) {
      return res.status(400).json({ error: { code: 'SHORT_PICK_REASON_REQUIRED', message: 'Short picking requires recording a reason (e.g., OUT_OF_STOCK, DAMAGED_ON_SHELF)' } });
    }

    line.qty_picked = qty_picked;
    line.short_pick_reason = short_pick_reason || null;
    line.status = qty_picked < line.qty_requested ? 'short_picked' : 'picked';
    line.picked_at = new Date().toISOString();
    line.picked_by = db.currentUser?.id || 'U-PICKER';

    await saveState();
    res.json({ data: line });
  });

  // Mark pick complete -> Writes Ledger entries!
  app.post('/api/v1/pick-lists/:id/complete', async (req, res) => {
    const plId = req.params.id;
    const pl = db.pick_lists.find(p => p.id === plId);
    if (!pl) return res.status(404).json({ error: 'Pick List not found' });

    const lines = db.pick_list_lines.filter(l => l.pick_list_id === plId);
    if (lines.some(l => l.status === 'pending')) {
      return res.status(422).json({ error: { code: 'LINES_NOT_ALL_ACTIONED', message: 'Cannot complete. Some picker lines remain pending action.' } });
    }

    try {
      // Loop lines inside atomic ledger write transaction
      lines.forEach(line => {
        const amountPicked = line.qty_picked || 0;
        if (amountPicked > 0) {
          writeLedgerEntry({
            sku_id: line.sku_id,
            batch_id: line.batch_id,
            location_id: line.location_id,
            warehouse_id: pl.warehouse_id,
            quantity: -amountPicked, // Out from stock
            transaction_type: 'pick',
            reference_id: plId,
            reference_type: 'pick_list',
            user_id: db.currentUser?.id || 'U-PICKER',
            notes: `Pick for Customer Order ${pl.order_id}`
          });
        }

        // Update customer order line fulfillment details
        const orderLine = db.customer_order_lines.find(ol => ol.id === line.order_line_id);
        if (orderLine) {
          orderLine.qty_fulfilled += amountPicked;
        }
      });

      pl.status = 'completed';
      pl.completed_at = new Date().toISOString();

      // Picking complete — order now moves to packing, not packed.
      // A different person must confirm packing (see
      // /api/v1/orders/:id/complete-packing below).
      const order = db.customer_orders.find(o => o.id === pl.order_id);
      if (order) {
        order.status = 'packing';
        order.picked_by = db.currentUser?.id || null;
      }

      await saveState();
      res.json({ data: pl });

    } catch (err: any) {
      return res.status(422).json({ error: err });
    }
  });

  app.post('/api/v1/orders/:id/complete-packing', async (req, res) => {
    const order = db.customer_orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });

    if (order.status !== 'packing') {
      return res.status(422).json({
        error: { code: 'INVALID_STATUS', message: `Order must be in 'packing' status to confirm packing. Current status: ${order.status}` }
      });
    }

    // Enforce different person from who picked it
    if (order.picked_by && db.currentUser?.id === order.picked_by) {
      return res.status(422).json({
        error: { code: 'PACKER_MUST_DIFFER_FROM_PICKER', message: 'A different person must confirm packing than who picked the order.' }
      });
    }

    // Determine if cold-chain confirmation is required: any order
    // line whose SKU has temp_zone 'chilled' or 'frozen'
    const orderLines = db.customer_order_lines.filter(ol => ol.order_id === order.id);
    const requiresColdChain = orderLines.some(ol => {
      const sku = db.skus.find(s => s.id === ol.sku_id);
      return sku && (sku.temp_zone === 'chilled' || sku.temp_zone === 'frozen');
    });

    const coldChainConfirmed = req.body.cold_chain_confirmed === true;
    if (requiresColdChain && !coldChainConfirmed) {
      return res.status(400).json({
        error: { code: 'COLD_CHAIN_CONFIRMATION_REQUIRED', message: 'This order contains chilled or frozen items. Cold-chain confirmation is required before packing can be completed.' }
      });
    }

    const toteCount = Number(req.body.tote_count) || 0;
    if (toteCount <= 0) {
      return res.status(400).json({
        error: { code: 'TOTE_COUNT_REQUIRED', message: 'At least one tote or cooler box must be recorded.' }
      });
    }

    // Record the asset(s) used, one PackingAsset row per asset type
    // provided. Body shape: { assets: [{ asset_type, count }], cold_chain_confirmed, tote_count }
    const assets = Array.isArray(req.body.assets) ? req.body.assets : [];
    if (!db.packing_assets) db.packing_assets = [];
    assets.forEach((a: any) => {
      const typeKey = a.asset_type_id || a.asset_type || '';
      if (!typeKey || !a.count || Number(a.count) <= 0) return;

      const foundType = (db.asset_types || []).find(
        t => t.id === typeKey || t.name.toLowerCase() === typeKey.toLowerCase()
      );
      const asset_type_id = foundType?.id || `AT-${typeKey.toUpperCase().replace(/_/g, '-')}`;
      const asset_type_name = foundType?.name || typeKey.replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      db.packing_assets.push({
        id: `PKA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order_id: order.id,
        asset_type_id,
        asset_type_name,
        count: Number(a.count),
        recorded_at: new Date().toISOString(),
        recorded_by: db.currentUser?.id || 'SYSTEM',
        asset_type: typeKey
      });
    });

    order.status = 'packed';
    order.packed_by = db.currentUser?.id || null;
    order.packed_at = new Date().toISOString();
    order.cold_chain_confirmed = coldChainConfirmed;
    order.packed_tote_count = toteCount;

    await saveState();
    res.json({ data: order });
  });

  app.post('/api/v1/pick-lists/:id/reopen', async (req, res) => {
    const plId = req.params.id;
    const pl = db.pick_lists.find(p => p.id === plId);
    if (!pl) return res.status(404).json({ error: 'Pick list not found' });
    if (db.currentUser?.role !== 'ops_manager' && db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Only managers can reopen' });
    }

    // Rollback dynamic ledger pick writes to allow re-edit
    // (In our simulated state, we just reverse completion ledger entries if needed or just unlock status)
    pl.status = 'in_progress';
    pl.completed_at = null;
    
    // reverse line status and create reversal ledger entries
    const lines = db.pick_list_lines.filter(l => l.pick_list_id === plId);
    lines.forEach(l => {
      const amountPicked = l.qty_picked || 0;
      if (amountPicked > 0) {
        try {
          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: l.location_id,
            warehouse_id: pl.warehouse_id,
            quantity: amountPicked, // Reversing negative pick (adding back to stock)
            transaction_type: 'pick_reversal',
            reference_id: plId,
            reference_type: 'pick_list',
            user_id: db.currentUser?.id || 'U-PICKER',
            notes: `Reversal of pick for Pick List ${plId} (reopened)`
          });
        } catch (err) {
          console.error('Error writing reversal entry:', err);
        }

        // Also adjust the order line tracking
        const orderLine = db.customer_order_lines.find(ol => ol.id === l.order_line_id);
        if (orderLine) {
          orderLine.qty_fulfilled = Math.max(0, orderLine.qty_fulfilled - amountPicked);
        }
      }
      l.status = 'pending';
    });

    // reverse batch counts
    db.batches.forEach(b => { b.quantity_available = getStockForBatch(b.id); });

    const order = db.customer_orders.find(o => o.id === pl.order_id);
    if (order) order.status = 'picking';

    await saveState();
    res.json({ data: pl });
  });

  // Dispatch & Delivery with Temp Log checks (FR-DISP-04 & BR-060/061)
  app.post('/api/v1/orders/:id/dispatch', async (req, res) => {
    const orderId = req.params.id;
    const order = db.customer_orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'packed') {
      return res.status(422).json({
        error: { code: 'ORDER_NOT_PACKED', message: `Order must be in 'packed' status before it can be dispatched. Current status: ${order.status}` }
      });
    }

    const allowedToDispatch =
      db.currentUser?.role === 'admin' ||
      db.currentUser?.role === 'ops_manager' ||
      db.currentUser?.role === 'driver' ||
      userHasPermission(db.currentUser, 'dispatch:execute');

    if (!allowedToDispatch) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to dispatch orders.' }
      });
    }

    const { driver_id, vehicle_id, tote_count, temp_log } = req.body;

    // Check if order contains frozen or chilled SKUs
    const orderLines = db.customer_order_lines.filter(l => l.order_id === orderId);
    const hasColdChainItems = orderLines.some(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return sku && (sku.temp_zone === 'chilled' || sku.temp_zone === 'frozen');
    });

    if (hasColdChainItems && (!temp_log || temp_log.temperature_celsius === undefined)) {
      return res.status(422).json({ error: { code: 'TEMP_LOG_REQUIRED', message: 'Order contains refrigerated or frozen dairy/meats. A dispatch temperature log is strictly mandatory.' } });
    }

    // Log cold chain dispatch breach if temp ranges don't conform
    let breachLogged = false;
    if (hasColdChainItems && temp_log) {
      const temp = temp_log.temperature_celsius;
      // standard chilled target: 0°C to 4°C
      if (temp < 0 || temp > 4) {
        breachLogged = true;
        // create breach temp log
        const logId = `TL-${Math.floor(Math.random()*100000)}`;
        db.temp_logs.push({
          id: logId,
          reference_id: `DEL-${orderId}`,
          reference_type: 'delivery',
          temperature_celsius: temp,
          zone_type: 'chilled',
          is_breach: true,
          recorded_by: db.currentUser?.id || 'U-DRIVER',
          recorded_at: new Date().toISOString(),
          device_id: vehicle_id || 'HANDHELD-CONSOLE',
          notes: `TEMP DISPATCH BREACH: Temp recorded ${temp}°C exceeds limits for cold chain delivery.`
        });
      } else {
        // normal log
        db.temp_logs.push({
          id: `TL-${Math.floor(Math.random()*100000)}`,
          reference_id: `DEL-${orderId}`,
          reference_type: 'delivery',
          temperature_celsius: temp,
          zone_type: 'chilled',
          is_breach: false,
          recorded_by: db.currentUser?.id || 'U-DRIVER',
          recorded_at: new Date().toISOString(),
          device_id: vehicle_id || 'HANDHELD-CONSOLE',
          notes: 'Temp dispatch normal.'
        });
      }
    }

    const deliveryId = `DEL-${orderId.split('-')[1] || Date.now().toString().slice(-4)}`;
    const finalToteCount = (tote_count !== undefined && tote_count !== null && tote_count !== '') ? Number(tote_count) : (order.packed_tote_count || 0);
    const newDelivery: Delivery = {
      id: deliveryId,
      order_id: orderId,
      driver_id,
      vehicle_id: vehicle_id || 'VAN-001',
      tote_count: finalToteCount,
      status: 'dispatched',
      dispatched_at: new Date().toISOString(),
      delivered_at: null,
      delivery_latitude: null,
      delivery_longitude: null,
      signature_url: null,
      failure_reason: null
    };

    db.deliveries.push(newDelivery);

    // Carry over assets recorded at packing time into this delivery
    const stagedAssets = (db.packing_assets || []).filter(pa => pa.order_id === order.id);
    if (!db.delivery_assets) db.delivery_assets = [];
    stagedAssets.forEach(pa => {
      db.delivery_assets.push({
        id: `DA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        delivery_id: deliveryId,
        asset_id: null,
        asset_type: pa.asset_type,
        uid: null,
        count: pa.count,
        dispatched_at: new Date().toISOString(),
        returned_at: null,
        return_condition: null
      });
    });

    order.status = 'dispatched';
    await saveState();

    const individually_tracked = req.body.individually_tracked || [];
    const count_tracked = req.body.count_tracked || [];
    const indCount = individually_tracked.length;
    const cntCount = count_tracked.reduce((sum: number, c: any) => sum + (Number(c.count) || 0), 0);

    res.json({ 
      data: newDelivery, 
      breach: breachLogged,
      asset_summary: {
        individually_tracked: indCount,
        count_tracked: cntCount
      }
    });
  });

  app.get('/api/v1/deliveries', (req, res) => {
    res.json({ data: db.deliveries });
  });

  app.post('/api/v1/deliveries/:id/confirm', async (req, res) => {
    const del = db.deliveries.find(d => d.id === req.params.id);
    if (!del) return res.status(404).json({ error: 'Delivery not found' });

    Object.assign(del, req.body);
    del.status = 'delivered';
    del.delivered_at = new Date().toISOString();

    const order = db.customer_orders.find(o => o.id === del.order_id);
    if (order) order.status = 'delivered';

    await saveState();
    res.json({ data: del });
  });

  app.post('/api/v1/deliveries/:id/fail', async (req, res) => {
    const del = db.deliveries.find(d => d.id === req.params.id);
    if (!del) return res.status(404).json({ error: 'Delivery not found' });

    del.status = 'failed';
    del.failure_reason = req.body.reason;

    const order = db.customer_orders.find(o => o.id === del.order_id);
    if (order) order.status = 'failed_delivery';

    // Return items to inventory logic (re-recepting)
    const pickLines = db.pick_list_lines.filter(l => l.pick_list_id === `PKL-${del.order_id.split('-')[1]}`);
    pickLines.forEach(l => {
      if ((l.qty_picked || 0) > 0) {
        writeLedgerEntry({
          sku_id: l.sku_id,
          batch_id: l.batch_id,
          location_id: l.location_id,
          warehouse_id: order?.fulfilment_warehouse_id || db.warehouses[0]?.id || '',
          quantity: l.qty_picked!, // Return positive
          transaction_type: 'return',
          reference_id: del.id,
          reference_type: 'return',
          user_id: db.currentUser?.id || 'U-DRIVER',
          notes: `Return to stock - Failed Delivery ${del.id}`
        });
      }
    });

    await saveState();
    res.json({ data: del });
  });

  // --- ASSET MANAGEMENT ENDPOINTS (FEATURE 1) ---

  app.get('/api/v1/assets', (req, res) => {
    let list = db.assets || [];
    const { warehouse_id, status } = req.query;
    if (warehouse_id) {
      list = list.filter(a => a.warehouse_id === warehouse_id || a.current_warehouse_id === warehouse_id);
    }
    if (status) {
      list = list.filter(a => {
        const itemStatus = a.status || a.current_status || '';
        return itemStatus.toLowerCase() === (status as string).toLowerCase();
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const total = list.length;
    const paginated = list.slice((page - 1) * perPage, page * perPage);

    res.json({
      data: paginated,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage)
      }
    });
  });

  app.post('/api/v1/assets', async (req, res) => {
    const { uid, type, warehouse_id, notes } = req.body;
    if (!uid || !type || !warehouse_id) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Missing uid, type, or warehouse_id' } });
    }
    const exists = db.assets.some(a => a.uid === uid);
    if (exists) {
      return res.status(400).json({ error: { code: 'ASSET_UID_EXISTS', message: `UID ${uid} already exists.` } });
    }
    const newAsset: Asset = {
      id: uid,
      uid,
      asset_type_id: `AT-${type.toUpperCase().replace(/_/g, '-')}`,
      current_status: 'available',
      current_warehouse_id: warehouse_id,
      notes: notes || null,
      created_by: db.currentUser?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      // Legacy compatibility:
      type,
      status: 'available',
      warehouse_id
    };
    db.assets.push(newAsset);
    await saveState();
    res.json({ data: newAsset });
  });

  // --- ASSET TYPE AND EVENT ENDPOINTS ---

  app.get('/api/v1/asset-types', (req, res) => {
    res.json({ data: db.asset_types || [] });
  });

  app.post('/api/v1/asset-types', async (req, res) => {
    if (db.currentUser?.role !== 'admin' &&
        db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN',
          message: 'Only managers can create asset types.' }
      });
    }
    const { name, description, requires_uid } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME',
          message: 'Asset type name is required (min 2 characters).',
          field: 'name' }
      });
    }
    const duplicate = (db.asset_types || []).find(
      t => t.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_NAME',
          message: `An asset type named "${name}" already exists.` }
      });
    }
    const newType = {
      id: `AT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim(),
      description: description || null,
      requires_uid: requires_uid !== false,  // default true
      is_active: true,
      created_by: db.currentUser?.id || 'SYSTEM',
      created_at: new Date().toISOString()
    };
    if (!db.asset_types) db.asset_types = [];
    db.asset_types.push(newType);
    await saveState();
    res.json({ data: newType });
  });

  app.patch('/api/v1/asset-types/:id', async (req, res) => {
    if (db.currentUser?.role !== 'admin' &&
        db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN',
          message: 'Only managers can modify asset types.' }
      });
    }
    const assetType = (db.asset_types || [])
      .find(t => t.id === req.params.id);
    if (!assetType) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Asset type not found' }
      });
    }
    const editable = ['name', 'description', 'requires_uid', 'is_active'];
    editable.forEach(field => {
      if (req.body[field] !== undefined) {
        (assetType as any)[field] = req.body[field];
      }
    });
    await saveState();
    res.json({ data: assetType });
  });

  app.post('/api/v1/assets/:id/events', async (req, res) => {
    const asset = (db.assets || []).find(a => a.id === req.params.id);
    if (!asset) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      });
    }

    const {
      event_type, movement_reason, reference_id, reference_type,
      qty, to_warehouse_id, notes, uid
    } = req.body;

    const VALID_EVENT_TYPES = [
      'created', 'uid_assigned', 'dispatched', 'returned',
      'damaged_reported', 'sent_for_repair', 'repair_completed',
      'retired', 'lost_reported', 'found', 'transferred',
      'pool_adjustment'
    ];
    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({
        error: { code: 'INVALID_EVENT_TYPE',
          message: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` }
      });
    }

    // Derive new status from event type
    const STATUS_MAP: Record<string, AssetStatus> = {
      created:          'available',
      uid_assigned:     asset.current_status,
      dispatched:       'dispatched',
      returned:         'returned',
      damaged_reported: 'returned',
      sent_for_repair:  'under_repair',
      repair_completed: 'available',
      retired:          'retired',
      lost_reported:    'lost',
      found:            'available',
      transferred:      'available',
      pool_adjustment:  asset.current_status
    };

    const fromStatus = asset.current_status as AssetStatus;
    const toStatus = STATUS_MAP[event_type] as AssetStatus;

    // If this is a UID assignment, update the asset's uid field
    if (event_type === 'uid_assigned' && uid) {
      // Check UID uniqueness within this asset type
      const duplicate = (db.assets || []).find(
        a => a.asset_type_id === asset.asset_type_id &&
             a.uid === uid && a.id !== asset.id
      );
      if (duplicate) {
        return res.status(409).json({
          error: { code: 'DUPLICATE_UID',
            message: `UID "${uid}" is already assigned to another ` +
              `asset of this type.` }
        });
      }
      asset.uid = uid;
    }

    // Build the event record
    const event: any = {
      id: `AE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      asset_id: asset.id,
      asset_type_id: asset.asset_type_id,
      event_type,
      movement_reason: movement_reason || null,
      reference_id: reference_id || null,
      reference_type: reference_type || null,
      qty: qty || 1,
      from_warehouse_id: asset.current_warehouse_id,
      to_warehouse_id: to_warehouse_id || null,
      from_status: fromStatus,
      to_status: toStatus,
      recorded_by: db.currentUser?.id || 'SYSTEM',
      recorded_at: new Date().toISOString(),
      notes: notes || null
    };

    // Apply status and location changes to the asset
    asset.current_status = toStatus;
    // Keep legacy fields updated for compatibility
    asset.status = toStatus;
    if (event_type === 'dispatched') {
      asset.current_warehouse_id = null; // out with a delivery
      asset.warehouse_id = '';
    } else if (to_warehouse_id) {
      asset.current_warehouse_id = to_warehouse_id;
      asset.warehouse_id = to_warehouse_id;
    }

    if (!db.asset_events) db.asset_events = [];
    db.asset_events.push(event);

    logAudit('ASSET_EVENT', 'Asset', asset.id,
      `${event_type} — ${asset.uid || asset.id} ` +
      `(${fromStatus} → ${toStatus})` +
      (reference_id ? ` ref: ${reference_id}` : '') +
      (notes ? ` — ${notes}` : '')
    );

    await saveState();
    res.json({ data: event });
  });

  // Get full event history for an asset
  app.get('/api/v1/assets/:id/events', (req, res) => {
    const asset = (db.assets || []).find(a => a.id === req.params.id);
    if (!asset) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      });
    }
    const events = (db.asset_events || [])
      .filter(e => e.asset_id === req.params.id)
      .sort((a, b) =>
        b.recorded_at.localeCompare(a.recorded_at)
      );
    // Enrich with recorder name
    const enriched = events.map(e => ({
      ...e,
      recorded_by_name: (db.users || [])
        .find(u => u.id === e.recorded_by)?.name || e.recorded_by
    }));
    res.json({ data: enriched });
  });

  // Get all assets involved in a specific order/reference
  app.get('/api/v1/asset-events/by-reference', (req, res) => {
    const { reference_id, reference_type } = req.query;
    if (!reference_id) {
      return res.status(400).json({
        error: { code: 'MISSING_PARAM',
          message: 'reference_id is required' }
      });
    }
    const events = (db.asset_events || [])
      .filter(e =>
        e.reference_id === reference_id &&
        (!reference_type || e.reference_type === reference_type)
      )
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

    // Enrich with asset details
    const enriched = events.map(e => {
      const asset = (db.assets || []).find(a => a.id === e.asset_id);
      const assetType = (db.asset_types || [])
        .find(t => t.id === e.asset_type_id);
      return {
        ...e,
        asset_uid: asset?.uid || null,
        asset_type_name: assetType?.name || e.asset_type_id
      };
    });

    res.json({ data: enriched });
  });

  app.get('/api/v1/delivery-assets', (req, res) => {
    let list = db.delivery_assets || [];
    const { delivery_id } = req.query;
    if (delivery_id) {
      list = list.filter(da => da.delivery_id === delivery_id);
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const total = list.length;
    const paginated = list.slice((page - 1) * perPage, page * perPage);

    res.json({
      data: paginated,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage)
      }
    });
  });

  app.post('/api/v1/deliveries/:id/assets', async (req, res) => {
    const delivery_id = req.params.id;
    const delivery = db.deliveries.find(d => d.id === delivery_id);
    if (!delivery) {
      return res.status(404).json({ error: { code: 'DELIVERY_NOT_FOUND', message: 'Delivery not found' } });
    }

    const { individually_tracked = [], count_tracked = [] } = req.body;
    const createdList: DeliveryAsset[] = [];

    // Validate individually tracked first
    for (const item of individually_tracked) {
      const asset = db.assets.find(a => a.uid === item.uid);
      if (!asset) {
        return res.status(400).json({ error: { code: 'ASSET_NOT_FOUND', message: `Asset is not found in database: ${item.uid}` } });
      }
      if (asset.status !== 'available') {
        return res.status(400).json({ error: { code: 'ASSET_NOT_AVAILABLE', message: `Asset ${item.uid} is currently ${asset.status}` } });
      }
    }

    // Process individually tracked
    for (const item of individually_tracked) {
      const asset = db.assets.find(a => a.uid === item.uid)!;
      asset.status = 'in_transit';
      const da: DeliveryAsset = {
        id: `DA-${Math.floor(Math.random() * 10000000)}`,
        delivery_id,
        asset_id: asset.id,
        asset_type: asset.type,
        uid: asset.uid,
        count: 1,
        dispatched_at: new Date().toISOString(),
        returned_at: null,
        return_condition: null
      };
      db.delivery_assets.push(da);
      createdList.push(da);
    }

    // Process count tracked
    for (const item of count_tracked) {
      const da: DeliveryAsset = {
        id: `DA-${Math.floor(Math.random() * 10000000)}`,
        delivery_id,
        asset_id: null,
        asset_type: item.type,
        uid: null,
        count: parseInt(item.count) || 1,
        dispatched_at: new Date().toISOString(),
        returned_at: null,
        return_condition: null
      };
      db.delivery_assets.push(da);
      createdList.push(da);
    }

    await saveState();
    res.json({ data: createdList });
  });

  app.post('/api/v1/deliveries/:id/return-assets', async (req, res) => {
    const { assets = [] } = req.body;
    const updated: DeliveryAsset[] = [];

    for (const item of assets) {
      let da = db.delivery_assets.find(d => {
        if (item.delivery_asset_id) return d.id === item.delivery_asset_id;
        if (item.uid) return d.uid === item.uid;
        return false;
      });

      if (da) {
        da.returned_at = new Date().toISOString();
        da.return_condition = item.return_condition; // 'good' | 'damaged' | 'lost'

        if (da.asset_id) {
          const asset = db.assets.find(a => a.id === da.asset_id);
          if (asset) {
            asset.status = item.return_condition === 'good' ? 'available' : item.return_condition;
          }
        }
        updated.push(da);
      }
    }

    await saveState();
    res.json({ data: updated });
  });

  // --- PRODUCT RECALL ENDPOINTS (FEATURE 2) ---

  app.get('/api/v1/recalls', (req, res) => {
    const list = db.product_recalls.map(r => {
      const actionsCount = db.recall_actions.filter(a => a.recall_id === r.id).length;
      return {
        ...r,
        recall_actions_count: actionsCount
      };
    });

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const total = list.length;
    const paginated = list.slice((page - 1) * perPage, page * perPage);

    res.json({
      data: paginated,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage)
      }
    });
  });

  app.get('/api/v1/recall-actions', (req, res) => {
    let list = db.recall_actions || [];
    const { recall_id } = req.query;
    if (recall_id) {
      list = list.filter(a => a.recall_id === recall_id);
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const total = list.length;
    const paginated = list.slice((page - 1) * perPage, page * perPage);

    res.json({
      data: paginated,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage)
      }
    });
  });

  app.post('/api/v1/recalls', async (req, res) => {
    const { scope, sku_id, supplier_id, batch_ids = [], reason, disposition } = req.body;
    
    // Determine affected batch_ids
    let affectedBatchIds: string[] = [];
    if (scope === 'batch') {
      affectedBatchIds = batch_ids;
    } else if (scope === 'sku') {
      affectedBatchIds = db.batches.filter(b => b.sku_id === sku_id).map(b => b.id);
    } else if (scope === 'supplier') {
      const supplierSkuIds = db.skus.filter(s => s.supplier_id === supplier_id).map(s => s.id);
      affectedBatchIds = db.batches.filter(b => supplierSkuIds.includes(b.sku_id)).map(b => b.id);
    }

    // Compute exposure_snapshot
    let units_in_stock = 0;
    db.batches.forEach(b => {
      if (affectedBatchIds.includes(b.id)) {
        units_in_stock += getStockForBatch(b.id) || 0;
      }
    });

    const linesWithBatches = db.pick_list_lines.filter(l => affectedBatchIds.includes(l.batch_id));
    
    let units_in_transit = 0;
    let units_delivered = 0;
    const affectedCustomerIds = new Set<string>();

    linesWithBatches.forEach(l => {
      const pl = db.pick_lists.find(p => p.id === l.pick_list_id);
      if (pl) {
        const ord = db.customer_orders.find(o => o.id === pl.order_id);
        if (ord) {
          const qty = l.qty_picked || l.qty_requested || 0;
          if (ord.status === 'dispatched') {
            units_in_transit += qty;
            affectedCustomerIds.add(ord.customer_id);
          } else if (ord.status === 'delivered') {
            units_delivered += qty;
            affectedCustomerIds.add(ord.customer_id);
          }
        }
      }
    });

    let estimated_value_kes = 0;
    affectedBatchIds.forEach(bid => {
      const bat = db.batches.find(b => b.id === bid);
      if (bat) {
        const sku = db.skus.find(s => s.id === bat.sku_id);
        if (sku) {
          estimated_value_kes += (getStockForBatch(bat.id) || 0) * (sku.cost_price_kes || 0);
        }
      }
    });

    const newRecall: ProductRecall = {
      id: `REC-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
      scope,
      sku_id: sku_id || null,
      supplier_id: supplier_id || null,
      batch_ids: affectedBatchIds,
      reason,
      disposition,
      initiated_by: db.currentUser?.id || 'U-OPS-A',
      status: 'draft',
      exposure_snapshot: {
        units_in_stock,
        units_in_transit,
        units_delivered,
        customers_affected: affectedCustomerIds.size,
        estimated_value_kes
      },
      customers_to_contact: [],
      created_at: new Date().toISOString(),
      resolved_at: null
    };

    db.product_recalls.push(newRecall);
    await saveState();
    res.json({ data: newRecall });
  });

  app.get('/api/v1/recalls/:id', (req, res) => {
    const recall = db.product_recalls.find(r => r.id === req.params.id);
    if (!recall) {
      return res.status(404).json({ error: { code: 'RECALL_NOT_FOUND', message: 'Recall not found' } });
    }
    const actions = db.recall_actions.filter(a => a.recall_id === recall.id);
    res.json({ data: { ...recall, recall_actions: actions } });
  });

  app.post('/api/v1/recalls/:id/confirm', async (req, res) => {
    const id = req.params.id;
    const recall = db.product_recalls.find(r => r.id === id);
    if (!recall) {
      return res.status(404).json({ error: { code: 'RECALL_NOT_FOUND', message: 'Recall not found' } });
    }

    // Step 1 — STOCK REMOVAL
    for (const batchId of recall.batch_ids) {
      const bat = db.batches.find(b => b.id === batchId);
      if (!bat) continue;

      const sku = db.skus.find(s => s.id === bat.sku_id);
      const skuName = sku ? sku.name : 'Unknown SKU';

      const locsWithStock = db.locations.map(loc => ({
        loc,
        qty: getStockForBatchAndLocation(bat.id, loc.id)
      })).filter(item => item.qty > 0);

      let totalRemoved = 0;
      for (const item of locsWithStock) {
        try {
          writeLedgerEntry({
            sku_id: bat.sku_id,
            batch_id: bat.id,
            location_id: item.loc.id,
            warehouse_id: item.loc.warehouse_id,
            quantity: -item.qty,
            transaction_type: 'write_off',
            reference_id: recall.id,
            reference_type: 'write_off',
            user_id: db.currentUser?.id || 'U-OPS-A',
            notes: 'PRODUCT RECALL ' + recall.id
          });
          totalRemoved += item.qty;
        } catch (err: any) {
          db.recall_actions.push({
            id: `ACT-${Math.floor(Math.random() * 1000000)}`,
            recall_id: recall.id,
            action_type: 'STOCK_REMOVED',
            reference_id: bat.id,
            reference_type: 'batch',
            automated: true,
            status: 'failed',
            description: `Failed to remove stock for batch ${bat.batch_number} at ${item.loc.code}: ${err.message || err}`,
            executed_at: new Date().toISOString()
          });
        }
      }

      bat.status = 'recalled'; // mark status
      bat.quantity_available = 0;

      db.recall_actions.push({
        id: `ACT-${Math.floor(Math.random() * 1000000)}`,
        recall_id: recall.id,
        action_type: 'STOCK_REMOVED',
        reference_id: bat.id,
        reference_type: 'batch',
        automated: true,
        status: 'done',
        description: `Removed ${totalRemoved} units of ${skuName} batch ${bat.batch_number}`,
        executed_at: new Date().toISOString()
      });
    }

    // Step 2 — PICK LIST CANCELLATION
    const affectedPklLines = db.pick_list_lines.filter(l => 
      recall.batch_ids.includes(l.batch_id) && l.status !== 'picked' && l.status !== 'skipped'
    );
    const pklIdsToCheck = new Set<string>();
    
    affectedPklLines.forEach(l => {
      const pl = db.pick_lists.find(p => p.id === l.pick_list_id);
      if (pl && pl.status !== 'completed') {
        l.status = 'skipped';
        l.short_pick_reason = 'OUT_OF_STOCK';
        pklIdsToCheck.add(pl.id);
      }
    });

    for (const plId of pklIdsToCheck) {
      const pl = db.pick_lists.find(p => p.id === plId);
      if (pl) {
        const allLines = db.pick_list_lines.filter(l => l.pick_list_id === pl.id);
        const allSkippedOrCancelled = allLines.every(l => l.status === 'skipped' || l.status === 'short_picked');
        if (allSkippedOrCancelled) {
          pl.status = 'cancelled';
        }

        db.recall_actions.push({
          id: `ACT-${Math.floor(Math.random() * 1000000)}`,
          recall_id: recall.id,
          action_type: 'PICKLIST_CANCELLED',
          reference_id: pl.id,
          reference_type: 'pick_list',
          automated: true,
          status: 'done',
          description: `Cancelled pick list ${pl.id} — affected batch recalled`,
          executed_at: new Date().toISOString()
        });
      }
    }

    // Step 3 — IN-TRANSIT DRIVER RECALL
    const dispatchedDeliveries = db.deliveries.filter(d => d.status === 'dispatched');
    for (const del of dispatchedDeliveries) {
      const order = db.customer_orders.find(o => o.id === del.order_id);
      if (order) {
        const pl = db.pick_lists.find(p => p.order_id === order.id);
        if (pl) {
          const plLines = db.pick_list_lines.filter(l => l.pick_list_id === pl.id);
          const hasRecalledBatch = plLines.some(l => recall.batch_ids.includes(l.batch_id));
          if (hasRecalledBatch) {
            del.status = 'returning';
            order.status = 'failed_delivery';

            db.recall_actions.push({
              id: `ACT-${Math.floor(Math.random() * 1000000)}`,
              recall_id: recall.id,
              action_type: 'DRIVER_RECALLED',
              reference_id: del.id,
              reference_type: 'delivery',
              automated: true,
              status: 'done',
              description: `Driver on delivery ${del.id} recalled — return to warehouse`,
              executed_at: new Date().toISOString()
            });
          }
        }
      }
    }

    // Step 4 — CUSTOMER CONTACT LIST
    const deliveredOrders = db.customer_orders.filter(o => o.status === 'delivered');
    const contactList: any[] = [];

    for (const order of deliveredOrders) {
      const pl = db.pick_lists.find(p => p.order_id === order.id);
      if (pl) {
        const plLines = db.pick_list_lines.filter(l => l.pick_list_id === pl.id);
        const affectedLines = plLines.filter(l => recall.batch_ids.includes(l.batch_id));
        
        if (affectedLines.length > 0) {
          const customer = db.customers.find(c => c.id === order.customer_id);
          const skusAffected = Array.from(new Set(affectedLines.map(l => l.sku_id)));
          
          if (customer) {
            const existing = contactList.find(c => c.customer_id === customer.id);
            if (existing) {
              skusAffected.forEach(sid => {
                if (!existing.skus_affected.includes(sid)) {
                  existing.skus_affected.push(sid);
                }
              });
            } else {
              contactList.push({
                customer_id: customer.id,
                customer_name: customer.name,
                phone: customer.phone,
                delivery_date: order.delivery_date,
                skus_affected: skusAffected
              });
            }
          }
        }
      }
    }

    recall.customers_to_contact = contactList;

    db.recall_actions.push({
      id: `ACT-${Math.floor(Math.random() * 1000000)}`,
      recall_id: recall.id,
      action_type: 'CONTACT_LIST_GENERATED',
      reference_id: null,
      reference_type: null,
      automated: true,
      status: 'done',
      description: `${contactList.length} customers identified who received recalled product`,
      executed_at: new Date().toISOString()
    });

    // Step 5 — SUPPLIER CLAIM
    if (recall.disposition === 'return_to_supplier') {
      let totalQty = 0;
      let totalValue = 0;
      let supplierName = 'Unknown Supplier';
      let grnNumber = 'N/A';

      if (recall.batch_ids.length > 0) {
        const firstBatch = db.batches.find(b => b.id === recall.batch_ids[0]);
        if (firstBatch) {
          const sku = db.skus.find(s => s.id === firstBatch.sku_id);
          if (sku) {
            const supplier = db.suppliers.find(s => s.id === sku.supplier_id);
            if (supplier) {
              supplierName = supplier.name;
            }
          }
          const gr = db.goods_receipts.find(g => g.id === firstBatch.goods_receipt_id);
          if (gr) {
            grnNumber = gr.grn_number || gr.id;
          }
        }
      }

      if (recall.exposure_snapshot) {
        totalQty = recall.exposure_snapshot.units_in_stock;
      } else {
        recall.batch_ids.forEach(bid => {
          const bat = db.batches.find(b => b.id === bid);
          if (bat) {
            totalQty += (bat.quantity_received || 0);
          }
        });
      }

      totalValue = recall.exposure_snapshot?.estimated_value_kes || 0;

      db.recall_actions.push({
        id: `ACT-${Math.floor(Math.random() * 1000000)}`,
        recall_id: recall.id,
        action_type: 'SUPPLIER_CLAIM_RAISED',
        reference_id: null,
        reference_type: null,
        automated: true,
        status: 'done',
        description: `Claim for ${totalQty} units at KES ${(totalValue/100).toFixed(2)} against supplier ${supplierName} referencing GRN ${grnNumber}`,
        executed_at: new Date().toISOString()
      });
    }

    recall.status = 'active';
    await saveState();

    const actions = db.recall_actions.filter(a => a.recall_id === recall.id);
    res.json({ data: { ...recall, recall_actions: actions } });
  });

  app.post('/api/v1/recalls/:id/resolve', async (req, res) => {
    const recall = db.product_recalls.find(r => r.id === req.params.id);
    if (!recall) {
      return res.status(404).json({ error: { code: 'RECALL_NOT_FOUND', message: 'Recall not found' } });
    }
    recall.status = 'resolved';
    recall.resolved_at = new Date().toISOString();
    await saveState();
    res.json({ data: recall });
  });

  // Cycle Counts Master list
  app.get('/api/v1/cycle-counts', (req, res) => {
    res.json({ data: db.cycle_counts });
  });

  app.get('/api/v1/cycle-counts/:id', (req, res) => {
    const count = db.cycle_counts.find(c => c.id === req.params.id);
    if (!count) return res.status(404).json({ error: 'Cycle count not found' });
    const lines = db.cycle_count_lines.filter(l => l.count_id === count.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      const loc = db.locations.find(l => l.id === line.location_id);
      return { ...line, sku_name: sku?.name, location_code: loc?.code };
    });
    res.json({ data: { ...count, lines } });
  });

  // Create scheduled cycle counts with active snapshot values (FR-CC-02 & BR-041)
  app.post('/api/v1/cycle-counts', async (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
    if (idempotencyKey && db.idempotency_keys[idempotencyKey]) {
      // This exact request was already processed (likely a retry
      // from the offline sync queue after the original response
      // was lost). Return the original result rather than creating
      // a duplicate.
      return res.status(200).json(db.idempotency_keys[idempotencyKey].response);
    }

    const { warehouse_id, zone_id, location_id, assigned_to, is_wall_to_wall, items_per_section } = req.body;
    const countId = `CNT-${Date.now().toString().slice(-4)}`;

    const newCount: CycleCount = {
      id: countId,
      warehouse_id,
      zone_id: zone_id || null,
      location_id: location_id || null,
      assigned_to: assigned_to || null,
      status: 'scheduled',
      scheduled_date: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      created_by: db.currentUser?.id || 'U-ADMIN',
      approved_by: null,
      notes: req.body.notes || (is_wall_to_wall ? 'Wall-to-wall Comprehensive Inventory Verification' : 'Routine cyclical count'),
      is_wall_to_wall: !!is_wall_to_wall,
      items_per_section: items_per_section ? Number(items_per_section) : null
    };

    // Auto-generate lines by snapshotting active quantities on ledger (skipping quarantine batch status - BR-041)
    const targetLocations = db.locations.filter(l => {
      if (l.warehouse_id !== warehouse_id) return false;
      if (zone_id && l.zone_id !== zone_id) return false;
      if (location_id && l.id !== location_id) return false;
      return true;
    });

    const addedUniqueKeys = new Set<string>();
    const countLines: any[] = [];

    if (is_wall_to_wall) {
      // Wall-to-Wall: Include ALL SKUs across target locations so they are systematically counted
      targetLocations.forEach(loc => {
        db.skus.forEach(sku => {
          const batches = db.batches.filter(b => b.sku_id === sku.id && b.status !== 'quarantine');
          
          if (batches.length > 0) {
            batches.forEach(batch => {
              const bQty = getStockForBatchAndLocation(batch.id, loc.id);
              if (bQty > 0) {
                const key = `${batch.id}_${loc.id}`;
                if (!addedUniqueKeys.has(key)) {
                  addedUniqueKeys.add(key);
                  const skuObj = db.skus.find(s => s.id === sku.id);
                  const locObj = db.locations.find(l => l.id === loc.id);
                  countLines.push({
                    id: `CNTL-${Math.floor(Math.random()*100000)}`,
                    count_id: countId,
                    sku_id: sku.id,
                    sku_name: skuObj?.name || sku.id,
                    location_code: locObj?.code || loc.id,
                    zone_id: loc.zone_id,
                    batch_id: batch.id,
                    location_id: loc.id,
                    system_qty: bQty,
                    counted_qty: null,
                    variance: null,
                    variance_pct: null,
                    status: 'pending',
                    counted_at: null,
                    counted_by: null,
                    approved_by: null,
                    notes: null
                  });
                }
              }
            });
          }

          // Check if SKU's temp_zone matches this location zone to represent physical capabilities correctly 
          const zoneObj = db.zones.find(z => z.id === loc.zone_id);
          const zoneKey = zoneObj?.id.toLowerCase() || ''; // e.g. "chilled", "frozen", "cool", "dry"
          const isZoneMatch = (sku.temp_zone === 'chilled' && zoneKey.includes('chl')) ||
                              (sku.temp_zone === 'frozen' && zoneKey.includes('frz')) ||
                              (sku.temp_zone === 'cool' && zoneKey.includes('cool')) ||
                              (sku.temp_zone === 'ambient' && zoneKey.includes('dry'));

          if (isZoneMatch) {
            const hasAnyLineForSkuLoc = countLines.some(cl => cl.sku_id === sku.id && cl.location_id === loc.id);
            if (!hasAnyLineForSkuLoc) {
              const placeholderBatchId = batches[0]?.id || `B-NEW-${sku.id}`;
              const key = `${placeholderBatchId}_${loc.id}`;
              if (!addedUniqueKeys.has(key)) {
                addedUniqueKeys.add(key);
                const skuObj = db.skus.find(s => s.id === sku.id);
                const locObj = db.locations.find(l => l.id === loc.id);
                countLines.push({
                  id: `CNTL-${Math.floor(Math.random()*100000)}`,
                  count_id: countId,
                  sku_id: sku.id,
                  sku_name: skuObj?.name || sku.id,
                  location_code: locObj?.code || loc.id,
                  zone_id: loc.zone_id,
                  batch_id: placeholderBatchId,
                  location_id: loc.id,
                  system_qty: 0,
                  counted_qty: null,
                  variance: null,
                  variance_pct: null,
                  status: 'pending',
                  counted_at: null,
                  counted_by: null,
                  approved_by: null,
                  notes: 'Wall-to-wall 0-Balance Audit Line'
                });
              }
            }
          }
        });
      });
    } else {
      // Normal snapshot basis:
      targetLocations.forEach(loc => {
        db.batches.forEach(batch => {
          // Skip quarantine
          if (batch.status === 'quarantine') return;

          const qty = getStockForBatchAndLocation(batch.id, loc.id);
          if (qty > 0) {
            const key = `${batch.id}_${loc.id}`;
            if (!addedUniqueKeys.has(key)) {
              addedUniqueKeys.add(key);
              const skuObj = db.skus.find(s => s.id === batch.sku_id);
              const locObj = db.locations.find(l => l.id === loc.id);
              countLines.push({
                id: `CNTL-${Math.floor(Math.random()*100000)}`,
                count_id: countId,
                sku_id: batch.sku_id,
                sku_name: skuObj?.name || batch.sku_id,
                location_code: locObj?.code || loc.id,
                zone_id: loc.zone_id,
                batch_id: batch.id,
                location_id: loc.id,
                system_qty: qty,
                counted_qty: null,
                variance: null,
                variance_pct: null,
                status: 'pending',
                counted_at: null,
                counted_by: null,
                approved_by: null,
                notes: null
              });
            }
          }
        });
      });
    }

    // Sort ALL lines per section (zone_id) ascending, then location_code ascending, then SKU name ascending!
    countLines.sort((a, b) => {
      const zoneComp = (a.zone_id || '').localeCompare(b.zone_id || '');
      if (zoneComp !== 0) return zoneComp;

      const locComp = (a.location_code || '').localeCompare(b.location_code || '');
      if (locComp !== 0) return locComp;

      const skuComp = (a.sku_name || '').localeCompare(b.sku_name || '');
      if (skuComp !== 0) return skuComp;

      return (a.batch_id || '').localeCompare(b.batch_id || '');
    });

    // Now limit the count lines per zone/section if items_per_section is specified
    let finalLines = countLines;
    if (items_per_section && typeof items_per_section === 'number' && items_per_section > 0) {
      const zoneLineCounts: { [key: string]: number } = {};
      finalLines = countLines.filter(line => {
        const zoneId = line.zone_id || 'UNKNOWN';
        if (!zoneLineCounts[zoneId]) {
          zoneLineCounts[zoneId] = 0;
        }
        if (zoneLineCounts[zoneId] < items_per_section) {
          zoneLineCounts[zoneId]++;
          return true;
        }
        return false;
      });
    }

    if (finalLines.length === 0) {
      return res.status(400).json({ error: { code: 'EMPTY_SHEET', message: 'No active stock inventories found matching targeted parameters. Count canceled.' } });
    }

    db.cycle_counts.push(newCount);
    
    // Save final lines to the db (stripping the temporary UI sorting decorations)
    finalLines.forEach(l => {
      db.cycle_count_lines.push({
        id: l.id,
        count_id: l.count_id,
        sku_id: l.sku_id,
        batch_id: l.batch_id,
        location_id: l.location_id,
        system_qty: l.system_qty,
        counted_qty: l.counted_qty,
        variance: l.variance,
        variance_pct: l.variance_pct,
        status: l.status,
        counted_at: l.counted_at || null,
        counted_by: l.counted_by || null,
        approved_by: l.approved_by || null,
        notes: l.notes || null
      });
    });

    const responsePayload = { data: { ...newCount, lines: finalLines } };
    if (idempotencyKey) {
      db.idempotency_keys[idempotencyKey] = {
        response: responsePayload,
        created_at: new Date().toISOString()
      };
    }
    await saveState();
    res.status(201).json(responsePayload);
  });

  // Confirm single cycle count count line -> calculates variance automatically (FR-CC-03/04 & BR-040)
  app.patch('/api/v1/cycle-counts/:id/lines/:lineId', async (req, res) => {
    const { id, lineId } = req.params;
    const { counted_qty, notes, assign_bin_id } = req.body;

    const count = db.cycle_counts.find(c => c.id === id);
    if (!count) return res.status(404).json({ error: 'Cycle count sheet not found' });

    const line = db.cycle_count_lines.find(l => l.id === lineId);
    if (!line) return res.status(404).json({ error: 'Audit line item not found' });

    const intCounted = parseInt(counted_qty);
    const variance = intCounted - line.system_qty;
    const variancePct = line.system_qty > 0 ? (variance / line.system_qty) * 100 : 0;

    line.counted_qty = intCounted;
    line.variance = variance;
    line.variance_pct = variancePct;
    line.status = 'counted';
    line.counted_at = new Date().toISOString();
    line.counted_by = db.currentUser?.id || 'U-AUDITOR';
    line.notes = notes || null;

    if (assign_bin_id) {
      line.assigned_bin_id = assign_bin_id;
      const binLocation = (db.locations || [])
        .find((b: any) => b.id === assign_bin_id);

      if (binLocation && line.sku_id) {
        logAudit(
          'BIN_ASSIGNED_DURING_COUNT',
          'SKU',
          line.sku_id,
          `Bin location ${binLocation.code || assign_bin_id} assigned ` +
          `to SKU ${line.sku_id} during cycle count ${id} ` +
          `by ${db.currentUser?.name}`
        );
      }
    }

    count.status = 'in_progress';

    await saveState();
    res.json({ data: line });
  });

  // POST /api/v1/cycle-counts/:id/items - extension for unlocated items
  app.post('/api/v1/cycle-counts/:id/items', async (req, res) => {
    const { id } = req.params;
    const { sku_id, qty_counted, notes, assign_bin_id } = req.body;

    const count = db.cycle_counts.find(c => c.id === id);
    if (!count) return res.status(404).json({ error: 'Cycle count sheet not found' });

    if (!sku_id) {
      return res.status(400).json({ error: { message: 'sku_id is required' } });
    }
    if (qty_counted === undefined || isNaN(parseInt(qty_counted))) {
      return res.status(400).json({ error: { message: 'qty_counted is required' } });
    }

    const intCounted = parseInt(qty_counted);
    
    // Find or create a line for this SKU.
    let line = db.cycle_count_lines.find(l => l.count_id === id && l.sku_id === sku_id);
    
    if (!line) {
      // Find system stock quantity for this SKU in the count's warehouse
      const ledger = db.stock_ledger || [];
      const systemQty = ledger
        .filter((e: any) => e.warehouse_id === count.warehouse_id && e.sku_id === sku_id)
        .reduce((sum: number, e: any) => sum + (e.quantity !== undefined ? e.quantity : (e.qty_change || 0)), 0);

      line = {
        id: `CCL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        count_id: id,
        sku_id,
        batch_id: 'SYSTEM', // fallback
        location_id: assign_bin_id || 'UNLOCATED',
        system_qty: systemQty,
        counted_qty: intCounted,
        variance: intCounted - systemQty,
        variance_pct: systemQty > 0 ? ((intCounted - systemQty) / systemQty) * 100 : 0,
        status: 'counted',
        counted_at: new Date().toISOString(),
        counted_by: db.currentUser?.id || 'U-AUDITOR',
        approved_by: null,
        notes: notes || null,
        assigned_bin_id: assign_bin_id || null
      };
      db.cycle_count_lines.push(line);
    } else {
      const variance = intCounted - line.system_qty;
      const variancePct = line.system_qty > 0 ? (variance / line.system_qty) * 100 : 0;
      line.counted_qty = intCounted;
      line.variance = variance;
      line.variance_pct = variancePct;
      line.status = 'counted';
      line.counted_at = new Date().toISOString();
      line.counted_by = db.currentUser?.id || 'U-AUDITOR';
      line.notes = notes || null;
      if (assign_bin_id) {
        line.assigned_bin_id = assign_bin_id;
      }
    }

    if (assign_bin_id) {
      const binLocation = (db.locations || [])
        .find((b: any) => b.id === assign_bin_id);

      if (binLocation) {
        logAudit(
          'BIN_ASSIGNED_DURING_COUNT',
          'SKU',
          sku_id,
          `Bin location ${binLocation.code || assign_bin_id} assigned ` +
          `to SKU ${sku_id} during cycle count ${id} ` +
          `by ${db.currentUser?.name}`
        );
      }
    }

    count.status = 'in_progress';
    await saveState();
    res.json({ data: line });
  });

  // Submit counting values for approvals
  app.post('/api/v1/cycle-counts/:id/submit', async (req, res) => {
    const count = db.cycle_counts.find(c => c.id === req.params.id);
    if (!count) return res.status(404).json({ error: 'Count not found' });

    const lines = db.cycle_count_lines.filter(l => l.count_id === count.id);
    if (lines.some(l => l.status === 'pending')) {
      return res.status(422).json({ error: 'Please count all lines before submitting sheets.' });
    }

    // Check if any line variance exceeds threshold (±5% or ±1 unit - BR-040)
    const requiresApproval = lines.some(l => {
      const v = l.variance || 0;
      const pct = Math.abs(l.variance_pct || 0);
      return Math.abs(v) > 1 || pct > 5;
    });

    if (requiresApproval) {
      count.status = 'pending_approval';
    } else {
      // Auto-adjust zero variance counts instantly
      count.status = 'completed';
      count.completed_at = new Date().toISOString();
      lines.forEach(l => {
        l.status = 'approved';
      });
    }

    await saveState();
    res.json({ data: count });
  });

  // Approve cycle count variations -> logs adjustment entries! (FR-CC-05 & BR-040)
  app.post('/api/v1/cycle-counts/:id/approve', async (req, res) => {
    const countId = req.params.id;
    const count = db.cycle_counts.find(c => c.id === countId);
    if (!count) return res.status(404).json({ error: 'Sheet context not found' });
    if (db.currentUser?.role !== 'ops_manager' && db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Only a manager can approve stock adjustment counts' });
    }
    if (count.created_by && db.currentUser?.id === count.created_by) {
      return res.status(422).json({
        error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'You cannot approve a cycle count you created yourself. A different manager must approve it.' }
      });
    }

    const lines = db.cycle_count_lines.filter(l => l.count_id === countId);

    try {
      // Adjustment execution inside ledger
      lines.forEach(l => {
        const targetLocationId = l.assigned_bin_id || l.location_id;
        if (l.variance && l.variance !== 0) {
          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: targetLocationId,
            warehouse_id: count.warehouse_id,
            quantity: l.variance, // signs matched naturally
            transaction_type: 'adjustment',
            reference_id: countId,
            reference_type: 'cycle_count',
            user_id: db.currentUser?.id || 'U-OPS-A',
            notes: `AdCount variance approved. Variance value: ${l.variance}${l.assigned_bin_id ? ' (assigned to new bin)' : ''}`
          });
          l.status = 'adjusted';
        } else if (l.assigned_bin_id) {
          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: targetLocationId,
            warehouse_id: count.warehouse_id,
            quantity: 0,
            transaction_type: 'adjustment',
            reference_id: countId,
            reference_type: 'cycle_count',
            user_id: db.currentUser?.id || 'U-OPS-A',
            notes: `Bin location assigned during count approval: ${l.assigned_bin_id}`
          });
          l.status = 'adjusted';
        } else {
          l.status = 'approved';
        }
        l.approved_by = db.currentUser?.id || 'U-OPS-A';
      });

      count.status = 'completed';
      count.approved_by = db.currentUser?.id || 'U-OPS-A';
      count.completed_at = new Date().toISOString();

      await saveState();
      res.json({ data: count });

    } catch (ledgerError: any) {
      return res.status(422).json({ error: ledgerError });
    }
  });

  // Write-Off endpoints (FR-WO-01 through 05 & BR-050/051/052)
  app.get('/api/v1/write-offs', (req, res) => {
    res.json({ data: db.write_offs });
  });

  app.get('/api/v1/write-offs/:id', (req, res) => {
    const wo = db.write_offs.find(w => w.id === req.params.id);
    if (!wo) return res.status(404).json({ error: 'Write-off not found' });
    const lines = db.write_off_lines.filter(l => l.write_off_id === wo.id).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return { ...line, sku_name: sku?.name, sku_code: sku?.code };
    });
    res.json({ data: { ...wo, lines } });
  });

  app.post('/api/v1/write-offs', async (req, res) => {
    const { warehouse_id, notes, lines } = req.body;

    const allowedReasons = ['EXPIRED', 'DAMAGED', 'LOST', 'QUALITY', 'THEFT'];

    // Enforce standardized reasons (BR-051) and values (BR-052)
    let totalKes = 0;
    for (const l of lines) {
      if (!allowedReasons.includes(l.reason)) {
        return res.status(400).json({ error: { code: 'INVALID_REASON', message: `Reason '${l.reason}' is unauthorized. Allowed: ${allowedReasons.join(', ')}` } });
      }
      if (!l.value_kes || l.value_kes <= 0) {
        return res.status(400).json({ error: { code: 'VALUE_REQUIRED', message: 'Real estimated value KES (> 0) must be supplied to write-off lines' } });
      }
      totalKes += l.value_kes;
    }

    const woId = `WO-${Date.now().toString().slice(-4)}`;
    const newWo: WriteOff = {
      id: woId,
      warehouse_id,
      status: 'pending_approval',
      created_by: db.currentUser?.id || 'U-OPS-A',
      approved_by: null,
      created_at: new Date().toISOString(),
      approved_at: null,
      total_value_kes: totalKes,
      notes: notes || 'Damaged product write off'
    };

    lines.forEach((l: any) => {
      db.write_off_lines.push({
        id: `WOL-${Math.floor(Math.random()*100000)}`,
        write_off_id: woId,
        sku_id: l.sku_id,
        batch_id: l.batch_id,
        location_id: l.location_id,
        qty: l.qty,
        reason: l.reason,
        value_kes: l.value_kes,
        notes: l.notes || null
      });
    });

    db.write_offs.push(newWo);

    if (totalKes >= CONFIG.WRITE_OFF_HIGH_VALUE_KES) {
      const approvalCode = 'MAP-' + Date.now().toString().slice(-6);
      const approvalSlip: MarkdownApproval = {
        id: approvalCode,
        write_off_id: woId,
        total_value_kes: totalKes,
        status: 'pending',
        warehouse_id: warehouse_id || 'W-MAIN',
        raised_by: db.currentUser?.id || 'U-OPS-A',
        raised_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
        feedback: null
      };
      if (!db.markdown_approvals) db.markdown_approvals = [];
      db.markdown_approvals.push(approvalSlip);
      
      createNotification(
        'MARKDOWN_PENDING',
        'Markdown Approval Required',
        `High-value write-off '${woId}' of KES ${totalKes} requires admin markdown approval prior to inventory settlement.`,
        'warning',
        { reference_id: woId, reference_type: 'write_off' }
      );
    } else {
      createNotification(
        'WRITE_OFF_PENDING',
        'Write-off Settlement Pending',
        `Standard value write-off '${woId}' of KES ${totalKes} submitted.`,
        'info',
        { reference_id: woId, reference_type: 'write_off' }
      );
    }

    await saveState();
    res.status(201).json({ data: newWo });
  });

  // Dual Approval constraint checks (BR-050)
  app.post('/api/v1/write-offs/:id/approve', async (req, res) => {
    const woId = req.params.id;
    const wo = db.write_offs.find(w => w.id === woId);
    if (!wo) return res.status(404).json({ error: 'Write-off not found' });

    if (wo.total_value_kes >= CONFIG.WRITE_OFF_HIGH_VALUE_KES) {
      return res.status(403).json({
        error: {
          code: 'HIGH_VALUE_MARKDOWN_REQUIRED',
          message: `Write-off exceeds the high value markdown threshold of KES ${CONFIG.WRITE_OFF_HIGH_VALUE_KES}. Authorizing this settlement is protected and must be executed by signing the Markdown Approval slip.`
        }
      });
    }

    if (!db.currentUser) {
      return res.status(401).json({ error: 'Authentication required (session invalid)' });
    }

    if (db.currentUser?.role !== 'ops_manager' && db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized role' });
    }

    if (wo.created_by === db.currentUser.id) {
      return res.status(422).json({
        error: {
          code: 'SELF_APPROVAL_PROHIBITED',
          message: 'Security constraint violation (BR-050): You are the creator of this Write-off slip. A second manager must review and authorize.'
        }
      });
    }

    const lines = db.write_off_lines.filter(l => l.write_off_id === woId);

    // Calculate affected bundles and their availabilities before write-off (B6)
    const affectedBundles = (db.bundle_definitions || []).filter(bd =>
      bd.is_active &&
      lines.some(l => bd.components.some(c => c.sku_id === l.sku_id))
    );

    const beforeAvailMap = new Map<string, number>();
    affectedBundles.forEach(bd => {
      beforeAvailMap.set(bd.id, getBundleAvailability(bd));
    });

    try {
      // Commit Ledger write-off atomically
      lines.forEach(l => {
        writeLedgerEntry({
          sku_id: l.sku_id,
          batch_id: l.batch_id,
          location_id: l.location_id,
          warehouse_id: wo.warehouse_id,
          quantity: -l.qty, // removal
          transaction_type: 'write_off',
          reference_id: woId,
          reference_type: 'write_off',
          user_id: db.currentUser?.id || 'U-ADMIN',
          notes: `Write off approved. Reason: ${l.reason}.`
        });

        // Set batch status appropriately if batch gets depleted
        const batch = db.batches.find(b => b.id === l.batch_id);
        if (batch) {
          batch.quantity_available = getStockForBatch(l.batch_id);
          if (batch.quantity_available <= 0) {
            batch.status = 'written_off';
          }
        }
      });

      wo.status = 'approved';
      wo.approved_by = db.currentUser.id;
      wo.approved_at = new Date().toISOString();

      // B6 affected bundles checks
      affectedBundles.forEach(bundleDef => {
        const prev = beforeAvailMap.get(bundleDef.id) || 0;
        const current = getBundleAvailability(bundleDef);
        if (current < prev) {
          const linesForBundle = lines.filter(l => bundleDef.components.some(c => c.sku_id === l.sku_id));
          const firstLine = linesForBundle[0];
          const skuName = firstLine ? (db.skus.find(s => s.id === firstLine.sku_id)?.name || firstLine.sku_id) : 'component';

          createNotification(
            'EXPIRY_ALERT',
            `Bundle component written off: ${bundleDef.name}`,
            `Write-off of ${skuName} reduces ${bundleDef.name} bundle availability. Check bundle stock.`,
            'warning',
            { reference_id: bundleDef.id, reference_type: 'bundle' }
          );
        }
      });

      try {
        checkBundleDeactivationCascades();
      } catch (cascadeErr) {
        console.error('Failed to run bundle deactivation cascades:', cascadeErr);
      }

      await saveState();
      res.json({ data: wo });

    } catch (err: any) {
      return res.status(422).json({ error: err });
    }
  });

  // Stock Ledger Raw reading stream (Read-only - BR-001)
  app.get('/api/v1/ledger', (req, res) => {
    const enriched = db.stock_ledger.map(entry => {
      const sku = db.skus.find(s => s.id === entry.sku_id);
      const loc = db.locations.find(l => l.id === entry.location_id);
      const wh = db.warehouses.find(w => w.id === entry.warehouse_id);
      const user = db.users.find(u => u.id === entry.user_id);
      return {
        ...entry,
        sku_name: sku?.name || 'Unknown SKU',
        sku_code: sku?.code || 'Unknown Code',
        location_code: loc?.code || 'Unknown Loc',
        warehouse_name: wh?.name || 'Unknown WH',
        user_name: user?.name || 'System'
      };
    });
    // Reverse chronological order output
    res.json({ data: enriched.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) });
  });

  // PUT and DELETE rejected on ledger
  app.put('/api/v1/ledger*', (req, res) => { res.status(405).json({ error: 'Method Not Allowed' }); });
  app.delete('/api/v1/ledger*', (req, res) => { res.status(405).json({ error: 'Method Not Allowed' }); });

  // --- REPORTING MODULE ENDPOINTS ---

  // Waste summary analytics
  app.get('/api/v1/reports/waste-summary', (req, res) => {
    // Sourced from approved write-offs. Returns totals grouped by reason/sku
    const approvedWos = db.write_offs.filter(w => w.status === 'approved');
    const reasonGroups: { [key: string]: { total_qty: number; total_value_kes: number } } = {};

    approvedWos.forEach(wo => {
      const wLines = db.write_off_lines.filter(l => l.write_off_id === wo.id);
      wLines.forEach(l => {
        if (!reasonGroups[l.reason]) {
          reasonGroups[l.reason] = { total_qty: 0, total_value_kes: 0 };
        }
        reasonGroups[l.reason].total_qty += l.qty;
        reasonGroups[l.reason].total_value_kes += l.value_kes;
      });
    });

    const totalRevenue = db.customer_orders.reduce((sum, o) => sum + o.total_value_kes, 0);

    const data = Object.entries(reasonGroups).map(([group, val]) => ({
      group,
      total_qty: val.total_qty,
      total_value_kes: val.total_value_kes,
      pct_of_revenue: totalRevenue > 0 ? parseFloat(((val.total_value_kes / totalRevenue) * 100).toFixed(2)) : 0
    }));

    res.json({ data });
  });

  // Expiry alerts
  app.get('/api/v1/reports/expiry-alerts', (req, res) => {
    const daysAhead = parseInt(req.query.days_ahead as string) || 3;
    const limitDate = new Date(Date.now() + daysAhead * 24 * 3600 * 1000).getTime();

    const alerts = db.batches
      .filter(b => b.status === 'active' && b.quantity_available > 0)
      .map(b => {
        const sku = db.skus.find(s => s.id === b.sku_id);
        const daysToExpiry = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / (24 * 3600 * 1000));
        return {
          sku_id: b.sku_id,
          sku_name: sku?.name || 'Unknown',
          batch_id: b.id,
          batch_number: b.batch_number,
          expiry_date: b.expiry_date,
          qty_available: b.quantity_available,
          days_to_expiry: daysToExpiry
        };
      })
      .filter(item => new Date(item.expiry_date).getTime() <= limitDate);

    res.json({ data: alerts.sort((a,b) => a.days_to_expiry - b.days_to_expiry) });
  });

  // Inventory turnover (COGS / average inventory value)
  app.get('/api/v1/reports/inventory-turnover', (req, res) => {
    // COGS derived from pick events sum * cost price
    const pickEntries = db.stock_ledger.filter(entry => entry.transaction_type === 'pick');
    let cogsCents = 0;
    pickEntries.forEach(entry => {
      const sku = db.skus.find(s => s.id === entry.sku_id);
      if (sku) {
        cogsCents += Math.abs(entry.quantity) * sku.cost_price_kes;
      }
    });

    // Opening vs closing stock values
    let totalStockCents = 0;
    db.skus.forEach(s => {
      totalStockCents += getSKUTotalStock(s.id) * s.cost_price_kes;
    });

    const cogs_kes = Math.round(cogsCents);
    const avg_inventory_value_kes = Math.round(totalStockCents);
    const turnover_ratio = avg_inventory_value_kes > 0 ? parseFloat((cogs_kes / avg_inventory_value_kes).toFixed(2)) : 0;

    res.json({ data: { cogs_kes, avg_inventory_value_kes, turnover_ratio } });
  });

  // Margins report (B5)
  app.get(['/api/v1/reports/margins', '/api/v1/reports/margins'], (req, res) => {
    let totalRevenue = 0;
    let totalCogs = 0;

    const items = db.customer_order_lines.map(line => {
      const order = db.customer_orders.find(o => o.id === line.order_id);
      const sku = db.skus.find(s => s.id === line.sku_id);
      const lineRevenue = line.qty_ordered * (line.unit_price_kes || sku?.selling_price_kes || 0);
      
      const orderDate = order?.created_at || new Date().toISOString();

      let lineCogs = 0;
      if (sku?.is_bundle) {
        const bd = (db.bundle_definitions || []).find(b => b.bundle_sku_id === sku.id);
        if (bd) {
          bd.components.forEach(comp => {
            const compCost = getPriceAtDate(comp.sku_id, orderDate).cost_price_kes;
            lineCogs += comp.qty * compCost;
          });
        }
        lineCogs *= line.qty_ordered;
      } else if (sku) {
        const skuCost = getPriceAtDate(sku.id, orderDate).cost_price_kes;
        lineCogs = line.qty_ordered * skuCost;
      }

      totalRevenue += lineRevenue;
      totalCogs += lineCogs;

      const profit = lineRevenue - lineCogs;
      const marginPct = lineRevenue > 0 ? parseFloat(((profit / lineRevenue) * 100).toFixed(2)) : 0;

      return {
        order_id: line.order_id,
        sku_id: line.sku_id,
        sku_name: sku?.name || 'Unknown',
        qty_ordered: line.qty_ordered,
        revenue_kes: lineRevenue,
        cogs_kes: lineCogs,
        profit_kes: profit,
        margin_pct: marginPct,
        is_bundle: sku?.is_bundle ?? false,
        created_at: order?.created_at
      };
    });

    const overallProfit = totalRevenue - totalCogs;
    const overallMarginPct = totalRevenue > 0 ? parseFloat(((overallProfit / totalRevenue) * 100).toFixed(2)) : 0;

    res.json({
      data: {
        total_revenue_kes: totalRevenue,
        total_cogs_kes: totalCogs,
        total_profit_kes: overallProfit,
        gross_margin_pct: overallMarginPct,
        items
      }
    });
  });

  // Margins grouped by SKU (B5)
  app.get(['/api/v1/reports/margin-by-sku', '/api/v1/reports/margin-by-sku'], (req, res) => {
    const skuMap: { [skuId: string]: { sku_id: string; sku_name: string; qty_ordered: number; revenue_kes: number; cogs_kes: number; profit_kes: number; margin_pct: number; } } = {};

    db.customer_order_lines.forEach(line => {
      const order = db.customer_orders.find(o => o.id === line.order_id);
      const sku = db.skus.find(s => s.id === line.sku_id);
      if (!sku) return;

      const orderDate = order?.created_at || new Date().toISOString();

      const qty = line.qty_ordered;
      const revenue = qty * (line.unit_price_kes || sku.selling_price_kes || 0);

      let cogs = 0;
      if (sku.is_bundle) {
        const bd = (db.bundle_definitions || []).find(b => b.bundle_sku_id === sku.id);
        if (bd) {
          bd.components.forEach(comp => {
            const compCost = getPriceAtDate(comp.sku_id, orderDate).cost_price_kes;
            cogs += comp.qty * compCost;
          });
        }
        cogs *= qty;
      } else {
        const skuCost = getPriceAtDate(sku.id, orderDate).cost_price_kes;
        cogs = qty * skuCost;
      }

      if (!skuMap[sku.id]) {
        skuMap[sku.id] = {
          sku_id: sku.id,
          sku_name: sku.name,
          qty_ordered: 0,
          revenue_kes: 0,
          cogs_kes: 0,
          profit_kes: 0,
          margin_pct: 0
        };
      }

      skuMap[sku.id].qty_ordered += qty;
      skuMap[sku.id].revenue_kes += revenue;
      skuMap[sku.id].cogs_kes += cogs;
    });

    const data = Object.values(skuMap).map(item => {
      const profit = item.revenue_kes - item.cogs_kes;
      const margin_pct = item.revenue_kes > 0 ? parseFloat(((profit / item.revenue_kes) * 100).toFixed(2)) : 0;
      return {
        ...item,
        profit_kes: profit,
        margin_pct
      };
    });

    res.json({ data });
  });

  // Margins grouped by Order (B5)
  app.get(['/api/v1/reports/margin-by-order', '/api/v1/reports/margin-by-order'], (req, res) => {
    const orderMap: { [orderId: string]: { order_id: string; customer_name: string; qty_ordered: number; revenue_kes: number; cogs_kes: number; profit_kes: number; margin_pct: number; created_at: string } } = {};

    db.customer_order_lines.forEach(line => {
      const order = db.customer_orders.find(o => o.id === line.order_id);
      const sku = db.skus.find(s => s.id === line.sku_id);
      if (!sku) return;

      const orderDate = order?.created_at || new Date().toISOString();

      const qty = line.qty_ordered;
      const revenue = qty * (line.unit_price_kes || sku.selling_price_kes || 0);

      let cogs = 0;
      if (sku.is_bundle) {
        const bd = (db.bundle_definitions || []).find(b => b.bundle_sku_id === sku.id);
        if (bd) {
          bd.components.forEach(comp => {
            const compCost = getPriceAtDate(comp.sku_id, orderDate).cost_price_kes;
            cogs += comp.qty * compCost;
          });
        }
        cogs *= qty;
      } else {
        const skuCost = getPriceAtDate(sku.id, orderDate).cost_price_kes;
        cogs = qty * skuCost;
      }

      if (!orderMap[line.order_id]) {
        const customer = order ? db.customers.find(c => c.id === order.customer_id) : null;
        orderMap[line.order_id] = {
          order_id: line.order_id,
          customer_name: customer?.name || 'Unknown',
          qty_ordered: 0,
          revenue_kes: 0,
          cogs_kes: 0,
          profit_kes: 0,
          margin_pct: 0,
          created_at: order?.created_at || new Date().toISOString()
        };
      }

      orderMap[line.order_id].qty_ordered += qty;
      orderMap[line.order_id].revenue_kes += revenue;
      orderMap[line.order_id].cogs_kes += cogs;
    });

    const data = Object.values(orderMap).map(item => {
      const profit = item.revenue_kes - item.cogs_kes;
      const margin_pct = item.revenue_kes > 0 ? parseFloat(((profit / item.revenue_kes) * 100).toFixed(2)) : 0;
      return {
        ...item,
        profit_kes: profit,
        margin_pct
      };
    });

    res.json({ data });
  });

  // Stock accuracy KPI
  app.get('/api/v1/reports/stock-accuracy', (req, res) => {
    const counts = db.cycle_count_lines.filter(l => l.status === 'adjusted' || l.status === 'approved');
    const total_lines = counts.length;
    const zero_variance_lines = counts.filter(c => c.variance === 0).length;
    const accuracy_pct = total_lines > 0 ? Math.round((zero_variance_lines / total_lines) * 100) : 0;

    res.json({ data: { total_lines, zero_variance_lines, accuracy_pct } });
  });

  // Reorder level alerts (FR-SKU-05 & BR-080)
  app.get('/api/v1/reports/reorder-alerts', (req, res) => {
    const alerts: any[] = [];
    db.skus.forEach(sku => {
      const stock = getSKUTotalStock(sku.id);
      if (stock < sku.reorder_level) {
        alerts.push({
          sku_id: sku.id,
          sku_name: sku.name,
          reorder_level: sku.reorder_level,
          current_stock: stock,
          shortage: sku.reorder_level - stock
        });
      }
    });
    res.json({ data: alerts });
  });

  // Supplier performance report (average lead times and defect rates)
  app.get('/api/v1/reports/supplier-performance', (req, res) => {
    const suppliersPerformance = db.suppliers.map(s => {
      // Find all POs for this supplier
      const pos = db.purchase_orders.filter(po => po.supplier_id === s.id);
      const posCount = pos.length;

      // Find all completed/partial Goods Receipts for this supplier's POs
      const grs = db.goods_receipts.filter(gr => pos.some(po => po.id === gr.po_id));
      const grsCount = grs.length;

      // Calculate Lead Times
      let totalLeadTimeHrs = 0;
      let recordedLeadTimesCount = 0;

      grs.forEach(gr => {
        const po = pos.find(p => p.id === gr.po_id);
        if (po && po.created_at && gr.received_at) {
          const diffMs = new Date(gr.received_at).getTime() - new Date(po.created_at).getTime();
          if (diffMs > 0) {
            totalLeadTimeHrs += diffMs / (1000 * 3600);
            recordedLeadTimesCount++;
          }
        }
      });

      // Defect calculation from Goods Receipt lines
      let totalQtyReceived = 0;
      let defectiveQty = 0;

      const grLines = db.goods_receipt_lines.filter(line => grs.some(g => g.id === line.gr_id));
      grLines.forEach(line => {
        totalQtyReceived += line.qty_received;
        if (line.condition === 'damaged' || line.condition === 'rejected') {
          defectiveQty += line.qty_received;
        }
      });

      // Default baseline values based on supplier to offer beautiful populated stats if history is sparse
      const baselineVals: { [key: string]: { lead_time: number; defect_rate: number; on_time_pct: number } } = {
        'S-KENCHIC': { lead_time: 1.8, defect_rate: 1.2, on_time_pct: 95 },
        'S-NAIROBI-GREENS': { lead_time: 1.1, defect_rate: 2.8, on_time_pct: 88 },
        'S-DRYPACK': { lead_time: 3.5, defect_rate: 0.6, on_time_pct: 98 }
      };

      const baseline = baselineVals[s.id] || { lead_time: s.lead_time_days || 2.5, defect_rate: 1.5, on_time_pct: 92 };

      const finalLeadTimeDays = recordedLeadTimesCount > 0 
        ? parseFloat((totalLeadTimeHrs / (24 * recordedLeadTimesCount)).toFixed(1)) 
        : baseline.lead_time;

      const finalDefectRatePct = totalQtyReceived > 0 
        ? parseFloat(((defectiveQty / totalQtyReceived) * 100).toFixed(2))
        : baseline.defect_rate;

      // Sourcing decision recommendation engine
      let rating = 'Excellent';
      let recommendation = 'Primary Choice';
      let riskLevel = 'Low';
      
      if (finalDefectRatePct > 2.5 || finalLeadTimeDays > 3.0) {
        rating = 'Fair';
        recommendation = 'Secondary / Backup Choice';
        riskLevel = 'Medium';
      }
      if (finalDefectRatePct > 5.0 || finalLeadTimeDays > 5.0) {
        rating = 'Poor';
        recommendation = 'Requires Immediate Corrective Action Plan';
        riskLevel = 'High';
      }

      return {
        supplier_id: s.id,
        supplier_name: s.name,
        contact_name: s.contact_name,
        avg_lead_time_days: finalLeadTimeDays,
        defect_rate_pct: finalDefectRatePct,
        orders_count: posCount,
        receipts_count: grsCount,
        total_qty_received: totalQtyReceived,
        defective_qty: defectiveQty,
        on_time_delivery_pct: baseline.on_time_pct,
        rating,
        risk_level: riskLevel,
        recommendation,
        baseline_lead_time_days: s.lead_time_days
      };
    });

    res.json({ data: suppliersPerformance });
  });

  // --- SAFETY RECALL ENDPOINTS ---
  app.get('/api/v1/batches', (req, res) => {
    const data = db.batches.map(b => {
      const sku = db.skus.find(s => s.id === b.sku_id);
      return {
        ...b,
        sku_name: sku?.name || 'Unknown SKU',
        sku_code: sku?.code || 'Unknown Code',
        sku_unit: sku?.unit || 'each',
        qty_available_calculated: getStockForBatch(b.id)
      };
    });
    res.json({ data });
  });

  app.get('/api/v1/batches/:id/recall', (req, res) => {
    const batchId = req.params.id;
    const batch = db.batches.find(b => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const sku = db.skus.find(s => s.id === batch.sku_id);

    // 1. Current Storage Locations for this batch
    const storage_locations: any[] = [];
    db.locations.forEach(loc => {
      const qty = getStockForBatchAndLocation(batchId, loc.id);
      if (qty > 0) {
        const zone = db.zones.find(z => z.id === loc.zone_id);
        const wh = db.warehouses.find(w => w.id === loc.warehouse_id);
        storage_locations.push({
          location_id: loc.id,
          code: loc.code,
          qty,
          warehouse_id: loc.warehouse_id,
          warehouse_name: wh?.name || loc.warehouse_id,
          zone_name: zone?.name || 'Unknown Zone',
          shelf_info: `Aisle ${loc.aisle}, Rack ${loc.rack}, Shelf ${loc.shelf}`
        });
      }
    });

    // 2. Affected Customer Orders
    const affected_orders_map = new Map<string, any>();
    
    db.pick_list_lines.forEach(line => {
      if (line.batch_id === batchId) {
        const pl = db.pick_lists.find(p => p.id === line.pick_list_id);
        if (pl) {
          const order = db.customer_orders.find(o => o.id === pl.order_id);
          if (order) {
            const customer = db.customers.find(c => c.id === order.customer_id);
            const key = order.id;
            const existing = affected_orders_map.get(key);
            const qty_picked_or_requested = line.qty_picked !== null ? line.qty_picked : line.qty_requested;

            if (existing) {
              existing.qty_affected += qty_picked_or_requested;
              if (line.status === 'picked') {
                existing.qty_picked += qty_picked_or_requested;
              }
            } else {
              affected_orders_map.set(key, {
                order_id: order.id,
                customer_id: order.customer_id,
                customer_name: customer?.name || 'Unknown Customer',
                customer_phone: customer?.phone || '',
                customer_email: customer?.email || '',
                status: order.status,
                delivery_date: order.delivery_date,
                delivery_address: order.delivery_address,
                notes: order.notes,
                qty_affected: qty_picked_or_requested,
                qty_picked: line.status === 'picked' ? qty_picked_or_requested : 0
              });
            }
          }
        }
      }
    });

    const affected_orders = Array.from(affected_orders_map.values());

    let supplier_name = 'Unknown Supplier';
    let supplier_phone = 'N/A';
    let grn_number = 'N/A';
    let po_id = 'N/A';
    let received_date = '';

    if (batch.goods_receipt_id) {
      const gr = db.goods_receipts.find(g => g.id === batch.goods_receipt_id);
      if (gr) {
        grn_number = gr.grn_number || gr.id;
        received_date = gr.received_at || '';
        
        const po = db.purchase_orders.find(p => p.id === gr.po_id);
        if (po) {
          po_id = po.id;
          const supplier = db.suppliers.find(s => s.id === po.supplier_id);
          if (supplier) {
            supplier_name = supplier.name;
            supplier_phone = supplier.phone || '';
          }
        }
      }
    }

    res.json({
      data: {
        batch: {
          ...batch,
          sku_name: sku?.name || 'Unknown SKU',
          sku_code: sku?.code || 'Unknown Code',
          sku_unit: sku?.unit || 'each',
          supplier_name,
          supplier_phone,
          grn_number,
          po_id,
          received_date
        },
        storage_locations,
        affected_orders,
        supplier_name,
        supplier_phone,
        grn_number,
        po_id,
        received_date
      }
    });
  });

  app.post('/api/v1/batches/:id/quarantine', async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const batchId = req.params.id;
    const batch = db.batches.find(b => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    batch.status = 'quarantine';
    await saveState();
    res.json({ data: batch });
  });

  app.post('/api/v1/batches/:id/activate', async (req, res) => {
    if (db.currentUser?.role !== 'admin' && db.currentUser?.role !== 'ops_manager') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const batchId = req.params.id;
    const batch = db.batches.find(b => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    batch.status = 'active';
    await saveState();
    res.json({ data: batch });
  });

  // --- ASSEMBLIES & BOM / PRODUCTION ENDPOINTS ---

  // Get templates
  app.get('/api/v1/assemblies/templates', (req, res) => {
    res.json({ data: db.assembly_templates || [] });
  });

  // Get assembly orders
  app.get('/api/v1/assembly-orders', (req, res) => {
    res.json({ data: db.assembly_orders || [] });
  });

  // Create assembly template
  app.post('/api/v1/assemblies/templates', async (req, res) => {
    const {
      name,
      type,
      input_sku_id,
      output_sku_id,
      expected_yield_pct,
      required_zone,
      stages,
      requires_temperature_log,
      notes
    } = req.body;

    if (!name || !type || !input_sku_id || !output_sku_id || !required_zone || !stages) {
      return res.status(400).json({ error: 'Missing required template fields' });
    }

    const newTemplate: AssemblyTemplate = {
      id: `TPL-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      type,
      status: 'draft',
      input_sku_id,
      output_sku_id,
      expected_yield_pct: Number(expected_yield_pct) || 100,
      required_zone,
      stages: (stages || []).map((s: any, idx: number) => ({
        stage_number: idx + 1,
        name: s.name,
        min_dwell_hours: Number(s.min_dwell_hours) || 0,
        max_dwell_hours: Number(s.max_dwell_hours) || 0,
        inspection_required: s.inspection_required ?? false
      })),
      requires_temperature_log: !!requires_temperature_log,
      approved_by: null,
      approved_at: null,
      created_by: db.currentUser?.id || 'SYSTEM',
      created_at: new Date().toISOString(),
      notes: notes || null
    };

    if (!db.assembly_templates) db.assembly_templates = [];
    db.assembly_templates.push(newTemplate);
    await saveState();
    res.json({ data: newTemplate });
  });

  // Approve assembly template
  app.post('/api/v1/assemblies/templates/:id/approve', async (req, res) => {
    const { id } = req.params;
    const template = db.assembly_templates?.find(t => t.id === id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (db.currentUser?.role !== 'ops_manager' && db.currentUser?.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only managers can approve assembly templates' } });
    }
    if (template.created_by && db.currentUser?.id === template.created_by) {
      return res.status(422).json({
        error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'You cannot approve an assembly template you created yourself. A different manager must approve it.' }
      });
    }

    template.status = 'active';
    template.approved_by = db.currentUser?.name || 'SYSTEM';
    template.approved_at = new Date().toISOString();

    await saveState();
    res.json({ data: template });
  });

  // Create assembly order
  app.post('/api/v1/assembly-orders', async (req, res) => {
    const {
      template_id,
      warehouse_id,
      location_id,
      input_batch_id,
      qty_input,
      qty_output_planned,
      notes,
      scheduled_start
    } = req.body;

    if (!template_id || !warehouse_id || !location_id || !input_batch_id || !qty_input || !qty_output_planned) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Missing required order fields' } });
    }

    const template = db.assembly_templates?.find(t => t.id === template_id);
    if (!template) {
      return res.status(404).json({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Assembly template not found' } });
    }

    if (template.status !== 'active') {
      return res.status(400).json({ error: { code: 'TEMPLATE_NOT_ACTIVE', message: 'Assembly template is not active' } });
    }

    const batch = db.batches.find(b => b.id === input_batch_id);
    if (!batch) {
      return res.status(404).json({ error: { code: 'BATCH_NOT_FOUND', message: 'Input batch not found' } });
    }

    if (batch.sku_id !== template.input_sku_id) {
      return res.status(400).json({ error: { code: 'INPUT_SKU_MISMATCH', message: 'Input batch SKU does not match template input SKU' } });
    }

    // Check available qty at location
    const availableQty = getStockForBatchAndLocation(input_batch_id, location_id);
    if (availableQty < Number(qty_input)) {
      return res.status(400).json({ error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock of batch ${input_batch_id} at location ${location_id} (Available: ${availableQty}, Requested: ${qty_input})` } });
    }

    // Validate location and zone
    const locationObj = db.locations.find(l => l.id === location_id);
    if (!locationObj) {
      return res.status(404).json({ error: { code: 'LOCATION_NOT_FOUND', message: 'Specified location not found' } });
    }

    const zoneObj = db.zones.find(z => z.id === locationObj.zone_id);
    if (!zoneObj) {
      return res.status(404).json({ error: { code: 'ZONE_NOT_FOUND', message: 'Zone associated with location not found' } });
    }

    if (zoneObj.type !== template.required_zone) {
      return res.status(400).json({ error: { code: 'ZONE_MISMATCH', message: `Zone temperature type mismatch (Required: ${template.required_zone}, Location Zone Type: ${zoneObj.type})` } });
    }

    const newOrder: AssemblyOrder = {
      id: `ASM-${Math.floor(1000 + Math.random() * 9000)}`,
      template_id,
      template_name: template.name,
      type: template.type,
      status: 'scheduled',
      warehouse_id,
      location_id,
      input_sku_id: template.input_sku_id,
      output_sku_id: template.output_sku_id,
      input_batch_id,
      output_batch_id: null,
      qty_input: Number(qty_input),
      qty_output_planned: Number(qty_output_planned),
      qty_output_actual: null,
      yield_variance_pct: null,
      current_stage: 0,
      stage_history: [],
      initiated_by: db.currentUser?.id || 'SYSTEM',
      scheduled_start: scheduled_start || new Date().toISOString(),
      actual_start: null,
      completed_at: null,
      notes: notes || null
    };

    if (!db.assembly_orders) db.assembly_orders = [];
    db.assembly_orders.push(newOrder);
    await saveState();
    res.json({ data: newOrder });
  });

  // Start assembly order
  app.post('/api/v1/assembly-orders/:id/start', async (req, res) => {
    const { id } = req.params;
    const { temperature_celsius } = req.body;
    const order = db.assembly_orders?.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Assembly order not found' });
    }

    if (order.status !== 'scheduled') {
      return res.status(400).json({ error: `Cannot start assembly order in status ${order.status}` });
    }

    const template = db.assembly_templates?.find(t => t.id === order.template_id);
    if (!template) {
      return res.status(500).json({ error: 'Associated template not found' });
    }

    const firstStage = template.stages[0];
    if (!firstStage) {
      return res.status(500).json({ error: 'Template has no stages defined' });
    }

    order.status = 'in_progress';
    order.actual_start = new Date().toISOString();
    order.current_stage = firstStage.stage_number;
    order.stage_history = [{
      stage_number: firstStage.stage_number,
      stage_name: firstStage.name,
      entered_at: new Date().toISOString(),
      approved_by: null,
      approved_by_name: null,
      temperature_celsius: temperature_celsius !== undefined ? Number(temperature_celsius) : null,
      notes: 'Assembly order commenced'
    }];

    await saveState();
    res.json({ data: order });
  });

  // Advance stage
  app.post('/api/v1/assembly-orders/:id/advance-stage', async (req, res) => {
    const { id } = req.params;
    const { approved_by_name, temperature_celsius, notes } = req.body;
    const order = db.assembly_orders?.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Assembly order not found' });
    }

    if (order.status !== 'in_progress') {
      return res.status(400).json({ error: 'Order is not currently in progress' });
    }

    const template = db.assembly_templates?.find(t => t.id === order.template_id);
    if (!template) {
      return res.status(500).json({ error: 'Template not found' });
    }

    const currentStageObj = template.stages.find(s => s.stage_number === order.current_stage);
    if (!currentStageObj) {
      return res.status(500).json({ error: 'Current stage object not found' });
    }

    // Inspector is not initiator check
    const inspectorId = db.currentUser?.id || 'INSPECTOR';
    const inspectorName = approved_by_name || db.currentUser?.name || 'INSPECTOR';
    if (inspectorId === order.initiated_by) {
      return res.status(400).json({ error: { code: 'INSPECTOR_IS_INITIATOR', message: 'The inspector validating the stage must be different from the initiator.' } });
    }

    // Dwell time check
    const currentEvent = order.stage_history[order.stage_history.length - 1];
    if (currentEvent) {
      const elapsedHours = (Date.now() - new Date(currentEvent.entered_at).getTime()) / (1000 * 3600);
      if (elapsedHours < currentStageObj.min_dwell_hours) {
        return res.status(400).json({ error: { code: 'DWELL_TIME_NOT_MET', message: `Stage requires minimum dwell time of ${currentStageObj.min_dwell_hours} hours. Only ${elapsedHours.toFixed(2)} hours elapsed.` } });
      }
    }

    // Approve the current stage
    if (currentEvent) {
      currentEvent.approved_by = db.currentUser?.id || 'INSPECTOR_ID';
      currentEvent.approved_by_name = inspectorName;
      currentEvent.notes = notes || 'Stage approved';
    }

    // See if there's a next stage
    const nextStageObj = template.stages.find(s => s.stage_number === order.current_stage + 1);
    if (nextStageObj) {
      order.current_stage = nextStageObj.stage_number;
      order.stage_history.push({
        stage_number: nextStageObj.stage_number,
        stage_name: nextStageObj.name,
        entered_at: new Date().toISOString(),
        approved_by: null,
        approved_by_name: null,
        temperature_celsius: temperature_celsius !== undefined ? Number(temperature_celsius) : null,
        notes: 'Entered stage'
      });
    } else {
      // Completed stages. Order must be completed via complete call
      order.notes = (order.notes || '') + ' | All stages completed, ready for closure';
    }

    await saveState();
    res.json({ data: order });
  });

  // Complete assembly order
  app.post('/api/v1/assembly-orders/:id/complete', async (req, res) => {
    const { id } = req.params;
    const { qty_output_actual, output_batch_id, notes } = req.body;
    const order = db.assembly_orders?.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Assembly order not found' });
    }

    if (order.status !== 'in_progress') {
      return res.status(400).json({ error: 'Order is not in progress' });
    }

    if (qty_output_actual === undefined || qty_output_actual === null) {
      return res.status(400).json({ error: 'Actual output quantity is required to complete' });
    }

    const actualQty = Number(qty_output_actual);
    const deviationPct = Math.abs((actualQty - order.qty_output_planned) / order.qty_output_planned) * 100;
    
    order.qty_output_actual = actualQty;
    order.yield_variance_pct = Number(deviationPct.toFixed(2));
    order.notes = notes || order.notes;

    if (deviationPct > 10) {
      // Goes to inspection pending
      order.status = 'inspection_pending';
      await saveState();
      return res.json({ 
        data: order, 
        warning: 'YIELD_VARIANCE_WARNING',
        message: 'Yield variance exceeds 10% bounds. Placed in inspection_pending status.' 
      });
    }

    // Within bounds, complete immediately
    commitAssemblyCompletion(order, actualQty, output_batch_id);
    await saveState();
    res.json({ data: order });
  });

  // Approve yield (reconciliation)
  app.post('/api/v1/assembly-orders/:id/approve-yield', async (req, res) => {
    const { id } = req.params;
    const { output_batch_id } = req.body;
    const order = db.assembly_orders?.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Assembly order not found' });
    }

    if (order.status !== 'inspection_pending') {
      return res.status(400).json({ error: 'Order is not awaiting yield approval' });
    }

    // Add self-approval check to approve-yield
    if (db.currentUser?.id === order.initiated_by) {
      return res.status(422).json({ error: 'SELF_APPROVAL_PROHIBITED', message: 'The initiator cannot approve the yield deviation.' });
    }

    commitAssemblyCompletion(order, order.qty_output_actual || order.qty_output_planned, output_batch_id);
    await saveState();
    res.json({ data: order });
  });

  // Helper function to commit stock changes for assembly order completion
  function commitAssemblyCompletion(order: AssemblyOrder, actualQty: number, outputBatchId?: string) {
    order.status = 'completed';
    order.completed_at = new Date().toISOString();

    // Deduct ingredient
    writeLedgerEntry({
      sku_id: order.input_sku_id,
      batch_id: order.input_batch_id,
      location_id: order.location_id,
      warehouse_id: order.warehouse_id,
      quantity: -order.qty_input,
      transaction_type: 'assembly_consumption',
      reference_id: order.id,
      reference_type: 'assembly_order',
      user_id: db.currentUser?.id || 'SYSTEM_ASM',
      notes: `Consumed for assembly order completion: ${order.id}`
    });

    // Create entry in batches dictionary
    const finalBatchId = outputBatchId || `BAT-ASM-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBatch: Batch = {
      id: finalBatchId,
      sku_id: order.output_sku_id,
      batch_number: finalBatchId,
      expiry_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      production_date: new Date().toISOString(),
      received_date: new Date().toISOString(),
      quantity_received: actualQty,
      quantity_available: actualQty,
      status: 'active',
      goods_receipt_id: 'SYSTEM_ASM',
      warehouse_id: order.warehouse_id,
      created_at: new Date().toISOString(),
      parent_batch_ids: [order.input_batch_id],
      child_batch_ids: [],
      assembly_order_id: order.id
    };

    db.batches.push(newBatch);
    order.output_batch_id = finalBatchId;

    // Record production
    writeLedgerEntry({
      sku_id: order.output_sku_id,
      batch_id: finalBatchId,
      location_id: order.location_id,
      warehouse_id: order.warehouse_id,
      quantity: actualQty,
      transaction_type: 'assembly_production',
      reference_id: order.id,
      reference_type: 'assembly_order',
      user_id: db.currentUser?.id || 'SYSTEM_ASM',
      notes: `Assembled from order ${order.id}`
    });

    // Yield shortfall (if any) is tracked as a reporting figure only,
    // via order.yield_variance_pct (set in the /complete endpoint
    // before this function is called). No ledger entry is written
    // for the shortfall: the output batch was only ever credited
    // with actualQty (see assembly_production entry above), so
    // there is nothing further to write off against it. A separate
    // debiting entry here would attempt to subtract a quantity that
    // was never credited, which can drive the batch negative when
    // actualQty is less than half of qty_output_planned.
  }

  // Get recipes
  app.get('/api/v1/production/recipes', (req, res) => {
    res.json({ data: db.production_recipes || [] });
  });

  // Get runs
  app.get('/api/v1/production/runs', (req, res) => {
    res.json({ data: db.production_runs || [] });
  });

  // Create a production run
  app.post('/api/v1/production/runs', async (req, res) => {
    const {
      recipe_id,
      warehouse_id,
      output_location_id,
      batches_planned,
      output_batch_id,
      output_expiry_date,
      notes,
      component_lines // Array of { component_id, sku_id, batch_id, qty_planned }
    } = req.body;

    const recipe = db.production_recipes?.find(r => r.id === recipe_id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const runId = `RUN-${Math.floor(1000 + Math.random() * 9000)}`;
    const output_qty_planned = recipe.output_qty_per_batch * (batches_planned || 1);

    // Auto-select ingredient batches using FEFO strategy and validate stock level
    const mappedComponentLines = [];
    for (const line of (component_lines || [])) {
      const qtyNeeded = Number(line.qty_planned);
      
      const activeBatches = (db.batches || [])
        .filter(b => b.sku_id === line.sku_id && b.warehouse_id === warehouse_id && b.status === 'active')
        .map(b => ({ ...b, stock: getStockForBatch(b.id) }))
        .filter(b => b.stock > 0)
        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

      const totalAvailable = activeBatches.reduce((acc, b) => acc + b.stock, 0);
      if (totalAvailable < qtyNeeded) {
        return res.status(400).json({
          error: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for key recipe component SKU ${line.sku_id} (needed ${qtyNeeded}, available ${totalAvailable}).`
        });
      }

      const earliestBatch = activeBatches[0];
      mappedComponentLines.push({
        id: `RL-${Math.floor(1000 + Math.random() * 9000)}`,
        component_id: line.component_id,
        sku_id: line.sku_id,
        batch_id: earliestBatch ? earliestBatch.id : (line.batch_id || null),
        qty_planned: qtyNeeded,
        qty_actual: null,
        consumed_at: null
      });
    }

    const newRun: ProductionRun = {
      id: runId,
      recipe_id,
      recipe_name: recipe.name,
      status: 'planned',
      warehouse_id,
      output_location_id,
      batches_planned: batches_planned || 1,
      component_lines: mappedComponentLines,
      output_qty_planned,
      output_qty_actual: null,
      output_batch_id: output_batch_id || `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
      output_expiry_date: output_expiry_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      standard_cost_kes: recipe.standard_cost_kes * (batches_planned || 1),
      actual_cost_kes: null,
      cost_variance_kes: null,
      initiated_by: db.currentUser?.id || 'WMS_ENGINE',
      scheduled_start: new Date().toISOString(),
      actual_start: null,
      completed_at: null,
      notes: notes || null
    };

    if (!db.production_runs) db.production_runs = [];
    db.production_runs.push(newRun);
    await saveState();
    res.json({ data: newRun });
  });

  // Advance production run status (planned -> in_progress -> completed)
  app.post('/api/v1/production/runs/:id/advance', async (req, res) => {
    const runId = req.params.id;
    const { qty_actual_output } = req.body;
    const run = db.production_runs?.find(r => r.id === runId);

    if (!run) {
      return res.status(404).json({ error: 'Production run not found' });
    }

    if (run.status === 'planned') {
      run.status = 'in_progress';
      run.actual_start = new Date().toISOString();
    } else if (run.status === 'in_progress') {
      run.status = 'completed';
      run.completed_at = new Date().toISOString();
      const finalOutputQty = Number(qty_actual_output) || run.output_qty_planned;
      run.output_qty_actual = finalOutputQty;

      // Deduct ingredients and record consumption
      const inputBatchIds: string[] = [];
      run.component_lines.forEach(line => {
        const batch = db.batches.find(b => b.id === line.batch_id);
        const consumeQty = line.qty_planned;
        line.qty_actual = consumeQty;
        line.consumed_at = new Date().toISOString();

        if (batch) {
          inputBatchIds.push(batch.id);

          const ledgerEntriesForBatch = db.stock_ledger.filter(e => e.batch_id === line.batch_id);
          let consumeLocationId = run.output_location_id;
          const locationWithStock = ledgerEntriesForBatch.find(e => getStockForBatchAndLocation(line.batch_id, e.location_id) >= consumeQty);
          if (locationWithStock) {
            consumeLocationId = locationWithStock.location_id;
          } else if (ledgerEntriesForBatch.length > 0) {
            consumeLocationId = ledgerEntriesForBatch[0].location_id;
          }

          writeLedgerEntry({
            sku_id: line.sku_id,
            batch_id: line.batch_id,
            location_id: consumeLocationId,
            warehouse_id: run.warehouse_id,
            quantity: -consumeQty,
            transaction_type: 'assembly_consumption',
            reference_id: run.id,
            reference_type: 'production_run',
            user_id: db.currentUser?.id || 'SYSTEM_RUN',
            notes: `Consumed for batch run of ${run.recipe_name}`
          });
        }
      });

      const recipeObj = db.production_recipes?.find(r => r.id === run.recipe_id);
      const outSkuId = recipeObj?.output_sku_id || '';

      const newBatch: Batch = {
        id: run.output_batch_id || `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
        sku_id: outSkuId,
        batch_number: run.output_batch_id || `BNO-${Math.floor(100000 + Math.random() * 900000)}`,
        expiry_date: run.output_expiry_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        production_date: new Date().toISOString(),
        received_date: new Date().toISOString(),
        quantity_received: finalOutputQty,
        quantity_available: finalOutputQty,
        status: 'active',
        goods_receipt_id: 'SYSTEM_ASM',
        warehouse_id: run.warehouse_id,
        created_at: new Date().toISOString(),
        parent_batch_ids: inputBatchIds,
        child_batch_ids: [],
        assembly_order_id: run.id
      };

      db.batches.push(newBatch);

      inputBatchIds.forEach(pId => {
        const pBatch = db.batches.find(b => b.id === pId);
        if (pBatch) {
          if (!pBatch.child_batch_ids) pBatch.child_batch_ids = [];
          pBatch.child_batch_ids.push(newBatch.id);
        }
      });

      writeLedgerEntry({
        sku_id: outSkuId,
        batch_id: newBatch.id,
        location_id: run.output_location_id,
        warehouse_id: run.warehouse_id,
        quantity: finalOutputQty,
        transaction_type: 'assembly_production',
        reference_id: run.id,
        reference_type: 'production_run',
        user_id: db.currentUser?.id || 'SYSTEM_RUN',
        notes: `Assembled from production run ${run.id}`
      });
    }

    await saveState();
    res.json({ data: run });
  });

  // Comprehensive detailed report for inventory and waste (turnover, waste by reason/sku, total waste cost)
  app.get('/api/v1/reports/comprehensive-export', (req, res) => {
    // 1. Calculate Inventory Turnover Ratio
    const pickEntries = db.stock_ledger.filter(entry => entry.transaction_type === 'pick');
    let cogsCents = 0;
    pickEntries.forEach(entry => {
      const sku = db.skus.find(s => s.id === entry.sku_id);
      if (sku) {
        cogsCents += Math.abs(entry.quantity) * sku.cost_price_kes;
      }
    });

    let totalStockCents = 0;
    db.skus.forEach(s => {
      totalStockCents += getSKUTotalStock(s.id) * s.cost_price_kes;
    });

    const cogs_kes = Math.round(cogsCents);
    const avg_inventory_value_kes = Math.round(totalStockCents);
    const turnover_ratio = avg_inventory_value_kes > 0 ? parseFloat((cogs_kes / avg_inventory_value_kes).toFixed(2)) : 0;

    // 2. Calculate Detailed Waste by Reason Code & SKU
    const approvedWos = db.write_offs.filter(w => w.status === 'approved');
    const wasteList: any[] = [];
    const wasteMap = new Map<string, { reason_code: string; sku_id: string; sku_name: string; quantity: number; total_waste_cost: number }>();

    approvedWos.forEach(wo => {
      const wLines = db.write_off_lines.filter(l => l.write_off_id === wo.id);
      wLines.forEach(l => {
        const key = `${l.reason}_${l.sku_id}`;
        const sku = db.skus.find(s => s.id === l.sku_id);
        const skuName = sku ? sku.name : 'Unknown SKU';
        const existing = wasteMap.get(key);
        if (existing) {
          existing.quantity += l.qty;
          existing.total_waste_cost += l.value_kes;
        } else {
          wasteMap.set(key, {
            reason_code: l.reason,
            sku_id: l.sku_id,
            sku_name: skuName,
            quantity: l.qty,
            total_waste_cost: l.value_kes
          });
        }
      });
    });



    const waste_details = Array.from(wasteMap.values());
    const total_waste_cost_sum = waste_details.reduce((sum, item) => sum + item.total_waste_cost, 0);

    // 3. Current Live Inventory Snapshot (with holding value)
    const inventory_items = db.skus.map(s => {
      const stockQty = getSKUTotalStock(s.id);
      return {
        sku_id: s.id,
        sku_name: s.name,
        sku_code: s.code,
        group_category: s.category_id,
        current_stock: stockQty,
        unit_cost_kes: s.cost_price_kes,
        total_valuation_kes: stockQty * s.cost_price_kes
      };
    });

    res.json({
      inventory_turnover: {
        cogs_kes,
        avg_inventory_value_kes,
        turnover_ratio
      },
      waste_details,
      total_waste_cost_sum,
      inventory_items,
      timestamp: new Date().toISOString()
    });
  });

  // --- TRANSFER LOGISTICS ROUND 6B ENDPOINTS ---

  app.post('/api/v1/transfers/:id/pack', async (req, res) => {
    const trId = req.params.id;
    const tr = db.transfers.find(t => t.id === trId);
    if (!tr) return res.status(404).json({ error: { message: 'Transfer not found' } });
    
    const validRoles = ['ops_manager', 'admin', 'receiver'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only authorized roles can mark transfers as packed' } });
    }

    if (tr.transfer_scope !== 'replenishment') {
      return res.status(400).json({ error: { code: 'WRONG_TRANSFER_SCOPE', message: 'Transfer must be a replenishment (FPO) order to be packed' } });
    }

    if (tr.status !== 'approved') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'FPO must be in Approved status to be packed' } });
    }

    tr.packed_by = db.currentUser.id;
    tr.packed_at = new Date().toISOString();
    tr.status = 'packed';
    await saveState();
    res.json({ data: tr });
  });

  app.post('/api/v1/manifests/replenishment', async (req, res) => {
    const { from_warehouse_id, to_warehouse_id, trip_reference, driver_id, vehicle_id, notes } = req.body;
    
    const validRoles = ['ops_manager', 'admin', 'receiver'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const fromWh = db.warehouses.find(w => w.id === from_warehouse_id);
    const toWh = db.warehouses.find(w => w.id === to_warehouse_id);

    if (!fromWh || fromWh.type !== 'main_warehouse') {
      return res.status(422).json({ error: { code: 'INVALID_WAREHOUSE_TYPE', message: 'From warehouse must be a main_warehouse' } });
    }
    if (!toWh || toWh.type !== 'fulfilment_point') {
      return res.status(422).json({ error: { code: 'INVALID_WAREHOUSE_TYPE', message: 'To warehouse must be a fulfilment_point' } });
    }
    if (!fromWh.is_active) {
      return res.status(422).json({ error: { code: 'WAREHOUSE_INACTIVE', message: `Source warehouse '${fromWh.name}' is inactive.` } });
    }
    if (!toWh.is_active) {
      return res.status(422).json({ error: { code: 'WAREHOUSE_INACTIVE', message: `Destination warehouse '${toWh.name}' is inactive.` } });
    }

    const driver = db.users.find(u => u.id === driver_id);

    const m: LoadingManifest = {
      id: 'MAN-' + Date.now(),
      manifest_number: nextManifestNumber('replenishment'),
      type: 'replenishment',
      status: 'draft',
      reference_id: null,
      transfer_ids: [],
      trip_reference: trip_reference || null,
      warehouse_from_id: from_warehouse_id,
      warehouse_to_id: to_warehouse_id || null,
      customer_name: null,
      customer_address: null,
      driver_id: driver_id || null,
      driver_name: driver?.name || null,
      vehicle_id: vehicle_id || null,
      lines: [],
      assets: [],
      dispatch_temperature_celsius: null,
      is_locked: false,
      generated_at: new Date().toISOString(),
      generated_by: db.currentUser.id,
      dispatched_by: null,
      dispatched_at: null,
      receiver_acknowledged_by: null,
      receiver_acknowledged_at: null,
      notes: notes || null
    };

    db.loading_manifests.push(m);
    await saveState();
    res.status(201).json({ data: m });
  });

  app.post('/api/v1/manifests/delivery', async (req, res) => {
    const { delivery_id } = req.body;
    
    const validRoles = ['ops_manager', 'admin', 'driver'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const delivery = db.deliveries.find(d => d.id === delivery_id);
    if (!delivery) {
      return res.status(404).json({ error: { message: 'Delivery not found' } });
    }

    if (delivery.status !== 'dispatched') {
      return res.status(422).json({ error: { code: 'DELIVERY_NOT_DISPATCHED', message: 'Delivery has not been dispatched yet' } });
    }

    const exists = db.loading_manifests.some(m => m.reference_id === delivery.id);
    if (exists) {
      return res.status(422).json({ error: { code: 'MANIFEST_EXISTS', message: 'A manifest already exists for this delivery' } });
    }

    const pLists = db.pick_lists.filter(pl => pl.order_id === delivery.order_id);
    const plLines = db.pick_list_lines.filter(l => pLists.some(pl => pl.id === l.pick_list_id) && l.status === 'picked');

    const lines: ManifestLine[] = plLines.map(plLine => {
      const sku = db.skus.find(s => s.id === plLine.sku_id);
      const batch = db.batches.find(b => b.id === plLine.batch_id);
      return {
        id: 'ML-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        transfer_id: '',
        transfer_line_id: plLine.id,
        sku_id: plLine.sku_id,
        sku_name: sku?.name || 'Unknown SKU',
        batch_id: plLine.batch_id,
        batch_number: batch?.batch_number || 'Unknown Batch',
        expiry_date: batch?.expiry_date || '',
        qty_manifested: plLine.qty_picked || plLine.qty_requested,
        qty_received: null,
        variance: null,
        from_location_id: plLine.location_id,
        to_location_id: null,
        temp_zone: sku?.temp_zone || 'ambient',
        received: false
      };
    });

    const assets: ManifestAsset[] = db.delivery_assets
      .filter(da => da.delivery_id === delivery.id)
      .map(da => ({
        uid: da.uid || null,
        asset_type: da.asset_type,
        count: da.count
      }));

    const logs = db.temp_logs
      .filter(t => t.reference_id === delivery.id && t.reference_type === 'delivery');

    let dispatch_temperature_celsius = null;
    if (logs.length > 0) {
      dispatch_temperature_celsius = logs[0].temperature_celsius;
    }

    const order = db.customer_orders.find(o => o.id === delivery.order_id);
    const customer = db.customers.find(c => c.id === order?.customer_id);
    const driver = db.users.find(u => u.id === delivery.driver_id);

    const m: LoadingManifest = {
      id: 'MAN-' + Date.now(),
      manifest_number: nextManifestNumber('delivery'),
      type: 'delivery',
      status: 'dispatched',
      reference_id: delivery.id,
      transfer_ids: [],
      trip_reference: null,
      warehouse_from_id: order?.fulfilment_warehouse_id || db.warehouses[0]?.id || '',
      warehouse_to_id: null,
      customer_name: customer?.name || null,
      customer_address: order?.delivery_address || customer?.delivery_address || null,
      driver_id: delivery.driver_id || null,
      driver_name: driver?.name || null,
      vehicle_id: delivery.vehicle_id || null,
      lines,
      assets,
      dispatch_temperature_celsius,
      is_locked: true,
      generated_at: new Date().toISOString(),
      generated_by: db.currentUser?.id || 'U-ADMIN',
      dispatched_by: db.currentUser?.id || 'U-ADMIN',
      dispatched_at: delivery.dispatched_at || new Date().toISOString(),
      receiver_acknowledged_by: null,
      receiver_acknowledged_at: null,
      notes: null
    };

    db.loading_manifests.push(m);
    await saveState();
    res.status(201).json({ data: m });
  });

  app.post('/api/v1/manifests/:id/add-fpo', async (req, res) => {
    const { transfer_id } = req.body;
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    const validRoles = ['ops_manager', 'admin', 'receiver'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.is_locked) {
      return res.status(422).json({ error: { code: 'MANIFEST_LOCKED', message: 'Manifest is locked' } });
    }
    if (manifest.type !== 'replenishment') {
      return res.status(422).json({ error: { code: 'WRONG_MANIFEST_TYPE', message: 'Manifest is not a replenishment type' } });
    }
    if (manifest.status !== 'draft' && manifest.status !== 'ready') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Manifest must be draft or ready' } });
    }

    const transfer = db.transfers.find(t => t.id === transfer_id);
    if (!transfer) return res.status(404).json({ error: { message: 'Transfer not found' } });

    if (transfer.transfer_scope !== 'replenishment') {
      return res.status(422).json({ error: { code: 'WRONG_SCOPE', message: 'Transfer is not a replenishment order' } });
    }
    if (transfer.status !== 'packed') {
      return res.status(422).json({ error: { code: 'FPO_NOT_PACKED', message: 'FPO must be marked as packed first' } });
    }
    if (transfer.from_warehouse_id !== manifest.warehouse_from_id || transfer.to_warehouse_id !== manifest.warehouse_to_id) {
      return res.status(422).json({ error: { code: 'WAREHOUSE_MISMATCH', message: 'Warehouse from/to mismatch' } });
    }
    if (transfer.manifest_id !== null) {
      return res.status(422).json({ error: { code: 'FPO_ALREADY_ON_MANIFEST', message: 'FPO is already allocated to a manifest' } });
    }

    if (!manifest.transfer_ids.includes(transfer.id)) {
      manifest.transfer_ids.push(transfer.id);
    }
    transfer.manifest_id = manifest.id;
    transfer.status = 'on_manifest';

    const tlLines = db.transfer_lines.filter(l => l.transfer_id === transfer.id);
    tlLines.forEach(tlLine => {
      const sku = db.skus.find(s => s.id === tlLine.sku_id);
      const batch = db.batches.find(b => b.id === tlLine.batch_id);
      manifest.lines.push({
        id: 'ML-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        transfer_id: transfer.id,
        transfer_line_id: tlLine.id,
        sku_id: tlLine.sku_id,
        sku_name: sku?.name || 'Unknown SKU',
        batch_id: tlLine.batch_id,
        batch_number: batch?.batch_number || 'Unknown Batch',
        expiry_date: batch?.expiry_date || '',
        qty_manifested: tlLine.qty_requested,
        qty_received: null,
        variance: null,
        from_location_id: tlLine.from_location_id,
        to_location_id: tlLine.to_location_id,
        temp_zone: sku?.temp_zone || 'ambient',
        received: false
      });
    });

    manifest.status = 'ready';
    await saveState();
    res.json({ data: manifest });
  });

  app.post('/api/v1/manifests/:id/remove-fpo', async (req, res) => {
    const { transfer_id } = req.body;
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.is_locked) {
      return res.status(422).json({ error: { code: 'MANIFEST_LOCKED', message: 'Manifest is locked' } });
    }

    manifest.transfer_ids = manifest.transfer_ids.filter(id => id !== transfer_id);
    manifest.lines = manifest.lines.filter(l => l.transfer_id !== transfer_id);

    const transfer = db.transfers.find(t => t.id === transfer_id);
    if (transfer) {
      transfer.manifest_id = null;
      transfer.status = 'packed';
    }

    if (manifest.transfer_ids.length === 0) {
      manifest.status = 'draft';
    } else {
      manifest.status = 'ready';
    }

    await saveState();
    res.json({ data: manifest });
  });

  app.post('/api/v1/manifests/:id/dispatch', async (req, res) => {
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.status !== 'ready') {
      return res.status(422).json({ error: { code: 'MANIFEST_NOT_READY', message: 'Manifest must be ready to dispatch' } });
    }
    if (manifest.transfer_ids.length === 0) {
      return res.status(422).json({ error: { code: 'NO_FPOS_ON_MANIFEST', message: 'No FPOs on manifest' } });
    }

    const dispatchTime = new Date().toISOString();
    manifest.is_locked = true;
    manifest.dispatched_by = db.currentUser.id;
    manifest.dispatched_at = dispatchTime;
    manifest.status = 'dispatched';

    if (req.body.dispatch_temperature_celsius !== undefined) {
      manifest.dispatch_temperature_celsius = parseFloat(req.body.dispatch_temperature_celsius);
    }

    manifest.transfer_ids.forEach(transfer_id => {
      const transfer = db.transfers.find(t => t.id === transfer_id);
      if (transfer) {
        transfer.status = 'dispatched';

        const tlLines = db.transfer_lines.filter(l => l.transfer_id === transfer.id);
        tlLines.forEach((line, index) => {
          try {
            writeLedgerEntry({
              sku_id: line.sku_id,
              batch_id: line.batch_id,
              location_id: line.from_location_id,
              warehouse_id: transfer.from_warehouse_id,
              quantity: -line.qty_requested,
              transaction_type: 'transfer_out',
              reference_id: transfer.id,
              reference_type: 'transfer',
              user_id: db.currentUser?.id || 'U-ADMIN',
              notes: `Replenishment dispatch MAN: ${manifest.manifest_number}`
            });
          } catch (err) {
            console.error('Ledger write during replenishment dispatch failed:', err);
          }

          db.stock_reservations.push({
            id: 'RES-' + Date.now() + '-' + index + '-' + Math.floor(Math.random()*1000),
            sku_id: line.sku_id,
            batch_id: line.batch_id,
            warehouse_id: transfer.to_warehouse_id,
            qty_reserved: line.qty_requested,
            reference_id: transfer.id,
            reference_type: 'replenishment',
            status: 'active',
            created_at: dispatchTime
          });
        });
      }
    });

    await saveState();
    res.json({ data: manifest });
  });

  app.get('/api/v1/manifests', (req, res) => {
    let filtered = [...db.loading_manifests];
    if (req.query.type) {
      filtered = filtered.filter(m => m.type === req.query.type);
    }
    if (req.query.status) {
      filtered = filtered.filter(m => m.status === req.query.status);
    }
    if (req.query.warehouse_from_id) {
      filtered = filtered.filter(m => m.warehouse_from_id === req.query.warehouse_from_id);
    }
    if (req.query.warehouse_to_id) {
      filtered = filtered.filter(m => m.warehouse_to_id === req.query.warehouse_to_id);
    }

    const data = filtered.map(m => {
      return {
        ...m,
        transfer_count: m.transfer_ids.length,
        line_count: m.lines.length
      };
    });
    res.json({ data });
  });

  app.get('/api/v1/manifests/:id', (req, res) => {
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    const enrichedLines = manifest.lines.map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      return {
        ...line,
        sku_name: sku?.name || line.sku_name,
        sku_code: sku?.code || '',
        display_unit: sku?.display_unit || 'units',
        display_divisor: sku?.display_divisor || 1
      };
    });

    const transfer_summaries = manifest.transfer_ids.map(tid => {
      const tr = db.transfers.find(t => t.id === tid);
      const lines = db.transfer_lines.filter(l => l.transfer_id === tid);
      return {
        id: tid,
        replenishment_order_number: tr?.replenishment_order_number || '',
        status: tr?.status || '',
        line_count: lines.length,
        notes: tr?.notes || ''
      };
    });

    res.json({
      data: {
        ...manifest,
        lines: enrichedLines,
        transfer_summaries
      }
    });
  });

  app.get('/api/v1/manifests/:id/print', (req, res) => {
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).send('<h1>Manifest not found</h1>');

    const fromWh = db.warehouses.find(w => w.id === manifest.warehouse_from_id)?.name || manifest.warehouse_from_id;
    const toWh = manifest.warehouse_to_id ? (db.warehouses.find(w => w.id === manifest.warehouse_to_id)?.name || manifest.warehouse_to_id) : 'Customer Delivery';

    let groupsText = '';
    if (manifest.type === 'replenishment') {
      manifest.transfer_ids.forEach(tid => {
        const transfer = db.transfers.find(t => t.id === tid);
        const fpoLines = manifest.lines.filter(l => l.transfer_id === tid);
        groupsText += `
          <div class="fpo-section">
            <h3>FPO Order: ${transfer?.replenishment_order_number || tid} ${transfer?.notes ? `(${transfer.notes})` : ''}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SKU</th>
                  <th>Batch</th>
                  <th>Expiry Date</th>
                  <th>Qty Manifested</th>
                  <th>Zone</th>
                  <th>Received Qty (Blank)</th>
                </tr>
              </thead>
              <tbody>
                ${fpoLines.map((line, idx) => {
                  const sku = db.skus.find(s => s.id === line.sku_id);
                  const displayStr = sku ? `${(line.qty_manifested / sku.display_divisor).toFixed(sku.display_unit === 'kg' ? 1 : 0)} ${sku.display_unit}` : `${line.qty_manifested}`;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${line.sku_name}</td>
                      <td>${line.batch_number}</td>
                      <td>${line.expiry_date ? line.expiry_date.slice(0, 10) : 'N/A'}</td>
                      <td><strong>${displayStr}</strong></td>
                      <td><span class="badge">${line.temp_zone}</span></td>
                      <td class="write-box"></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      });
    } else {
      groupsText = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>SKU</th>
              <th>Batch</th>
              <th>Expiry Date</th>
              <th>Qty Manifested</th>
              <th>Zone</th>
              <th>Received Qty (Blank)</th>
            </tr>
          </thead>
          <tbody>
            ${manifest.lines.map((line, idx) => {
              const sku = db.skus.find(s => s.id === line.sku_id);
              const displayStr = sku ? `${(line.qty_manifested / sku.display_divisor).toFixed(sku.display_unit === 'kg' ? 1 : 0)} ${sku.display_unit}` : `${line.qty_manifested}`;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${line.sku_name}</td>
                  <td>${line.batch_number}</td>
                  <td>${line.expiry_date ? line.expiry_date.slice(0, 10) : 'N/A'}</td>
                  <td><strong>${displayStr}</strong></td>
                  <td><span class="badge">${line.temp_zone}</span></td>
                  <td class="write-box"></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    let assetsHtml = '';
    if (manifest.assets.length > 0) {
      assetsHtml = `
        <div class="assets-section">
          <h3>Tracked Logistics Assets:</h3>
          <ul>
            ${manifest.assets.map(a => `<li>${a.count} x ${a.asset_type.replace('_', ' ')} ${a.uid ? `(UID: ${a.uid})` : ''}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let discrepancyHtml = '';
    if (manifest.type === 'replenishment') {
      const closedTransfers = manifest.transfer_ids.map(tid => db.transfers.find(t => t.id === tid)).filter(Boolean);
      const allRejections = closedTransfers.reduce((list, t) => {
        if (t && t.rejection_lines) list.push(...t.rejection_lines);
        return list;
      }, [] as FPORejectionLine[]);

      if (allRejections.length > 0) {
        discrepancyHtml = `
          <div class="discrepancies-section">
            <h3 style="color: #721c24;">Recorded Discrepancies & Rejections:</h3>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Manifested</th>
                  <th>Received</th>
                  <th>Reason</th>
                  <th>Disposition</th>
                </tr>
              </thead>
              <tbody>
                ${allRejections.map(r => {
                  return `
                    <tr>
                      <td>${r.sku_name}</td>
                      <td>${r.qty_manifested}</td>
                      <td>${r.qty_received}</td>
                      <td>${r.rejection_reason}</td>
                      <td>${r.disposition}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Loading Manifest: ${manifest.manifest_number}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            line-height: 1.4;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
          }
          header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title-area h1 {
            margin: 0 0 5px 0;
            font-size: 24px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .title-area h2 {
            margin: 0;
            font-size: 14px;
            color: #666;
            font-weight: normal;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            font-size: 13px;
            margin-bottom: 20px;
          }
          .info-val {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 20px;
          }
          table th, table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          table th {
            background-color: #f1f1f1;
            font-weight: bold;
          }
          .write-box {
            background-color: #fafafa;
            width: 150px;
            border: 1px dotted #999;
          }
          .fpo-section {
            margin-bottom: 30px;
            border: 1px solid #eee;
            padding: 15px;
            border-radius: 4px;
          }
          .fpo-section h3 {
            margin-top: 0;
            color: #000;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
          }
          .badge {
            background: #e1f5fe;
            color: #0288d1;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
          }
          .sig-box {
            border: 1px solid #ccc;
            padding: 15px;
            border-radius: 4px;
            height: 120px;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #eee;
            padding-top: 10px;
            font-size: 11px;
            color: #777;
            text-align: center;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
              font-size: 12px;
            }
            .sig-box {
              height: 100px;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="title-area">
            <h1>\${CONFIG.PLATFORM_NAME}</h1>
            <h2>Warehouse Management System — Loading Manifest</h2>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">\${manifest.manifest_number}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666; text-transform: uppercase;">\${manifest.type} Manifest</p>
          </div>
        </header>

        <div class="info-grid">
          <div>
            <div><strong>From Site:</strong> <span class="info-val">${fromWh}</span></div>
            <div><strong>To Site:</strong> <span class="info-val">${toWh}</span></div>
            ${manifest.customer_name ? `<div><strong>Customer Name:</strong> <span class="info-val">${manifest.customer_name}</span></div>` : ''}
            ${manifest.customer_address ? `<div><strong>Delivery Address:</strong> <span class="info-val">${manifest.customer_address}</span></div>` : ''}
          </div>
          <div>
            <div><strong>Driver:</strong> <span class="info-val">${manifest.driver_name || 'N/A'}</span></div>
            <div><strong>Vehicle:</strong> <span class="info-val">${manifest.vehicle_id || 'N/A'}</span></div>
            <div><strong>Dispatch Date/Time:</strong> <span class="info-val">${manifest.dispatched_at ? manifest.dispatched_at.slice(0, 16).replace('T', ' ') : 'N/A'}</span></div>
            ${manifest.dispatch_temperature_celsius !== null ? `<div><strong>Dispatch Temp:</strong> <span class="info-val">${manifest.dispatch_temperature_celsius} °C</span></div>` : ''}
          </div>
        </div>

        ${groupsText}

        ${assetsHtml}

        ${discrepancyHtml}

        <div class="signatures">
          <div class="sig-box">
            <strong>DISPATCHED BY:</strong><br><br>
            Name: ______________________<br><br>
            Signature: __________________<br><br>
            Time: _______________________
          </div>
          <div class="sig-box">
            <strong>RECEIVED BY:</strong><br><br>
            Name: ______________________<br><br>
            Signature: __________________<br><br>
            Time: _______________________
          </div>
        </div>

        <div class="footer">
          Retain for 7 years | System generated on \${new Date().toISOString().slice(0, 19).replace('T', ' ')} | \${CONFIG.PLATFORM_NAME} WMS
        </div>

        <script>
          window.onload = function() {
            if (window.location.search.includes('print=true')) {
              window.print();
            }
          }
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  });

  app.post('/api/v1/manifests/:id/open-receiving', async (req, res) => {
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    const validRoles = ['receiver', 'ops_manager', 'admin'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.status !== 'dispatched') {
      return res.status(422).json({ error: { code: 'NOT_DISPATCHED', message: 'Manifest is not in dispatched status' } });
    }

    manifest.status = 'receiving';
    manifest.transfer_ids.forEach(tid => {
      const transfer = db.transfers.find(t => t.id === tid);
      if (transfer) {
        transfer.status = 'receiving';
      }
    });

    await saveState();
    res.json({ data: manifest });
  });

  app.post('/api/v1/manifests/:id/receive-line', async (req, res) => {
    const {
      transfer_id,
      transfer_line_id,
      qty_received,
      rejection_reason,
      is_returnable,
      disposition,
      actual_sku_id,
      disposition_notes,
      markdown_price_kes,
      donate_recipient
    } = req.body;

    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    const validRoles = ['receiver', 'ops_manager', 'admin'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.status !== 'receiving') {
      return res.status(422).json({ error: { code: 'NOT_IN_RECEIVING', message: 'Manifest is not in receiving state' } });
    }

    const mLine = manifest.lines.find(l => l.transfer_line_id === transfer_line_id);
    if (!mLine) return res.status(404).json({ error: { message: 'Manifest line not found' } });

    mLine.received = true;
    mLine.qty_received = parseFloat(qty_received);
    mLine.variance = mLine.qty_received - mLine.qty_manifested;

    const qty_rejected = mLine.qty_manifested - mLine.qty_received;
    const transfer = db.transfers.find(t => t.id === transfer_id);
    if (!transfer) return res.status(404).json({ error: { message: 'Transfer not found' } });

    let warningText = '';
    let rejectionLineObj: any = null;

    if (qty_rejected > 0 || rejection_reason) {
      if (!rejection_reason) {
        return res.status(422).json({ error: { code: 'REJECTION_REASON_REQUIRED', message: 'rejection_reason is required when there is a rejection' } });
      }

      let returnable = is_returnable;
      if (returnable === undefined) {
        const sku = db.skus.find(s => s.id === mLine.sku_id);
        if (sku && (sku.temp_zone === 'chilled' || sku.temp_zone === 'frozen')) {
          returnable = false;
        } else {
          returnable = true;
        }
      }

      if (!returnable && !disposition) {
        return res.status(422).json({ error: { code: 'DISPOSITION_REQUIRED', message: 'disposition is required for non-returnable rejections' } });
      }

      const active_disposition = returnable ? 'RETURN_TO_SOURCE' : disposition;
      let write_off_id = null;
      let actual_batch_id = null;
      const skuObj = db.skus.find(s => s.id === mLine.sku_id);

      if (active_disposition === 'WRITE_OFF_AT_FP') {
        const woId = `WO-${Date.now()}`;
        const cost = skuObj ? qty_rejected * skuObj.cost_price_kes : 0;
        
        db.write_offs.push({
          id: woId,
          warehouse_id: manifest.warehouse_to_id || db.warehouses[1]?.id || db.warehouses[0]?.id || '',
          status: 'approved',
          created_by: db.currentUser.id,
          approved_by: 'AUTO',
          created_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          total_value_kes: cost,
          notes: `FPO rejection write-off: ${rejection_reason}`
        });

        db.write_off_lines.push({
          id: `WOL-${Math.random().toString(36).substr(2,9).toUpperCase()}`,
          write_off_id: woId,
          sku_id: mLine.sku_id,
          batch_id: mLine.batch_id,
          qty: qty_rejected,
          reason: 'DAMAGED',
          value_kes: cost,
          location_id: transfer.to_location_id || 'RGL-Z1-01',
          notes: ''
        });

        write_off_id = woId;
      }

      let actual_sku_name = null;
      if (active_disposition === 'ACCEPT_AS_RECEIVED') {
        if (!actual_sku_id) {
          return res.status(422).json({ error: { code: 'ACTUAL_SKU_REQUIRED', message: 'actual_sku_id is required' } });
        }
        const actualSku = db.skus.find(s => s.id === actual_sku_id);
        if (!actualSku) {
          return res.status(404).json({ error: { code: 'SKU_NOT_FOUND', message: 'Actual SKU not found' } });
        }
        actual_sku_name = actualSku.name;

        const toWhLocations = db.locations.filter(l => l.warehouse_id === manifest.warehouse_to_id);
        const matchesZone = toWhLocations.some(l => {
          const zoneObj = db.zones.find(z => z.id === l.zone_id);
          return zoneObj?.type === actualSku.temp_zone;
        });

        if (!matchesZone) {
          warningText = `${actualSku.name} requires ${actualSku.temp_zone} storage. Confirm suitable location exists at this site.`;
        }

        const newBatchId = 'BAT-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        const actualBatchNum = 'FPO-WRONG-' + Date.now();
        db.batches.push({
          id: newBatchId,
          sku_id: actual_sku_id,
          batch_number: actualBatchNum,
          goods_receipt_id: 'GR-AUTO-FPO',
          received_date: new Date().toISOString(),
          expiry_date: mLine.expiry_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          production_date: null,
          quantity_received: qty_rejected,
          quantity_available: qty_rejected,
          status: 'active',
          warehouse_id: manifest.warehouse_to_id || db.warehouses[1]?.id || db.warehouses[0]?.id || '',
          created_at: new Date().toISOString(),
          parent_batch_ids: [],
          child_batch_ids: [],
          assembly_order_id: null
        });

        writeLedgerEntry({
          sku_id: actual_sku_id,
          batch_id: newBatchId,
          location_id: transfer.to_location_id || 'RGL-Z1-01',
          warehouse_id: manifest.warehouse_to_id || db.warehouses[1]?.id || db.warehouses[0]?.id || '',
          quantity: qty_rejected,
          transaction_type: 'transfer_in',
          reference_id: transfer.id,
          reference_type: 'transfer',
          user_id: db.currentUser.id,
          notes: `Wrong product received vs FPO ${transfer.replenishment_order_number} — accepted at FP as ${actualSku.name}`
        });

        actual_batch_id = newBatchId;
      }

      if (active_disposition === 'DONATE') {
        if (!donate_recipient) {
          return res.status(422).json({ error: { code: 'RECIPIENT_REQUIRED', message: 'donate_recipient is required' } });
        }
        try {
          writeLedgerEntry({
            sku_id: mLine.sku_id,
            batch_id: mLine.batch_id,
            location_id: transfer.to_location_id || 'RGL-Z1-01',
            warehouse_id: manifest.warehouse_to_id || db.warehouses[1]?.id || db.warehouses[0]?.id || '',
            quantity: -qty_rejected,
            transaction_type: 'write_off',
            reference_id: transfer.id,
            reference_type: 'write_off',
            user_id: db.currentUser.id,
            notes: `Donated: ${donate_recipient}`
          });
        } catch (e) {
          console.error(e);
        }
      }

      if (active_disposition === 'MARKDOWN_SALE') {
        if (markdown_price_kes === undefined || markdown_price_kes === null) {
          return res.status(422).json({ error: { code: 'MARKDOWN_PRICE_REQUIRED', message: 'markdown_price_kes is required' } });
        }
      }

      rejectionLineObj = {
        id: 'REJ-' + Date.now() + '-' + Math.floor(Math.random()*1000),
        transfer_line_id,
        sku_id: mLine.sku_id,
        sku_name: mLine.sku_name,
        batch_id: mLine.batch_id,
        batch_number: mLine.batch_number,
        qty_manifested: mLine.qty_manifested,
        qty_received: mLine.qty_received,
        qty_rejected,
        rejection_reason,
        is_returnable: returnable,
        disposition: active_disposition,
        actual_sku_id: actual_sku_id || null,
        actual_sku_name: actual_sku_name || null,
        actual_batch_id,
        disposition_notes: disposition_notes || null,
        markdown_price_kes: markdown_price_kes ? parseFloat(markdown_price_kes) : null,
        donate_recipient: donate_recipient || null,
        write_off_id,
        recorded_by: db.currentUser.id,
        recorded_at: new Date().toISOString()
      };

      if (!transfer.rejection_lines) {
        transfer.rejection_lines = [];
      }
      transfer.rejection_lines.push(rejectionLineObj);
    }

    let qtyToReceiveInfp = mLine.qty_received;
    if (qtyToReceiveInfp > 0) {
      try {
        writeLedgerEntry({
          sku_id: mLine.sku_id,
          batch_id: mLine.batch_id,
          location_id: mLine.to_location_id || 'RGL-Z1-01',
          warehouse_id: manifest.warehouse_to_id || db.warehouses[1]?.id || db.warehouses[0]?.id || '',
          quantity: qtyToReceiveInfp,
          transaction_type: 'transfer_in',
          reference_id: transfer.id,
          reference_type: 'transfer',
          user_id: db.currentUser.id,
          notes: `${manifest.manifest_number} / ${transfer.replenishment_order_number}`
        });
      } catch (err) {
        console.error('Ledger write during replenishment receiving failed:', err);
      }
    }

    const reservation = db.stock_reservations.find(r => r.reference_id === transfer.id && r.batch_id === mLine.batch_id && r.status === 'active');
    if (reservation) {
      if (qty_received >= mLine.qty_manifested) {
        reservation.status = 'fulfilled';
      } else {
        reservation.qty_reserved = Math.max(0, reservation.qty_reserved - qty_received);
        if (reservation.qty_reserved <= 0) {
          reservation.status = 'fulfilled';
        }
      }
    }

    await saveState();
    res.json({
      data: mLine,
      rejection: rejectionLineObj,
      warning: warningText || undefined
    });
  });

  app.post('/api/v1/manifests/:id/close-fpo', async (req, res) => {
    const { transfer_id } = req.body;
    const manifest = db.loading_manifests.find(m => m.id === req.params.id);
    if (!manifest) return res.status(404).json({ error: { message: 'Manifest not found' } });

    const validRoles = ['receiver', 'ops_manager', 'admin'];
    if (!db.currentUser || !validRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (manifest.status !== 'receiving') {
      return res.status(422).json({ error: { code: 'NOT_IN_RECEIVING', message: 'Manifest is not in receiving state' } });
    }

    const tLines = manifest.lines.filter(l => l.transfer_id === transfer_id);
    const incomplete = tLines.some(l => !l.received);
    if (incomplete) {
      return res.status(422).json({ error: { code: 'RECEIVING_INCOMPLETE', message: 'All manifest lines for this transfer must be received first' } });
    }

    const transfer = db.transfers.find(t => t.id === transfer_id);
    if (!transfer) return res.status(404).json({ error: { message: 'Transfer not found' } });

    transfer.status = 'fp_closed';
    transfer.closure_report_sent_at = new Date().toISOString();

    db.stock_reservations
      .filter(r => r.reference_id === transfer_id && r.status === 'active')
      .forEach(r => r.status = 'cancelled');

    const rejections = transfer.rejection_lines || [];
    const reasonGroups = new Map<string, { reason: RejectionReason; line_count: number; qty_rejected: number; value_kes: number }>();
    
    rejections.forEach(r => {
      const existing = reasonGroups.get(r.rejection_reason);
      const sku = db.skus.find(s => s.id === r.sku_id);
      const value = r.qty_rejected * (sku?.cost_price_kes || 0);

      if (existing) {
        existing.line_count += 1;
        existing.qty_rejected += r.qty_rejected;
        existing.value_kes += value;
      } else {
        reasonGroups.set(r.rejection_reason, {
          reason: r.rejection_reason,
          line_count: 1,
          qty_rejected: r.qty_rejected,
          value_kes: value
        });
      }
    });

    const report: FPOClosureReport = {
      fpo_id: transfer.id,
      fpo_number: transfer.replenishment_order_number || '',
      manifest_number: manifest.manifest_number,
      closed_by: db.currentUser.id,
      closed_at: new Date().toISOString(),
      total_lines: tLines.length,
      fully_received_lines: tLines.filter(l => (l.qty_received || 0) >= l.qty_manifested).length,
      partially_received_lines: tLines.filter(l => (l.qty_received || 0) < l.qty_manifested && (l.qty_received || 0) > 0).length,
      rejected_lines: rejections.length,
      rejection_summary: Array.from(reasonGroups.values()),
      returning_to_source: rejections.filter(r => r.disposition === 'RETURN_TO_SOURCE'),
      written_off_at_fp: rejections.filter(r => r.disposition === 'WRITE_OFF_AT_FP'),
      markdown_at_fp: rejections.filter(r => r.disposition === 'MARKDOWN_SALE'),
      donated_at_fp: rejections.filter(r => r.disposition === 'DONATE'),
      accepted_wrong_product: rejections.filter(r => r.disposition === 'ACCEPT_AS_RECEIVED'),
      under_pick_discrepancy: rejections.some(r => r.rejection_reason === 'UNDER_PICKED'),
      under_pick_lines: rejections.filter(r => r.rejection_reason === 'UNDER_PICKED')
    };

    transfer.closure_report = report;

    if (report.under_pick_discrepancy) {
      createNotification(
        'REORDER_LEVEL_BREACHED',
        'Under-Pick Discrepancy Flagged',
        `Under-pick discrepancy detected on transfer closure of FPO '${transfer.replenishment_order_number}' at '${transfer.from_warehouse_id}'.`,
        'critical',
        { reference_id: transfer.id, reference_type: 'transfer', warehouse_id: transfer.from_warehouse_id }
      );
      transfer.under_pick_flagged_user = transfer.packed_by;
    }

    const allClosed = manifest.transfer_ids.every(id => {
      const trObj = db.transfers.find(t => t.id === id);
      return trObj?.status === 'fp_closed' || trObj?.status === 'completed';
    });

    if (allClosed) {
      manifest.status = 'closed';
    }

    await saveState();
    res.json({ data: report });
  });

  app.get('/api/v1/transfers/:id/closure-report', (req, res) => {
    const tr = db.transfers.find(t => t.id === req.params.id);
    if (!tr) return res.status(404).json({ error: 'Transfer not found' });
    res.json({ data: tr.closure_report || null, rejection_lines: tr.rejection_lines || [] });
  });

  app.post('/api/v1/transfers/:id/acknowledge-closure', async (req, res) => {
    const tr = db.transfers.find(t => t.id === req.params.id);
    if (!tr) return res.status(404).json({ error: 'Transfer not found' });

    if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    if (tr.status !== 'fp_closed') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'FPO must be closed at FP to acknowledge closure' } });
    }

    const rejections = tr.rejection_lines || [];
    const returnsToSource = rejections.filter(r => r.disposition === 'RETURN_TO_SOURCE');

    if (returnsToSource.length > 0) {
      const returnTrId = `TRF-RET-${Date.now().toString().slice(-4)}`;
      const returnTransfer: Transfer = {
        id: returnTrId,
        from_warehouse_id: tr.to_warehouse_id,
        to_warehouse_id: tr.from_warehouse_id,
        from_location_id: tr.to_location_id || 'RGL-Z1-01',
        to_location_id: tr.from_location_id || 'RGN-Z1-01',
        status: 'approved',
        requires_approval: false,
        created_by: db.currentUser.id,
        approved_by: 'SYSTEM',
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        completed_at: null,
        notes: `Auto-approved return from FPO ${tr.replenishment_order_number}`,
        transfer_scope: 'inter_site',
        rejection_lines: []
      };

      db.transfers.push(returnTransfer);

      returnsToSource.forEach(r => {
        db.transfer_lines.push({
          id: `TFL-${Math.floor(Math.random()*10000)}`,
          transfer_id: returnTrId,
          sku_id: r.sku_id,
          batch_id: r.batch_id,
          from_location_id: tr.to_location_id || 'RGL-Z1-01',
          to_location_id: tr.from_location_id || 'RGN-Z1-01',
          qty_requested: r.qty_rejected,
          qty_transferred: null
        });
      });
    }

    tr.status = 'completed';
    await saveState();
    res.json({ data: tr });
  });

  app.get('/api/v1/replenishment-rules', (req, res) => {
    let rules = [...db.replenishment_rules];
    if (req.query.warehouse_id) {
      rules = rules.filter(r => r.fulfilment_warehouse_id === req.query.warehouse_id);
    }

    const data = rules.map(rule => {
      const sku = db.skus.find(s => s.id === rule.sku_id);
      const wh = db.warehouses.find(w => w.id === rule.fulfilment_warehouse_id);
      return {
        ...rule,
        sku_name: sku?.name || 'Unknown SKU',
        sku_code: sku?.code || '',
        warehouse_name: wh?.name || 'Unknown Warehouse'
      };
    });
    res.json({ data });
  });

  app.post('/api/v1/replenishment-rules', async (req, res) => {
    if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const { sku_id, fulfilment_warehouse_id, par_level, reorder_qty } = req.body;
    const rule: ReplenishmentRule = {
      id: 'REP-' + Date.now(),
      sku_id,
      fulfilment_warehouse_id,
      par_level: parseFloat(par_level),
      reorder_qty: parseFloat(reorder_qty),
      is_active: true,
      created_by: db.currentUser.id,
      created_at: new Date().toISOString()
    };

    db.replenishment_rules.push(rule);
    await saveState();
    res.status(201).json({ data: rule });
  });

  app.patch('/api/v1/replenishment-rules/:id', async (req, res) => {
    if (!db.currentUser || (db.currentUser.role !== 'ops_manager' && db.currentUser.role !== 'admin')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const rule = db.replenishment_rules.find(r => r.id === req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    if (req.body.par_level !== undefined) rule.par_level = parseFloat(req.body.par_level);
    if (req.body.reorder_qty !== undefined) rule.reorder_qty = parseFloat(req.body.reorder_qty);
    if (req.body.is_active !== undefined) rule.is_active = !!req.body.is_active;

    await saveState();
    res.json({ data: rule });
  });

  app.delete('/api/v1/replenishment-rules/:id', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }

    db.replenishment_rules = db.replenishment_rules.filter(r => r.id !== req.params.id);
    await saveState();
    res.json({ success: true });
  });

  // ==========================================
  // --- A5. API KEYS MANAGEMENT ENDPOINTS ---
  // ==========================================
  
  app.post('/api/v1/admin/api-keys', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }

    const { name, scopes } = req.body;
    if (!name || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ error: 'Missing key descriptive name or scopes list' });
    }

    // Validate scope values
    const allowedScopes: APIKeyScope[] = [
      'orders:read',
      'orders:write',
      'inventory:read',
      'inventory:write',
      'ledger:read',
      'reports:read',
      'webhooks:manage',
      'admin'
    ];
    for (const s of scopes) {
      if (!allowedScopes.includes(s)) {
        return res.status(400).json({ error: `Invalid scope: ${s}. Allowed: ${allowedScopes.join(', ')}` });
      }
    }

    const { rawKey, keyHash } = generateAPIKey();
    const newKey: APIKey = {
      id: 'AK-' + Date.now().toString().slice(-6),
      name,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 8),
      scopes: scopes as APIKeyScope[],
      created_by: db.currentUser?.id || 'system',
      created_at: new Date().toISOString(),
      last_used_at: null,
      expires_at: null,
      is_active: true,
      usage_count: 0
    };

    if (!db.api_keys) db.api_keys = [];
    db.api_keys.push(newKey);
    await saveState();

    res.status(201).json({
      data: {
        id: newKey.id,
        name: newKey.name,
        scopes: newKey.scopes,
        raw_key: rawKey,
        is_active: newKey.is_active,
        created_at: newKey.created_at
      }
    });
  });

  app.get('/api/v1/admin/api-keys', (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    // Return keys safely (excluding hashes and raw keys)
    const sanitized = (db.api_keys || []).map(k => ({
      id: k.id,
      name: k.name,
      scopes: k.scopes,
      is_active: k.is_active,
      created_at: k.created_at,
      last_used_at: k.last_used_at
    }));
    res.json({ data: sanitized });
  });

  app.patch('/api/v1/admin/api-keys/:id', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    const key = (db.api_keys || []).find(k => k.id === req.params.id);
    if (!key) return res.status(404).json({ error: 'API Key not found' });

    if (req.body.is_active !== undefined) {
      key.is_active = !!req.body.is_active;
    }
    await saveState();
    res.json({ data: key });
  });

  app.delete('/api/v1/admin/api-keys/:id', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    db.api_keys = (db.api_keys || []).filter(k => k.id !== req.params.id);
    await saveState();
    res.json({ success: true });
  });

  // ===========================================
  // --- A5.2 NOTIFICATIONS & WEBHOOK LINKS ---
  // ===========================================

  app.get('/api/v1/notifications', (req, res) => {
    let list = db.notifications || [];
    if (req.query.trigger) {
      list = list.filter(n => n.trigger === req.query.trigger);
    }
    if (req.query.is_read !== undefined) {
      const isRead = req.query.is_read === 'true';
      list = list.filter(n => n.is_read === isRead);
    }
    res.json({ data: list });
  });

  app.post('/api/v1/notifications/:id/read', async (req, res) => {
    const notif = (db.notifications || []).find(n => n.id === req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    notif.is_read = true;
    notif.read_at = new Date().toISOString();
    notif.read_by = db.currentUser?.id || 'system';
    await saveState();
    res.json({ data: notif });
  });

  app.get('/api/v1/admin/webhook-deliveries', (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    res.json({ data: db.webhook_deliveries || [] });
  });

  app.post('/api/v1/admin/webhooks/:id/test', (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    const webhook = (db.notification_webhooks || []).find(w => w.id === req.params.id);
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const trigger = webhook.triggers[0] || 'EXPIRY_ALERT';
    const testNotif = createNotification(
      trigger,
      `Diagnostic Webhook Test: ${webhook.channel}`,
      `Self-asserting ping dispatched from FreshOps test deck to test webhook reliability.`,
      'info'
    );

    res.json({
      success: true,
      message: `Test event of trigger '${trigger}' simulated and webhooks fired.`,
      notification: testNotif
    });
  });

  // ==========================================
  // --- A6. PRICE MARKDOWNS AND APPROVALS ---
  // ==========================================

  app.get('/api/v1/admin/markdown-approvals', (req, res) => {
    res.json({ data: db.markdown_approvals || [] });
  });

  app.post('/api/v1/admin/markdown-approvals/:id/approve', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required to sign markdown' } });
    }
    const approval = (db.markdown_approvals || []).find(m => m.id === req.params.id);
    if (!approval) return res.status(404).json({ error: 'Markdown approval slip not found' });

    if (approval.raised_by && db.currentUser?.id === approval.raised_by) {
      return res.status(422).json({
        error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'You cannot approve a markdown you raised yourself. A different admin must approve it.' }
      });
    }

    approval.status = 'approved';
    approval.reviewed_by = db.currentUser.id;
    approval.reviewed_at = new Date().toISOString();
    approval.feedback = req.body.feedback || 'Approved by system administrator.';

    const wo = db.write_offs.find(w => w.id === approval.write_off_id);
    if (wo) {
      const lines = db.write_off_lines.filter(l => l.write_off_id === wo.id);
      try {
        // Commit ledger atomically
        lines.forEach(l => {
          writeLedgerEntry({
            sku_id: l.sku_id,
            batch_id: l.batch_id,
            location_id: l.location_id,
            warehouse_id: wo.warehouse_id,
            quantity: -l.qty,
            transaction_type: 'write_off',
            reference_id: wo.id,
            reference_type: 'write_off',
            user_id: db.currentUser?.id || 'U-ADMIN',
            notes: `Approved high-value markdown. Reason: ${l.reason}.`
          });

          const batch = db.batches.find(b => b.id === l.batch_id);
          if (batch) {
            batch.quantity_available = getStockForBatch(l.batch_id);
            if (batch.quantity_available <= 0) {
              batch.status = 'written_off';
            }
          }
        });

        wo.status = 'approved';
        wo.approved_by = db.currentUser.id;
        wo.approved_at = new Date().toISOString();
      } catch (err: any) {
        return res.status(422).json({ error: err });
      }
    }

    createNotification(
      'MARKDOWN_APPROVED',
      'Markdown Approved',
      `High-value write-off markdown for slip '${approval.write_off_id}' approved. Value KES: ${approval.total_value_kes}`,
      'info',
      { reference_id: approval.write_off_id, reference_type: 'write_off' }
    );

    try {
      checkBundleDeactivationCascades();
    } catch (cascadeErr) {
      console.error('Failed to run bundle deactivation cascades:', cascadeErr);
    }

    await saveState();
    res.json({ data: approval });
  });

  app.post('/api/v1/admin/markdown-approvals/:id/reject', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required to reject markdown' } });
    }
    const approval = (db.markdown_approvals || []).find(m => m.id === req.params.id);
    if (!approval) return res.status(404).json({ error: 'Markdown approval slip not found' });

    approval.status = 'rejected';
    approval.reviewed_by = db.currentUser.id;
    approval.reviewed_at = new Date().toISOString();
    approval.feedback = req.body.feedback || 'Rejected due to valuation or lack of physical evidence.';

    const wo = db.write_offs.find(w => w.id === approval.write_off_id);
    if (wo) {
      wo.status = 'rejected';
    }

    createNotification(
      'MARKDOWN_REJECTED',
      'Markdown Rejected',
      `High-value write-off markdown for slip '${approval.write_off_id}' rejected. Feedback: ${approval.feedback}`,
      'warning',
      { reference_id: approval.write_off_id, reference_type: 'write_off' }
    );

    await saveState();
    res.json({ data: approval });
  });

  // =========================================================================
  // --- SECTIONS 1 TO 5: CUSTOMER RETURNS, VENDOR CARDS, SKU PUBLICATION,
  // --- EOD CHECKS, ZONING ENFORCEMENT RULES
  // =========================================================================

  function nextReturnNumber(): string {
    db.return_counter = (db.return_counter || 0) + 1;
    return 'RET-' + String(db.return_counter).padStart(4, '0');
  }

  // --- SECTION 1: CUSTOMER RETURNS ENDPOINTS ---

  app.get('/api/v1/customer-returns', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let returns = [...(db.customer_returns || [])];
    if (req.query.status) {
      returns = returns.filter(r => r.status === req.query.status);
    }
    if (req.query.customer_id) {
      returns = returns.filter(r => r.customer_id === req.query.customer_id);
    }
    if (req.query.order_id) {
      returns = returns.filter(r => r.order_id === req.query.order_id);
    }
    if (req.query.from) {
      returns = returns.filter(r => r.raised_at >= (req.query.from as string));
    }
    if (req.query.to) {
      returns = returns.filter(r => r.raised_at <= (req.query.to as string));
    }

    // Enrich with customer_name
    returns = returns.map(r => {
      const cust = db.customers.find(c => c.id === r.customer_id);
      return {
        ...r,
        customer_name: cust ? cust.name : r.customer_name
      };
    });

    // Sort by raised_at DESC
    returns.sort((a, b) => new Date(b.raised_at).getTime() - new Date(a.raised_at).getTime());

    const paginated = returns.slice(offset, offset + limit);
    res.json({ data: paginated, meta: { total: returns.length, page, limit } });
  });

  app.get('/api/v1/customer-returns/:id', (req, res) => {
    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    const cust = db.customers.find(c => c.id === ret.customer_id);
    const enrichedLines = (ret.lines || []).map(line => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      const batch = db.batches.find(b => b.id === line.batch_id);
      return {
        ...line,
        sku_name: sku ? sku.name : line.sku_name,
        batch_number: batch ? batch.batch_number : line.batch_number
      };
    });

    res.json({
      data: {
        ...ret,
        customer_name: cust ? cust.name : ret.customer_name,
        lines: enrichedLines
      }
    });
  });

  app.post('/api/v1/customer-returns', async (req, res) => {
    const allowedRoles = ['ops_manager', 'admin', 'driver'];
    if (!db.currentUser || !allowedRoles.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const { order_id, delivery_id, customer_id, return_type, reason_summary, physical_collection_required, notes, lines } = req.body;

    const order = db.customer_orders.find(o => o.id === order_id);
    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    const delivery = db.deliveries.find(d => d.id === delivery_id);
    if (!delivery) {
      return res.status(404).json({ error: { code: 'DELIVERY_NOT_FOUND', message: 'Delivery not found' } });
    }

    for (const line of (lines || [])) {
      const batch = db.batches.find(b => b.id === line.batch_id);
      if (!batch) {
        return res.status(404).json({ error: { code: 'BATCH_NOT_FOUND', message: `Batch ${line.batch_id} not found` } });
      }
    }

    const now = new Date().toISOString();
    const customer = db.customers.find(c => c.id === customer_id);

    const enrichedLines = (lines || []).map((line: any, idx: number) => {
      const sku = db.skus.find(s => s.id === line.sku_id);
      const batch = db.batches.find(b => b.id === line.batch_id);
      return {
        id: `RETL-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        order_line_id: line.order_line_id,
        sku_id: line.sku_id,
        sku_name: sku ? sku.name : `SKU ${line.sku_id}`,
        batch_id: line.batch_id,
        batch_number: batch ? batch.batch_number : `BAT ${line.batch_id}`,
        qty_returned: line.qty_returned,
        reason: line.reason,
        temp_zone: sku ? sku.temp_zone : 'ambient',
        cold_chain_intact: null,
        disposition: null,
        restocked_to_location_id: null,
        write_off_id: null,
        credit_value_kes: line.credit_value_kes,
        inspected_by: null,
        inspected_at: null
      };
    });

    const total_credit_value_kes = (lines || []).reduce((sum: number, l: any) => sum + (l.credit_value_kes || 0), 0);

    const customerReturn = {
      id: `RET-${Date.now()}`,
      return_number: nextReturnNumber(),
      order_id,
      delivery_id,
      customer_id,
      customer_name: customer ? customer.name : 'Unknown Customer',
      return_type,
      status: 'raised',
      raised_by: db.currentUser?.id || 'system',
      raised_at: now,
      reason_summary,
      physical_collection_required: !!physical_collection_required,
      collection_driver_id: null,
      collection_scheduled_at: null,
      collected_at: null,
      collection_temp_celsius: null,
      received_at_warehouse_id: null,
      received_by: null,
      received_at: null,
      receipt_temp_celsius: null,
      total_credit_value_kes,
      credit_issued: false,
      credit_issued_at: null,
      closed_at: null,
      notes: notes || null,
      lines: enrichedLines
    };

    if (!db.customer_returns) db.customer_returns = [];
    db.customer_returns.unshift(customerReturn as any);
    await saveState();

    res.status(201).json({ data: customerReturn });
  });

  app.post('/api/v1/customer-returns/:id/schedule-collection', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status !== 'raised') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Return was already scheduled or processed.' } });
    }

    const { driver_id, scheduled_at } = req.body;
    ret.collection_driver_id = driver_id;
    ret.collection_scheduled_at = scheduled_at;
    ret.status = 'collection_scheduled';

    createNotification(
      'FPO_DISPATCHED',
      'Return collection scheduled',
      `Return ${ret.return_number} scheduled for collection on ${scheduled_at}.`,
      'info',
      { reference_id: ret.id, reference_type: 'customer_return' }
    );

    await saveState();
    res.json({ data: ret });
  });

  app.post('/api/v1/customer-returns/:id/confirm-collection', async (req, res) => {
    const allowed = ['driver', 'ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status !== 'collection_scheduled') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Return is not in collection_scheduled status' } });
    }

    const { collection_temp_celsius } = req.body;
    ret.collected_at = new Date().toISOString();
    ret.collection_temp_celsius = collection_temp_celsius != null ? parseFloat(collection_temp_celsius) : null;
    ret.status = 'in_transit_back';

    await saveState();
    res.json({ data: ret });
  });

  app.post('/api/v1/customer-returns/:id/receive', async (req, res) => {
    const allowed = ['receiver', 'ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status !== 'in_transit_back' && ret.status !== 'raised') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: `Status is not valid for receiving. Return status: ${ret.status}` } });
    }

    const { warehouse_id, receipt_temp_celsius, lines } = req.body;
    const now = new Date().toISOString();

    ret.received_at_warehouse_id = warehouse_id;
    ret.received_by = db.currentUser?.id || 'system';
    ret.received_at = now;
    ret.receipt_temp_celsius = receipt_temp_celsius != null ? parseFloat(receipt_temp_celsius) : null;

    (lines || []).forEach((reqLine: any) => {
      const l = (ret.lines || []).find((x: any) => x.id === reqLine.line_id);
      if (l) {
        l.cold_chain_intact = !!reqLine.cold_chain_intact;

        if (l.cold_chain_intact === false) {
          const sku = db.skus.find(s => s.id === l.sku_id);
          if (sku?.temp_zone === 'chilled' || sku?.temp_zone === 'frozen') {
            createNotification(
              'COLD_CHAIN_BREACH',
              'Cold chain broken on customer return',
              `Return ${ret.return_number}: ${l.sku_name} cold chain not intact on receipt. Cannot be restocked.`,
              'warning',
              { reference_id: ret.id, reference_type: 'customer_return', warehouse_id }
            );
          }
        }
      }
    });

    ret.status = 'received_at_warehouse';
    await saveState();
    res.json({ data: ret });
  });

  app.post('/api/v1/customer-returns/:id/inspect', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status !== 'received_at_warehouse') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Return must be received at warehouse to inspect' } });
    }

    const { lines } = req.body;
    const now = new Date().toISOString();

    for (const line of (lines || [])) {
      const retLine = (ret.lines || []).find((l: any) => l.id === line.line_id);
      if (!retLine) continue;

      const sku = db.skus.find(s => s.id === retLine.sku_id);
      const isColdSensitive = sku?.temp_zone === 'chilled' || sku?.temp_zone === 'frozen';
      if (retLine.cold_chain_intact === false && isColdSensitive) {
        if (line.disposition === 'RESTOCK') {
          return res.status(422).json({
            error: {
              code: 'COLD_CHAIN_COMPROMISED',
              message: `${retLine.sku_name} cold chain was not intact. Cannot restock temperature-sensitive items. Use WRITE_OFF or SUPPLIER_CLAIM instead.`
            }
          });
        }
      }

      if (line.disposition === 'RESTOCK') {
        if (!line.restocked_to_location_id) {
          return res.status(400).json({
            error: {
              code: 'LOCATION_REQUIRED',
              message: 'restocked_to_location_id required for RESTOCK disposition'
            }
          });
        }
        writeLedgerEntry({
          sku_id: retLine.sku_id,
          batch_id: retLine.batch_id,
          location_id: line.restocked_to_location_id,
          warehouse_id: ret.received_at_warehouse_id,
          quantity: retLine.qty_returned,
          transaction_type: 'return',
          reference_id: ret.id,
          reference_type: 'return',
          user_id: db.currentUser?.id || 'system',
          notes: 'Customer return restocked: ' + ret.return_number
        });
        retLine.restocked_to_location_id = line.restocked_to_location_id;
      }

      if (line.disposition === 'WRITE_OFF') {
        const woId = 'WO-RET-' + Date.now();
        const writeOff = {
          id: woId,
          warehouse_id: ret.received_at_warehouse_id,
          status: 'approved',
          created_by: db.currentUser?.id,
          approved_by: db.currentUser?.id,
          created_at: now,
          approved_at: now,
          total_value_kes: retLine.credit_value_kes,
          notes: 'Auto write-off from customer return: ' + ret.return_number,
          lines: [{
            id: woId + '-L1',
            write_off_id: woId,
            sku_id: retLine.sku_id,
            batch_id: retLine.batch_id,
            location_id: ret.received_at_warehouse_id,
            qty: retLine.qty_returned,
            reason: 'DAMAGED',
            value_kes: retLine.credit_value_kes,
            notes: 'Customer return write-off'
          }]
        };
        if (!db.write_offs) db.write_offs = [];
        db.write_offs.push(writeOff as any);

        // Pre-load return first to avoid INSUFFICIENT_STOCK
        writeLedgerEntry({
          sku_id: retLine.sku_id,
          batch_id: retLine.batch_id,
          location_id: ret.received_at_warehouse_id,
          warehouse_id: ret.received_at_warehouse_id,
          quantity: retLine.qty_returned,
          transaction_type: 'return',
          reference_id: ret.id,
          reference_type: 'return',
          user_id: db.currentUser?.id || 'system',
          notes: 'Pre-load returned stock for write-off'
        });

        writeLedgerEntry({
          sku_id: retLine.sku_id,
          batch_id: retLine.batch_id,
          location_id: ret.received_at_warehouse_id,
          warehouse_id: ret.received_at_warehouse_id,
          quantity: -retLine.qty_returned,
          transaction_type: 'write_off',
          reference_id: ret.id,
          reference_type: 'write_off',
          user_id: db.currentUser?.id || 'system',
          notes: 'Customer return write-off: ' + ret.return_number
        });
        retLine.write_off_id = woId;
      }

      retLine.disposition = line.disposition;
      retLine.inspected_by = db.currentUser?.id || 'system';
      retLine.inspected_at = now;
    }

    ret.status = 'inspected';
    await saveState();
    res.json({ data: ret });
  });

  app.post('/api/v1/customer-returns/:id/close', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status !== 'inspected') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Return must be inspected first' } });
    }

    const incomplete = (ret.lines || []).some((l: any) => !l.disposition);
    if (incomplete) {
      return res.status(422).json({ error: { code: 'INSPECTION_INCOMPLETE', message: 'All lines must be inspected with a selected disposition.' } });
    }

    ret.status = 'closed';
    ret.closed_at = new Date().toISOString();
    await saveState();
    res.json({ data: ret });
  });

  app.post('/api/v1/customer-returns/:id/issue-credit', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const ret = db.customer_returns.find(r => r.id === req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (ret.status === 'raised' || ret.status === 'collection_scheduled') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'Credit cannot be issued in the current status.' } });
    }

    ret.credit_issued = true;
    ret.credit_issued_at = new Date().toISOString();

    createNotification(
      'WRITE_OFF_HIGH_VALUE',
      'Customer credit issued',
      `Credit of KES ${(ret.total_credit_value_kes / 100).toFixed(2)} issued for return ${ret.return_number} to ${ret.customer_name}.`,
      'info',
      { reference_id: ret.id, reference_type: 'customer_return' }
    );

    await saveState();
    res.json({ data: ret });
  });

  // --- SECTION 2: VENDOR CARD ENDPOINTS ---

  app.get('/api/v1/vendor-cards', (req, res) => {
    let cards = [...(db.vendor_cards || [])];
    if (req.query.sku_id) {
      cards = cards.filter(c => c.sku_id === req.query.sku_id);
    }
    if (req.query.supplier_id) {
      cards = cards.filter(c => c.supplier_id === req.query.supplier_id);
    }
    if (req.query.is_preferred !== undefined) {
      const pref = req.query.is_preferred === 'true';
      cards = cards.filter(c => c.is_preferred === pref);
    }
    if (req.query.is_active !== undefined) {
      const active = req.query.is_active === 'true';
      cards = cards.filter(c => c.is_active === active);
    }

    const enriched = cards.map(vc => {
      const sku = db.skus.find(s => s.id === vc.sku_id);
      const supplier = db.suppliers.find(s => s.id === vc.supplier_id);
      return {
        ...vc,
        sku_name: sku ? sku.name : null,
        supplier_name: supplier ? supplier.name : null
      };
    });

    enriched.sort((a, b) => {
      if (a.is_preferred && !b.is_preferred) return -1;
      if (!a.is_preferred && b.is_preferred) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json({ data: enriched });
  });

  app.get('/api/v1/vendor-cards/:id', (req, res) => {
    const vc = (db.vendor_cards || []).find(c => c.id === req.params.id);
    if (!vc) return res.status(404).json({ error: 'Vendor card not found' });

    const sku = db.skus.find(s => s.id === vc.sku_id);
    const supplier = db.suppliers.find(s => s.id === vc.supplier_id);

    res.json({
      data: {
        ...vc,
        sku_name: sku ? sku.name : null,
        supplier_name: supplier ? supplier.name : null
      }
    });
  });

  app.post('/api/v1/vendor-cards', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const {
      sku_id, supplier_id, supplier_sku_code, supplier_unit,
      units_per_supplier_unit, moq, lead_time_days,
      price_kes, is_preferred, notes
    } = req.body;

    const sku = db.skus.find(s => s.id === sku_id);
    if (!sku || sku.is_active === false) {
      return res.status(404).json({ error: { code: 'SKU_NOT_FOUND', message: 'Active SKU not found' } });
    }

    const supplier = db.suppliers.find(s => s.id === supplier_id);
    if (!supplier) {
      return res.status(404).json({ error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' } });
    }

    if (sku.is_bundle) {
      return res.status(422).json({ error: { code: 'CANNOT_ADD_VENDOR_CARD_TO_BUNDLE', message: 'Cannot add vendor card to a bundle' } });
    }

    const prefVal = !!is_preferred;

    if (prefVal) {
      (db.vendor_cards || []).forEach(v => {
        if (v.sku_id === sku_id) {
          v.is_preferred = false;
        }
      });
    }

    const newCard = {
      id: 'VC-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sku_id,
      supplier_id,
      supplier_sku_code,
      supplier_unit,
      units_per_supplier_unit: parseInt(units_per_supplier_unit) || 1,
      moq: parseInt(moq) || 1,
      lead_time_days: parseInt(lead_time_days) || 1,
      price_kes: parseInt(price_kes) || 0,
      is_preferred: prefVal,
      is_active: true,
      notes: notes || null,
      created_by: db.currentUser?.id || 'system',
      created_at: new Date().toISOString()
    };

    if (!db.vendor_cards) db.vendor_cards = [];
    db.vendor_cards.push(newCard);

    sku.readiness_pct = computeReadinessPct(sku, db.categories);

    await saveState();
    res.status(201).json({ data: newCard });
  });

  app.patch('/api/v1/vendor-cards/:id', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const card = (db.vendor_cards || []).find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ error: 'Vendor card not found' });

    const fields = [
      'supplier_sku_code', 'supplier_unit', 'units_per_supplier_unit',
      'moq', 'lead_time_days', 'price_kes', 'is_preferred', 'notes', 'is_active'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'is_preferred') {
          const prefVal = !!req.body.is_preferred;
          card.is_preferred = prefVal;
          if (prefVal) {
            (db.vendor_cards || []).forEach(v => {
              if (v.sku_id === card.sku_id && v.id !== card.id) {
                v.is_preferred = false;
              }
            });
          }
        } else if (['units_per_supplier_unit', 'moq', 'lead_time_days', 'price_kes'].includes(f)) {
          (card as any)[f] = parseInt(req.body[f]) || 0;
        } else if (f === 'is_active') {
          card.is_active = !!req.body.is_active;
        } else {
          (card as any)[f] = req.body[f];
        }
      }
    });

    const sku = db.skus.find(s => s.id === card.sku_id);
    if (sku) {
      sku.readiness_pct = computeReadinessPct(sku, db.categories);
    }

    await saveState();
    res.json({ data: card });
  });

  app.delete('/api/v1/vendor-cards/:id', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }

    const card = (db.vendor_cards || []).find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ error: 'Vendor card not found' });

    card.is_active = false;

    const sku = db.skus.find(s => s.id === card.sku_id);
    if (sku) {
      sku.readiness_pct = computeReadinessPct(sku, db.categories);
    }

    await saveState();
    res.json({ success: true, data: card });
  });

  // --- SECTION 3: SKU PUBLICATION ENDPOINTS ---

  app.post('/api/v1/skus/:id/publish', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) return res.status(404).json({ error: 'SKU not found' });

    const { ok, missing } = canPublish(sku);
    if (!ok) {
      return res.status(422).json({
        error: {
          code: 'PUBLISH_REQUIREMENTS_NOT_MET',
          message: 'Product cannot be published. Missing: ' + missing.join(', '),
          missing
        }
      });
    }

    sku.publication_status = 'published';
    sku.published_at = new Date().toISOString();
    sku.published_by = db.currentUser?.id || 'system';
    sku.readiness_pct = computeReadinessPct(sku, db.categories);

    await saveState();
    res.json({ data: sku });
  });

  app.post('/api/v1/skus/:id/unpublish', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) return res.status(404).json({ error: 'SKU not found' });

    const openOrderIds = (db.customer_orders || [])
      .filter(o => ['received', 'picking', 'packed', 'dispatched'].includes(o.status))
      .map(o => o.id);

    const openOrdersCount = (db.customer_order_lines || []).filter(ol =>
      openOrderIds.includes(ol.order_id) && ol.sku_id === sku.id
    ).length;

    sku.publication_status = 'draft';
    sku.published_at = null;
    sku.published_by = null;

    const warnings = openOrdersCount > 0
      ? [`${openOrdersCount} open order(s) contain this product`]
      : [];

    await saveState();
    res.json({ data: sku, warnings });
  });

  app.post('/api/v1/skus/:id/archive', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }

    const sku = db.skus.find(s => s.id === req.params.id);
    if (!sku) return res.status(404).json({ error: 'SKU not found' });

    const totalStock = (db.batches || [])
      .filter(b => b.sku_id === sku.id && b.status === 'active')
      .reduce((sum, b) => sum + (b.quantity_available || 0), 0);

    if (totalStock > 0) {
      return res.status(422).json({
        error: {
          code: 'SKU_HAS_ACTIVE_STOCK',
          message: `Cannot archive: ${totalStock} units still in stock. Write off or sell through all stock first.`
        }
      });
    }

    sku.publication_status = 'archived';
    sku.is_active = false;

    await saveState();
    res.json({ data: sku });
  });

  // --- SECTION 4: EOD CHECK ENDPOINTS ---

  app.get('/api/v1/eod-checks', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let checks = [...(db.cross_dock_eod_checks || [])];
    if (req.query.warehouse_id) {
      checks = checks.filter(c => c.warehouse_id === req.query.warehouse_id);
    }
    if (req.query.status) {
      checks = checks.filter(c => c.status === req.query.status);
    }
    if (req.query.check_date) {
      checks = checks.filter(c => c.check_date === req.query.check_date);
    }

    checks.sort((a, b) => new Date(b.check_date).getTime() - new Date(a.check_date).getTime());

    const paginated = checks.slice(offset, offset + limit);
    res.json({ data: paginated, meta: { total: checks.length, page, limit } });
  });

  app.get('/api/v1/eod-checks/:id', (req, res) => {
    const check = (db.cross_dock_eod_checks || []).find(c => c.id === req.params.id);
    if (!check) return res.status(404).json({ error: 'EOD check not found' });

    const enrichedLines = (check.lines || []).map((l: any) => {
      const sku = db.skus.find(s => s.id === l.sku_id);
      return {
        ...l,
        sku_name: sku ? sku.name : l.sku_name
      };
    });

    res.json({
      data: {
        ...check,
        lines: enrichedLines
      }
    });
  });

  app.post('/api/v1/eod-checks', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const { warehouse_id, check_date } = req.body;
    const checkDate = check_date || new Date().toISOString().slice(0, 10);

    const crossDockLocs = (db.locations || []).filter(l =>
      l.warehouse_id === warehouse_id && l.is_cross_dock
    );
    if (crossDockLocs.length === 0) {
      return res.status(422).json({
        error: {
          code: 'NO_CROSS_DOCK_LOCATIONS',
          message: 'No cross-dock locations found in this warehouse.'
        }
      });
    }

    const todayStart = checkDate + 'T00:00:00.000Z';
    const lines: any[] = [];

    crossDockLocs.forEach(loc => {
      const batchesAtLoc = new Map<string, number>();
      (db.stock_ledger || [])
        .filter(e => e.location_id === loc.id)
        .forEach(e => {
          batchesAtLoc.set(e.batch_id, (batchesAtLoc.get(e.batch_id) || 0) + e.quantity);
        });

      batchesAtLoc.forEach((qty, batchId) => {
        if (qty <= 0) return;
        const batch = db.batches.find(b => b.id === batchId);
        if (!batch || batch.status !== 'active') return;
        const sku = db.skus.find(s => s.id === batch.sku_id);

        const transferred = (db.stock_ledger || [])
          .filter(e =>
            e.location_id === loc.id &&
            e.batch_id === batchId &&
            e.transaction_type === 'transfer_in' &&
            e.timestamp >= todayStart
          )
          .reduce((sum, e) => sum + e.quantity, 0);

        const sold = Math.abs((db.stock_ledger || [])
          .filter(e =>
            e.location_id === loc.id &&
            e.batch_id === batchId &&
            e.transaction_type === 'pick' &&
            e.timestamp >= todayStart
          )
          .reduce((sum, e) => sum + e.quantity, 0));

        lines.push({
          id: 'EODL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          location_id: loc.id,
          location_code: loc.code,
          sku_id: batch.sku_id,
          sku_name: sku?.name || batch.sku_id,
          batch_id: batchId,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          qty_transferred_in: transferred,
          qty_sold: sold,
          qty_remaining: qty,
          resolution: qty === 0 ? 'ZERO' : null,
          carry_forward_reason: null,
          write_off_id: null
        });
      });
    });

    const check = {
      id: 'EOD-' + Date.now(),
      warehouse_id,
      check_date: checkDate,
      initiated_by: db.currentUser?.id || 'system',
      completed_at: null,
      status: 'pending',
      lines,
      sellthrough_rate_pct: null,
      total_transferred_kes: lines.reduce((sum, l) => {
        const sku = db.skus.find(s => s.id === l.sku_id);
        return sum + (l.qty_transferred_in * (sku?.cost_price_kes || 0));
      }, 0),
      total_sold_kes: 0,
      total_carried_forward_kes: 0,
      total_written_off_kes: 0
    };

    if (!db.cross_dock_eod_checks) db.cross_dock_eod_checks = [];
    db.cross_dock_eod_checks.unshift(check as any);
    await saveState();
    res.status(201).json({ data: check });
  });

  app.post('/api/v1/eod-checks/:id/resolve-line', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const check = (db.cross_dock_eod_checks || []).find(c => c.id === req.params.id);
    if (!check) return res.status(404).json({ error: 'EOD check not found' });

    if (check.status !== 'pending') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'EOD Check is not pending' } });
    }

    const { line_id, resolution, carry_forward_reason } = req.body;
    const line = (check.lines || []).find((l: any) => l.id === line_id);
    if (!line) {
      return res.status(404).json({ error: { code: 'LINE_NOT_FOUND', message: 'EOD Check line not found' } });
    }

    if (line.qty_remaining === 0) {
      line.resolution = 'ZERO';
      await saveState();
      return res.json({ data: line });
    }

    if (resolution === 'CARRY_FORWARD') {
      if (!carry_forward_reason) {
        return res.status(400).json({ error: { code: 'REASON_REQUIRED', message: 'carry_forward_reason is mandatory' } });
      }
      line.resolution = 'CARRY_FORWARD';
      line.carry_forward_reason = carry_forward_reason;
    } else if (resolution === 'WRITE_OFF') {
      const sku = db.skus.find(s => s.id === line.sku_id);
      const valKes = line.qty_remaining * (sku?.cost_price_kes || 0);

      const woId = 'WO-EOD-' + Date.now();
      const writeOff = {
        id: woId,
        warehouse_id: check.warehouse_id,
        status: 'approved',
        created_by: db.currentUser?.id,
        approved_by: db.currentUser?.id,
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        total_value_kes: valKes,
        notes: 'EOD cross-dock write-off: ' + check.id,
        lines: [{
          id: woId + '-L1',
          write_off_id: woId,
          sku_id: line.sku_id,
          batch_id: line.batch_id,
          location_id: line.location_id,
          qty: line.qty_remaining,
          reason: 'EXPIRED',
          value_kes: valKes,
          notes: 'Cross-dock EOD write-off'
        }]
      };

      if (!db.write_offs) db.write_offs = [];
      db.write_offs.push(writeOff as any);

      writeLedgerEntry({
        sku_id: line.sku_id,
        batch_id: line.batch_id,
        location_id: line.location_id,
        warehouse_id: check.warehouse_id,
        quantity: -line.qty_remaining,
        transaction_type: 'write_off',
        reference_id: check.id,
        reference_type: 'write_off',
        user_id: db.currentUser?.id || 'system',
        notes: 'EOD cross-dock write-off'
      });

      line.write_off_id = woId;
      line.resolution = 'WRITE_OFF';
    }

    await saveState();
    res.json({ data: line });
  });

  app.post('/api/v1/eod-checks/:id/complete', (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const check = (db.cross_dock_eod_checks || []).find(c => c.id === req.params.id);
    if (!check) return res.status(404).json({ error: 'EOD check not found' });

    if (check.status !== 'pending') {
      return res.status(422).json({ error: { code: 'INVALID_STATUS', message: 'EOD check is not pending' } });
    }

    const pending = check.lines.filter(l => !l.resolution);
    if (pending.length > 0) {
      return res.status(422).json({
        error: {
          code: 'EOD_LINES_PENDING',
          message: `${pending.length} line(s) still need a resolution.`
        }
      });
    }

    check.lines.forEach(l => {
      if (l.qty_remaining === 0 && !l.resolution) l.resolution = 'ZERO';
    });

    const totalTransferred = check.lines.reduce((s, l) => s + l.qty_transferred_in, 0);
    const totalSold = check.lines.reduce((s, l) => s + l.qty_sold, 0);
    check.sellthrough_rate_pct = totalTransferred > 0
      ? Math.round((totalSold / totalTransferred) * 100)
      : 0;

    check.total_sold_kes = check.lines.reduce((s, l) => {
      const sku = db.skus.find(sk => sk.id === l.sku_id);
      return s + (l.qty_sold * (sku?.cost_price_kes || 0));
    }, 0);

    check.total_carried_forward_kes = check.lines
      .filter(l => l.resolution === 'CARRY_FORWARD')
      .reduce((s, l) => {
        const sku = db.skus.find(sk => sk.id === l.sku_id);
        return s + (l.qty_remaining * (sku?.cost_price_kes || 0));
      }, 0);

    check.total_written_off_kes = check.lines
      .filter(l => l.resolution === 'WRITE_OFF')
      .reduce((s, l) => {
        const sku = db.skus.find(sk => sk.id === l.sku_id);
        return s + (l.qty_remaining * (sku?.cost_price_kes || 0));
      }, 0);

    check.status = 'completed';
    check.completed_at = new Date().toISOString();

    if (check.sellthrough_rate_pct < 70) {
      createNotification(
        'OVERSTOCKED_SKU',
        'Low FP sellthrough rate',
        `EOD check at ${check.warehouse_id}: sellthrough rate ${check.sellthrough_rate_pct}% — consider reducing tomorrow's replenishment transfer.`,
        'warning',
        { reference_id: check.id, reference_type: 'eod_check', warehouse_id: check.warehouse_id }
      );
    }

    logAudit(
      'EOD_CHECK_COMPLETED',
      'CrossDockEODCheck',
      check.id,
      `Completed cross-dock End-Of-Day check ${check.id} at warehouse ${check.warehouse_id} with sell-through rate of ${check.sellthrough_rate_pct}%`,
      { sellthrough_rate_pct: check.sellthrough_rate_pct, warehouse_id: check.warehouse_id }
    );
    res.json({ data: check });
  });

  app.get('/api/v1/reports/sellthrough', (req, res) => {
    let checks = (db.cross_dock_eod_checks || []).filter(c => c.status === 'completed');

    if (req.query.warehouse_id) {
       checks = checks.filter(c => c.warehouse_id === req.query.warehouse_id);
    }
    if (req.query.from) {
       checks = checks.filter(c => c.check_date >= (req.query.from as string));
    }
    if (req.query.to) {
       checks = checks.filter(c => c.check_date <= (req.query.to as string));
    }

    const mapped = checks.map(c => ({
      check_date: c.check_date,
      warehouse_id: c.warehouse_id,
      sellthrough_rate_pct: c.sellthrough_rate_pct,
      total_transferred_kes: c.total_transferred_kes,
      total_sold_kes: c.total_sold_kes,
      total_carried_forward_kes: c.total_carried_forward_kes,
      total_written_off_kes: c.total_written_off_kes
    }));

    mapped.sort((a, b) => new Date(b.check_date).getTime() - new Date(a.check_date).getTime());

    res.json({ data: mapped });
  });

  // --- SECTION 5: ZONING RULES ENDPOINTS ---

  app.get('/api/v1/zoning-rules', (req, res) => {
    let rules = db.zoning_separation_rules || [];
    if (req.query.warehouse_id) {
      rules = rules.filter(r => r.warehouse_id === req.query.warehouse_id);
    }
    res.json({ data: rules });
  });

  app.post('/api/v1/zoning-rules', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const { warehouse_id, rule_type, class_a, class_b, require_different_zones, minimum_distance_m, notes } = req.body;

    const newRule = {
      id: 'RULE-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      warehouse_id,
      rule_type,
      class_a,
      class_b,
      require_different_zones: !!require_different_zones,
      minimum_distance_m: minimum_distance_m ? parseFloat(minimum_distance_m) : null,
      notes: notes || null,
      created_by: db.currentUser?.id || 'system',
      created_at: new Date().toISOString()
    };

    if (!db.zoning_separation_rules) db.zoning_separation_rules = [];
    db.zoning_separation_rules.push(newRule as any);

    await saveState();
    res.status(201).json({ data: newRule });
  });

  app.delete('/api/v1/zoning-rules/:id', async (req, res) => {
    if (!db.currentUser || db.currentUser.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }

    const index = (db.zoning_separation_rules || []).findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Zoning rule not found' });

    const deleted = db.zoning_separation_rules.splice(index, 1)[0];
    await saveState();
    res.json({ success: true, data: deleted });
  });

  app.patch('/api/v1/zones/:id', async (req, res) => {
    const allowed = ['ops_manager', 'admin'];
    if (!db.currentUser || !allowed.includes(db.currentUser.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const zone = db.zones.find(z => z.id === req.params.id);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const { permitted_product_classes, is_quarantine_zone, max_capacity_kg } = req.body;
    const warnings: string[] = [];

    if (permitted_product_classes && Array.isArray(permitted_product_classes)) {
      zone.permitted_product_classes = permitted_product_classes;

      const locIds = (db.locations || []).filter(l => l.zone_id === zone.id).map(l => l.id);
      const stockLedgerEntries = (db.stock_ledger || []).filter(e => locIds.includes(e.location_id));

      const batchIdsInLocs = Array.from(new Set(stockLedgerEntries.map(e => e.batch_id)));
      for (const bId of batchIdsInLocs) {
        const qty = stockLedgerEntries.filter(e => e.batch_id === bId).reduce((sum, e) => sum + e.quantity, 0);
        if (qty > 0) {
          const batch = db.batches.find(b => b.id === bId);
          if (batch) {
            const productClass = getEffectiveProductClass(batch.sku_id);
            if (productClass && !permitted_product_classes.includes(productClass as ProductClass)) {
              const sku = db.skus.find(s => s.id === batch.sku_id);
              warnings.push(
                `Suboptimal layout: SKU ${sku?.name || batch.sku_id} (${productClass}) is currently stored in zone ${zone.name}, which now permits only: ${permitted_product_classes.join(', ')}.`
              );
            }
          }
        }
      }
    }

    if (is_quarantine_zone !== undefined) {
      zone.is_quarantine_zone = !!is_quarantine_zone;
    }

    if (max_capacity_kg !== undefined) {
      zone.max_capacity_kg = max_capacity_kg;
    }

    await saveState();
    res.json({ data: zone, warnings: warnings.length > 0 ? warnings : undefined });
  });

  app.get('/api/v1/audit-logs', (req, res) => {
    res.json({ success: true, data: db.audit_logs || [] });
  });

  // ==========================================
  // --- A8. SYSTEM AND SSE EVENT STREAM -----
  // ==========================================

  app.get('/api/v1/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ status: 'connected', tenant: db.tenant_id })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.get('/api/v1/admin/config', (req, res) => {
    res.json({
      platform_name: CONFIG.PLATFORM_NAME,
      tenant_name: CONFIG.TENANT_NAME,
      tenant_id: db.tenant_id,
      setup_complete: db.setup_complete,
      notification_thresholds: {
        expiry_alert_days: CONFIG.EXPIRY_ALERT_DAYS_DEFAULT,
        delivery_late_hours: CONFIG.DELIVERY_LATE_HOURS,
        write_off_high_value_kes: CONFIG.WRITE_OFF_HIGH_VALUE_KES
      }
    });
  });

  // Serve full schema definition JSON at openapi.json
  app.get('/api/v1/openapi.json', (req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'FreshOpsPlatform API',
        version: '1.0.0',
        description: 'Modern developer hub and cold chain logistics integration API.'
      },
      servers: [
        { url: '/api/v1/v1', description: 'FreshOps v1 Endpoint Base' }
      ],
      paths: {
        '/notifications': {
          get: {
            summary: 'List system notifications',
            parameters: [
              { name: 'trigger', in: 'query', schema: { type: 'string' } },
              { name: 'is_read', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'Succesful query' } }
          }
        },
        '/notifications/{id}/read': {
          post: {
            summary: 'Mark alert notification read',
            responses: { 200: { description: 'Updated state' } }
          }
        },
        '/admin/api-keys': {
          get: { summary: 'List generated keys (Admin only)' },
          post: {
            summary: 'Generate a new API Key (Admin only)',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name', 'scopes'],
                    properties: {
                      name: { type: 'string' },
                      scopes: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        },
        '/admin/markdown-approvals': {
          get: { summary: 'List high value markdown approval slips' }
        },
        '/admin/webhook-deliveries': {
          get: { summary: 'Inspect webhook response delivery history logs' }
        },
        '/events': {
          get: { summary: 'Real-time Server Sent Events notifications stream' }
        }
      }
    });
  });

  // --- COMPATIBILITY SHIM MIDDLEWARE ---
  // Legacy /api/* → /api/v1/* redirect
  app.use('/api', (req: any, res: any, next: any) => {
    if (!req.path.startsWith('/v1/')) {
      req.url = '/v1' + req.url;
      return (app as any)._router.handle(req, res, next);
    }
    next();
  });

  // --- END OF TRANSFER LOGISTICS ENDPOINTS ---

  // Reset or run tests inside backend mock state for UI animations!
  app.post('/api/v1/tests/run', async (req, res) => {
    const suiteResults = await runBrtTestSuite(db);
    res.json({ data: suiteResults });
  });

  app.post('/api/v1/state/reset', async (req, res) => {
    await resetState();
    res.json({ success: true, message: 'Database reset to default seed data successfully!' });
  });

  // Serve app using Vite in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FreshOps WMS full-stack server running on http://localhost:${PORT}`);
    
    // Warm startup check & recurring scheduled trigger boot
    try {
      runScheduledNotificationChecks();
      setInterval(runScheduledNotificationChecks, CONFIG.SCHEDULED_CHECK_INTERVAL_MS);
      console.log(`Notification scheduler launched on ${CONFIG.SCHEDULED_CHECK_INTERVAL_MS}ms intervals.`);
    } catch (err) {
      console.error('Failed to register notification scheduler:', err);
    }
  });
}

// Help naming batches with direct codes representation
function skuShortName(skuId: string): string {
  if (skuId.includes('MILK')) return 'MILK';
  if (skuId.includes('CHICK')) return 'CHICK';
  if (skuId.includes('AVO')) return 'AVO';
  if (skuId.includes('RICE')) return 'RICE';
  if (skuId.includes('BURGER')) return 'BURGER';
  return 'GEN';
}

function nextFPONumber(): string {
  db.replenishment_order_counter = (db.replenishment_order_counter || 0) + 1;
  const numStr = String(db.replenishment_order_counter).padStart(4, '0');
  return `FPO-${numStr}`;
}

function nextManifestNumber(type: 'delivery' | 'replenishment'): string {
  if (type === 'delivery') {
    db.manifest_counter_delivery = (db.manifest_counter_delivery || 0) + 1;
    const numStr = String(db.manifest_counter_delivery).padStart(4, '0');
    return `MAN-DLV-${numStr}`;
  } else {
    db.manifest_counter_transfer = (db.manifest_counter_transfer || 0) + 1;
    const numStr = String(db.manifest_counter_transfer).padStart(4, '0');
    return `MAN-REP-${numStr}`;
  }
}

startServer();
