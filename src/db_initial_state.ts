/**
 * FreshOpsPlatform â€” Demo Seed Data
 *
 * This file contains illustrative demo data for a fictional fresh
 * food operator in Nairobi ("Regen Warehouse" / "Regal Plaza").
 * It exists to make the system demonstrable out of the box and to
 * support development and testing.
 *
 * DEPLOYING THIS SYSTEM?
 * You do not need to edit this file. Run the application and use
 * the Setup Wizard (shown on first launch) to configure your own
 * warehouses, zones, and administrator account. Your real
 * operational data will be separate from this demo seed.
 *
 * The following are intentionally specific to the demo scenario
 * and are NOT constraints on how you use the platform:
 *   - Warehouse names (Regen, Regal) â€” create your own
 *   - Supplier names (Kenchic etc.) â€” create your own in Suppliers
 *   - Customer names (Carrefour, QuickMart etc.) â€” create your own
 *   - Product names and codes â€” create your own via Catalogue
 *   - Asset types â€” none seeded; create your own in Settings
 *   - Counting sections â€” none seeded; create your own in Settings
 *   - All monetary values are in KES
 */

import { User, Warehouse, Zone, Location, Supplier, Category, SKU, Customer, PurchaseOrder, CustomerOrder, PurchaseOrderLine, CustomerOrderLine, StockLedgerEntry, Batch, WorkflowTemplate, Asset } from './types';

// Seed accounts use temporary password 'changeme123' â€” all seed
// accounts have must_reset_password: true and will be forced to
// change this on first login.
export const INITIAL_USERS: User[] = [
  {
    id: 'U-ADMIN',
    name: 'Admin',
    email: 'admin@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'admin',
    primary_warehouse_id: 'RGN',
    is_active: true,
    created_at: '2026-06-01T08:00:00Z',
    last_login_at: '2026-06-14T09:00:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-OPS-A',
    name: 'Mercy Wanjiku',
    email: 'mercy@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'ops_manager',
    primary_warehouse_id: 'RGN',
    is_active: true,
    created_at: '2026-06-01T08:30:00Z',
    last_login_at: '2026-06-14T09:15:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-OPS-B',
    name: 'David Omondi',
    email: 'david@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'ops_manager',
    primary_warehouse_id: 'RGL',
    is_active: true,
    created_at: '2026-06-01T08:45:00Z',
    last_login_at: '2026-06-13T10:00:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-RECEIVER',
    name: 'Josphat Kamau',
    email: 'josphat@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'receiver',
    primary_warehouse_id: 'RGN',
    is_active: true,
    created_at: '2026-06-02T09:00:00Z',
    last_login_at: '2026-06-14T07:00:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-PICKER',
    name: 'Esther Muthoni',
    email: 'esther@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'picker',
    primary_warehouse_id: 'RGN',
    is_active: true,
    created_at: '2026-06-02T09:30:00Z',
    last_login_at: '2026-06-14T08:00:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-DRIVER',
    name: 'Peter Kiprop',
    email: 'peter@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'driver',
    primary_warehouse_id: 'RGL',
    is_active: true,
    created_at: '2026-06-03T10:00:00Z',
    last_login_at: '2026-06-14T08:30:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-AUDITOR',
    name: 'Hellen Atieno',
    email: 'hellen@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'auditor',
    primary_warehouse_id: 'RGN',
    is_active: true,
    created_at: '2026-06-03T11:00:00Z',
    last_login_at: '2026-06-13T16:00:00Z',
    reports_to_user_id: null,
  },
  {
    id: 'U-DISABLED',
    name: 'Deactivated User',
    email: 'disabled@freshops.local',
    phone: null,
    password_hash: null,
    must_reset_password: true,
    role: 'receiver',
    primary_warehouse_id: 'RGN',
    is_active: false,
    created_at: '2026-06-01T08:00:00Z',
    last_login_at: null,
    reports_to_user_id: null,
  }
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'RGN',
    name: 'Main Warehouse',
    type: 'main_warehouse',
    address: 'Regen, Waiyaki Way, Nairobi',
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'RGL',
    name: 'Fulfilment Point 1',
    type: 'fulfilment_point',
    address: 'Regal Plaza, Parklands, Nairobi',
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
  }
];

