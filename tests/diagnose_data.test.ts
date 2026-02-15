
import { describe, it } from 'vitest';
import { initializeTestApp } from 'firebase/testing';
import { collection, getDocs, getFirestore, query, where, doc, getDoc } from 'firebase/firestore';

// Configuration
const PROJECT_ID = 'demo-courtmaster'; // Using the standard emulator project ID
const EMULATOR_HOST = 'localhost';
const EMULATOR_PORT = 8080;

describe('Data Diagnosis', () => {
    it('lists all tournaments and their sub-collections', async () => {
        // Initialize app pointing to emulator
        const app = initializeTestApp({ projectId: PROJECT_ID });
        const db = app.firestore();

        console.log('--- DIAGNOSIS START ---');

        // 1. List Tournaments
        const tourneysSnap = await db.collection('tournaments').get();
        console.log(`Found ${tourneysSnap.size} tournaments`);

        for (const doc of tourneysSnap.docs) {
            console.log(`\nTournament: ${doc.id}`);
            const data = doc.data();
            console.log(`  Name: ${data.name}`);

            // Check for legacy root collections
            const rootStages = await doc.ref.collection('stage').get();
            console.log(`  Root 'stage' collection: ${rootStages.size} docs`);

            const rootMatches = await doc.ref.collection('match').get();
            console.log(`  Root 'match' collection: ${rootMatches.size} docs`);

            // Check for 'categories' sub-collection
            const categoriesSnap = await doc.ref.collection('categories').get();
            console.log(`  'categories' collection: ${categoriesSnap.size} docs`);

            for (const catDoc of categoriesSnap.docs) {
                console.log(`    Category: ${catDoc.id}`);

                // Check for sub-collections in category
                const catStages = await catDoc.ref.collection('stage').get();
                console.log(`      'stage' collection: ${catStages.size} docs`);

                const catMatches = await catDoc.ref.collection('match').get();
                console.log(`      'match' collection: ${catMatches.size} docs`);

                // Check for '_data' wrapper (brackets-manager default)
                const dataStages = await catDoc.ref.collection('_data').doc('stage').collection('stage').get().catch(() => ({ size: 0 }));
                // Note: _data is usually a document with subcollections? Or a collection?
                // Brackets manager default is often root/categories/id/_data/stage...

                // Let's check explicitly for '_data' collection
                const dataCol = await catDoc.ref.collection('_data').get();
                console.log(`      '_data' collection: ${dataCol.size} docs`);

                if (dataCol.size > 0) {
                    for (const d of dataCol.docs) {
                        console.log(`        Doc inside _data: ${d.id}`);
                        // Check if this doc has subcollections?
                    }
                }
            }
        }

        console.log('--- DIAGNOSIS END ---');
    });
});
