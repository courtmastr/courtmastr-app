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
    /**
     * CRITICAL: Normalize object references to IDs and ensure type consistency
     *
     * This method handles two key scenarios:
     * 1. Object references: brackets-manager passes objects for stage_id, group_id, round_id
     *    We extract just the 'id' property to avoid storing nested objects
     *
     * 2. ID type consistency: Convert ALL *_id fields to strings for consistent querying
     *    Firestore document IDs are strings, so we normalize all ID fields to strings
     */
    normalizeReferences(obj) {
        if (obj === null || obj === undefined)
            return obj;
        if (Array.isArray(obj))
            return obj.map(item => this.normalizeReferences(item));
        if (typeof obj !== 'object')
            return obj;
        const normalized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Handle _id fields specially
            if (key.endsWith('_id') || key === 'id') {
                if (value && typeof value === 'object' && 'id' in value) {
                    // Extract ID from object reference and convert to string
                    normalized[key] = String(value.id);
                }
                else if (value !== null && value !== undefined) {
                    // Convert primitive ID values to strings for consistency
                    normalized[key] = String(value);
                }
                else {
                    normalized[key] = value;
                }
            }
            else if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively normalize nested objects
                normalized[key] = this.normalizeReferences(value);
            }
            else if (Array.isArray(value)) {
                // Recursively normalize arrays
                normalized[key] = value.map(item => this.normalizeReferences(item));
            }
            else {
                normalized[key] = value;
            }
        }
        return normalized;
    }
    // Implementation signature
    async insert(table, value) {
        const colRef = this.getCollectionRef(table);
        if (Array.isArray(value)) {
            console.log(`📦 [FirestoreAdapter] Batch inserting ${value.length} items to ${table}`);
            if (value.length === 0) {
                console.log(`   ⚠️  Empty array, returning true`);
                return true;
            }
            // Firestore batch limit is 500 operations
            const BATCH_SIZE = 500;
            const batches = [];
            for (let i = 0; i < value.length; i += BATCH_SIZE) {
                const chunk = value.slice(i, i + BATCH_SIZE);
                const batch = this.db.batch();
                for (const item of chunk) {
                    const docRef = colRef.doc();
                    const data = this.normalizeReferences(this.removeUndefined({
                        id: docRef.id,
                        ...item,
                    }));
                    batch.set(docRef, data);
                }
                batches.push(batch);
            }
            try {
                await Promise.all(batches.map(b => b.commit()));
                console.log(`   ✅ Successfully committed ${batches.length} batch(es)`);
                return true;
            }
            catch (error) {
                console.error(`   ❌ Batch commit failed:`, error);
                throw new Error(`Failed to insert batch into ${table}: ${error}`);
            }
        }
        // Single insert
        const docRef = colRef.doc();
        const data = this.normalizeReferences(this.removeUndefined({
            id: docRef.id,
            ...value,
        }));
        try {
            await docRef.set(data);
            console.log(`   ✅ [FirestoreAdapter] Created ${table} document: ${docRef.id}`);
            // Return the string ID as-is (brackets-manager will use it as a key)
            return docRef.id;
        }
        catch (error) {
            console.error(`   ❌ Failed to insert ${table}:`, error);
            throw new Error(`Failed to insert into ${table}: ${error}`);
        }
    }
    async select(table, arg) {
        var _a;
        if (arg === undefined) {
            console.log(`🔍 [FirestoreAdapter] Selecting all from ${table}`);
            const snapshot = await this.getCollectionRef(table).get();
            if (snapshot.empty) {
                console.log(`   ⚠️  No documents found`);
                return null;
            }
            const results = snapshot.docs.map(doc => doc.data());
            console.log(`   ✅ Found ${results.length} documents`);
            return results;
        }
        if (typeof arg === 'number' || typeof arg === 'string') {
            console.log(`🔍 [FirestoreAdapter] Selecting ${table} by id: ${arg}`);
            const snapshot = await this.getCollectionRef(table).where('id', '==', String(arg)).get();
            if (snapshot.empty) {
                console.log(`   ⚠️  No document found with id=${arg}`);
                return null;
            }
            const result = ((_a = snapshot.docs[0]) === null || _a === void 0 ? void 0 : _a.data()) || null;
            console.log(`   ${result ? '✅ Found' : '⚠️  Not found'}`);
            return result;
        }
        console.log(`🔍 [FirestoreAdapter] Selecting ${table} with filter:`, arg);
        let query = this.getCollectionRef(table);
        for (const [key, val] of Object.entries(arg)) {
            if (val !== undefined) {
                // Convert numeric values to strings for ID fields
                const queryVal = (key.endsWith('_id') || key === 'id') ? String(val) : val;
                query = query.where(key, '==', queryVal);
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log(`   ⚠️  No documents found matching filter`);
            return null;
        }
        const results = snapshot.docs.map(doc => doc.data());
        console.log(`   ✅ Found ${results.length} documents`);
        return results;
    }
    async update(table, arg, value) {
        console.log(`📝 [FirestoreAdapter] Updating ${table}`);
        let query = this.getCollectionRef(table);
        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', String(arg));
        }
        else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    const queryVal = (key.endsWith('_id') || key === 'id') ? String(val) : val;
                    query = query.where(key, '==', queryVal);
                }
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log(`   ⚠️  No documents found to update`);
            return false;
        }
        const cleanValue = this.removeUndefined(value);
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, cleanValue);
        });
        try {
            await batch.commit();
            console.log(`   ✅ Updated ${snapshot.size} document(s)`);
            return true;
        }
        catch (error) {
            console.error(`   ❌ Update failed:`, error);
            return false;
        }
    }
    async delete(table, arg) {
        console.log(`🗑️  [FirestoreAdapter] Deleting from ${table}`);
        let query = this.getCollectionRef(table);
        if (arg === undefined) {
            const snapshot = await query.get();
            if (snapshot.empty)
                return true;
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`   ✅ Deleted ${snapshot.size} document(s)`);
            return true;
        }
        if (typeof arg === 'number' || typeof arg === 'string') {
            query = query.where('id', '==', String(arg));
        }
        else {
            for (const [key, val] of Object.entries(arg)) {
                if (val !== undefined) {
                    const queryVal = (key.endsWith('_id') || key === 'id') ? String(val) : val;
                    query = query.where(key, '==', queryVal);
                }
            }
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log(`   ⚠️  No documents found to delete`);
            return false;
        }
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        try {
            await batch.commit();
            console.log(`   ✅ Deleted ${snapshot.size} document(s)`);
            return true;
        }
        catch (error) {
            console.error(`   ❌ Delete failed:`, error);
            return false;
        }
    }
}
exports.FirestoreStorage = FirestoreStorage;
//# sourceMappingURL=firestore-adapter.js.map