export const INITIAL_ZONES: Zone[] = [
  // RGN Zones
  { id: 'Z-RGN-AMB', warehouse_id: 'RGN', name: 'Ambient Section', type: 'ambient', min_temp_celsius: 15, max_temp_celsius: 25, is_active: true, current_temp_celsius: 19.5 },
  { id: 'Z-RGN-CHL', warehouse_id: 'RGN', name: 'Cold Room A', type: 'chilled', min_temp_celsius: 0, max_temp_celsius: 4, is_active: true, current_temp_celsius: 2.3 },
  { id: 'Z-RGN-COOL', warehouse_id: 'RGN', name: 'Cool Room A', type: 'cool', min_temp_celsius: 8, max_temp_celsius: 12, is_active: true, current_temp_celsius: 9.8 },
  { id: 'Z-RGN-FRZ', warehouse_id: 'RGN', name: 'Freezer Room A', type: 'frozen', min_temp_celsius: -25, max_temp_celsius: -18, is_active: true, current_temp_celsius: -21.2 },

  // RGL Zones
  { id: 'Z-RGL-AMB', warehouse_id: 'RGL', name: 'Parklands Dry Racks', type: 'ambient', min_temp_celsius: 15, max_temp_celsius: 25, is_active: true, current_temp_celsius: 18.9 },
  { id: 'Z-RGL-CHL', warehouse_id: 'RGL', name: 'Parklands Chilled Cabinets', type: 'chilled', min_temp_celsius: 0, max_temp_celsius: 4, is_active: true, current_temp_celsius: 1.7 },
];

export const INITIAL_LOCATIONS: Location[] = [
  // RGN Locations
  { id: 'L-RGN-AMB-01', zone_id: 'Z-RGN-AMB', warehouse_id: 'RGN', code: 'A-01-01-A', aisle: 'A', rack: '01', shelf: '01', bin: 'A', capacity_kg: 500, is_active: true },
  { id: 'L-RGN-AMB-02', zone_id: 'Z-RGN-AMB', warehouse_id: 'RGN', code: 'A-01-01-B', aisle: 'A', rack: '01', shelf: '01', bin: 'B', capacity_kg: 500, is_active: true },
  { id: 'L-RGN-CHL-01', zone_id: 'Z-RGN-CHL', warehouse_id: 'RGN', code: 'C-01-01-A', aisle: 'C', rack: '01', shelf: '01', bin: 'A', capacity_kg: 200, is_active: true },
  { id: 'L-RGN-CHL-02', zone_id: 'Z-RGN-CHL', warehouse_id: 'RGN', code: 'C-01-01-B', aisle: 'C', rack: '01', shelf: '01', bin: 'B', capacity_kg: 200, is_active: true },
  { id: 'L-RGN-COOL-01', zone_id: 'Z-RGN-COOL', warehouse_id: 'RGN', code: 'V-01-01-A', aisle: 'V', rack: '01', shelf: '01', bin: 'A', capacity_kg: 300, is_active: true },
  { id: 'L-RGN-FRZ-01', zone_id: 'Z-RGN-FRZ', warehouse_id: 'RGN', code: 'F-01-01-A', aisle: 'F', rack: '01', shelf: '01', bin: 'A', capacity_kg: 150, is_active: true },

  // RGL Locations
  { id: 'L-RGL-AMB-01', zone_id: 'Z-RGL-AMB', warehouse_id: 'RGL', code: 'P-DRY-01', aisle: 'P', rack: 'DRY', shelf: '01', bin: 'A', capacity_kg: 100, is_active: true },
  { id: 'L-RGL-CHL-01', zone_id: 'Z-RGL-CHL', warehouse_id: 'RGL', code: 'P-CHL-01', aisle: 'P', rack: 'CHL', shelf: '01', bin: 'A', capacity_kg: 50, is_active: true }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'S-KENCHIC', name: 'Sunrise Farm Cooperative', contact_name: 'Maina Kamau', phone: '+254711122334', email: 'orders@sunrisefarm.co.ke', lead_time_days: 2, payment_terms: 'NET30', is_active: true, created_at: '2026-06-01T00:00:00Z' },
  { id: 'S-NAIROBI-GREENS', name: 'Valley Fresh Produce', contact_name: 'Wanjala Juma', phone: '+254722233445', email: 'produce@valleyfresh.co.ke', lead_time_days: 1, payment_terms: 'COD', is_active: true, created_at: '2026-06-01T00:00:00Z' },
  { id: 'S-DRYPACK', name: 'Continental Dry Foods', contact_name: 'Saima Khan', phone: '+254733344556', email: 'sales@continentaldry.co.ke', lead_time_days: 4, payment_terms: 'NET45', is_active: true, created_at: '2026-06-01T00:00:00Z' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'CAT-DAIRY',    name: 'Dairy & Milks',            numeric_code: 100, parent_id: null, default_temp_zone: 'chilled',  expiry_alert_days: null },
  { id: 'CAT-PRODUCE',  name: 'Horticulture & Fruits',    numeric_code: 200, parent_id: null, default_temp_zone: 'cool',     expiry_alert_days: null },
  { id: 'CAT-MEAT',     name: 'Fresh Poultry & Meats',    numeric_code: 300, parent_id: null, default_temp_zone: 'chilled',  expiry_alert_days: null },
  { id: 'CAT-PACKAGED', name: 'Packaged Staples',          numeric_code: 400, parent_id: null, default_temp_zone: 'ambient',  expiry_alert_days: null },
  { id: 'CAT-FROZEN',   name: 'Frozen Confectionery',      numeric_code: 500, parent_id: null, default_temp_zone: 'frozen',   expiry_alert_days: null }
];

