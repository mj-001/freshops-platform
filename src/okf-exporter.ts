// OKF v0.1 digital-twin exporter for FreshOpsPlatform.
// Run with: npm run okf:export
//
// Environment variables:
//   DATABASE_ADAPTER=json|firestore  (default: json)
//   DATABASE_URL=<firebase-project-id>  (firestore mode only)
//   GOOGLE_APPLICATION_CREDENTIALS=<path>  (firestore mode only)
//   FIRESTORE_EMULATOR_HOST=localhost:8080  (emulator mode)
//   DB_FILE=./state.json  (json mode, default: ./state.json)
//   GCS_BUCKET=<bucket-name>  (optional: upload bundle to GCS)
//   GCS_PREFIX=okf/  (optional: GCS path prefix, default: okf/)
//   GITHUB_REPO_URL=<https-or-ssh-url>  (optional: push to Git repo)
//   GIT_USER_NAME=<name>  (optional, for git commit identity)
//   GIT_USER_EMAIL=<email>  (optional, for git commit identity)
//   GIT_WORK_DIR=/tmp/freshops-twin  (optional: local clone path)
//   OKF_OUT_DIR=./okf-output  (optional: local output directory)

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OKFFile {
  relativePath: string;   // e.g. "physical/warehouses/WH-001.md"
  content: string;
}

interface ExportState {
  warehouses: any[];
  zones: any[];
  bin_locations: any[];
  skus: any[];
  categories: any[];
  suppliers: any[];
  batches: any[];
  stock_ledger: any[];
  write_offs: any[];
  write_off_lines: any[];
  pick_lists: any[];
  pick_list_lines: any[];
  cycle_counts: any[];
  cycle_count_lines: any[];
  setup_config: any;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[okf-exporter] Starting OKF v0.1 export...');

  const state = await loadState();
  const files = buildBundle(state);

  const outDir = process.env.OKF_OUT_DIR
    ? path.resolve(process.env.OKF_OUT_DIR)
    : path.join(process.cwd(), 'okf-output');

  writeFilesToDisk(files, outDir);
  console.log(`[okf-exporter] Wrote ${files.length} files to ${outDir}`);

  if (process.env.GCS_BUCKET) {
    await uploadToCloudStorage(files, process.env.GCS_BUCKET);
  }

  if (process.env.GITHUB_REPO_URL) {
    await pushToGit(outDir);
  }

  console.log('[okf-exporter] Done.');
}

// ---------------------------------------------------------------------------
// State loading
// ---------------------------------------------------------------------------

async function loadState(): Promise<ExportState> {
  const adapter = process.env.DATABASE_ADAPTER || 'json';
  if (adapter === 'firestore') {
    return loadFromFirestore();
  }
  return loadFromJsonFile();
}

