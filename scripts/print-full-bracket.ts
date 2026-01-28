
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

async function printFullBracket() {
    const storage = new InMemoryDatabase();
    const manager = new BracketsManager(storage);

    // Create 12 participants
    const seeding = [];
    for (let i = 1; i <= 12; i++) {
        seeding.push(`Seed ${i}`);
    }
    // Pad to 16
    while (seeding.length < 16) seeding.push(null);

    await manager.create.stage({
        tournamentId: 1,
        name: 'Inner Outer',
        type: 'double_elimination',
        seeding,
        settings: {
            seedOrdering: ['inner_outer'],
        },
    });

    const allMatches = await manager.storage.select('match');
    const participants = await manager.storage.select('participant');

    // Sort slightly to group by Round/Group
    allMatches.sort((a, b) => {
        if (a.group_id !== b.group_id) return a.group_id - b.group_id; // Winners vs Losers vs Finals (usually)
        if (a.round_id !== b.round_id) return a.round_id - b.round_id;
        return a.number - b.number;
    });

    // We need to know which group is Winners/Losers
    const groups = await manager.storage.select('group');
    // Usually Group 0 = Winners, Group 1 = Losers, Group 2 = Finals?
    // Let's map group ID to name.
    // Actually, Brackets Manager defines group numbers: 1 (WB), 2 (LB), 3 (Final)

    // Since we are using select('group'), we can see the group number.

    const groupMap = new Map();
    groups.forEach(g => {
        let name = 'Unknown';
        if (g.number === 1) name = 'Winners Bracket';
        else if (g.number === 2) name = 'Losers Bracket';
        else if (g.number === 3) name = 'Finals';
        groupMap.set(g.id, name);
    });

    console.log('\n--- FULL DOUBLE ELIMINATION BRACKET (12 Players / 16 Slots) ---\n');

    let currentGroup = -1;
    let currentRound = -1;

    for (const m of allMatches) {
        if (m.group_id !== currentGroup) {
            currentGroup = m.group_id;
            console.log(`\n=== ${groupMap.get(m.group_id) || `Group ${m.group_id}`} ===`);
            currentRound = -1;
        }

        if (m.round_id !== currentRound) {
            currentRound = m.round_id;
            console.log(`\n  Round ${m.round_id + 1}:`);
        }

        const p1 = m.opponent1 ? (m.opponent1.id != null ? `Seed ${m.opponent1.id + 1}` : (m.opponent1.position ? `Winner Match ${JSON.stringify(m.opponent1)}` : 'BYE')) : 'BYE';
        // Wait, m.opponent1.position is confusing if not ID. 
        // Let's resolve name logic better.

        const getPlayerName = (opp: any) => {
            if (!opp) return 'BYE';
            if (opp.id !== null && opp.id !== undefined) return `Seed ${opp.id + 1}`;
            // If it's a TBD match winner advancement
            // Actually, brackets-manager stores previous match info implicitly but doesn't expose it easily in Opponent object unless we traverse.
            return 'TBD';
        };

        const name1 = getPlayerName(m.opponent1);
        const name2 = getPlayerName(m.opponent2);

        console.log(`    Match ${m.number}: ${name1} vs ${name2}`);
    }
}

printFullBracket().catch(console.error);
