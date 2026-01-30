/**
 * Client-side Bracket Generator for Courtmaster
 * Uses brackets-manager library for proper progression
 */

import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase';
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Registration, Category } from '@/types';

// ============================================
// Types
// ============================================

export interface BracketOptions {
  grandFinal?: 'simple' | 'double' | 'none'; // simple = one match, double = reset if LB wins
  consolationFinal?: boolean; // Third place match
  seedOrdering?: ('natural' | 'reverse' | 'half_shift' | 'inner_outer')[];
}

export interface BracketResult {
  success: boolean;
  stageId: number;
  matchCount: number;
  groupCount: number;
  roundCount: number;
}

// ============================================
// Main Generator
// ============================================

export function useBracketGenerator() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);

  /**
   * Generate bracket using brackets-manager library
   */
  async function generateBracket(
    tournamentId: string,
    categoryId: string,
    options: BracketOptions = {}
  ): Promise<BracketResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
      // 1. Get category details
      const categoryDoc = await getDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId)
      );

      if (!categoryDoc.exists()) {
        throw new Error('Category not found');
      }

      const category = categoryDoc.data() as Category;

      progress.value = 10;

      // 2. Get approved registrations
      const registrationsQuery = query(
        collection(db, 'tournaments', tournamentId, 'registrations'),
        where('categoryId', '==', categoryId),
        where('status', 'in', ['approved', 'checked_in'])
      );

      const registrationsSnap = await getDocs(registrationsQuery);
      const registrations = registrationsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Registration[];

      if (registrations.length < 2) {
        throw new Error('Need at least 2 participants to generate bracket');
      }

      progress.value = 20;

      // 3. Sort by seed
      const sortedRegistrations = sortRegistrationsBySeed(registrations);
      console.log(`📊 Generating ${category.format} bracket for ${sortedRegistrations.length} participants`);

      // 4. Create seeding array (null for BYEs)
      const seeding = createSeedingArray(sortedRegistrations);

      progress.value = 30;

      // 5. Generate using brackets-manager (in-memory)
      const storage = new InMemoryDatabase();
      const manager = new BracketsManager(storage);

      // 5a. Initialize storage with participants FIRST (required by brackets-manager)
      const participantsData = sortedRegistrations.map((reg, index) => ({
        id: index + 1, // Use numeric IDs like sample app
        tournament_id: categoryId,
        name: reg.id, // Store registration ID as name for lookup
      }));
      
      storage.setData({
        participant: participantsData,
        stage: [],
        group: [],
        round: [],
        match: [],
        match_game: [],
      });
      
      console.log(`💾 Initialized storage with ${participantsData.length} participants`);

      const stageType = category.format === 'pool_to_elimination'
        ? 'single_elimination'
        : category.format;

      const stage = await manager.create.stage({
        tournamentId: categoryId,
        name: category.name,
        type: stageType as any,
        seeding,
        settings: {
          seedOrdering: options.seedOrdering || ['inner_outer'],
          grandFinal: options.grandFinal || (stageType === 'double_elimination' ? 'double' : undefined),
          consolationFinal: options.consolationFinal,
        },
      });

      progress.value = 50;

      // 6. Export from memory and save to Firestore
      await saveBracketsToFirestore(tournamentId, categoryId, storage, stage.id, sortedRegistrations);

      progress.value = 80;

      // 7. Update category status
      await setDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId),
        {
          status: 'active',
          stageId: stage.id,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      progress.value = 100;

      // Get stats
      const matches = await storage.select('match', { stage_id: stage.id });
      const groups = await storage.select('group', { stage_id: stage.id });
      const rounds = await storage.select('round', { stage_id: stage.id });

      const result: BracketResult = {
        success: true,
        stageId: stage.id,
        matchCount: Array.isArray(matches) ? matches.length : 0,
        groupCount: Array.isArray(groups) ? groups.length : 0,
        roundCount: Array.isArray(rounds) ? rounds.length : 0,
      };

      // Log detailed bracket structure
      if (Array.isArray(matches) && Array.isArray(groups) && Array.isArray(rounds)) {
        // Create lookups
        const groupMap = new Map((groups as any[]).map(g => [String(g.id), g]));
        const roundMap = new Map((rounds as any[]).map(r => [String(r.id), r]));
        
        const wb = matches.filter((m: any) => groupMap.get(String(m.group_id))?.number === 0);
        const lb = matches.filter((m: any) => groupMap.get(String(m.group_id))?.number === 1);
        const gf = matches.filter((m: any) => groupMap.get(String(m.group_id))?.number === 2);
        
        console.log('🏆 Bracket Structure:');
        console.log(`   Winners Bracket: ${wb.length} matches`);
        console.log(`   Losers Bracket: ${lb.length} matches`);
        console.log(`   Grand Finals: ${gf.length} matches`);
        
        // Group WB by round
        console.log('   WB by Round:');
        const wbByRound = new Map();
        wb.forEach((m: any) => {
          const round = roundMap.get(String(m.round_id));
          const roundNum = round?.number || m.round_id;
          if (!wbByRound.has(roundNum)) wbByRound.set(roundNum, []);
          wbByRound.get(roundNum).push(m);
        });
        [...wbByRound.entries()].sort((a, b) => a[0] - b[0]).forEach(([roundNum, ms]) => {
          console.log(`     Round ${roundNum}: ${ms.length} matches`);
        });
        
        // Group LB by round
        console.log('   LB by Round:');
        const lbByRound = new Map();
        lb.forEach((m: any) => {
          const round = roundMap.get(String(m.round_id));
          const roundNum = round?.number || m.round_id;
          if (!lbByRound.has(roundNum)) lbByRound.set(roundNum, []);
          lbByRound.get(roundNum).push(m);
        });
        [...lbByRound.entries()].sort((a, b) => a[0] - b[0]).forEach(([roundNum, ms]) => {
          console.log(`     Round ${roundNum}: ${ms.length} matches`);
        });
        
        // Show first few WB matches
        if (wb.length > 0) {
          console.log('   Sample WB matches:');
          wb.slice(0, 4).forEach((m: any) => {
            const p1 = participantsData.find((p: any) => p.id === m.opponent1?.id)?.name?.slice(0, 8) || 'TBD';
            const p2 = participantsData.find((p: any) => p.id === m.opponent2?.id)?.name?.slice(0, 8) || 'TBD';
            console.log(`     Match ${m.number}: ${p1} vs ${p2}`);
          });
        }
        if (lb.length > 0) {
          console.log('   Sample LB matches:');
          lb.slice(0, 4).forEach((m: any) => {
            const p1 = participantsData.find((p: any) => p.id === m.opponent1?.id)?.name?.slice(0, 8) || 'TBD';
            const p2 = participantsData.find((p: any) => p.id === m.opponent2?.id)?.name?.slice(0, 8) || 'TBD';
            console.log(`     Match ${m.number}: ${p1} vs ${p2}`);
          });
        }
      }

      console.log(`✅ Bracket generated:`, result);
      return result;

    } catch (err) {
      console.error('Error generating bracket:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate bracket';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete existing bracket
   */
  async function deleteBracket(
    tournamentId: string,
    categoryId: string
  ): Promise<void> {
    // Find stages for this category
    const stagesQuery = query(
      collection(db, 'tournaments', tournamentId, 'stage'),
      where('tournament_id', '==', categoryId)
    );

    const stagesSnap = await getDocs(stagesQuery);
    const batch = writeBatch(db);

    for (const stageDoc of stagesSnap.docs) {
      const stageId = stageDoc.id;

      // Delete all related collections
      const collections = ['group', 'round', 'match', 'match_game', 'participant'];

      for (const collName of collections) {
        const collQuery = query(
          collection(db, 'tournaments', tournamentId, collName),
          where('stage_id', '==', stageId)
        );
        const collSnap = await getDocs(collQuery);
        collSnap.docs.forEach(d => batch.delete(d.ref));
      }

      // Also delete participants linked by tournament_id
      const partQuery = query(
        collection(db, 'tournaments', tournamentId, 'participant'),
        where('tournament_id', '==', stageId)
      );
      const partSnap = await getDocs(partQuery);
      partSnap.docs.forEach(d => batch.delete(d.ref));

      batch.delete(stageDoc.ref);
    }

    await batch.commit();

    // Update category status
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId),
      { status: 'setup', updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  return {
    loading,
    error,
    progress,
    generateBracket,
    deleteBracket,
  };
}

// ============================================
// Helper Functions
// ============================================

function sortRegistrationsBySeed(registrations: Registration[]): Registration[] {
  const seeded = registrations
    .filter(r => r.seed !== undefined && r.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));

  const unseeded = registrations
    .filter(r => r.seed === undefined || r.seed === null)
    .sort(() => Math.random() - 0.5);

  return [...seeded, ...unseeded];
}

/**
 * Create seeding array for brackets-manager
 * 
 * Simple approach: [1, 2, 3, ..., N, null, null, ...]
 * brackets-manager with 'inner_outer' will automatically:
 * - Place top seeds in favorable positions
 * - Distribute BYEs to benefit highest seeds
 * 
 * Example 12 players (16-slot bracket):
 *   Input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null, null, null, null]
 *   inner_outer places BYEs at positions that give seeds 1-4 byes
 * 
 * registrations MUST be sorted by seed (best seed first = participant 1)
 */
function createSeedingArray(registrations: Registration[]): (number | null)[] {
  const count = registrations.length;
  
  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(count, 2))));
  
  // Create seeding: participant IDs in order, then nulls for BYEs
  const seeding: (number | null)[] = [];
  
  // Add participant IDs (1, 2, 3, ...)
  for (let i = 0; i < registrations.length; i++) {
    seeding.push(i + 1); // Participant ID
  }
  
  // Pad with nulls (BYEs) to reach bracket size
  while (seeding.length < bracketSize) {
    seeding.push(null);
  }
  
  console.log('🎯 Seeding array:', seeding.map((s, i) => s ? `Pos${i}:P${s}` : `Pos${i}:BYE`).join(', '));
  console.log(`   ${count} participants -> ${bracketSize}-slot bracket (${bracketSize - count} BYEs)`);
  console.log('   brackets-manager inner_outer will optimize placement');
  
  return seeding;
}

