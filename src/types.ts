export type Role = 'admin' | 'ops_manager' | 'receiver' | 'picker' | 'driver' | 'auditor';

export type Permission =
  | 'receiving:view'
  | 'receiving:create'
  | 'catalogue:view'
  | 'bundles:manage'
  | 'cycle_counts:create'
  | 'cycle_counts:approve'
  | 'write_offs:create'
  | 'write_offs:approve'
  | 'transfers:create'
  | 'transfers:approve'
  | 'picking:execute'
  | 'packing:execute'
  | 'dispatch:execute'
  | 'deliveries:view'
  | 'returns:manage'
  | 'eod_check:execute'
  | 'traceability:view'
  | 'recalls:initiate'
  | 'recalls:execute'
  | 'assembly_templates:approve'
  | 'production:execute'
  | 'margin_report:view'
  | 'api_keys:manage'
  | 'webhooks:manage'
  | 'settings:manage'
  | 'users:manage'
  | 'finance:approve';

export interface CustomRole {
  id: string;
  name: string;                // e.g. 'Dispatcher'
  description: string | null;
  permissions: Permission[];
  created_by: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;              // NEW
  password_hash: string | null;      // NEW â€” null only for any pre-existing seed users
  must_reset_password: boolean;      // NEW â€” true immediately after admin-created accounts
  role: Role;
  custom_role_id?: string | null;   // NEW â€” when set, this user's
                                     // permissions come from the
                                     // referenced CustomRole instead
                                     // of the legacy role-based
                                     // checks. null = behaves exactly
                                     // as today (no change).
  primary_warehouse_id: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  reports_to_user_id: string | null;  // NEW â€” the user's direct
                                        // line manager. Used by the
                                        // WorkflowApproval engine to
                                        // determine stage-1 approvers
                                        // automatically. null for the
                                        // top of the org (e.g. the
                                        // admin who reports to no one).
  granted_permissions?: Permission[];   // permissions added on top of role
  revoked_permissions?: Permission[];   // permissions removed from role
}

export type TempZone = 'frozen' | 'chilled' | 'cool' | 'ambient';

export interface Warehouse {
  id: string; // e.g., 'RGN', 'RGL'
  name: string;
  type: 'main_warehouse' | 'fulfilment_point';
  address: string;
  is_active: boolean;
  created_at: string;
}

export interface Zone {
  id: string;
  warehouse_id: string;
  name: string;
  type: TempZone;
  min_temp_celsius: number;
  max_temp_celsius: number;
  is_active: boolean;
  current_temp_celsius?: number;
  permitted_product_classes?: ProductClass[];
  is_quarantine_zone?: boolean;
  max_capacity_kg?: number | null;
}

export interface Location {
  id: string; // e.g., 'RGN-AMB-01'
  zone_id: string;
  warehouse_id: string;
  code: string; // 'A-01-03-B'
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  capacity_kg: number | null;
  is_active: boolean;
  is_cross_dock?: boolean;
  is_entry_point?: boolean;
  is_exit_point?: boolean;
}

export interface BinLocation {
  id: string;
  code: string;
  name?: string;
  warehouse_id: string;
  zone_id: string;
  location_type: 'pick' | 'bulk' | 'receiving' | 'dispatch' | 'quarantine';
  capacity_units?: number;
  capacity_kg?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  lead_time_days: number;
  payment_terms: string | null;
  is_active: boolean;
  created_at: string;
}

export type ProductClass =
  | 'raw_protein'
  | 'ready_to_eat'
  | 'dairy'
  | 'fresh_produce'
  | 'dry_goods'
  | 'frozen_protein'
  | 'allergen'
  | 'cleaning_chemical'
  | 'packaging';

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  default_temp_zone: TempZone;
  expiry_alert_days: number | null; // null = use system default
  requires_barcode?: boolean;
  default_product_class?: ProductClass | null;
  numeric_code: number;   // NEW â€” 3-digit prefix used to build
                           // product codes. Top-level categories
                           // use multiples of 100 (100, 200, 300...).
                           // Sub-categories use the parent's base
                           // plus an offset (110, 120, 310...).
}

export type PublicationStatus =
  | 'draft'      // created, not yet ready for sale
  | 'ready'      // readiness checks passed, awaiting publish decision
  | 'published'  // live and available for ordering
  | 'blocked'    // NEW â€” pulled from sale pending investigation.
                 // Stock continues to be tracked and counted normally
                 // at its bin location. Item not orderable.
  | 'delisted'   // NEW â€” permanently removed from active catalogue.
                 // Stock tracked until exhausted, then archived.
  | 'archived';  // kept for backward compatibility with existing data

export type EthyleneProfile =
  | 'producer'      // apples, bananas, avocados, tomatoes, mangoes
  | 'sensitive'     // leafy greens, broccoli, carrots, cucumbers
  | 'neutral';      // neither produces nor is affected

