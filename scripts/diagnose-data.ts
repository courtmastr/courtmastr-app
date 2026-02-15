
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'demo-api-key',
    authDomain: 'demo-courtmaster.firebaseapp.com',
    projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

async function diagnose() {
    console.log('--- DIAGNOSIS START ---');

    const tourneysSnap = await getDocs(collection(db, 'tournaments'));
    console.log(`Found ${tourneysSnap.size} tournaments`);

    for (const tDoc of tourneysSnap.docs) {
        console.log(`\nTournament: ${tDoc.id} (${tDoc.data().name})`);

        // Check Root Collections
        const rootStages = await getDocs(collection(db, `tournaments/${tDoc.id}/stage`));
        console.log(`  Root 'stage': ${rootStages.size} docs`);
        const rootMatches = await getDocs(collection(db, `tournaments/${tDoc.id}/match`));
        console.log(`  Root 'match': ${rootMatches.size} docs`);

        // Check Categories
        const catSnap = await getDocs(collection(db, `tournaments/${tDoc.id}/categories`));
        console.log(`  Categories: ${catSnap.size} docs`);

        for (const catDoc of catSnap.docs) {
            console.log(`    Category: ${catDoc.id}`);

            // Check Sub-collections
            const subStages = await getDocs(collection(db, `tournaments/${tDoc.id}/categories/${catDoc.id}/stage`));
            console.log(`      Sub 'stage': ${subStages.size} docs`);

            const subMatches = await getDocs(collection(db, `tournaments/${tDoc.id}/categories/${catDoc.id}/match`));
            console.log(`      Sub 'match': ${subMatches.size} docs`);

            // Check _data wrapper
            // Note: Client SDK cannot list subcollections, so we guess common Bracket Manager patterns
            // Default: collection(db, 'tournaments/.../categories/.../_data/stage/stage')?
            // Or just a document '_data/stage'?
        }
    }
    console.log('--- DIAGNOSIS END ---');
    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
