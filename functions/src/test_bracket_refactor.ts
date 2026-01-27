// Test the refactored bracket generation using brackets-manager
import * as admin from 'firebase-admin';
import { getBracketsManager } from './manager';
import { generateBracket } from './bracket';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-project',
    });
}

async function testBracketGeneration() {
    const tournamentId = 'test_bracket_generation';
    const categoryId = 'test_category';
    const db = admin.firestore();

    try {
        // Create a test category
        await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .set({
                name: 'Test Category',
                format: 'double_elimination',
                status: 'draft',
            });

        // Create test registrations
        const playerNames = ['Player A', 'Player B', 'Player C', 'Player D'];
        for (let i = 0; i < playerNames.length; i++) {
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('registrations')
                .add({
                    categoryId: categoryId,
                    playerName: playerNames[i],
                    status: 'approved',
                    seed: i + 1,  // Seeded 1-4
                });
        }

        console.log('📋 Created test tournament and registrations');

        // Generate bracket using the refactored function
        await generateBracket(tournamentId, categoryId);

        console.log('\n✅ Bracket generation completed successfully!');

        // Verify bracket data was created
        const manager = getBracketsManager(tournamentId);

        // Check participants
        const participants = await manager.storage.select('participant');
        console.log(`\n👥 Participants created: ${Array.isArray(participants) ? participants.length : 0}`);
        if (Array.isArray(participants)) {
            participants.forEach(p => console.log(`  - ${p.name}`));
        }

        // Check stages
        const stages = await manager.storage.select('stage');
        console.log(`\n🎯 Stages created: ${Array.isArray(stages) ? stages.length : (stages ? 1 : 0)}`);
        if (stages) {
            const stageList = Array.isArray(stages) ? stages : [stages];
            stageList.forEach(s => console.log(`  - ${s.name} (${s.type})`));
        }

        // Check matches
        const matches = await manager.storage.select('match');
        console.log(`\n🏆 Matches created: ${Array.isArray(matches) ? matches.length : 0}`);
        if (Array.isArray(matches)) {
            console.log('  Match details:');
            matches.slice(0, 10).forEach((m, idx) => {
                console.log(`    [${idx + 1}] Match ${m.id}: ${m.status || 'pending'}`);
            });
            if (matches.length > 10) {
                console.log(`    ... and ${matches.length - 10} more matches`);
            }
        }

        // Check category status was updated
        const categoryDoc = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .get();
        const categoryData = categoryDoc.data();
        console.log(`\n📊 Category status: ${categoryData?.status}`);

        console.log('\n✨ All verifications passed!');
    } catch (error) {
        console.error('\n❌ Error during bracket generation test:', error);
        throw error;
    }
}

// Run the test
testBracketGeneration()
    .then(() => {
        console.log('\n🎉 Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
