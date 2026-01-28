import * as admin from 'firebase-admin';
import { getBracketsManager } from './manager';

// Auto-detect emulator or set explicitly
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('⚠️  FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080');
    console.log('   Make sure the emulator is running: npm run emulators');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-courtmaster' });
}

console.log(`🔌 Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);

async function diagnoseIssue() {
    const tournamentId = 'test_diagnosis';

    console.log('🔬 DIAGNOSIS: Testing FirestoreAdapter contract compliance\n');
    console.log('='.repeat(80));

    const manager = getBracketsManager(tournamentId);

    // Test 1: Verify insert() return type for single object
    console.log('\n📋 TEST 1: Single object insert return type');
    const testParticipant = { name: 'Test Player', tournament_id: 1 };
    const participantResult = await manager.storage.insert('participant', testParticipant);
    console.log(`   Returned type: ${typeof participantResult}`);
    console.log(`   Returned value:`, participantResult);
    console.log(`   Expected: number or string (usable as ID)`);
    console.log(`   Status: ${typeof participantResult === 'number' || typeof participantResult === 'string' ? '✅ PASS' : '❌ FAIL'}`);

    // Test 2: Verify insert() return type for array
    console.log('\n📋 TEST 2: Array insert return type');
    const testMatches = [
        {
            stage_id: '1',
            group_id: '1',
            round_id: '1',
            number: 1,
            status: 0,
            child_count: 0,
            opponent1: { id: 1 },
            opponent2: { id: 2 }
        },
        {
            stage_id: '1',
            group_id: '1',
            round_id: '1',
            number: 2,
            status: 0,
            child_count: 0,
            opponent1: { id: 3 },
            opponent2: { id: 4 }
        }
    ];
    const matchesResult = await manager.storage.insert('match', testMatches as any);
    console.log(`   Returned type: ${typeof matchesResult}`);
    console.log(`   Returned value type: ${Array.isArray(matchesResult) ? 'array' : typeof matchesResult}`);
    console.log(`   Expected: boolean (true on success)`);
    console.log(`   Status: ${typeof matchesResult === 'boolean' ? '✅ PASS' : '❌ FAIL'}`);

    // Test 3: Attempt minimal stage creation
    console.log('\n📋 TEST 3: Minimal double elimination stage creation');
    try {
        const stage = await manager.create.stage({
            tournamentId: 1,
            name: 'Test Stage',
            type: 'double_elimination',
            seeding: ['P1', 'P2', 'P3', 'P4'],
            settings: { grandFinal: 'simple' }
        });

        console.log(`   Stage created: ${stage.id}`);
        console.log(`   Stage ID type: ${typeof stage.id}`);

        // Check if matches were created
        const matches = await manager.storage.select('match', { stage_id: String(stage.id) });
        const matchCount = Array.isArray(matches) ? matches.length : (matches ? 1 : 0);
        console.log(`   Matches created: ${matchCount}`);
        console.log(`   Expected for 4 players DE: 6-7 matches (3 WB + 2-3 LB + 1 GF)`);
        console.log(`   Status: ${matchCount >= 6 ? '✅ PASS' : '❌ FAIL'}`);

        if (matchCount > 0 && matches) {
            const sampleMatch = Array.isArray(matches) ? matches[0] : matches;
            console.log(`   Sample match structure:`, JSON.stringify(sampleMatch, null, 2));
        }

    } catch (error) {
        console.error(`   ❌ Stage creation failed:`, error);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔬 DIAGNOSIS COMPLETE\n');
}

diagnoseIssue().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