async function saveBracketsToFirestore(
  tournamentId: string,
  categoryId: string,
  storage: InMemoryDatabase,
  stageId: number,
  registrations: Registration[]
): Promise<void> {
  console.log('💾 Starting saveBracketsToFirestore...', { tournamentId, categoryId, stageId });
  
  const batch = writeBatch(db);

  // Get all data from memory
  const [stage, groups, rounds, matches, participants, matchGames] = await Promise.all([
    storage.select('stage', stageId),
    storage.select('group', { stage_id: stageId }),
    storage.select('round', { stage_id: stageId }),
    storage.select('match', { stage_id: stageId }),
    storage.select('participant', { tournament_id: categoryId }), // Use categoryId (tournament_id in bm)
    storage.select('match_game', { stage_id: stageId }),
  ]);
  
  console.log('📊 Retrieved from memory:', {
    stage: stage ? 'yes' : 'no',
    groupsCount: Array.isArray(groups) ? groups.length : 0,
    roundsCount: Array.isArray(rounds) ? rounds.length : 0,
    matchesCount: Array.isArray(matches) ? matches.length : 0,
    participantsCount: Array.isArray(participants) ? participants.length : 0,
    matchGamesCount: Array.isArray(matchGames) ? matchGames.length : 0,
  });

  // Save stage
  if (stage) {
    batch.set(doc(db, 'tournaments', tournamentId, 'stage', String(stageId)), {
      id: String(stageId),
      tournament_id: categoryId,
      name: (stage as any).name,
      type: (stage as any).type,
    });
  }

  // Save groups
  if (Array.isArray(groups)) {
    for (const group of groups) {
      const g = group as any;
      batch.set(
        doc(db, 'tournaments', tournamentId, 'group', String(g.id)),
        {
          id: String(g.id),
          stage_id: String(stageId),
          number: g.number,
        }
      );
    }
  }

  // Save rounds
  if (Array.isArray(rounds)) {
    for (const round of rounds) {
      const r = round as any;
      batch.set(
        doc(db, 'tournaments', tournamentId, 'round', String(r.id)),
        {
          id: String(r.id),
          stage_id: String(stageId),
          group_id: String(r.group_id),
          number: r.number,
        }
      );
    }
  }

  // Save participants - use registrations data to ensure proper mapping
  if (registrations.length > 0) {
    console.log(`💾 Saving ${registrations.length} participants to Firestore...`);
    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const participantId = i + 1; // Numeric ID (1, 2, 3...)
      
      const partData: any = {
        id: String(participantId),
        tournament_id: String(stageId),
        name: reg.id, // Registration ID for name lookup
      };

      console.log(`  Saving participant ${participantId} -> reg ${reg.id.slice(0,8)}...`);
      batch.set(
        doc(db, 'tournaments', tournamentId, 'participant', String(participantId)),
        partData
      );
    }
  } else {
    console.warn('⚠️ No participants to save!');
  }

  // Save matches
  if (Array.isArray(matches)) {
    for (const match of matches) {
      const m = match as any;

      // Clean opponent data - remove undefined values
      // Sanitize match object to remove undefined values (which Firestore rejects)
      const sanitized = JSON.parse(JSON.stringify(m));

      batch.set(
        doc(db, 'tournaments', tournamentId, 'match', String(m.id)),
        {
          id: String(m.id),  // Include ID as string for consistent querying
          stage_id: String(stageId),
          group_id: String(m.group_id),
          round_id: String(m.round_id),
          number: m.number,
          opponent1: sanitized.opponent1 || null,
          opponent2: sanitized.opponent2 || null,
          status: m.status,
          ...(m.child_count && { child_count: m.child_count }),
        }
      );
    }
  }

  // Save match games (if any)
  if (Array.isArray(matchGames)) {
    for (const game of matchGames) {
      const g = game as any;

      // Clean opponent data for games too
      // Sanitize game object
      const sanitizedGame = JSON.parse(JSON.stringify(g));

      batch.set(
        doc(db, 'tournaments', tournamentId, 'match_game', String(g.id)),
        {
          id: String(g.id),
          parent_id: String(g.match_id),
          stage_id: String(stageId),
          number: g.number,
          opponent1: sanitizedGame.opponent1 || null,
          opponent2: sanitizedGame.opponent2 || null,
          status: g.status,
        }
      );
    }
  }

  // Commit batch with error handling
  try {
    await batch.commit();
    console.log('✅ Batch commit completed');
  } catch (err) {
    console.error('❌ Batch commit failed:', err);
    throw err;
  }
  
  // Verify participants were saved
  try {
    const allParticipantsSnap = await getDocs(
      collection(db, 'tournaments', tournamentId, 'participant')
    );
    // Count participants that have tournament_id matching our stage
    const ourParticipants = allParticipantsSnap.docs.filter(d => d.data().tournament_id === String(stageId));
    console.log(`✅ Verified ${ourParticipants.length} participants saved to Firestore`);
    
    if (ourParticipants.length === 0) {
      console.warn('⚠️ WARNING: No participants found after save!');
      console.warn('   This may indicate a Firestore rules issue or data mismatch.');
    }
  } catch (err) {
    console.error('❌ Verification query failed:', err);
  }
}