async function loadFromFirestore(): Promise<ExportState> {
  const { initializeApp, getApps, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    const projectId = process.env.DATABASE_URL;
    if (!projectId) throw new Error('[okf-exporter] DATABASE_URL must be set for Firestore mode.');

    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
    if (emulatorHost) {
      console.log(`[okf-exporter] Using Firestore emulator at ${emulatorHost}`);
      initializeApp({ projectId });
    } else {
      initializeApp({ credential: applicationDefault(), projectId });
    }
  }

  const db = getFirestore();

  const collectionNames: (keyof ExportState)[] = [
    'warehouses', 'zones', 'bin_locations', 'skus', 'categories', 'suppliers',
    'batches', 'stock_ledger', 'write_offs', 'write_off_lines',
    'pick_lists', 'pick_list_lines', 'cycle_counts', 'cycle_count_lines',
  ];

  const state: Partial<ExportState> = {};

  await Promise.all(
    collectionNames.map(async (col) => {
      const snap = await db.collection(col as string).get();
      (state as any)[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    })
  );

  // setup_config stored as single doc in _config/setup_config
  const cfgSnap = await db.collection('_config').doc('setup_config').get();
  state.setup_config = cfgSnap.exists ? cfgSnap.data() : null;

  console.log(`[okf-exporter] Loaded state from Firestore (${state.warehouses?.length ?? 0} warehouses, ${state.skus?.length ?? 0} SKUs)`);
  return state as ExportState;
}

function loadFromJsonFile(): ExportState {
  const jsonPath = process.env.DB_FILE || path.join(process.cwd(), 'state.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('[okf-exporter] state.json not found — using empty state');
    return emptyState();
  }
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const s: ExportState = {
    warehouses:      raw.warehouses      || [],
    zones:           raw.zones           || [],
    bin_locations:   raw.bin_locations   || [],
    skus:            raw.skus            || [],
    categories:      raw.categories      || [],
    suppliers:       raw.suppliers       || [],
    batches:         raw.batches         || [],
    stock_ledger:    raw.stock_ledger    || [],
    write_offs:      raw.write_offs      || [],
    write_off_lines: raw.write_off_lines || [],
    pick_lists:      raw.pick_lists      || [],
    pick_list_lines: raw.pick_list_lines || [],
    cycle_counts:    raw.cycle_counts    || [],
    cycle_count_lines: raw.cycle_count_lines || [],
    setup_config:    raw.setup_config    || null,
  };
  console.log(`[okf-exporter] Loaded state from ${jsonPath} (${s.warehouses.length} warehouses, ${s.skus.length} SKUs)`);
  return s;
}

function emptyState(): ExportState {
  return {
    warehouses: [], zones: [], bin_locations: [], skus: [], categories: [],
    suppliers: [], batches: [], stock_ledger: [], write_offs: [],
    write_off_lines: [], pick_lists: [], pick_list_lines: [],
    cycle_counts: [], cycle_count_lines: [], setup_config: null,
  };
}

// ---------------------------------------------------------------------------
// Bundle builder
// ---------------------------------------------------------------------------

function buildBundle(state: ExportState): OKFFile[] {
  const files: OKFFile[] = [];
  const exportedAt = new Date().toISOString();
  const companyName = state.setup_config?.company_name || 'FreshOps Operator';
  const currency = state.setup_config?.currency || 'KES';

  // Root index
  files.push(buildRootIndex(companyName, exportedAt, state));

  // Physical layer
  files.push(...buildPhysicalLayer(state, exportedAt));

  // Catalogue layer
  files.push(...buildCatalogueLayer(state, exportedAt, currency));

  // Operations layer
  files.push(...buildOperationsLayer(state, exportedAt, currency));

  return files;
}

// ---------------------------------------------------------------------------
// Root index
// ---------------------------------------------------------------------------

function buildRootIndex(companyName: string, exportedAt: string, state: ExportState): OKFFile {
  const fm: Record<string, any> = {
    okf_version: '0.1',
    type: 'index',
    title: `${companyName} — FreshOps Digital Twin`,
    exported_at: exportedAt,
    warehouse_count: state.warehouses.length,
    sku_count: state.skus.filter((s: any) => s.is_active).length,
    supplier_count: state.suppliers.filter((s: any) => s.is_active).length,
  };
  const body = `
# ${companyName} — FreshOps Digital Twin

This bundle was automatically generated by FreshOpsPlatform (OKF v0.1).

Exported: \`${exportedAt}\`

## Structure

| Directory | Description |
|-----------|-------------|
| [physical/](physical/index.md) | Warehouses, temperature zones, bin locations |
| [catalogue/](catalogue/index.md) | SKUs, suppliers, categories |
| [operations/](operations/index.md) | Stock summaries, alerts, performance metrics |

## Stats

- **Warehouses:** ${state.warehouses.length}
- **Active SKUs:** ${state.skus.filter((s: any) => s.is_active).length}
- **Active Suppliers:** ${state.suppliers.filter((s: any) => s.is_active).length}
- **Open Batches:** ${state.batches.filter((b: any) => b.status === 'active').length}
`.trimStart();

  return { relativePath: 'index.md', content: buildFile(fm, body) };
}

// ---------------------------------------------------------------------------
// Physical layer
// ---------------------------------------------------------------------------

function buildPhysicalLayer(state: ExportState, exportedAt: string): OKFFile[] {
  const files: OKFFile[] = [];

  // physical/index.md
  files.push({
    relativePath: 'physical/index.md',
    content: buildFile(
      { type: 'directory', title: 'Physical Infrastructure', exported_at: exportedAt },
      `# Physical Infrastructure\n\n- [Warehouses](warehouses/index.md)\n- [Temperature Zones](zones/index.md)\n- [Bin Locations](bin_locations/index.md)\n`
    ),
  });

  // Warehouses
  files.push({
    relativePath: 'physical/warehouses/index.md',
    content: buildFile(
      { type: 'directory', title: 'Warehouses', count: state.warehouses.length, exported_at: exportedAt },
      buildListingBody('Warehouses', state.warehouses, w => `[${w.name}](${w.id}.md) — ${w.type === 'main_warehouse' ? 'Main' : 'Fulfilment'}, ${w.is_active ? 'Active' : 'Inactive'}`)
    ),
  });
  for (const w of state.warehouses) {
    files.push(buildWarehouseFile(w, state, exportedAt));
  }

  // Zones
  files.push({
    relativePath: 'physical/zones/index.md',
    content: buildFile(
      { type: 'directory', title: 'Temperature Zones', count: state.zones.length, exported_at: exportedAt },
      buildListingBody('Zones', state.zones, z => `[${z.name}](${z.id}.md) — ${z.type}, ${z.min_temp_celsius}°C to ${z.max_temp_celsius}°C`)
    ),
  });
  for (const z of state.zones) {
    files.push(buildZoneFile(z, state, exportedAt));
  }

  // Bin locations — summary only (too granular for per-file)
  files.push(buildBinLocationIndex(state, exportedAt));

  return files;
}

function buildWarehouseFile(w: any, state: ExportState, exportedAt: string): OKFFile {
  const zones = state.zones.filter((z: any) => z.warehouse_id === w.id);
  const bins = state.bin_locations.filter((b: any) => b.warehouse_id === w.id);
  const activeBatches = state.batches.filter((b: any) => b.warehouse_id === w.id && b.status === 'active');
  const totalUnits = activeBatches.reduce((sum: number, b: any) => sum + (b.quantity_available || 0), 0);

  const fm: Record<string, any> = {
    type: 'warehouse',
    id: w.id,
    name: w.name,
    warehouse_type: w.type,
    address: w.address || null,
    is_active: w.is_active,
    zone_count: zones.length,
    bin_count: bins.length,
    active_batch_count: activeBatches.length,
    total_units_on_hand: totalUnits,
    exported_at: exportedAt,
  };

  const body = `
# ${w.name}

**Type:** ${w.type === 'main_warehouse' ? 'Main Warehouse' : 'Fulfilment Point'}
**Status:** ${w.is_active ? 'Active' : 'Inactive'}
${w.address ? `**Address:** ${w.address}` : ''}

## Temperature Zones (${zones.length})

${zones.length === 0 ? '_No zones configured._' : zones.map((z: any) => `- [${z.name}](../zones/${z.id}.md) — ${z.type} (${z.min_temp_celsius}°C to ${z.max_temp_celsius}°C)`).join('\n')}

## Inventory Snapshot

- **Active Batches:** ${activeBatches.length}
- **Total Units On Hand:** ${totalUnits.toLocaleString()}
- **Bin Locations:** ${bins.length}
`;

  return { relativePath: `physical/warehouses/${w.id}.md`, content: buildFile(fm, body) };
}

function buildZoneFile(z: any, state: ExportState, exportedAt: string): OKFFile {
  const warehouse = state.warehouses.find((w: any) => w.id === z.warehouse_id);
  const bins = state.bin_locations.filter((b: any) => b.zone_id === z.id);
  const classes = z.permitted_product_classes?.join(', ') || 'All';

  const fm: Record<string, any> = {
    type: 'zone',
    id: z.id,
    name: z.name,
    warehouse_id: z.warehouse_id,
    warehouse_name: warehouse?.name || z.warehouse_id,
    temp_zone_type: z.type,
    min_temp_celsius: z.min_temp_celsius,
    max_temp_celsius: z.max_temp_celsius,
    is_quarantine: z.is_quarantine_zone || false,
    bin_count: bins.length,
    exported_at: exportedAt,
  };

  const body = `
# ${z.name}

**Warehouse:** [${warehouse?.name || z.warehouse_id}](../warehouses/${z.warehouse_id}.md)
**Type:** ${z.type}
**Temperature Range:** ${z.min_temp_celsius}°C to ${z.max_temp_celsius}°C
**Quarantine Zone:** ${z.is_quarantine_zone ? 'Yes' : 'No'}
**Permitted Product Classes:** ${classes}
**Bin Locations:** ${bins.length}
${z.max_capacity_kg ? `**Max Capacity:** ${z.max_capacity_kg} kg` : ''}
`;

  return { relativePath: `physical/zones/${z.id}.md`, content: buildFile(fm, body) };
}

function buildBinLocationIndex(state: ExportState, exportedAt: string): OKFFile {
  const byType = state.bin_locations.reduce((acc: Record<string, number>, b: any) => {
    acc[b.location_type] = (acc[b.location_type] || 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(byType)
    .map(([t, count]) => `| ${t} | ${count} |`)
    .join('\n');

  const body = `
# Bin Locations

Total: **${state.bin_locations.length}** bin locations across ${state.warehouses.length} warehouses.

## By Type

| Location Type | Count |
|---------------|-------|
${rows || '| — | 0 |'}

## By Warehouse

${state.warehouses.map((w: any) => {
  const count = state.bin_locations.filter((b: any) => b.warehouse_id === w.id).length;
  return `- [${w.name}](../warehouses/${w.id}.md) — ${count} bins`;
}).join('\n') || '_No warehouses._'}
`;

  return {
    relativePath: 'physical/bin_locations/index.md',
    content: buildFile(
      { type: 'directory', title: 'Bin Locations', count: state.bin_locations.length, exported_at: exportedAt },
      body
    ),
  };
}

// ---------------------------------------------------------------------------
// Catalogue layer
// ---------------------------------------------------------------------------

function buildCatalogueLayer(state: ExportState, exportedAt: string, currency: string): OKFFile[] {
  const files: OKFFile[] = [];

  files.push({
    relativePath: 'catalogue/index.md',
    content: buildFile(
      { type: 'directory', title: 'Product Catalogue', exported_at: exportedAt },
      `# Product Catalogue\n\n- [SKUs](skus/index.md)\n- [Suppliers](suppliers/index.md)\n`
    ),
  });

  // SKUs
  const activeSkus = state.skus.filter((s: any) => s.is_active);
  files.push({
    relativePath: 'catalogue/skus/index.md',
    content: buildFile(
      { type: 'directory', title: 'SKUs', count: activeSkus.length, total_count: state.skus.length, exported_at: exportedAt },
      buildListingBody(
        `SKUs (${activeSkus.length} active of ${state.skus.length} total)`,
        activeSkus,
        s => `[${s.name}](${s.id}.md) \`${s.code}\` — ${s.temp_zone}, ${currency} ${(s.selling_price_cents / 100).toFixed(2)}`
      )
    ),
  });
  for (const sku of state.skus) {
    files.push(buildSkuFile(sku, state, exportedAt, currency));
  }

  // Suppliers
  files.push({
    relativePath: 'catalogue/suppliers/index.md',
    content: buildFile(
      { type: 'directory', title: 'Suppliers', count: state.suppliers.length, exported_at: exportedAt },
      buildListingBody('Suppliers', state.suppliers, s => `[${s.name}](${s.id}.md) — ${s.is_active ? 'Active' : 'Inactive'}, lead time ${s.lead_time_days}d`)
    ),
  });
  for (const sup of state.suppliers) {
    files.push(buildSupplierFile(sup, state, exportedAt, currency));
  }

  return files;
}

function buildSkuFile(sku: any, state: ExportState, exportedAt: string, currency: string): OKFFile {
  const category = state.categories.find((c: any) => c.id === sku.category_id);
  const supplier = state.suppliers.find((s: any) => s.id === sku.supplier_id);
  const batches = state.batches.filter((b: any) => b.sku_id === sku.id && b.status === 'active');
  const totalOnHand = batches.reduce((sum: number, b: any) => sum + (b.quantity_available || 0), 0);
  const earliestExpiry = batches.length > 0
    ? batches.sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date))[0].expiry_date
    : null;

  const fm: Record<string, any> = {
    type: 'sku',
    id: sku.id,
    code: sku.code,
    name: sku.name,
    category_id: sku.category_id,
    category_name: category?.name || sku.category_id,
    supplier_id: sku.supplier_id,
    supplier_name: supplier?.name || sku.supplier_id,
    temp_zone: sku.temp_zone,
    unit: sku.unit,
    shelf_life_days: sku.shelf_life_days,
    reorder_level: sku.reorder_level,
    reorder_qty: sku.reorder_qty,
    cost_price_cents: sku.cost_price_cents,
    selling_price_cents: sku.selling_price_cents,
    is_active: sku.is_active,
    publication_status: sku.publication_status || 'draft',
    total_units_on_hand: totalOnHand,
    active_batch_count: batches.length,
    earliest_expiry: earliestExpiry,
    exported_at: exportedAt,
  };

  const body = `
# ${sku.name}

**Code:** \`${sku.code}\`
**Status:** ${sku.publication_status || 'draft'}
**Category:** ${category?.name || sku.category_id}
**Supplier:** [${supplier?.name || sku.supplier_id}](../suppliers/${sku.supplier_id}.md)
**Temperature Zone:** ${sku.temp_zone}
**Shelf Life:** ${sku.shelf_life_days} days

## Pricing

| | ${currency} |
|---|---|
| Cost Price | ${(sku.cost_price_cents / 100).toFixed(2)} |
| Selling Price | ${(sku.selling_price_cents / 100).toFixed(2)} |

## Units & Measurements

| Field | Value |
|-------|-------|
| Base Unit | ${sku.base_unit} |
| Display Unit | ${sku.display_unit} |
| Procurement Unit | ${sku.procurement_unit} |
| Count Unit | ${sku.count_unit} |

## Stock

- **On Hand:** ${totalOnHand} ${sku.unit}
- **Active Batches:** ${batches.length}
- **Earliest Expiry:** ${earliestExpiry || 'N/A'}
- **Reorder Level:** ${sku.reorder_level} ${sku.unit}
- **Reorder Qty:** ${sku.reorder_qty} ${sku.unit}
${totalOnHand < sku.reorder_level ? '\n> ⚠️ **Below reorder level**' : ''}
`;

  return { relativePath: `catalogue/skus/${sku.id}.md`, content: buildFile(fm, body) };
}

function buildSupplierFile(sup: any, state: ExportState, exportedAt: string, currency: string): OKFFile {
  const supplierSkus = state.skus.filter((s: any) => s.supplier_id === sup.id && s.is_active);

  const fm: Record<string, any> = {
    type: 'supplier',
    id: sup.id,
    name: sup.name,
    contact_name: sup.contact_name || null,
    phone: sup.phone || null,
    email: sup.email || null,
    lead_time_days: sup.lead_time_days,
    payment_terms: sup.payment_terms || null,
    is_active: sup.is_active,
    active_sku_count: supplierSkus.length,
    exported_at: exportedAt,
  };

  const body = `
# ${sup.name}

**Status:** ${sup.is_active ? 'Active' : 'Inactive'}
**Lead Time:** ${sup.lead_time_days} days
${sup.contact_name ? `**Contact:** ${sup.contact_name}` : ''}
${sup.phone ? `**Phone:** ${sup.phone}` : ''}
${sup.email ? `**Email:** ${sup.email}` : ''}
${sup.payment_terms ? `**Payment Terms:** ${sup.payment_terms}` : ''}

## Active SKUs (${supplierSkus.length})

${supplierSkus.length === 0 ? '_No active SKUs from this supplier._' : supplierSkus.map((s: any) => `- [${s.name}](../skus/${s.id}.md) \`${s.code}\``).join('\n')}
`;

  return { relativePath: `catalogue/suppliers/${sup.id}.md`, content: buildFile(fm, body) };
}

// ---------------------------------------------------------------------------
// Operations layer
// ---------------------------------------------------------------------------

function buildOperationsLayer(state: ExportState, exportedAt: string, currency: string): OKFFile[] {
  const files: OKFFile[] = [];

  files.push({
    relativePath: 'operations/index.md',
    content: buildFile(
      { type: 'directory', title: 'Operations', exported_at: exportedAt },
      `# Operations\n\n- [Stock Summary](stock_summary.md)\n- [Expiry Alerts](expiry_alerts.md)\n- [Reorder Alerts](reorder_alerts.md)\n- [Performance](performance/index.md)\n`
    ),
  });

  files.push(buildStockSummary(state, exportedAt, currency));
  files.push(buildExpiryAlerts(state, exportedAt));
  files.push(buildReorderAlerts(state, exportedAt, currency));

  // Performance sub-directory
  files.push({
    relativePath: 'operations/performance/index.md',
    content: buildFile(
      { type: 'directory', title: 'Performance Metrics', exported_at: exportedAt },
      `# Performance Metrics\n\n- [Pick Rate](pick_rate.md)\n- [Waste Summary](waste_summary.md)\n- [Cycle Count Accuracy](cycle_count_accuracy.md)\n`
    ),
  });
  files.push(buildPickRate(state, exportedAt));
  files.push(buildWasteSummary(state, exportedAt, currency));
  files.push(buildCycleCountAccuracy(state, exportedAt));

  return files;
}

