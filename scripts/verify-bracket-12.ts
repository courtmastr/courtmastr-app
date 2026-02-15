
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

async function testBracket() {
    const storage = new InMemoryDatabase();
    const manager = new BracketsManager(storage);

    // 12 Participants
    const participants = [
        'Seed 1', 'Seed 2', 'Seed 3', 'Seed 4',
        'Seed 5', 'Seed 6', 'Seed 7', 'Seed 8',
        'Seed 9', 'Seed 10', 'Seed 11', 'Seed 12'
    ];

    // Pad to 16 (Power of 2) logic from bracket.ts
    const seeding = [...participants];
    while (seeding.length < 16) {
        seeding.push(null);
    }

    console.log('Seeding:', seeding);

    const stage = await manager.create.stage({
        tournamentId: 1,
        name: 'DE 12 Participants',
        type: 'double_elimination',
        seeding: seeding,
        settings: {
            seedOrdering: ['inner_outer'],
            grandFinal: 'simple',
        },
    });

    console.log('Stage created:', stage.id);

    const matches = await manager.storage.select('match', { stage_id: stage.id });
    const rounds = await manager.storage.select('round', { stage_id: stage.id });
    const groups = await manager.storage.select('group', { stage_id: stage.id });

    // Helper to get name
    const getName = (id) => {
        if (id === null) return 'BYE';
        return participants[id] || `Winner/Loser of ...`;
        // Note: brackets-manager seeding IDs are 0-based indices if we pass array of strings? 
        // Actually, create.stage with array of strings creates participants and uses their IDs.
        // But here we want to see who plays whom.
        // Let's re-read how seeding works.
        // If we pass an array of strings, it creates participants.
    };

    // We need to fetch participants to map IDs back to names
    const dbParticipants = await manager.storage.select('participant', { tournament_id: 1 });
    const getPartName = (id) => {
        if (id === null) return 'BYE';
        const p = dbParticipants.find(p => p.id === id);
        return p ? p.name : 'TBD';
    };

    // Filter WB Round 1
    const wbGroup = groups.find(g => g.number === 1); // Winners Bracket
    const wbR1 = rounds.find(r => r.group_id === wbGroup.id && r.number === 1);

    console.log('\n--- Winners Bracket Round 1 ---');
    const r1Matches = matches.filter(m => m.round_id === wbR1.id);

    r1Matches.forEach(m => {
        const p1 = m.opponent1 ? getPartName(m.opponent1.id) : 'BYE';
        const p2 = m.opponent2 ? getPartName(m.opponent2.id) : 'BYE';
        console.log(`Match ${m.number}: ${p1} vs ${p2}`);
    });

    console.log('\n--- Summary ---');
    console.log(`Total Matches: ${matches.length}`);
    console.log(`WB Round 1 Matches: ${r1Matches.length}`);

    // Check if Byes are correctly placed
    // Expectation: Seeds 1, 2, 3, 4 should have BYEs if standard seeding.
    // In brackets-manager, 'inner_outer' usually pairs 1vs16, 2vs15, etc.
    // 16, 15, 14, 13 are BYEs.
    // So 1 vs Bye, 2 vs Bye, 3 vs Bye, 4 vs Bye.
}

testBracket();
