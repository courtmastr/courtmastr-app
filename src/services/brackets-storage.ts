import { CrudInterface, Table, OmitId, DataTypes } from 'brackets-manager';
import { Firestore } from 'firebase/firestore';
import { collection, doc, getDocs, setDoc, query, where, writeBatch, Query, DocumentData } from 'firebase/firestore';

/**
 * ADAPTER CONSISTENCY:
 * Both client (brackets-storage.ts) and server (firestore-adapter.ts)
 * normalize all IDs to strings for Firestore compatibility.
 *
 * Path differences are intentional:
 * - Client: /categories/{id}/_data/{table} (category isolation)
 * - Server: /tournaments/{id}/{table} (tournament scope for CFs)
 *
 * Both adapters handle IDs identically after Phase 1.1 migration.
 */
export class ClientFirestoreStorage implements CrudInterface {
  private db: Firestore;
  private rootPath: string;
  private idCounters: Map<string, number> = new Map();

  constructor(db: Firestore, rootPath: string) {
    this.db = db;
    this.rootPath = rootPath;
  }

  private getNextId(table: string): number {
    const current = this.idCounters.get(table) || 0;
    this.idCounters.set(table, current + 1);
    return current;
  }

  private getCollectionRef(table: string) {
    return collection(this.db, `${this.rootPath}/${table}`);
  }

  private removeUndefined(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.removeUndefined(item));
    if (typeof obj !== 'object') return obj;

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        // Recursively clean nested objects
        cleaned[key] = this.removeUndefined(value);
      }
    }
    return cleaned;
  }

  private normalizeReferences(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.normalizeReferences(item));
    if (typeof obj !== 'object') return obj;

    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Special case: preserve 'id' field type (don't convert to string)
      // This allows brackets-manager to query by numeric ID
      if (key === 'id') {
        normalized[key] = value; // Keep as-is (number or string)
      }
      // Convert foreign key references (stage_id, round_id, etc.) to strings
      else if (key.endsWith('_id') && key !== 'id') {
        if (value && typeof value === 'object' && 'id' in value) {
          normalized[key] = String(value.id); // Convert to string (match server adapter)
        } else {
          normalized[key] = value; // Keep as is
        }
      }
      // Recursively handle nested objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        normalized[key] = this.normalizeReferences(value);
      }
      // Recursively handle arrays
      else if (Array.isArray(value)) {
        normalized[key] = value.map(item => this.normalizeReferences(item));
      }
      // All other values - keep as-is
      else {
        normalized[key] = value; // Changed from String(value) to preserve types
      }
    }
    return normalized;
  }

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]>): Promise<number>;
  async insert<T extends Table>(table: T, values: OmitId<DataTypes[T]>[]): Promise<boolean>;

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]> | OmitId<DataTypes[T]>[]): Promise<number | boolean> {
    const colRef = this.getCollectionRef(table);

    if (Array.isArray(value)) {
      console.log(`📦 [ClientFirestoreStorage] Batch inserting ${value.length} items to ${table}`);
      if (value.length === 0) return true;

      const BATCH_SIZE = 500;
      for (let i = 0; i < value.length; i += BATCH_SIZE) {
        const chunk = value.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(this.db);

        for (const item of chunk) {
          const itemWithId = item as any;
          // If item has an id, use it; otherwise generate one
          const originalId = itemWithId.id;
          const docId = originalId !== undefined ? String(originalId) : doc(colRef).id;
          const docRef = doc(colRef, docId);

          // Store the id field as whatever was provided (or generate if missing)
          const idToStore = originalId !== undefined ? originalId : docId;
          const data = this.removeUndefined(this.normalizeReferences({
            ...item,
            id: idToStore,
          }));
          batch.set(docRef, data);
        }

        await batch.commit();
      }
      console.log(`   ✅ [ClientFirestoreStorage] Batch insert complete`);
      return true;
    }

    // Single insert - brackets-manager calls this for stages, matches, etc.
    const valueWithId = value as any;
    const originalId = valueWithId.id;

    // Generate numeric ID if not provided (brackets-manager/viewer require numeric IDs)
    const idToStore = originalId !== undefined ? originalId : this.getNextId(table);

    // Use Firestore doc ID for document path, but store numeric id in data
    const docRef = doc(colRef, String(idToStore));

    const data = this.removeUndefined(this.normalizeReferences({
      ...value,
      id: idToStore,
    }));

    console.log(`📝 [ClientFirestoreStorage] Inserting ${table} with id:`, idToStore);
    await setDoc(docRef, data);

    // Return the numeric id (brackets-manager uses this)
    return idToStore as number;
  }

  async select<T>(table: Table, arg?: number | string | Partial<T>): Promise<T[] | T | null> {
    const colRef = this.getCollectionRef(table);

    if (arg === undefined) {
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) return null;
      return snapshot.docs.map(doc => doc.data() as T);
    }

    if (typeof arg === 'number' || typeof arg === 'string') {
      const id = typeof arg === 'string' && /^\d+$/.test(arg) ? parseInt(arg, 10) : arg;
      const q = query(colRef, where('id', '==', id));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;
      return snapshot.docs[0]?.data() as T || null;
    }

    let q = query(colRef);
    for (const [key, val] of Object.entries(arg)) {
      if (val !== undefined) {
        q = query(q, where(key, '==', val));
      }
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs.map(doc => doc.data() as T);
  }

  private buildFilteredQuery<T>(
    table: Table,
    arg: number | string | Partial<T> | undefined
  ): Query<DocumentData> {
    const colRef = this.getCollectionRef(table);
    let q = query(colRef);

    if (arg === undefined) {
      return q;
    }

    if (typeof arg === 'number' || typeof arg === 'string') {
      const id = typeof arg === 'string' && /^\d+$/.test(arg) ? parseInt(arg, 10) : arg;
      q = query(q, where('id', '==', id));
    } else {
      for (const [key, val] of Object.entries(arg)) {
        if (val !== undefined) {
          q = query(q, where(key, '==', val));
        }
      }
    }

    return q;
  }

  async update<T>(table: Table, arg: number | string | Partial<T>, value: T): Promise<boolean> {
    const q = this.buildFilteredQuery(table, arg);
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;

    const cleanValue = this.removeUndefined(value);
    const batch = writeBatch(this.db);
    snapshot.docs.forEach(d => {
      batch.update(d.ref, cleanValue as any);
    });

    await batch.commit();
    return true;
  }

  async delete<T>(table: Table, arg?: number | string | Partial<T>): Promise<boolean> {
    if (arg === undefined) {
      const colRef = this.getCollectionRef(table);
      const snapshot = await getDocs(query(colRef));
      if (snapshot.empty) return true;

      const batch = writeBatch(this.db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return true;
    }

    const q = this.buildFilteredQuery(table, arg);
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;

    const batch = writeBatch(this.db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return true;
  }
}