function buildStockSummary(state: ExportState, exportedAt: string, currency: string): OKFFile {
  // Aggregate batches by sku_id + warehouse_id
  type StockRow = { sku_id: string; sku_name: string; warehouse_id: string; warehouse_name: string; units_on_hand: number; batch_count: number; value_cents: number };
  const rows: StockRow[] = [];

  for (const sku of state.skus.filter((s: any) => s.is_active)) {
    const skuBatches = state.batches.filter((b: any) => b.sku_id === sku.id && b.status === 'active');
    const byWh: Record<string, { units: number; batches: number }> = {};
    for (const b of skuBatches) {
      if (!byWh[b.warehouse_id]) byWh[b.warehouse_id] = { units: 0, batches: 0 };
      byWh[b.warehouse_id].units += b.quantity_available || 0;
      byWh[b.warehouse_id].batches += 1;
    }
    for (const [whId, data] of Object.entries(byWh)) {
      const wh = state.warehouses.find((w: any) => w.id === whId);
      rows.push({
        sku_id: sku.id,
        sku_name: sku.name,
        warehouse_id: whId,
        warehouse_name: wh?.name || whId,
        units_on_hand: data.units,
        batch_count: data.batches,
        value_cents: data.units * sku.cost_price_cents,
      });
    }
  }

  const totalValue = rows.reduce((s, r) => s + r.value_cents, 0);
  const totalUnits = rows.reduce((s, r) => s + r.units_on_hand, 0);

  const tableRows = rows
    .sort((a, b) => b.value_cents - a.value_cents)
    .map(r => `| [${r.sku_name}](../catalogue/skus/${r.sku_id}.md) | [${r.warehouse_name}](../physical/warehouses/${r.warehouse_id}.md) | ${r.units_on_hand.toLocaleString()} | ${r.batch_count} | ${currency} ${(r.value_cents / 100).toFixed(2)} |`)
    .join('\n');

  const body = `
# Stock Summary

Exported: \`${exportedAt}\`

**Total Units On Hand:** ${totalUnits.toLocaleString()}
**Total Inventory Value:** ${currency} ${(totalValue / 100).toFixed(2)}
**Active Lines:** ${rows.length}

## Detail

| SKU | Warehouse | Units On Hand | Batches | Value (${currency}) |
|-----|-----------|--------------|---------|---------------------|
${tableRows || '| — | — | 0 | 0 | 0.00 |'}
`;

  return {
    relativePath: 'operations/stock_summary.md',
    content: buildFile(
      {
        type: 'stock_summary',
        exported_at: exportedAt,
        total_units_on_hand: totalUnits,
        total_value_cents: totalValue,
        currency,
        line_count: rows.length,
      },
      body
    ),
  };
}

