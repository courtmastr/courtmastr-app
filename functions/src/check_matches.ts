/**
 * Check synced matches by bracketType
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-courtmaster' });
}

const db = admin.firestore();
db.settings({ host: 'localhost:8080', ssl: false });

async function checkMatches() {
    const tournamentId = 'mfRQv4yFdOTv3GJNWPAW';

    const matchesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .get();

    console.log(`\n📊 Total matches: ${matchesSnapshot.docs.length}\n`);

    // Group by bracketType
    const byType: Record<string, number> = {};
    const byRound: Record<string, Array<{ round: number, matchNumber: number, bracketType: string, p1: string | null, p2: string | null }>> = {};

    matchesSnapshot.docs.forEach(doc => {
        const m = doc.data();
        byType[m.bracketType] = (byType[m.bracketType] || 0) + 1;

        const key = `${m.bracketType}-R${m.round}`;
        if (!byRound[key]) byRound[key] = [];
        byRound[key].push({
            round: m.round,
            matchNumber: m.matchNumber,
            bracketType: m.bracketType,
            p1: m.participant1Id,
            p2: m.participant2Id
        });
    });

    console.log('By Bracket Type:');
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} matches`);
    });

    console.log('\nFirst 3 matches from each bracket:');
    ['winners', 'losers', 'finals'].forEach(type => {
        console.log(`\n${type.toUpperCase()}:`);
        const rounds = Object.keys(byRound)
            .filter(k => k.startsWith(type))
            .sort();

        rounds.slice(0, 2).forEach(key => {
            const matches = byRound[key].slice(0, 3);
            console.log(`  ${key}:`);
            matches.forEach(m => {
                console.log(`    #${m.matchNumber}: ${m.p1 ? 'Player' : 'BYE'} vs ${m.p2 ? 'Player' : 'BYE'}`);
            });
        });
    });

    process.exit(0);
}

checkMatches();
