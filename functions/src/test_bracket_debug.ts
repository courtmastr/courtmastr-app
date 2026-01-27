/**
 * Test script to call generateBracket and see debug logs
 */
import * as admin from 'firebase-admin';
import { generateBracket } from './bracket';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-courtmaster',
    });
}

// Connect to emulators
const db = admin.firestore();
db.settings({
    host: 'localhost:8080',
    ssl: false,
});

async function testBracketGeneration() {
    const tournamentId = 'QOVnXUV2g8cWRoeJFDN4';

    // Get categories
    const categoriesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .get();

    console.log(`\n📋 Found ${categoriesSnapshot.docs.length} categories:\n`);

    for (const catDoc of categoriesSnapshot.docs) {
        const cat = catDoc.data();
        console.log(`  - ${cat.name} (${catDoc.id}): ${cat.format}`);
    }

    // Generate bracket for Men's Singles
    const mensCategory = categoriesSnapshot.docs.find(d => d.data().name === "Men's Singles");

    if (!mensCategory) {
        console.error('❌ Men\'s Singles category not found!');
        process.exit(1);
    }

    console.log(`\n🎯 Generating bracket for Men's Singles (${mensCategory.id})...\n`);
    console.log('='.repeat(80));

    try {
        await generateBracket(tournamentId, mensCategory.id);
        console.log('='.repeat(80));
        console.log('\n✅ Bracket generation completed!\n');

        // Check if matches were created in legacy schema
        const matchesSnapshot = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('matches')
            .where('categoryId', '==', mensCategory.id)
            .get();

        console.log(`\n📊 Legacy matches created: ${matchesSnapshot.docs.length}`);

        if (matchesSnapshot.docs.length > 0) {
            console.log('\n📝 First 3 matches:');
            matchesSnapshot.docs.slice(0, 3).forEach((doc, i) => {
                const m = doc.data();
                console.log(`  ${i + 1}. Round ${m.round}, Match ${m.matchNumber} (${m.bracketType})`);
                console.log(`     P1: ${m.participant1Id}, P2: ${m.participant2Id}`);
            });
        }

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }

    process.exit(0);
}

testBracketGeneration();