export const INITIAL_SKUS: SKU[] = [
  {
    id: 'SKU-MILK',
    code: '100001',
    moq: 1,
    name: 'Brookside Chilled Milk 1L',
    category_id: 'CAT-DAIRY',
    supplier_id: 'S-KENCHIC', // Kenchic also distributes some dairy
    temp_zone: 'chilled',
    unit: 'pack',
    weight_kg: 1.0,
    shelf_life_days: 5,
    reorder_level: 50,
    reorder_qty: 100,
    cost_price_cents: 7000, // 70.00 KES
    selling_price_cents: 9500, // 95.00 KES
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'ml',
    procurement_unit: 'case of 12',
    procurement_unit_qty: 6000,
    count_unit: 'case of 12',
    count_unit_qty: 6000,
    remainder_unit: 'bottle',
    remainder_unit_qty: 500,
    display_unit: 'L',
    display_divisor: 1000,
    display_decimals: 2,
    expiry_alert_days: null,
    is_bundle: false,
    bundle_definition_id: null
  },
  {
    id: 'SKU-CHICK',
    code: '300001',
    moq: 1,
    name: 'Kenchic Whole Chicken 1.2kg',
    category_id: 'CAT-MEAT',
    supplier_id: 'S-KENCHIC',
    temp_zone: 'chilled',
    unit: 'each',
    weight_kg: 1.2,
    shelf_life_days: 4,
    reorder_level: 25,
    reorder_qty: 60,
    cost_price_cents: 45000, // 450.00 KES
    selling_price_cents: 58000, // 580.00 KES
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'g',
    procurement_unit: '5kg pack',
    procurement_unit_qty: 5000,
    count_unit: '5kg pack',
    count_unit_qty: 5000,
    remainder_unit: 'kg',
    remainder_unit_qty: 1000,
    display_unit: 'kg',
    display_divisor: 1000,
    display_decimals: 1,
    expiry_alert_days: null,
    is_bundle: false,
    bundle_definition_id: null
  },
  {
    id: 'SKU-AVO',
    code: '200001',
    moq: 1,
    name: 'Hass Avocados (Pack of 4)',
    category_id: 'CAT-PRODUCE',
    supplier_id: 'S-NAIROBI-GREENS',
    temp_zone: 'cool',
    unit: 'pack',
    weight_kg: 0.8,
    shelf_life_days: 7,
    reorder_level: 30,
    reorder_qty: 50,
    cost_price_cents: 12000, // 120.00 KES
    selling_price_cents: 18000, // 180.00 KES
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'each',
    procurement_unit: 'crate of 50',
    procurement_unit_qty: 50,
    count_unit: 'crate of 50',
    count_unit_qty: 50,
    remainder_unit: 'each',
    remainder_unit_qty: 1,
    display_unit: 'each',
    display_divisor: 1,
    display_decimals: 0,
    expiry_alert_days: null,
    is_bundle: false,
    bundle_definition_id: null
  },
  {
    id: 'SKU-RICE',
    code: '400001',
    moq: 1,
    name: 'Daawat Basmati Rice 2kg',
    category_id: 'CAT-PACKAGED',
    supplier_id: 'S-DRYPACK',
    temp_zone: 'ambient',
    unit: 'pack',
    weight_kg: 2.0,
    shelf_life_days: 180,
    reorder_level: 40,
    reorder_qty: 80,
    cost_price_cents: 32000, // 320.00 KES
    selling_price_cents: 39500, // 395.00 KES
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'g',
    procurement_unit: '25kg bag',
    procurement_unit_qty: 25000,
    count_unit: '25kg bag',
    count_unit_qty: 25000,
    remainder_unit: 'kg',
    remainder_unit_qty: 1000,
    display_unit: 'kg',
    display_divisor: 1000,
    display_decimals: 1,
    expiry_alert_days: null,
    is_bundle: false,
    bundle_definition_id: null
  },
  {
    id: 'SKU-BURGER',
    code: '500001',
    moq: 1,
    name: 'Kenchic Premium Frozen Patties 8pk',
    category_id: 'CAT-FROZEN',
    supplier_id: 'S-KENCHIC',
    temp_zone: 'frozen',
    unit: 'pack',
    weight_kg: 0.9,
    shelf_life_days: 90,
    reorder_level: 15,
    reorder_qty: 40,
    cost_price_cents: 52000, // 520.00 KES
    selling_price_cents: 68000, // 680.00 KES
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'each',
    procurement_unit: 'case of 40',
    procurement_unit_qty: 40,
    count_unit: 'case of 40',
    count_unit_qty: 40,
    remainder_unit: 'each',
    remainder_unit_qty: 1,
    display_unit: 'each',
    display_divisor: 1,
    display_decimals: 0,
    expiry_alert_days: null,
    is_bundle: false,
    bundle_definition_id: null
  },
  {
    id: 'SKU-BUNDLE-DEMO',
    name: 'Chicken & Rice Meal Bundle',
    code: '400002',
    moq: 1,
    category_id: 'CAT-PACKAGED',
    supplier_id: 'S-KENCHIC',
    temp_zone: 'chilled',
    unit: 'each',
    weight_kg: 3.2,
    shelf_life_days: 0,
    reorder_level: 0,
    reorder_qty: 0,
    cost_price_cents: 0, // computed from components at pick time
    selling_price_cents: 145000, // KES 1,450
    is_active: true,
    created_at: '2026-06-15T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
    max_stock_level: null,
    barcode: null,
    base_unit: 'each',
    procurement_unit: 'each',
    procurement_unit_qty: 1,
    count_unit: 'each',
    count_unit_qty: 1,
    remainder_unit: 'each',
    remainder_unit_qty: 1,
    display_unit: 'each',
    display_divisor: 1,
    display_decimals: 0,
    expiry_alert_days: null,
    is_bundle: true,
    bundle_definition_id: 'BD-001'
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'C-01', name: 'Carrefour Sarit Centre', phone: '+254722000111', email: 'sarit@carrefour.ke', delivery_address: 'Sarit Centre, Westlands, Nairobi', zone: 'Westlands', customer_type: 'b2c', company_name: null, payment_terms: 'cash', credit_limit_cents: null, outstanding_balance_cents: 0, created_at: '2026-06-01T10:00:00Z' },
  { id: 'C-02', name: 'QuickMart Lavington', phone: '+254722000222', email: 'lavington@quickmart.ke', delivery_address: 'Lavington Mall, Nairobi', zone: 'Lavington', customer_type: 'b2c', company_name: null, payment_terms: 'cash', credit_limit_cents: null, outstanding_balance_cents: 0, created_at: '2026-06-01T10:00:00Z' },
  { id: 'C-03', name: 'Naivas Ngong Road', phone: '+254722000333', email: 'ngong@naivas.co.ke', delivery_address: 'Prestige Plaza, Ngong Road, Nairobi', zone: 'Ngong Road', customer_type: 'b2c', company_name: null, payment_terms: 'cash', credit_limit_cents: null, outstanding_balance_cents: 0, created_at: '2026-06-01T10:00:00Z' },
  { id: 'CUST-B2B-001', name: 'CafÃ© Savanna Ltd', phone: '+254 722 000 001', email: 'orders@verde.co.ke', delivery_address: 'Westlands, Nairobi', zone: 'Westlands', customer_type: 'b2b', company_name: 'Savanna Ltd', payment_terms: 'net_14', credit_limit_cents: 150000, outstanding_balance_cents: 32000, created_at: '2026-06-16T12:00:00Z' }
];