function buildExpiryAlerts(state: ExportState, exportedAt: string): OKFFile {
  const today = new Date();
  const alerts: Array<{ batch: any; sku: any; daysLeft: number }> = [];

  for (const batch of state.batches.filter((b: any) => b.status === 'active')) {
    const sku = state.skus.find((s: any) => s.id === batch.sku_id);
    if (!sku) continue;
    const alertDays = sku.expiry_alert_days ?? 7;
    const expiry = new Date(batch.expiry_date);
    const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= alertDays) {
      alerts.push({ batch, sku, daysLeft });
    }
  }

  alerts.sort((a, b) => a.daysLeft - b.daysLeft);

  const rows = alerts.map(({ batch, sku, daysLeft }) => {
    const wh = state.warehouses.find((w: any) => w.id === batch.warehouse_id);
    const urgency = daysLeft <= 0 ? '🔴 EXPIRED' : daysLeft <= 2 ? '🟠 CRITICAL' : '🟡 WARNING';
    return `| ${urgency} | [${sku.name}](../catalogue/skus/${sku.id}.md) | \`${batch.batch_number}\` | ${batch.expiry_date} | ${daysLeft}d | ${batch.quantity_available} | ${wh?.name || batch.warehouse_id} |`;
  }).join('\n');

  const body = `
# Expiry Alerts

Exported: \`${exportedAt}\`

**Items Approaching Expiry:** ${alerts.length}
**Expired:** ${alerts.filter(a => a.daysLeft <= 0).length}
**Critical (≤2 days):** ${alerts.filter(a => a.daysLeft > 0 && a.daysLeft <= 2).length}
**Warning:** ${alerts.filter(a => a.daysLeft > 2).length}

${alerts.length === 0 ? '_No items approaching expiry._' : `
| Status | SKU | Batch | Expiry Date | Days Left | Qty | Warehouse |
|--------|-----|-------|-------------|-----------|-----|-----------|
${rows}
`}
`;

  return {
    relativePath: 'operations/expiry_alerts.md',
    content: buildFile(
      {
        type: 'expiry_alert_report',
        exported_at: exportedAt,
        alert_count: alerts.length,
        expired_count: alerts.filter(a => a.daysLeft <= 0).length,
        critical_count: alerts.filter(a => a.daysLeft > 0 && a.daysLeft <= 2).length,
      },
      body
    ),
  };
}

