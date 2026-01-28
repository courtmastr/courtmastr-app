
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

async function debugMatches(tournamentId: string) {
    console.log(`\n🔍 Debugging matches for tournament: ${tournamentId}`);

    // 1. List all matches in the 'match' collection (brackets-manager schema)
    const matchesRef = db.collection(`tournaments/${tournamentId}/match`);
    const snapshot = await matchesRef.get();

    console.log(`Found ${snapshot.size} matches in 'match' collection.`);

    if (snapshot.empty) {
        console.log('❌ No matches found!');
        return;
    }

    // 2. Print the first match to see its structure
    const firstMatch = snapshot.docs[0].data();
    console.log('\n📄 First match structure:', JSON.stringify(firstMatch, null, 2));

    // 3. Check for stage_id field
    if (firstMatch.stage_id) {
        console.log(`\n✅ Match has 'stage_id': ${firstMatch.stage_id} (Type: ${typeof firstMatch.stage_id})`);
    } else {
        console.log('\n❌ Match matches missing "stage_id" field!');
        console.log('Available fields:', Object.keys(firstMatch));
    }
}

// Run with the tournament ID from the screenshot
debugMatches('uAotrf2nIfFaoZkDTJ2u').catch(console.error);