export const INITIAL_POS: PurchaseOrder[] = [
  { id: 'PO-1001', supplier_id: 'S-KENCHIC', warehouse_id: 'RGN', status: 'sent', expected_date: '2026-06-16T12:00:00Z', notes: 'Urgent restocking', created_by: 'U-OPS-A', created_at: '2026-06-13T14:00:00Z', updated_at: '2026-06-13T14:00:00Z' },
  { id: 'PO-1002', supplier_id: 'S-NAIROBI-GREENS', warehouse_id: 'RGN', status: 'sent', expected_date: '2026-06-15T08:00:00Z', notes: 'Daily farm harvest', created_by: 'U-OPS-A', created_at: '2026-06-14T06:00:00Z', updated_at: '2026-06-14T06:00:00Z' }
];

export const INITIAL_PO_LINES: PurchaseOrderLine[] = [
  { id: 'POL-1001-A', po_id: 'PO-1001', sku_id: 'SKU-MILK', qty_ordered: 100, qty_received: 0, unit_cost_cents: 7000 },
  { id: 'POL-1001-B', po_id: 'PO-1001', sku_id: 'SKU-CHICK', qty_ordered: 50, qty_received: 0, unit_cost_cents: 45000 },
  { id: 'POL-1002-A', po_id: 'PO-1002', sku_id: 'SKU-AVO', qty_ordered: 40, qty_received: 0, unit_cost_cents: 12000 }
];