function buildReorderAlerts(state: ExportState, exportedAt: string, currency: string): OKFFile {
  type ReorderRow = { sku: any; unitsOnHand: number; reorderLevel: number; shortfall: number };
  const alerts: ReorderRow[] = [];

  for (const sku of state.skus.filter((s: any) => s.is_active)) {
    const totalOnHand = state.batches
      .filter((b: any) => b.sku_id === sku.id && b.status === 'active')
      .reduce((sum: number, b: any) => sum + (b.quantity_available || 0), 0);
    if (totalOnHand < sku.reorder_level) {
      alerts.push({ sku, unitsOnHand: totalOnHand, reorderLevel: sku.reorder_level, shortfall: sku.reorder_level - totalOnHand });
    }
  }

  alerts.sort((a, b) => b.shortfall - a.shortfall);

  const rows = alerts.map(({ sku, unitsOnHand, reorderLevel, shortfall }) =>
    `| [${sku.name}](../catalogue/skus/${sku.id}.md) | \`${sku.code}\` | ${unitsOnHand} | ${reorderLevel} | **${shortfall}** | ${sku.reorder_qty} |`
  ).join('\n');

  const body = `
# Reorder Alerts

Exported: \`${exportedAt}\`

**SKUs Below Reorder Level:** ${alerts.length}

${alerts.length === 0 ? '_All SKUs are above reorder levels._' : `
| SKU | Code | On Hand | Reorder Level | Shortfall | Suggested Qty |
|-----|------|---------|---------------|-----------|---------------|
${rows}
`}
`;

  return {
    relativePath: 'operations/reorder_alerts.md',
    content: buildFile(
      {
        type: 'reorder_alert_report',
        exported_at: exportedAt,
        alert_count: alerts.length,
      },
      body
    ),
  };
}

