import { CrudInterface, Table } from 'brackets-manager';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Firestore implementation of the CrudInterface for brackets-manager.
 */
export class FirestoreStorage implements CrudInterface {
    private db: Firestore;
    private rootPath: string;

    constructor(db: Firestore, rootPath: string) {
        this.db = db;
        this.rootPath = rootPath;
    }

    private getCollectionRef(table: string) {
        const parts = this.rootPath.split('/').filter(p => p.length > 0);

        if (parts.length % 2 !== 0) {
            return this.db.collection(this.rootPath).doc('_data').collection(table);
        }

        return this.db.doc(this.rootPath).collection(table);
    }

    private removeUndefined(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(item => this.removeUndefined(item));
        if (typeof obj !== 'object') return obj;

        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = this.removeUndefined(value);
            }
        }
        return cleaned;
    }

    async insert<T>(table: Table, value: T): Promise<number | T> {
        const colRef = this.getCollectionRef(table);

        if (Array.isArray(value)) {
            const batch = this.db.batch();
            const results: any[] = [];

            for (const item of value) {
                const docRef = colRef.doc();
                const data = this.removeUndefined({
                    id: docRef.id,
                    ...item,
                });
                batch.set(docRef, data);
                results.push(data);
            }

            await batch.commit();
            return results as unknown as T;
        }

        const docRef = colRef.doc();
        const data = this.removeUndefined({
            id: docRef.id,
            ...value,
        });
        await docRef.set(data);
        return data as T;
    }

    async select<T>(table: Table, arg?: number | string | Partial<T>): Promise<T[] | T | null> {
        if (arg === undefined) {
            const snapshot = await this.getCollectionRef(table).get();
            if (snapshot.empty) return null;
            return snapshot.docs.map(doc => doc.data() as T);
        }

        if (typeof arg === 'number' || typeof arg === 'string') {
            const snapshot = await this.getCollectionRef(table).where('id', '==', arg).get();
            if (snapshot.empty) return null;
            return snapshot.docs[0]?.data() as T || null;
        }

        let query: FirebaseFirestore.Query = this.getCollectionRef(table);
        for (const [key, val] of Object.entries(arg)) {
            if (val !== undefined) {
                query = query.where(key, '==', val);
            }
        }

        const snapshot = await query.get();
        if (snapshot.empty) return null;
        return snapshot.docs.map(doc => doc.data() as T);
    }

    async update<T>(table: Table, arg: number | string | Partial<T>, value: T): Promise<boolean> {
        let query: FirebaseFirestore.Query = this.getCollectionRef(table);

        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', arg);
        } else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    query = query.where(key, '==', val);
                }
            }
        }

        const snapshot = await query.get();
        if (snapshot.empty) return false;

        const cleanValue = this.removeUndefined(value);
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, cleanValue as any);
        });

        await batch.commit();
        return true;
    }

    async delete<T>(table: Table, arg?: number | string | Partial<T>): Promise<boolean> {
        let query: FirebaseFirestore.Query = this.getCollectionRef(table);

        if (arg === undefined) {
            const snapshot = await query.get();
            if (snapshot.empty) return true;

            const batch = this.db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            return true;
        }

        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', arg);
        } else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    query = query.where(key, '==', val);
                }
            }
        }

        const snapshot = await query.get();
        if (snapshot.empty) return false;

        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return true;
    }
}