export const INITIAL_CUSTOMER_ORDERS: CustomerOrder[] = [
  { id: 'ORD-2001', external_order_id: 'WC-8831', customer_id: 'C-01', fulfilment_warehouse_id: 'RGN', status: 'received', delivery_date: '2026-06-15T10:00:00Z', delivery_address: 'Sarit Centre, Westlands, Nairobi', total_value_cents: 1720000, notes: 'Deliver to back loading dock', delivery_zone: null, dispatch_sequence: null, created_at: '2026-06-14T08:00:00Z', updated_at: '2026-06-14T08:00:00Z', picked_by: null, packed_by: null, packed_at: null, cold_chain_confirmed: false, packed_tote_count: null },
  { id: 'ORD-2002', external_order_id: 'WC-8832', customer_id: 'C-02', fulfilment_warehouse_id: 'RGL', status: 'received', delivery_date: '2026-06-15T12:00:00Z', delivery_address: 'Lavington Mall, Nairobi', total_value_cents: 790000, notes: 'Leave at reception if closed', delivery_zone: null, dispatch_sequence: null, created_at: '2026-06-14T08:45:00Z', updated_at: '2026-06-14T08:45:00Z', picked_by: null, packed_by: null, packed_at: null, cold_chain_confirmed: false, packed_tote_count: null }
];

export const INITIAL_CUSTOMER_ORDER_LINES: CustomerOrderLine[] = [
  { id: 'OL-2001-A', order_id: 'ORD-2001', sku_id: 'SKU-MILK', qty_ordered: 20, qty_fulfilled: 0, unit_price_cents: 9500 },
  { id: 'OL-2001-B', order_id: 'ORD-2001', sku_id: 'SKU-CHICK', qty_ordered: 10, qty_fulfilled: 0, unit_price_cents: 58000 },
  { id: 'OL-2001-C', order_id: 'ORD-2001', sku_id: 'SKU-AVO', qty_ordered: 15, qty_fulfilled: 0, unit_price_cents: 18000 },
  { id: 'OL-2002-A', order_id: 'ORD-2002', sku_id: 'SKU-MILK', qty_ordered: 10, qty_fulfilled: 0, unit_price_cents: 9500 },
  { id: 'OL-2002-B', order_id: 'ORD-2002', sku_id: 'SKU-RICE', qty_ordered: 10, qty_fulfilled: 0, unit_price_cents: 39500 }
];