function buildPickRate(state: ExportState, exportedAt: string): OKFFile {
  const completedLists = state.pick_lists.filter((p: any) => p.status === 'completed' || p.status === 'dispatched');
  const totalLines = completedLists.reduce((sum: number, pl: any) => {
    const lines = state.pick_list_lines.filter((l: any) => l.pick_list_id === pl.id);
    return sum + lines.length;
  }, 0);

  // Lines fulfilled at full quantity vs. short-picked
  const allLines = completedLists.flatMap((pl: any) =>
    state.pick_list_lines.filter((l: any) => l.pick_list_id === pl.id)
  );
  const fulfilledFull = allLines.filter((l: any) => (l.picked_qty || 0) >= (l.requested_qty || 0)).length;
  const fulfilmentPct = allLines.length > 0 ? Math.round(fulfilledFull / allLines.length * 100) : 100;

  const body = `
# Pick Rate

Exported: \`${exportedAt}\`

**Completed Pick Lists:** ${completedLists.length}
**Total Pick Lines:** ${totalLines}
**Lines Fulfilled at Full Qty:** ${fulfilledFull} / ${allLines.length}
**Pick Fulfilment Rate:** ${fulfilmentPct}%

${fulfilmentPct < 90 ? '> ⚠️ **Pick fulfilment below 90% — investigate short-picks.**' : '> ✅ Pick fulfilment is healthy.'}
`;

  return {
    relativePath: 'operations/performance/pick_rate.md',
    content: buildFile(
      {
        type: 'pick_rate_report',
        exported_at: exportedAt,
        completed_pick_list_count: completedLists.length,
        total_pick_lines: totalLines,
        fulfilment_pct: fulfilmentPct,
      },
      body
    ),
  };
}

