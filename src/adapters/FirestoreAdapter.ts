// src/adapters/FirestoreAdapter.ts
// Firebase Firestore adapter for FreshOpsPlatform.
// Uses firebase-admin SDK (server-side).
//
// Required environment variables:
//   DATABASE_ADAPTER=firestore
//   DATABASE_URL=your-firebase-project-id
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//     OR set individual credential env vars (see Firebase docs)
//
// For local development with the Firebase Emulator:
//   FIRESTORE_EMULATOR_HOST=localhost:8080
//   DATABASE_ADAPTER=firestore
//   DATABASE_URL=freshops-local  (any project ID works with emulator)

import { DatabaseAdapter, QueryFilter } from './DatabaseAdapter';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Query } from 'firebase-admin/firestore';

export class FirestoreAdapter implements DatabaseAdapter {
  private projectId: string;
  private firestore: Firestore | null = null;
  private connected = false;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  async connect(): Promise<void> {
    try {
      // Initialize Firebase Admin SDK if not already initialized
      if (!getApps().length) {
        const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

        if (emulatorHost) {
          // Local emulator mode — no credentials needed
          console.log(`[FirestoreAdapter] Connecting to Firestore emulator at ${emulatorHost}`);
          initializeApp({
            projectId: this.projectId
          });
        } else {
          // Production mode — uses GOOGLE_APPLICATION_CREDENTIALS
          // environment variable automatically
          console.log(`[FirestoreAdapter] Connecting to Firestore project: ${this.projectId}`);
          initializeApp({
            credential: applicationDefault(),
            projectId: this.projectId
          });
        }
      }

      this.firestore = getFirestore();

      // Verify connectivity with a lightweight read
      await this.firestore.collection('_health').doc('ping').get();

      this.connected = true;
      console.log('[FirestoreAdapter] Connected successfully.');
    } catch (err: any) {
      // Health check doc not existing is fine — means the DB is
      // empty and accessible. Any other error is a real failure.
      if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
        this.connected = true;
        console.log('[FirestoreAdapter] Connected (empty database).');
      } else {
        throw new Error(
          `[FirestoreAdapter] Failed to connect to Firestore project ` +
          `"${this.projectId}": ${err.message}\n\n` +
          `Ensure GOOGLE_APPLICATION_CREDENTIALS points to a valid ` +
          `service account JSON file, or set FIRESTORE_EMULATOR_HOST ` +
          `for local development.`
        );
      }
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // firebase-admin handles connection pooling automatically
  }

  isConnected(): boolean {
    return this.connected;
  }

  private get db(): Firestore {
    if (!this.firestore) {
      throw new Error('[FirestoreAdapter] Not connected. Call connect() first.');
    }
    return this.firestore;
  }

  // --------------- Generic CRUD ---------------