export const INITIAL_BATCHES: Batch[] = [
  { id: 'B-MILK-EXP-EARLY', sku_id: 'SKU-MILK', batch_number: 'BTC-20260613-M', expiry_date: '2026-06-16T00:00:00Z', production_date: '2026-06-11T00:00:00Z', received_date: '2026-06-12T08:00:00Z', quantity_received: 80, quantity_available: 35, status: 'active', goods_receipt_id: 'GR-HIST-01', warehouse_id: 'RGN', created_at: '2026-06-12T08:00:00Z' },
  { id: 'B-MILK-EXP-LATE', sku_id: 'SKU-MILK', batch_number: 'BTC-20260614-M', expiry_date: '2026-06-19T00:00:00Z', production_date: '2026-06-12T00:00:00Z', received_date: '2026-06-13T08:00:00Z', quantity_received: 100, quantity_available: 100, status: 'active', goods_receipt_id: 'GR-HIST-02', warehouse_id: 'RGN', created_at: '2026-06-13T08:00:00Z' },
  { id: 'B-CHICK-EXP-EARLY', sku_id: 'SKU-CHICK', batch_number: 'BTC-20260612-C', expiry_date: '2026-06-15T00:00:00Z', production_date: '2026-06-11T00:00:00Z', received_date: '2026-06-12T08:00:00Z', quantity_received: 30, quantity_available: 12, status: 'active', goods_receipt_id: 'GR-HIST-01', warehouse_id: 'RGN', created_at: '2026-06-12T08:00:00Z' },
  { id: 'B-AVO-EXP-EARLY', sku_id: 'SKU-AVO', batch_number: 'BTC-20260613-A', expiry_date: '2026-06-20T00:00:00Z', production_date: '2026-06-11T00:00:00Z', received_date: '2026-06-13T10:00:00Z', quantity_received: 150, quantity_available: 110, status: 'active', goods_receipt_id: 'GR-HIST-03', warehouse_id: 'RGN', created_at: '2026-06-13T10:00:00Z' },
  { id: 'B-RICE-EXP-LATE', sku_id: 'SKU-RICE', batch_number: 'BTC-20260612-R', expiry_date: '2026-12-12T00:00:00Z', production_date: '2026-06-01T00:00:00Z', received_date: '2026-06-12T09:00:00Z', quantity_received: 50, quantity_available: 30, status: 'active', goods_receipt_id: 'GR-HIST-04', warehouse_id: 'RGL', created_at: '2026-06-12T09:00:00Z' }
];