function buildWasteSummary(state: ExportState, exportedAt: string, currency: string): OKFFile {
  const approvedWriteOffs = state.write_offs.filter((w: any) => w.status === 'approved');
  const allLines = approvedWriteOffs.flatMap((wo: any) =>
    state.write_off_lines.filter((l: any) => l.write_off_id === wo.id)
  );

  const totalQty = allLines.reduce((s: number, l: any) => s + (l.quantity || 0), 0);
  const totalValue = allLines.reduce((s: number, l: any) => s + (l.total_value_cents || 0), 0);

  const byReason: Record<string, { qty: number; value: number }> = {};
  for (const l of allLines) {
    const reason = l.reason || 'unknown';
    if (!byReason[reason]) byReason[reason] = { qty: 0, value: 0 };
    byReason[reason].qty += l.quantity || 0;
    byReason[reason].value += l.total_value_cents || 0;
  }

  const reasonRows = Object.entries(byReason)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([reason, data]) => `| ${reason} | ${data.qty.toLocaleString()} | ${currency} ${(data.value / 100).toFixed(2)} |`)
    .join('\n');

  const body = `
# Waste Summary

Exported: \`${exportedAt}\`

**Approved Write-Offs:** ${approvedWriteOffs.length}
**Total Qty Written Off:** ${totalQty.toLocaleString()}
**Total Waste Value:** ${currency} ${(totalValue / 100).toFixed(2)}

## By Reason

${allLines.length === 0 ? '_No write-offs recorded._' : `
| Reason | Qty | Value (${currency}) |
|--------|-----|---------------------|
${reasonRows}
`}
`;

  return {
    relativePath: 'operations/performance/waste_summary.md',
    content: buildFile(
      {
        type: 'waste_summary_report',
        exported_at: exportedAt,
        write_off_count: approvedWriteOffs.length,
        total_qty: totalQty,
        total_value_cents: totalValue,
        currency,
      },
      body
    ),
  };
}

