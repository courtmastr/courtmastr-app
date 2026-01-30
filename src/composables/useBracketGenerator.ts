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
      await saveBracketsToFirestore(tournamentId, categoryId, storage, Number(stage.id), sortedRegistrations);

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
        stageId: Number(stage.id),
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
  console.log('💾 Starting saveBracketsToFirestore (minimal 3-collection)...', { tournamentId, categoryId, stageId });
  
  const batch = writeBatch(db);

  // Get all data from memory
  const [stage, groups, rounds, matches] = await Promise.all([
    storage.select('stage', stageId),
    storage.select('group', { stage_id: stageId }),
    storage.select('round', { stage_id: stageId }),
    storage.select('match', { stage_id: stageId }),
  ]);
  
  // Create lookup maps for deriving fields
  const groupMap = new Map((Array.isArray(groups) ? groups : []).map((g: any) => [String(g.id), g]));
  const roundMap = new Map((Array.isArray(rounds) ? rounds : []).map((r: any) => [String(r.id), r]));
  const registrationMap = new Map(registrations.map((r, i) => [i + 1, r.id]));
  
  console.log('📊 Retrieved from memory:', {
    stage: stage ? 'yes' : 'no',
    groupsCount: groupMap.size,
    roundsCount: roundMap.size,
    matchesCount: Array.isArray(matches) ? matches.length : 0,
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

  // Save matches with enhanced fields (derived from groups/rounds)
  if (Array.isArray(matches)) {
    for (const match of matches) {
      const m = match as any;

      // Derive round number and bracket type from lookups
      const round = roundMap.get(String(m.round_id));
      const group = groupMap.get(String(m.group_id));
      
      const roundNumber = round?.number || 1;
      const bracketType = getBracketTypeFromGroupNumber(group?.number);
      
      // Convert opponent IDs to registration IDs
      const opponent1RegId = m.opponent1?.id ? registrationMap.get(Number(m.opponent1.id)) : null;
      const opponent2RegId = m.opponent2?.id ? registrationMap.get(Number(m.opponent2.id)) : null;

      // Sanitize match object
      const sanitized = JSON.parse(JSON.stringify(m));

      batch.set(
        doc(db, 'tournaments', tournamentId, 'match', String(m.id)),
        {
          id: String(m.id),
          stage_id: String(stageId),
          // Enhanced fields (derived from groups/rounds)
          round: roundNumber,
          bracket: bracketType,
          position: m.number,
          // Store registration IDs directly
          opponent1: m.opponent1 ? {
            ...sanitized.opponent1,
            id: opponent1RegId || sanitized.opponent1.id,
          } : null,
          opponent2: m.opponent2 ? {
            ...sanitized.opponent2,
            id: opponent2RegId || sanitized.opponent2.id,
          } : null,
          status: m.status,
          ...(m.child_count && { child_count: m.child_count }),
        }
      );
    }
  }

  // Commit batch with error handling
  try {
    await batch.commit();
    console.log('✅ Batch commit completed (minimal collections)');
  } catch (err) {
    console.error('❌ Batch commit failed:', err);
    throw err;
  }
  
  // Verify matches were saved
  try {
    const matchesSnap = await getDocs(
      query(collection(db, 'tournaments', tournamentId, 'match'), where('stage_id', '==', String(stageId)))
    );
    console.log(`✅ Verified ${matchesSnap.docs.length} matches saved to Firestore`);
    
    if (matchesSnap.docs.length === 0) {
      console.warn('⚠️ WARNING: No matches found after save!');
    }
  } catch (err) {
    console.error('❌ Verification query failed:', err);
  }
}

/**
 * Get bracket type from group number
 * 0 = winners, 1 = losers, 2 = finals
 */
function getBracketTypeFromGroupNumber(groupNumber: number | undefined): 'winners' | 'losers' | 'finals' {
  switch (groupNumber) {
    case 0:
      return 'winners';
    case 1:
      return 'losers';
    case 2:
      return 'finals';
    default:
      return 'winners';
  }
}
