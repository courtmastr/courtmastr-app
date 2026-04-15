import { CrudInterface, Table, OmitId, DataTypes } from 'brackets-manager';
import { Firestore } from 'firebase/firestore';
import { collection, doc, getDocs, setDoc, query, where, writeBatch, Query, DocumentData } from 'firebase/firestore';
import { normalizeReferences, removeUndefinedDeep } from './brackets-storage-utils';
import { logger } from '../utils/logger';

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

  /**
   * Reads existing documents in each table and advances the ID counter past
   * the current maximum. Call this before generating a new stage into a path
   * that already contains data (e.g. elimination stage after pool stage) so
   * the new stage receives non-colliding IDs.
   */
  async seedCountersFromExisting(tables: string[]): Promise<void> {
    for (const table of tables) {
      const colRef = this.getCollectionRef(table);
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        let maxId = -1;
        snapshot.docs.forEach((d) => {
          const id = (d.data() as { id?: unknown }).id;
          if (typeof id === 'number' && id > maxId) maxId = id;
        });
        if (maxId >= 0) this.idCounters.set(table, maxId + 1);
      }
    }
  }

  private getCollectionRef(table: string) {
    return collection(this.db, `${this.rootPath}/${table}`);
  }

  private getRecordId(value: unknown): unknown {
    if (value && typeof value === 'object' && 'id' in value) {
      return (value as { id?: unknown }).id;
    }
    return undefined;
  }

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]>): Promise<number>;
  async insert<T extends Table>(table: T, values: OmitId<DataTypes[T]>[]): Promise<boolean>;

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]> | OmitId<DataTypes[T]>[]): Promise<number | boolean> {
    const colRef = this.getCollectionRef(table);

    if (Array.isArray(value)) {
      logger.debug(`📦 [ClientFirestoreStorage] Batch inserting ${value.length} items to ${table}`);
      if (value.length === 0) return true;

      const BATCH_SIZE = 500;
      for (let i = 0; i < value.length; i += BATCH_SIZE) {
        const chunk = value.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(this.db);

        for (const item of chunk) {
          // If item has an id, use it; otherwise generate one
          const originalId = this.getRecordId(item);
          const docId = originalId !== undefined ? String(originalId) : doc(colRef).id;
          const docRef = doc(colRef, docId);

          // Store the id field as whatever was provided (or generate if missing)
          const idToStore = originalId !== undefined ? originalId : docId;
          const data = removeUndefinedDeep(normalizeReferences({
            ...item,
            id: idToStore,
          }));
          batch.set(docRef, data);
        }

        await batch.commit();
      }
      logger.debug(`   ✅ [ClientFirestoreStorage] Batch insert complete`);
      return true;
    }

    // Single insert - brackets-manager calls this for stages, matches, etc.
    const originalId = this.getRecordId(value);

    // Generate numeric ID if not provided (brackets-manager/viewer require numeric IDs)
    const idToStore = originalId !== undefined ? originalId : this.getNextId(table);

    // Use Firestore doc ID for document path, but store numeric id in data
    const docRef = doc(colRef, String(idToStore));

    const data = removeUndefinedDeep(normalizeReferences({
      ...value,
      id: idToStore,
    }));

    logger.debug(`📝 [ClientFirestoreStorage] Inserting ${table} with id:`, idToStore);
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

    const cleanValue = removeUndefinedDeep(value);
    const batch = writeBatch(this.db);
    snapshot.docs.forEach(d => {
      batch.update(d.ref, cleanValue as DocumentData);
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