function buildCycleCountAccuracy(state: ExportState, exportedAt: string): OKFFile {
  const completedCounts = state.cycle_counts.filter((c: any) => c.status === 'approved');
  const allLines = completedCounts.flatMap((cc: any) =>
    state.cycle_count_lines.filter((l: any) => l.cycle_count_id === cc.id)
  );

  const countedLines = allLines.filter((l: any) => l.counted_qty !== null && l.counted_qty !== undefined);
  const exactMatches = countedLines.filter((l: any) => (l.counted_qty || 0) === (l.expected_qty || 0));
  const accuracyPct = countedLines.length > 0 ? Math.round(exactMatches.length / countedLines.length * 100) : 100;

  const body = `
# Cycle Count Accuracy

Exported: \`${exportedAt}\`

**Completed Cycle Counts:** ${completedCounts.length}
**Total Lines Counted:** ${countedLines.length}
**Exact Matches:** ${exactMatches.length}
**Accuracy:** ${accuracyPct}%

${accuracyPct < 95 ? '> ⚠️ **Count accuracy below 95% — review counting process.**' : '> ✅ Count accuracy is within acceptable range.'}

## Summary by Count

${completedCounts.slice(0, 10).map((cc: any) => {
  const lines = state.cycle_count_lines.filter((l: any) => l.cycle_count_id === cc.id);
  const counted = lines.filter((l: any) => l.counted_qty !== null);
  const exact = counted.filter((l: any) => (l.counted_qty || 0) === (l.expected_qty || 0));
  const pct = counted.length > 0 ? Math.round(exact.length / counted.length * 100) : 100;
  return `- Count \`${cc.id}\` (${cc.completed_at ? cc.completed_at.slice(0, 10) : 'N/A'}): ${pct}% accurate (${exact.length}/${counted.length} lines)`;
}).join('\n') || '_No completed counts._'}
`;

  return {
    relativePath: 'operations/performance/cycle_count_accuracy.md',
    content: buildFile(
      {
        type: 'cycle_count_accuracy_report',
        exported_at: exportedAt,
        completed_count_count: completedCounts.length,
        total_lines: countedLines.length,
        accuracy_pct: accuracyPct,
      },
      body
    ),
  };
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

function writeFilesToDisk(files: OKFFile[], outDir: string): void {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  for (const file of files) {
    const fullPath = path.join(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Cloud Storage upload
// ---------------------------------------------------------------------------

async function uploadToCloudStorage(files: OKFFile[], bucket: string): Promise<void> {
  const prefix = process.env.GCS_PREFIX || 'okf/';
  console.log(`[okf-exporter] Uploading ${files.length} files to gs://${bucket}/${prefix}`);

  const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getStorage } = await import('firebase-admin/storage');

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }

  const storage = getStorage();
  const bucketRef = storage.bucket(bucket);

  await Promise.all(
    files.map(file => {
      const destPath = `${prefix}${file.relativePath}`;
      return bucketRef.file(destPath).save(Buffer.from(file.content, 'utf-8'), {
        contentType: 'text/markdown; charset=utf-8',
        metadata: { cacheControl: 'no-cache' },
      });
    })
  );

  console.log(`[okf-exporter] Uploaded to gs://${bucket}/${prefix}`);
}

// ---------------------------------------------------------------------------
// Git push
// ---------------------------------------------------------------------------

async function pushToGit(outDir: string): Promise<void> {
  const repoUrl = process.env.GITHUB_REPO_URL!;
  const workDir = process.env.GIT_WORK_DIR || '/tmp/freshops-twin';
  const userName = process.env.GIT_USER_NAME || 'FreshOps OKF Exporter';
  const userEmail = process.env.GIT_USER_EMAIL || 'okf@freshops.internal';

  console.log(`[okf-exporter] Pushing OKF bundle to ${repoUrl}`);

  try {
    const run = (cmd: string) => execSync(cmd, { cwd: workDir, stdio: 'pipe' });

    if (fs.existsSync(path.join(workDir, '.git'))) {
      run('git fetch origin');
      run('git reset --hard origin/main');
    } else {
      fs.mkdirSync(workDir, { recursive: true });
      execSync(`git clone ${repoUrl} ${workDir}`, { stdio: 'pipe' });
    }

    // Clear old OKF files (keep .git and README.md)
    const toRemove = fs.readdirSync(workDir).filter(f => f !== '.git' && f !== 'README.md');
    for (const item of toRemove) {
      fs.rmSync(path.join(workDir, item), { recursive: true, force: true });
    }

    // Copy new files
    const copyDir = (src: string, dest: string) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
      }
    };
    copyDir(outDir, workDir);

    run(`git config user.email "${userEmail}"`);
    run(`git config user.name "${userName}"`);
    run('git add -A');

    const hasChanges = (() => {
      try { run('git diff --cached --exit-code'); return false; } catch { return true; }
    })();

    if (!hasChanges) {
      console.log('[okf-exporter] No changes to push.');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    run(`git commit -m "chore: OKF export ${timestamp}"`);
    run('git push origin main');
    console.log('[okf-exporter] Pushed successfully.');
  } catch (err: any) {
    console.error('[okf-exporter] Git push failed:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFrontmatter(obj: Record<string, any>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else if (typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        v.forEach(item => lines.push(`  - ${JSON.stringify(item)}`));
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(String(v))}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function buildFile(frontmatter: Record<string, any>, body: string): string {
  return toFrontmatter(frontmatter) + '\n\n' + body.trimStart();
}

function buildListingBody(title: string, items: any[], formatter: (item: any) => string): string {
  if (items.length === 0) return `# ${title}\n\n_None configured._\n`;
  return `# ${title}\n\n${items.map(item => `- ${formatter(item)}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(err => {
  console.error('[okf-exporter] Fatal error:', err);
  process.exit(1);
});
