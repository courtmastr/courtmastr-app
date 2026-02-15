
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

async function runSimulation(strategyName: string, seedOrdering: string[]) {
    console.log(`\n==================================================`);
    console.log(`Running Simulation: ${strategyName} (seedOrdering: ${JSON.stringify(seedOrdering)})`);
    console.log(`==================================================`);

    const storage = new InMemoryDatabase();
    const manager = new BracketsManager(storage);

    // Create 12 participants
    const seeding = [];
    for (let i = 1; i <= 12; i++) {
        seeding.push(`Seed ${i}`);
    }
    // Pad to 16
    while (seeding.length < 16) {
        seeding.push(null);
    }

    try {
        await manager.create.stage({
            tournamentId: 1,
            name: strategyName,
            type: 'double_elimination',
            seeding,
            settings: {
                seedOrdering: seedOrdering as any,
            },
        });
    } catch (e: any) {
        console.error(`Error creating stage for ${strategyName}:`, e.message);
        return;
    }

    const allMatches = await manager.storage.select('match');
    allMatches.sort((a, b) => a.number - b.number);

    console.log('--- ROUND 1 MATCHUPS ---');
    allMatches.filter(m => m.round_id === 0).forEach(m => {
        const p1 = m.opponent1 ? (m.opponent1.id != null ? `Seed ${m.opponent1.id + 1}` : 'BYE') : 'BYE';
        const p2 = m.opponent2 ? (m.opponent2.id != null ? `Seed ${m.opponent2.id + 1}` : 'BYE') : 'BYE';
        console.log(`Match ${m.number}: ${p1} vs ${p2}`);
    });
}

async function main() {
    // Strategy 1: Inner Outer (Standard "High plays Low")
    await runSimulation('Inner Outer', ['inner_outer']);

    // Strategy 2: Effort Balanced
    await runSimulation('Effort Balanced', ['effort_balanced']);

    // Strategy 3: Seed Optimized
    await runSimulation('Seed Optimized', ['seed_optimized']);
}

main().catch(console.error);