export interface SKU {
  id: string;
  code: string;
  name: string;
  category_id: string;
  supplier_id: string;
  temp_zone: TempZone;
  unit: 'kg' | 'g' | 'each' | 'litre' | 'ml' | 'pack';
  weight_kg: number | null;
  shelf_life_days: number;
  reorder_level: number;
  reorder_qty: number;
  moq: number;            // NEW â€” supplier's minimum order quantity
                           // in supplier units. Defaults to 1.
                           // Must be respected when creating POs.
  cost_price_cents: number; // in cents
  selling_price_cents: number; // in cents
  is_active: boolean;
  created_at: string;
  updated_at: string;
  max_stock_level: number | null;
  barcode: string | null;
  base_unit: 'g' | 'ml' | 'each';
  procurement_unit: string;        // '25kg bucket', 'case of 24', '1L bottle'
  procurement_unit_qty: number;    // base units per procurement unit
  count_unit: string;              // what floor staff count in
  count_unit_qty: number;          // base units per count unit
  remainder_unit: string;          // smaller denomination for partial counts
  remainder_unit_qty: number;      // base units per remainder unit
  display_unit: string;            // 'kg', 'L', 'each' shown in all UI
  display_divisor: number;         // base_qty / divisor = display number
  display_decimals: number;        // decimal places for display
  expiry_alert_days: number | null; // null = inherit from category, then system default
  is_bundle: boolean;              // default false
  bundle_definition_id: string | null; // FK -> bundle_definitions
  publication_status?: PublicationStatus;
  published_at?: string | null;
  published_by?: string | null;
  requires_barcode?: boolean | null;
  image_urls?: string[];
  description?: string | null;
  readiness_pct?: number;
  product_class?: ProductClass | null;
  ethylene_profile?: EthyleneProfile;
}

export interface Batch {
  id: string;
  sku_id: string;
  batch_number: string;
  expiry_date: string; // ISO string
  production_date: string | null;
  received_date: string;
  quantity_received: number;
  quantity_available: number; // derivative cache
  status: 'active' | 'depleted' | 'quarantine' | 'written_off' | 'recalled';
  goods_receipt_id: string;
  warehouse_id: string;
  created_at: string;
  parent_batch_ids?: string[];
  child_batch_ids?: string[];
  assembly_order_id?: string | null;
}

export type TransactionType =
  | 'receipt'
  | 'transfer_in'
  | 'transfer_out'
  | 'pick'
  | 'pick_reversal'
  | 'adjustment'
  | 'write_off'
  | 'return'
  | 'correction'
  | 'assembly_consumption'
  | 'assembly_production'
  | 'assembly_loss';

export interface StockLedgerEntry {
  id: string;
  timestamp: string;
  sku_id: string;
  batch_id: string;
  location_id: string;
  warehouse_id: string;
  quantity: number; // positive = in, negative = out
  transaction_type: TransactionType;
  reference_id: string;
  reference_type: 'goods_receipt' | 'transfer' | 'pick_list' | 'cycle_count' | 'write_off' | 'return' | 'assembly_order' | 'production_run';
  user_id: string;
  notes: string | null;
}

export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'closed' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  status: POStatus;
  expected_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  sku_id: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost_cents: number;
  bom_linked?: boolean;
}

export interface GoodsReceipt {
  id: string;
  po_id: string;
  warehouse_id: string;
  received_by: string;
  received_at: string;
  status: 'pending' | 'completed' | 'partial';
  notes: string | null;
  grn_number: string;
}

export interface GoodsReceiptLine {
  id: string;
  gr_id: string;
  po_line_id: string;
  sku_id: string;
  batch_id: string;
  qty_received: number;
  expiry_date: string;
  condition: 'good' | 'damaged' | 'rejected';
  put_away_location_id: string | null;
  put_away_at: string | null;
  put_away_by: string | null;
  actual_unit_cost_cents: number | null;    // NEW â€” what supplier
                                           // actually invoiced.
                                           // null = matched PO price
  price_variance_cents: number | null;      // NEW â€” actual minus PO
                                           // price. Positive = supplier
                                           // charged more. null = no
                                           // variance.
  variance_workflow_id: string | null;    // NEW â€” WorkflowApproval id
                                           // if variance triggered an
                                           // approval
}

export type PriceChangeReason =
  | 'supplier_increase'
  | 'supplier_decrease'
  | 'repricing'
  | 'promotion'
  | 'correction'
  | 'initial'
  | 'variance_approved';   // used when price is updated via the
                            // variance approval workflow

export interface PriceHistory {
  id: string;
  sku_id: string;
  effective_from: string;       // ISO â€” date this price took effect.
                                 // For variance approvals, this is
                                 // set to the GRN receipt date of the
                                 // specific PO that had the variance,
                                 // NOT today's date.
  cost_price_cents: number;        // in cents
  selling_price_cents: number;     // in cents
  reason: PriceChangeReason;
  notes: string | null;
  changed_by: string;
  source_po_id: string | null;   // the PO that triggered this change,
                                  // if created via variance approval
  created_at: string;
}

export type WorkflowApprovalType =
  | 'PRICE_VARIANCE'
  | 'NEW_SUPPLIER'
  | 'PRICE_CHANGE'
  | 'WRITE_OFF_HIGH_VALUE';
  // More types can be added as new modules adopt this engine

