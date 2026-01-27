"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreStorage = void 0;
/**
 * Firestore implementation of the CrudInterface for brackets-manager.
 */
class FirestoreStorage {
    constructor(db, rootPath) {
        this.db = db;
        this.rootPath = rootPath;
    }
    getCollectionRef(table) {
        const parts = this.rootPath.split('/').filter(p => p.length > 0);
        if (parts.length % 2 !== 0) {
            return this.db.collection(this.rootPath).doc('_data').collection(table);
        }
        return this.db.doc(this.rootPath).collection(table);
    }
    removeUndefined(obj) {
        if (obj === null || obj === undefined)
            return obj;
        if (Array.isArray(obj))
            return obj.map(item => this.removeUndefined(item));
        if (typeof obj !== 'object')
            return obj;
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = this.removeUndefined(value);
            }
        }
        return cleaned;
    }
    async insert(table, value) {
        const colRef = this.getCollectionRef(table);
        if (Array.isArray(value)) {
            const batch = this.db.batch();
            const results = [];
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
            return results;
        }
        const docRef = colRef.doc();
        const data = this.removeUndefined({
            id: docRef.id,
            ...value,
        });
        await docRef.set(data);
        return data;
    }
    async select(table, arg) {
        var _a;
        if (arg === undefined) {
            const snapshot = await this.getCollectionRef(table).get();
            if (snapshot.empty)
                return null;
            return snapshot.docs.map(doc => doc.data());
        }
        if (typeof arg === 'number' || typeof arg === 'string') {
            const snapshot = await this.getCollectionRef(table).where('id', '==', arg).get();
            if (snapshot.empty)
                return null;
            return ((_a = snapshot.docs[0]) === null || _a === void 0 ? void 0 : _a.data()) || null;
        }
        let query = this.getCollectionRef(table);
        for (const [key, val] of Object.entries(arg)) {
            if (val !== undefined) {
                query = query.where(key, '==', val);
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty)
            return null;
        return snapshot.docs.map(doc => doc.data());
    }
    async update(table, arg, value) {
        let query = this.getCollectionRef(table);
        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', arg);
        }
        else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    query = query.where(key, '==', val);
                }
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty)
            return false;
        const cleanValue = this.removeUndefined(value);
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, cleanValue);
        });
        await batch.commit();
        return true;
    }
    async delete(table, arg) {
        let query = this.getCollectionRef(table);
        if (arg === undefined) {
            const snapshot = await query.get();
            if (snapshot.empty)
                return true;
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            return true;
        }
        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', arg);
        }
        else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    query = query.where(key, '==', val);
                }
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty)
            return false;
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return true;
    }
}
exports.FirestoreStorage = FirestoreStorage;
//# sourceMappingURL=firestore-adapter.js.map