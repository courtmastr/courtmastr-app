
import * as admin from 'firebase-admin';

// Auto-detect emulator or set explicitly
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('⚠️  FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080');
    console.log('   Make sure the emulator is running: npm run emulators');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-courtmaster',
    });
}

console.log(`🔌 Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);

const db = admin.firestore();

async function debugFirestore(tournamentId: string) {
    console.log(`\n🔍 DEEP DEBUG for tournament: ${tournamentId}`);

    try {
        const tournamentRef = db.collection('tournaments').doc(tournamentId);

        // Check 'match' (singular)
        const matchCol = tournamentRef.collection('match');
        const matchDocs = await matchCol.get();
        console.log(`\n'match' (singular) count: ${matchDocs.size}`);

        // Check 'matches' (plural) - legacy or potential misconfiguration
        const matchesCol = tournamentRef.collection('matches');
        const matchesDocs = await matchesCol.get();
        console.log(`'matches' (plural) count: ${matchesDocs.size}`);

        // Check 'stage'
        const stageCol = tournamentRef.collection('stage');
        const stageDocs = await stageCol.get();
        console.log(`'stage' count: ${stageDocs.size}`);

        if (!matchDocs.empty) {
            console.log('✅ Found data in singular "match" collection. Sample ID:', matchDocs.docs[0].id);
            console.log('Sample Data:', JSON.stringify(matchDocs.docs[0].data(), null, 2));
        }

        if (!matchesDocs.empty) {
            console.log('⚠️ Found data in plural "matches" collection (Legacy?). Sample ID:', matchesDocs.docs[0].id);
        }

    } catch (error) {
        console.error('❌ ERROR:', error);
    }
}

// Run with the tournament ID from the screenshot
debugFirestore('uAotrf2nIfFaoZkDTJ2u').catch(console.error);
