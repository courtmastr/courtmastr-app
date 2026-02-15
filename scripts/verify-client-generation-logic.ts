
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

async function verifyClientGenerationLogic() {
    console.log('🧪 Verifying Client-Side Bracket Generation Logic');

    // --- Simulation of useBracketGenerator.ts logic ---

    const storage = new InMemoryDatabase();
    const manager = new BracketsManager(storage);

    // 1. Simulate 12 Participants (Sorted by seed)
    const participants = [
        { id: '1', name: 'Seed 1', seed: 1 },
        { id: '2', name: 'Seed 2', seed: 2 },
        { id: '3', name: 'Seed 3', seed: 3 },
        { id: '4', name: 'Seed 4', seed: 4 },
        { id: '5', name: 'Seed 5', seed: 5 },
        { id: '6', name: 'Seed 6', seed: 6 },
        { id: '7', name: 'Seed 7', seed: 7 },
        { id: '8', name: 'Seed 8', seed: 8 },
        { id: '9', name: 'Seed 9', seed: 9 },
        { id: '10', name: 'Seed 10', seed: 10 },
        { id: '11', name: 'Seed 11', seed: 11 },
        { id: '12', name: 'Seed 12', seed: 12 },
    ];

    console.log(`\n📋 Participants: ${participants.length}`);

    // 2. Create Seeding Array (Logic from createSeedingArray in useBracketGenerator.ts)
    // "Calculate bracket size (next power of 2, minimum 4)"
    const count = participants.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(count, 4))));

    console.log(`\n🧮 Calculated Bracket Size: ${bracketSize} (Power of 2)`);

    // "Create array with registration IDs"
    // "Pad with nulls for BYEs"
    const seeding: (string | null)[] = participants.map(r => r.name); // Using names for visibility in this script, essentially IDs

    while (seeding.length < bracketSize) {
        seeding.push(null);
    }

    console.log('🌱 Seeding Array (with Byes):');
    console.log(seeding);

    // 3. Generate Double Elimination Bracket
    console.log('\n⚙️  Generating Double Elimination Stage...');
    const stage = await manager.create.stage({
        tournamentId: 1, // Mock ID
        name: 'DE 12 Test',
        type: 'double_elimination',
        seeding: seeding,
        settings: {
            seedOrdering: ['inner_outer'], // Matches useBracketGenerator default
            grandFinal: 'simple',          // Matches useBracketGenerator default for DE (unless option passed)
        },
    });

    console.log(`✅ Stage Created: ID ${stage.id}`);

    // 4. Verify Matches
    const matches = await manager.storage.select('match', { stage_id: stage.id });
    const wbMatches = await manager.storage.select('match', { stage_id: stage.id, group_id: 0 }); // Usually 0 or 1 for WB depending on impl, let's filter by round
    const rounds = await manager.storage.select('round', { stage_id: stage.id });

    console.log(`\n📊 Total Matches Created: ${matches.length}`);

    // Logic Check 1: Match Count
    // For 12 participants DE:
    // WB: 11 matches (12-1)
    // LB: 10 matches 
    // Total: 21 + 1 (Final) = 22 matches (if simple final)
    // Let's verify exact count.

    // Actually, Brackets Manager standard DE with 12 participants:
    // Bracket size 16.
    // WB R1: 8 matches. 4 Byes. (Candidates: 12. 16 slots. 4 byes.)
    // Wait, 12 participants. 4 Byes.
    // 1 vs Bye (Adv), 2 vs Bye (Adv), 3 vs Bye (Adv), 4 vs Bye (Adv).
    // 5 vs 12, 6 vs 11, 7 vs 10, 8 vs 9.
    // So 4 matches played in WB R1. 4 are "Bye" matches (usually not created as real matches or status 6? Brackets Manager creates them but auto-resolves or marks them).

    // Let's see what is actually created.

    const activeMatches = matches.filter(m => m.status !== 6); // 6 might be 'Archived' or 'Byes' in some versions? No, brackets-manager usually just creates walkable matches.
    // Let's just list them.

    console.log('\n--- Winners Bracket Round 1 ---');
    const wbGroup = await manager.storage.select('group', { stage_id: stage.id, number: 1 });
    // Note: brackets-manager behavior on group numbers: 1 is usually WB, 2 is LB, 3 is Finals.
    // Let's fetch groups to be sure.
    const groups = await manager.storage.select('group', { stage_id: stage.id });
    const wbGroupId = groups.find(g => g.number === 1)?.id;

    // Get Round 1 of WB
    const wbR1 = rounds.find(r => r.group_id === wbGroupId && r.number === 1);

    if (wbR1) {
        const r1Matches = matches.filter(m => m.round_id === wbR1.id);
        r1Matches.forEach(m => {
            const p1 = m.opponent1?.id !== undefined ? (m.opponent1.id === null ? 'BYE' : participants[m.opponent1.id]?.name || 'Unknown') : 'TBD';
            // Note: In this script we passed names as IDs for seeding, so opponent1.id will be the name (if brackets manager didn't normalize it to int IDs. It likely normalized to 0-based index if we passed array, OR it used the values if we passed seeding array).
            // Actually, if we pass `seeding` as array of strings, brackets-manager creates participants with IDs 0..N-1? Or uses the strings?
            // "If you provide a list of names, the library will create the participants for you."
            // But we created `seeding` as `['Seed 1', 'Seed 2', ..., null, null]`.
            // So IDs will be 0..15.
            // Let's map back.

            const getName = (id) => id === null ? 'BYE' : seeding[id] || 'TBD';

            const name1 = m.opponent1 && m.opponent1.id !== null ? getName(m.opponent1.id) : 'BYE';
            const name2 = m.opponent2 && m.opponent2.id !== null ? getName(m.opponent2.id) : 'BYE';

            console.log(`Match ${m.number}: ${name1} vs ${name2}`);
        });
    }

    if (matches.length > 20) {
        console.log(`\n✅ SUCCESS: Match count (${matches.length}) looks reasonable for DE 12.`);
    } else {
        console.error(`\n❌ WARNING: Match count (${matches.length}) seems low for DE 12.`);
    }
}

// Run it
verifyClientGenerationLogic().catch(console.error);