export const INITIAL_LEDGER: StockLedgerEntry[] = [
  // Milk Receipt 1
  { id: 'LED-001', timestamp: '2026-06-12T09:00:00Z', sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-EARLY', location_id: 'L-RGN-CHL-01', warehouse_id: 'RGN', quantity: 80, transaction_type: 'receipt', reference_id: 'GR-HIST-01', reference_type: 'goods_receipt', user_id: 'U-RECEIVER', notes: 'Initial receipt' },
  // Pick ORD-HIST-1
  { id: 'LED-002', timestamp: '2026-06-12T14:00:00Z', sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-EARLY', location_id: 'L-RGN-CHL-01', warehouse_id: 'RGN', quantity: -45, transaction_type: 'pick', reference_id: 'PK-HIST-01', reference_type: 'pick_list', user_id: 'U-PICKER', notes: 'Pick order hist' },
  
  // Milk Receipt 2
  { id: 'LED-003', timestamp: '2026-06-13T09:00:00Z', sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-LATE', location_id: 'L-RGN-CHL-01', warehouse_id: 'RGN', quantity: 100, transaction_type: 'receipt', reference_id: 'GR-HIST-02', reference_type: 'goods_receipt', user_id: 'U-RECEIVER', notes: 'Top up receipt' },

  // Chicken Receipt
  { id: 'LED-004', timestamp: '2026-06-12T09:15:00Z', sku_id: 'SKU-CHICK', batch_id: 'B-CHICK-EXP-EARLY', location_id: 'L-RGN-CHL-02', warehouse_id: 'RGN', quantity: 30, transaction_type: 'receipt', reference_id: 'GR-HIST-01', reference_type: 'goods_receipt', user_id: 'U-RECEIVER', notes: 'Poultry delivery' },
  // Pick ORD-HIST-1
  { id: 'LED-005', timestamp: '2026-06-12T14:15:00Z', sku_id: 'SKU-CHICK', batch_id: 'B-CHICK-EXP-EARLY', location_id: 'L-RGN-CHL-02', warehouse_id: 'RGN', quantity: -18, transaction_type: 'pick', reference_id: 'PK-HIST-01', reference_type: 'pick_list', user_id: 'U-PICKER', notes: 'Pick chicken order' },

  // Avocado Receipt
  { id: 'LED-006', timestamp: '2026-06-13T10:15:00Z', sku_id: 'SKU-AVO', batch_id: 'B-AVO-EXP-EARLY', location_id: 'L-RGN-COOL-01', warehouse_id: 'RGN', quantity: 150, transaction_type: 'receipt', reference_id: 'GR-HIST-03', reference_type: 'goods_receipt', user_id: 'U-RECEIVER', notes: 'Fresh harest' },
  { id: 'LED-007', timestamp: '2026-06-13T16:00:00Z', sku_id: 'SKU-AVO', batch_id: 'B-AVO-EXP-EARLY', location_id: 'L-RGN-COOL-01', warehouse_id: 'RGN', quantity: -40, transaction_type: 'pick', reference_id: 'PK-HIST-02', reference_type: 'pick_list', user_id: 'U-PICKER', notes: 'Direct pick sale' },

  // Rice Receipt and transfer to RGL
  { id: 'LED-008', timestamp: '2026-06-12T10:00:00Z', sku_id: 'SKU-RICE', batch_id: 'B-RICE-EXP-LATE', location_id: 'L-RGL-AMB-01', warehouse_id: 'RGL', quantity: 50, transaction_type: 'receipt', reference_id: 'GR-HIST-04', reference_type: 'goods_receipt', user_id: 'U-RECEIVER', notes: 'Rice receive directly to FPL' },
  { id: 'LED-009', timestamp: '2026-06-13T11:00:00Z', sku_id: 'SKU-RICE', batch_id: 'B-RICE-EXP-LATE', location_id: 'L-RGL-AMB-01', warehouse_id: 'RGL', quantity: -20, transaction_type: 'pick', reference_id: 'PK-HIST-03', reference_type: 'pick_list', user_id: 'U-PICKER', notes: 'Rice sold out' }
];

export const INITIAL_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'WFT-PRICE-VARIANCE',
    type: 'PRICE_VARIANCE',
    name: 'Price Variance Approval',
    description: 'Triggered when goods are received at a different price than the purchase order. Requires line manager and finance sign-off.',
    stages: [
      {
        stage: 1,
        label: 'Line Manager Approval',
        required_user_id: 'REPORTS_TO_CREATOR',
        required_role: null,
        required_permission: null
      },
      {
        stage: 2,
        label: 'Finance Director Review',
        required_user_id: null,
        required_role: null,
        required_permission: 'finance:approve'
      },
      {
        stage: 3,
        label: 'Audit Sign-off',
        required_user_id: null,
        required_role: 'auditor',
        required_permission: null
      }
    ],
    is_active: true,
    created_by: 'SYSTEM',
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z'
  },
  {
    id: 'WFT-NEW-SUPPLIER',
    type: 'NEW_SUPPLIER',
    name: 'New Supplier Onboarding',
    description: 'Triggered when a new supplier is created. Requires category manager and finance approval before the supplier becomes active.',
    stages: [
      {
        stage: 1,
        label: 'Category Manager Approval',
        required_user_id: null,
        required_role: null,
        required_permission: 'catalogue:view'
      },
      {
        stage: 2,
        label: 'Finance Approval',
        required_user_id: null,
        required_role: null,
        required_permission: 'finance:approve'
      }
    ],
    is_active: true,
    created_by: 'SYSTEM',
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z'
  },
  {
    id: 'WFT-PRICE-CHANGE',
    type: 'PRICE_CHANGE',
    name: 'Price Change Approval',
    description: 'Triggered when a manual price change is submitted for a product.',
    stages: [
      {
        stage: 1,
        label: 'Line Manager Approval',
        required_user_id: 'REPORTS_TO_CREATOR',
        required_role: null,
        required_permission: null
      },
      {
        stage: 2,
        label: 'Finance Approval',
        required_user_id: null,
        required_role: null,
        required_permission: 'finance:approve'
      }
    ],
    is_active: true,
    created_by: 'SYSTEM',
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z'
  }
];

export const INITIAL_ASSETS: Asset[] = [];