  async findAll<T>(
    collection: string,
    filter?: QueryFilter
  ): Promise<T[]> {
    let query: Query = this.db.collection(collection);

    if (filter) {
      // Apply simple equality filters from the QueryFilter object.
      // For complex queries, callers should use findOne or runTransaction.
      Object.entries(filter).forEach(([field, value]) => {
        if (value !== undefined) {
          query = query.where(field, '==', value);
        }
      });
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  async findById<T>(
    collection: string,
    id: string
  ): Promise<T | null> {
    const doc = await this.db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  }

  async findOne<T>(
    collection: string,
    filter: QueryFilter
  ): Promise<T | null> {
    let query: Query = this.db.collection(collection);
    Object.entries(filter).forEach(([field, value]) => {
      if (value !== undefined) {
        query = query.where(field, '==', value);
      }
    });
    query = query.limit(1);
    const snapshot = await query.get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as T;
  }

  async create<T>(
    collection: string,
    data: any
  ): Promise<T> {
    if (!data.id) {
      throw new Error(
        `[FirestoreAdapter] create() requires data.id to be set. ` +
        `FreshOpsPlatform generates all IDs server-side before persisting.`
      );
    }
    const { id, ...rest } = data;
    await this.db.collection(collection).doc(id).set({
      ...rest,
      _created_at: FieldValue.serverTimestamp()
    });
    return data as T;
  }

  async update<T>(
    collection: string,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const ref = this.db.collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({
      ...updates,
      _updated_at: FieldValue.serverTimestamp()
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as T;
  }

  async delete(
    collection: string,
    id: string
  ): Promise<boolean> {
    const ref = this.db.collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  // --------------- Ledger (append-only) ---------------

  async appendToLedger(entry: any): Promise<any> {
    // The stock ledger is append-only — never update, never delete.
    // This is one of the five TLA+-verified invariants of this system.
    if (!entry.id) {
      throw new Error('[FirestoreAdapter] Ledger entries must have an id.');
    }
    const { id, ...rest } = entry;
    await this.db.collection('stock_ledger').doc(id).set({
      ...rest,
      _appended_at: FieldValue.serverTimestamp()
    });
    return entry;
  }

  async queryLedger(filter: {
    sku_id?: string;
    batch_id?: string;
    location_id?: string;
    warehouse_id?: string;
    transaction_type?: string | string[];
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query: Query =
      this.db.collection('stock_ledger');

    if (filter.sku_id) {
      query = query.where('sku_id', '==', filter.sku_id);
    }
    if (filter.batch_id) {
      query = query.where('batch_id', '==', filter.batch_id);
    }
    if (filter.location_id) {
      query = query.where('location_id', '==', filter.location_id);
    }
    if (filter.warehouse_id) {
      query = query.where('warehouse_id', '==', filter.warehouse_id);
    }
    if (filter.transaction_type) {
      if (Array.isArray(filter.transaction_type)) {
        query = query.where('transaction_type', 'in',
          filter.transaction_type);
      } else {
        query = query.where('transaction_type', '==',
          filter.transaction_type);
      }
    }
    if (filter.from) {
      query = query.where('created_at', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('created_at', '<=', filter.to);
    }

    // Order by created_at ascending (chronological ledger order)
    query = query.orderBy('created_at', 'asc');

    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // --------------- Transactions ---------------

  async runTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // Firestore transactions require passing the transaction object
    // through — this simplified wrapper runs the provided function
    // within a Firestore transaction context.
    // For full transaction support, callers that need atomic reads
    // and writes should use db.runTransaction() directly.
    return await this.db.runTransaction(async () => {
      return await fn();
    });
  }

  // --------------- State management (legacy compatibility) ---------------
  // These methods exist for compatibility with the JsonFileAdapter
  // interface. In Firestore mode, loadAll() fetches every collection
  // and saveAll() writes every collection as a batch. These are
  // used during migration (bulk import of existing JSON state into
  // Firestore) and should not be called in normal operation.

  async loadAll(): Promise<Record<string, any[]>> {
    const COLLECTIONS = [
      'users', 'warehouses', 'zones', 'locations', 'suppliers',
      'categories', 'skus', 'batches', 'stock_ledger',
      'purchase_orders', 'purchase_order_lines',
      'goods_receipts', 'goods_receipt_lines',
      'customer_orders', 'customer_order_lines', 'customers',
      'pick_lists', 'pick_list_lines', 'transfers', 'transfer_lines',
      'cycle_counts', 'cycle_count_lines', 'write_offs', 'write_off_lines',
      'delivery_manifests', 'delivery_manifest_lines', 'delivery_assets',
      'assembly_templates', 'assembly_orders', 'assembly_order_lines',
      'assets', 'asset_types', 'asset_events',
      'notifications', 'webhooks', 'api_keys',
      'custom_roles', 'workflow_approvals', 'workflow_templates',
      'price_history', 'counting_sections',
      'idempotency_keys', 'audit_logs'
    ];

    const result: Record<string, any[]> = {};
    await Promise.all(
      COLLECTIONS.map(async col => {
        const snapshot = await this.db.collection(col).get();
        result[col] = snapshot.docs.map(
          doc => ({ id: doc.id, ...doc.data() })
        );
      })
    );
    return result;
  }

  async saveAll(state: Record<string, any[]>): Promise<void> {
    // Batch writes in groups of 500 (Firestore limit per batch)
    const BATCH_SIZE = 500;

    for (const [collection, items] of Object.entries(state)) {
      if (!items || items.length === 0) continue;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = this.db.batch();
        const chunk = items.slice(i, i + BATCH_SIZE);

        chunk.forEach(item => {
          if (!item.id) return; // skip items without IDs
          const { id, ...rest } = item;
          const ref = this.db.collection(collection).doc(id);
          batch.set(ref, rest, { merge: true });
        });

        await batch.commit();
        console.log(
          `[FirestoreAdapter] Saved ${chunk.length} items to ${collection}`
        );
      }
    }
  }
}