export type WorkflowStageStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export interface WorkflowApprovalStage {
  stage: number;               // 1, 2, 3...
  label: string;               // e.g. 'Line Manager Approval'
  required_user_id: string | null;   // specific user who must approve
                                      // (null = any user with required_role)
  required_role: string | null;      // role that can approve if no
                                      // specific user is required
  required_permission: string | null;// custom permission key (for
                                      // Finance custom role etc.)
  status: WorkflowStageStatus;
  actioned_by: string | null;
  actioned_at: string | null;
  notes: string | null;
}

export interface WorkflowApproval {
  id: string;
  type: WorkflowApprovalType;
  entity_id: string;             // id of the thing awaiting approval
  entity_type: string;           // e.g. 'price_variance', 'supplier'
  entity_snapshot: any;          // full JSON of what's being approved
  status: 'pending' | 'approved' | 'rejected';
  raised_by: string;             // user who created this approval
  raised_at: string;
  stages: WorkflowApprovalStage[];
  current_stage: number;         // which stage is currently active
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface WorkflowTemplateStage {
  stage: number;
  label: string;
  required_user_id: string | null;
  required_role: string | null;
  required_permission: string | null;
}

export interface WorkflowTemplate {
  id: string;
  type: WorkflowApprovalType;
  name: string;
  description: string | null;
  stages: WorkflowTemplateStage[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}


export type CustomerOrderStatus =
  | 'received'
  | 'picking'
  | 'packing'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'failed_delivery'
  | 'cancelled';

export interface CustomerOrder {
  id: string;
  external_order_id: string | null;
  customer_id: string;
  fulfilment_warehouse_id: string;
  status: CustomerOrderStatus;
  delivery_date: string;
  delivery_address: string;
  total_value_cents: number;
  notes: string | null;
  delivery_zone: string | null;
  dispatch_sequence: number | null;
  created_at: string;
  updated_at: string;
  picked_by: string | null;           // NEW: who completed the pick list
  packed_by: string | null;           // NEW: who confirmed packing
  packed_at: string | null;           // NEW
  cold_chain_confirmed: boolean;      // NEW: default false
  packed_tote_count: number | null;   // NEW: asset count recorded at packing time
}

export interface CustomerOrderLine {
  id: string;
  order_id: string;
  sku_id: string;
  qty_ordered: number;
  qty_fulfilled: number;
  unit_price_cents: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  delivery_address: string;
  zone: string | null;
  customer_type: 'b2c' | 'b2b';
  company_name: string | null;
  payment_terms: 'cash' | 'net_7' | 'net_14' | 'net_30';
  credit_limit_cents: number | null;
  outstanding_balance_cents: number;
  created_at: string;
}

export type PickListStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PickList {
  id: string;
  order_id: string;
  warehouse_id: string;
  assigned_to: string | null;
  status: PickListStatus;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface PickListLine {
  id: string;
  pick_list_id: string;
  order_line_id: string;
  sku_id: string;
  batch_id: string;
  location_id: string;
  qty_requested: number;
  qty_picked: number | null;
  status: 'pending' | 'picked' | 'short_picked' | 'skipped';
  short_pick_reason: 'OUT_OF_STOCK' | 'DAMAGED_ON_SHELF' | 'LOCATION_EMPTY' | 'QUALITY_REJECT' | null;
  picked_at: string | null;
  picked_by: string | null;

  // Bundle additions
  is_bundle_component?: boolean;
  bundle_sku_id?: string | null;
  bundle_order_line_id?: string | null;
  effective_bundle_expiry_date?: string | null;
}

export type TransferStatus = 'draft' | 'pending_approval' | 'approved' | 'packed' | 'on_manifest' | 'dispatched' | 'receiving' | 'fp_closed' | 'completed' | 'cancelled';

export interface Transfer {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  status: TransferStatus;
  requires_approval: boolean;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  notes: string | null;
  transfer_scope?: 'intra_site' | 'inter_site' | 'replenishment';
  replenishment_order_number?: string | null;
  manifest_id?: string | null;
  packed_by?: string | null;
  packed_at?: string | null;
  vehicle_notes?: string | null;
  rejection_lines?: FPORejectionLine[];
  closure_report?: FPOClosureReport | null;
  closure_report_sent_at?: string | null;
  under_pick_flagged_user?: string | null;
}

export interface TransferLine {
  id: string;
  transfer_id: string;
  sku_id: string;
  batch_id: string;
  from_location_id: string;
  to_location_id: string;
  qty_requested: number;
  qty_transferred: number | null;
}

export type CycleCountStatus = 'scheduled' | 'in_progress' | 'pending_approval' | 'completed' | 'cancelled';

export interface CycleCount {
  id: string;
  warehouse_id: string;
  zone_id: string | null;
  location_id: string | null;
  assigned_to: string | null;
  status: CycleCountStatus;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  approved_by: string | null;
  notes: string | null;
  is_wall_to_wall?: boolean;
  items_per_section?: number | null;
}

export interface CycleCountLine {
  id: string;
  count_id: string;
  sku_id: string;
  batch_id: string;
  location_id: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
  variance_pct: number | null;
  status: 'pending' | 'counted' | 'approved' | 'adjusted' | 'waived';
  counted_at: string | null;
  counted_by: string | null;
  approved_by: string | null;
  notes: string | null;
  assigned_bin_id?: string | null;
}

export interface CycleCountItem {
  id: string;
  count_id: string;
  sku_id: string;
  qty_system: number;       // what the system expected
  qty_counted: number;      // what the counter found
  variance: number;         // qty_counted - qty_system
  counted_by: string;
  counted_at: string;
  notes: string | null;
  assigned_bin_id: string | null;  // bin assigned during this count
}

export type WriteOffStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'reversed';

export interface WriteOff {
  id: string;
  warehouse_id: string;
  status: WriteOffStatus;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
  total_value_cents: number;
  notes: string | null;
}

export type WriteOffReason = 'EXPIRED' | 'DAMAGED' | 'LOST' | 'QUALITY' | 'THEFT';

export interface WriteOffLine {
  id: string;
  write_off_id: string;
  sku_id: string;
  batch_id: string;
  location_id: string;
  qty: number;
  reason: WriteOffReason;
  value_cents: number;
  notes: string | null;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id: string;
  vehicle_id: string | null;
  tote_count: number;
  status: 'pending' | 'dispatched' | 'delivered' | 'failed' | 'returning';
  dispatched_at: string | null;
  delivered_at: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  signature_url: string | null;
  failure_reason: string | null;
}

export interface TempLog {
  id: string;
  reference_id: string; // delivery_id or location_id
  reference_type: 'delivery' | 'location';
  temperature_celsius: number;
  zone_type: TempZone;
  is_breach: boolean;
  recorded_by: string;
  recorded_at: string;
  device_id: string | null;
  notes: string | null;
}

export interface TestResult {
  id: string;
  name: string;
  description: string;
  module: string;
  status: 'passed' | 'failed' | 'skipped' | 'idle';
  error?: string;
  logs?: string[];
}

export interface AssetType {
  id: string;
  name: string;              // fully operator-defined. e.g. 'Cooler Box',
                              // 'Insulated Tote', 'Hanging Rail', 'Crate',
                              // 'Proving Basket' â€” whatever the operator uses.
                              // No defaults shipped â€” admin creates these.
  description: string | null;
  requires_uid: boolean;     // true = each individual asset of this type
                              // gets its own UID/barcode/QR tag for
                              // individual tracking.
                              // false = tracked as a pool (e.g. "we have
                              // 40 of these, 12 are out") â€” no individual
                              // identity per unit.
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export type AssetStatus =
  | 'available'        // in warehouse, ready to dispatch
  | 'dispatched'       // out with an order or replenishment
  | 'returned'         // back from a delivery, not yet checked in
  | 'under_repair'     // sent out for repair
  | 'retired'          // permanently decommissioned
  | 'lost';            // reported lost, not yet found

export interface Asset {
  id: string;
  asset_type_id: string;     // references AssetType.id
  uid: string | null;        // optional: barcode, QR, RFID tag value.
                              // null when the asset_type.requires_uid
                              // is false (pool tracking) or when the
                              // UID hasn't been assigned yet.
                              // Unique within an asset_type.
  current_status: AssetStatus;
  current_warehouse_id: string | null;  // where the asset currently is.
                                         // null when dispatched externally.
  notes: string | null;
  created_by: string;
  created_at: string;

  // Legacy fields for backward compatibility
  type?: any;
  status?: any;
  warehouse_id?: any;
}

export type AssetEventType =
  | 'created'              // asset registered in system for first time
  | 'uid_assigned'         // UID/tag assigned to a previously untagged asset
  | 'dispatched'           // sent out with a customer order, FPO, or transfer
  | 'returned'             // came back from wherever it was dispatched to
  | 'damaged_reported'     // damage noted on return or during inspection
  | 'sent_for_repair'      // sent to an external/internal repair agent
  | 'repair_completed'     // returned from repair, back in service
  | 'retired'              // permanently taken out of service
  | 'lost_reported'        // reported missing
  | 'found'                // recovered after being reported lost
  | 'transferred'          // moved between warehouses internally (no order)
  | 'pool_adjustment';     // manual count correction for pool assets

export type AssetMovementReason =
  | 'customer_order'       // dispatched with a customer delivery
  | 'replenishment_order'  // dispatched with a replenishment/FPO
  | 'internal_transfer'    // moved between own warehouses
  | 'repair'               // sent to repair agent
  | 'replacement'          // replacing a damaged/lost unit
  | 'return_from_customer' // customer returned it
  | 'return_from_replenishment' // returned from replenishment destination
  | 'disposal'             // end of life removal
  | 'manual';              // no system document, manually recorded

export interface AssetEvent {
  id: string;
  asset_id: string;          // which asset this event is for
  asset_type_id: string;     // denormalised for faster queries by type
  event_type: AssetEventType;
  movement_reason: AssetMovementReason | null;  // null for events that
                              // are not movements (e.g. uid_assigned,
                              // damaged_reported)

  // Reference to the system document that caused this event.
  // This is the key audit field â€” any event triggered by an order,
  // replenishment, transfer, or repair job must carry a reference
  // so you can look at any asset and see its full document trail,
  // or look at any order and see which assets went with it.
  reference_id: string | null;     // e.g. 'ORD-2001', 'FPO-001',
                                    // 'TRF-005', 'REP-001'
  reference_type: 'customer_order' | 'replenishment_order' |
                  'transfer' | 'repair_job' | 'manual' | null;

  // Pool quantity (for non-UID assets â€” how many units of this type
  // were involved in this event)
  qty: number;               // always 1 for individually-tracked assets.
                              // for pool assets: how many units moved.

  from_warehouse_id: string | null;
  to_warehouse_id: string | null;  // null when dispatched to a customer
                                    // (they don't have a warehouse_id)
  from_status: AssetStatus;
  to_status: AssetStatus;
  recorded_by: string;       // user id
  recorded_at: string;       // ISO timestamp
  notes: string | null;
}

export interface DeliveryAsset {
  id: string;
  delivery_id: string;
  asset_id: string | null;
  asset_type_id?: string | null;  // changed from string to reference AssetType (made optional for backward compatibility)
  asset_type: string;            // keep as legacy string label for display
  uid: string | null;
  count: number;
  dispatched_at: string;
  returned_at: string | null;
  return_condition: 'good' | 'damaged' | 'lost' | null;
}

export interface PackingAsset {
  id: string;
  order_id: string;
  asset_type_id: string;     // references AssetType.id â€” operator-defined
  asset_type_name: string;   // denormalised display name at time of recording
                              // (so the packing record remains readable even
                              // if the AssetType is later renamed)
  count: number;
  recorded_at: string;
  recorded_by: string;
  asset_type?: string;       // legacy field for backward compatibility
}

export interface ProductRecall {
  id: string;
  scope: 'batch' | 'sku' | 'supplier';
  sku_id: string | null;
  supplier_id: string | null;
  batch_ids: string[];
  reason: 'HEALTH_SAFETY' | 'QUALITY' | 'SUPPLIER_DIRECTIVE' | 'CONTAMINATION' | 'REGULATORY';
  disposition: 'return_to_supplier' | 'destroy' | 'hold';
  initiated_by: string;
  status: 'draft' | 'active' | 'resolving' | 'resolved';
  exposure_snapshot: {
    units_in_stock: number;
    units_in_transit: number;
    units_delivered: number;
    customers_affected: number;
    estimated_value_cents: number;
  };
  customers_to_contact: {
    customer_id: string;
    customer_name: string;
    phone: string;
    delivery_date: string;
    skus_affected: string[];
  }[];
  created_at: string;
  resolved_at: string | null;
}

export interface RecallAction {
  id: string;
  recall_id: string;
  action_type: string;
  reference_id: string | null;
  reference_type: string | null;
  automated: boolean;
  status: 'pending' | 'done' | 'failed';
  description: string;
  executed_at: string | null;
}

// --- ASSEMBLIES MODULE ---
export type AssemblyType = 'state_change' | 'portioning';
export type AssemblyTemplateStatus = 'draft' | 'active' | 'archived';
export type AssemblyOrderStatus =
  | 'scheduled' | 'in_progress' | 'inspection_pending'
  | 'completed' | 'failed' | 'cancelled';

export interface AssemblyStage {
  stage_number: number;
  name: string;
  min_dwell_hours: number;
  max_dwell_hours: number;
  inspection_required: boolean;
}

export interface AssemblyTemplate {
  id: string;
  name: string;
  type: AssemblyType;
  status: AssemblyTemplateStatus;
  input_sku_id: string;
  output_sku_id: string;
  expected_yield_pct: number;
  required_zone: TempZone;
  stages: AssemblyStage[];
  requires_temperature_log: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  notes: string | null;
}

export interface AssemblyStageEvent {
  stage_number: number;
  stage_name: string;
  entered_at: string;
  approved_by: string | null;
  approved_by_name: string | null;
  temperature_celsius: number | null;
  notes: string | null;
}

export interface AssemblyOrder {
  id: string;
  template_id: string;
  template_name: string;
  type: AssemblyType;
  status: AssemblyOrderStatus;
  warehouse_id: string;
  location_id: string;
  input_sku_id: string;
  output_sku_id: string;
  input_batch_id: string;
  output_batch_id: string | null;
  qty_input: number;               // base units
  qty_output_planned: number;      // base units
  qty_output_actual: number | null;
  yield_variance_pct: number | null;
  current_stage: number;
  stage_history: AssemblyStageEvent[];
  initiated_by: string;
  scheduled_start: string;
  actual_start: string | null;
  completed_at: string | null;
  notes: string | null;
}

// --- BOM / PRODUCTION MODULE ---
export interface BomComponent {
  id: string;
  sku_id: string;
  qty_per_batch: number;    // base units per production batch
  notes: string | null;
}

export interface ProductionRecipe {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  output_sku_id: string;
  output_qty_per_batch: number;  // base units output per batch
  components: BomComponent[];
  standard_cost_cents: number;     // auto-computed from component costs
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  notes: string | null;
}

export type ProductionRunStatus =
  'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionRunLine {
  id: string;
  component_id: string;
  sku_id: string;
  batch_id: string;           // FEFO-assigned on run creation
  qty_planned: number;        // base units
  qty_actual: number | null;
  consumed_at: string | null;
}

export interface ProductionRun {
  id: string;
  recipe_id: string;
  recipe_name: string;
  status: ProductionRunStatus;
  warehouse_id: string;
  output_location_id: string;
  batches_planned: number;
  component_lines: ProductionRunLine[];
  output_qty_planned: number;
  output_qty_actual: number | null;
  output_batch_id: string | null;
  output_expiry_date: string | null;
  standard_cost_cents: number;
  actual_cost_cents: number | null;
  cost_variance_cents: number | null;
  initiated_by: string;
  scheduled_start: string;
  actual_start: string | null;
  completed_at: string | null;
  notes: string | null;
}

export type ManifestType = 'delivery' | 'replenishment';
export type ManifestStatus =
  | 'draft' | 'ready' | 'dispatched' | 'receiving' | 'closed';

export interface ManifestLine {
  id: string;
  transfer_id: string;             // which FPO this line belongs to
  transfer_line_id: string;
  sku_id: string;
  sku_name: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  qty_manifested: number;          // base units
  qty_received: number | null;     // base units â€” set during receiving
  variance: number | null;
  from_location_id: string | null;
  to_location_id: string | null;
  temp_zone: string;
  received: boolean;               // true once this line is confirmed
}

export interface ManifestAsset {
  uid: string | null;
  asset_type: string;
  count: number;
}

export interface LoadingManifest {
  id: string;
  manifest_number: string;         // MAN-DEL-0001 or MAN-TRF-0001
  type: ManifestType;
  status: ManifestStatus;
  // Delivery manifests: one reference_id (delivery_id)
  // Replenishment manifests: multiple transfer_ids (array of FPO ids)
  reference_id: string | null;     // for delivery type
  transfer_ids: string[];          // for replenishment type
  trip_reference: string | null;   // e.g. 'Morning RGL Run 07:00'
  warehouse_from_id: string;
  warehouse_to_id: string | null;
  customer_name: string | null;
  customer_address: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  lines: ManifestLine[];
  assets: ManifestAsset[];
  dispatch_temperature_celsius: number | null;
  is_locked: boolean;
  generated_at: string;
  generated_by: string;
  dispatched_by: string | null;
  dispatched_at: string | null;
  receiver_acknowledged_by: string | null;
  receiver_acknowledged_at: string | null;
  notes: string | null;
}

export type RejectionReason =
  | 'WRONG_PRODUCT'
  | 'QUALITY_REJECT'
  | 'UNDER_PICKED'
  | 'DAMAGED_IN_TRANSIT'
  | 'TEMPERATURE_BREACH'
  | 'SHORT_DATED'
  | 'QUANTITY_DISCREPANCY';

export type DispositionType =
  | 'RETURN_TO_SOURCE'        // returnable â€” goes back to RGN
  | 'WRITE_OFF_AT_FP'         // non-returnable â€” disposed at FP
  | 'MARKDOWN_SALE'           // borderline quality â€” quick sale at FP
  | 'DONATE'                  // safe but not sellable
  | 'ACCEPT_AS_RECEIVED';     // wrong product but sellable â€” stays at FP

export interface FPORejectionLine {
  id: string;
  transfer_line_id: string;
  sku_id: string;               // the SKU that was supposed to arrive
  sku_name: string;
  batch_id: string;
  batch_number: string;
  qty_manifested: number;
  qty_received: number;
  qty_rejected: number;
  rejection_reason: RejectionReason;
  is_returnable: boolean;
  disposition: DispositionType;
  actual_sku_id: string | null;    // for ACCEPT_AS_RECEIVED â€” what actually arrived
  actual_sku_name: string | null;
  actual_batch_id: string | null;  // new batch created at FP for actual SKU
  disposition_notes: string | null;
  markdown_price_cents: number | null;
  donate_recipient: string | null;
  write_off_id: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface FPOClosureReport {
  fpo_id: string;
  fpo_number: string;
  manifest_number: string;
  closed_by: string;
  closed_at: string;
  total_lines: number;
  fully_received_lines: number;
  partially_received_lines: number;
  rejected_lines: number;
  rejection_summary: {
    reason: RejectionReason;
    line_count: number;
    qty_rejected: number;
    value_cents: number;
  }[];
  returning_to_source: FPORejectionLine[];
  written_off_at_fp: FPORejectionLine[];
  markdown_at_fp: FPORejectionLine[];
  donated_at_fp: FPORejectionLine[];
  accepted_wrong_product: FPORejectionLine[];
  under_pick_discrepancy: boolean;
  under_pick_lines: FPORejectionLine[];
}

// Replaces batch-level locking â€” reserves specific qty at destination
export interface StockReservation {
  id: string;
  sku_id: string;
  batch_id: string;
  warehouse_id: string;         // the DESTINATION warehouse
  qty_reserved: number;         // base units
  reference_id: string;         // FPO transfer id
  reference_type: 'replenishment';
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
}

export interface CycleCountSuggestion {
  id: string;
  warehouse_id: string;
  suggested_reason: 'UNDER_PICK_DISCREPANCY' | 'VARIANCE_ALERT';
  reference_fpo: string | null;
  batch_ids: string[];
  suggested_at: string;
  actioned: boolean;
}

export interface ReplenishmentRule {
  id: string;
  sku_id: string;
  fulfilment_warehouse_id: string;
  par_level: number;             // base units â€” minimum to maintain
  reorder_qty: number;           // base units â€” how much to send when below par
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export type NotificationTrigger =
  | 'EXPIRY_ALERT'
  | 'EXPIRED_STOCK_IN_BIN'
  | 'REORDER_LEVEL_BREACHED'
  | 'OVERSTOCKED_SKU'
  | 'CATALOGUE_STOCK_NO_PUBLISH'
  | 'DELIVERY_LATE'
  | 'FPO_DISPATCHED'
  | 'FPO_CLOSURE_READY'
  | 'WRITE_OFF_HIGH_VALUE'
  | 'BOM_INSUFFICIENT_STOCK'
  | 'PERMISSION_VIOLATION'
  | 'DELIVERY_LOCATION_MISMATCH'
  | 'STOCK_TO_ZERO_ADJUSTMENT'
  | 'DOUBLE_TRANSACTION';

export interface WMSNotification {
  id: string;
  trigger: NotificationTrigger;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  reference_id: string | null;     // ID of the affected record
  reference_type: string | null;   // 'batch', 'order', 'sku', 'delivery' ...
  warehouse_id: string | null;
  target_roles: string[];          // which roles see this notification
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
}

export interface NotificationWebhook {
  id: string;
  channel: 'slack' | 'teams' | 'gchat';
  webhook_url: string;
  triggers: NotificationTrigger[];  // which triggers fire to this webhook
  is_active: boolean;
  created_at: string;
}

export type MarkdownApprovalStatus =
  | 'pending' | 'approved' | 'rejected';

export interface MarkdownApproval {
  id: string;
  sku_id?: string;
  sku_name?: string;
  batch_id?: string;
  batch_number?: string;
  expiry_date?: string;
  warehouse_id: string;
  qty_for_markdown?: number;        // base units reserved for markdown
  system_trigger_reason?: string;   // human-readable
  trigger_details?: {
    days_to_expiry: number | null;
    rejection_reason: string | null;
    fpo_id: string | null;
  };
  proposed_markdown_price_cents?: number;   // in KES cents
  original_price_cents?: number;
  discount_pct?: number;
  status: MarkdownApprovalStatus;
  raised_by?: string;               // user id
  raised_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  reservation_id?: string | null;   // FK -> stock_reservations

  // Write-off dual-approval properties
  write_off_id?: string;
  total_value_cents?: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  feedback?: string | null;
}

export type APIKeyScope =
  | 'orders:read'
  | 'orders:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'ledger:read'
  | 'reports:read'
  | 'webhooks:manage'
  | 'admin';

export interface APIKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;       // first 8 chars for identification
  scopes: APIKeyScope[];
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  usage_count: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  trigger: string;
  payload_summary: string;
  status: 'delivered' | 'failed' | 'pending';
  http_status: number | null;
  attempted_at: string;
  response_ms: number | null;
}

export interface BundleComponent {
  sku_id: string;
  sku_name: string;           // denormalised for display
  qty: number;                // how many of this SKU per 1 bundle unit
}

export interface BundleDefinition {
  id: string;
  name: string;               // 'Lotion Bundle', 'Weekend Fruit Box'
  bundle_sku_id: string;      // the SKU that appears on order lines
  components: BundleComponent[];
  is_active: boolean;
  valid_from: string | null;  // null = always valid
  valid_until: string | null; // null = no expiry. Use for promotions.
  created_by: string;
  created_at: string;
  notes: string | null;
}

export interface SetupConfig {
  company_name: string;
  country: string;
  currency: string;
  primary_language: string;
  configured_at: string;
  configured_by_name: string;
  configured_by_email: string;
}

// SECTION 1 â€” CUSTOMER RETURNS
export type ReturnType =
  | 'doorstep_rejection'    // driver still at door, items in van
  | 'post_delivery'         // reported after delivery completed
  | 'driver_error';         // wrong address or items left incorrectly

export type ReturnLineDisposition =
  | 'RESTOCK'               // ambient/sealed/cold chain verified â€” back to stock
  | 'WRITE_OFF'             // cannot restock â€” fresh/temp-sensitive
  | 'SUPPLIER_CLAIM'        // quality issue traceable to supplier
  | 'CREDIT_ONLY';          // quality issue, no physical return needed

export type CustomerReturnStatus =
  | 'raised'
  | 'collection_scheduled'
  | 'in_transit_back'
  | 'received_at_warehouse'
  | 'inspected'
  | 'closed';

export interface CustomerReturnLine {
  id: string;
  order_line_id: string;
  sku_id: string;
  sku_name: string;
  batch_id: string;
  batch_number: string;
  qty_returned: number;           // base units
  reason: string;                 // customer stated reason
  temp_zone: string;
  cold_chain_intact: boolean | null;   // set on inspection
  disposition: ReturnLineDisposition | null;
  restocked_to_location_id: string | null;
  write_off_id: string | null;
  credit_value_cents: number;       // KES cents
  inspected_by: string | null;
  inspected_at: string | null;
}

export interface CustomerReturn {
  id: string;
  return_number: string;          // RET-0001
  order_id: string;
  delivery_id: string;
  customer_id: string;
  customer_name: string;
  return_type: ReturnType;
  status: CustomerReturnStatus;
  raised_by: string;
  raised_at: string;
  reason_summary: string;
  physical_collection_required: boolean;
  collection_driver_id: string | null;
  collection_scheduled_at: string | null;
  collected_at: string | null;
  collection_temp_celsius: number | null;
  received_at_warehouse_id: string | null;
  received_by: string | null;
  received_at: string | null;
  receipt_temp_celsius: number | null;
  lines: CustomerReturnLine[];
  total_credit_value_cents: number;
  credit_issued: boolean;
  credit_issued_at: string | null;
  closed_at: string | null;
  notes: string | null;
}

// SECTION 2 â€” CATALOGUE / PIM GATE
export interface VendorCard {
  id: string;
  sku_id: string;
  supplier_id: string;
  supplier_sku_code: string;      // supplier's own code for this product
  supplier_unit: string;          // 'case', 'pallet', 'each'
  units_per_supplier_unit: number;
  moq: number;                    // minimum order quantity in supplier units
  lead_time_days: number;
  price_cents: number;              // per supplier unit, KES cents
  is_preferred: boolean;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
}

// SECTION 3 â€” CROSS-DOCK EOD ZERO CHECK
export type CarryForwardReason =
  | 'DEMAND_SHORTFALL'            // stock transferred but not enough orders
  | 'DELIVERY_FAILED'             // orders existed but deliveries failed
  | 'OPERATIONAL_DELAY'           // late start, driver issues
  | 'QUALITY_HOLD';               // stock held pending inspection

export interface CrossDockEODCheck {
  id: string;
  warehouse_id: string;
  check_date: string;             // YYYY-MM-DD
  initiated_by: string;
  completed_at: string | null;
  status: 'pending' | 'completed';
  lines: CrossDockEODLine[];
  sellthrough_rate_pct: number | null;  // computed on completion
  total_transferred_cents: number;
  total_sold_cents: number;
  total_carried_forward_cents: number;
  total_written_off_cents: number;
}

export interface CrossDockEODLine {
  id: string;
  location_id: string;
  location_code: string;
  sku_id: string;
  sku_name: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  qty_transferred_in: number;     // what arrived from RGN today
  qty_sold: number;               // what was picked and dispatched
  qty_remaining: number;          // current qty_available
  resolution: 'ZERO' | 'CARRY_FORWARD' | 'WRITE_OFF' | null;
  carry_forward_reason: CarryForwardReason | null;
  write_off_id: string | null;
}

// SECTION 4 â€” WAREHOUSE ZONING RULES
export interface ZoningSeparationRule {
  id: string;
  warehouse_id: string;
  rule_type:
    | 'product_class_separation'
    | 'ethylene_separation'
    | 'allergen_separation';
  class_a: ProductClass;
  class_b: ProductClass;
  require_different_zones: boolean; // true = must be in different zones
  minimum_distance_m: number | null; // null if different zones required
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface CountingSection {
  id: string;
  warehouse_id: string;    // which warehouse this section belongs to
  name: string;            // fully operator-defined. No defaults.
                           // Examples: 'Chiller', 'Cold Room A',
                           // 'Dry Store', 'Butchery', 'Bakery' â€”
                           // whatever the operator's physical layout is.
  icon: string;            // lucide icon name, e.g. 'Thermometer',
                           // 'Package', 'Snowflake', 'Leaf', 'FlaskConical'
                           // Admin picks from a curated list in the UI.
  zone_ids: string[];      // which zone IDs belong to this section.
                           // Can be empty â€” admin links zones to sections
                           // when setting up. Counting works even before
                           // zones are linked.
  bin_prefix: string | null; // optional: items in bins whose code starts
                              // with this prefix belong to this section.
                              // e.g. 'DA-' captures DA-01-01, DA-01-02...
                              // null means no prefix filter.
  item_filter: string | null; // optional status filter to surface specific
                               // items during counting. Format: 'status:draft',
                               // 'status:blocked', 'status:delisted'.
                               // When set, items matching this filter are
                               // surfaced in the count view ALONGSIDE normal
                               // items â€” counting still happens at bin
                               // location, not separately. null = no filter.
  display_order: number;   // controls section grid sort order
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  details?: any;
}

export interface DbState {
  idempotency_keys: Record<string, { response: any; created_at: string }>;
  price_history: PriceHistory[];
  workflow_approvals: WorkflowApproval[];
  workflow_templates: WorkflowTemplate[];
  counting_sections: CountingSection[];
  asset_types: AssetType[];
  asset_events: AssetEvent[];
}




