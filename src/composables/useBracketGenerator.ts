/**
 * Client-side Bracket Generator for Courtmaster
 * Uses brackets-manager library with proper FirestoreStorage adapter
 * Stores data in category-isolated subcollections
 */

import { ref } from 'vue';
import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from '@/services/firebase';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import type { Registration, Category, LevelEliminationFormat, MatchStatus, PoolSeedingMethod } from '@/types';
import { logger } from '@/utils/logger';

// ============================================
// Types
// ============================================

export interface BracketOptions {
  grandFinal?: 'simple' | 'double' | 'none';
  consolationFinal?: boolean;
  seedOrdering?: (
    | 'natural'
    | 'reverse'
    | 'half_shift'
    | 'reverse_half_shift'
    | 'pair_flip'
    | 'inner_outer'
    | 'groups.effort_balanced'
    | 'groups.seed_optimized'
    | 'groups.bracket_optimized'
  )[];
  groupCount?: number;
  qualifiersPerGroup?: number;
  teamsPerPool?: number;
  poolSeedingMethod?: PoolSeedingMethod;
  /** Pre-sorted registration IDs from the Advance to Elimination dialog. When provided,
   *  extractPoolQualifiers is skipped and these IDs are used directly in order. */
  precomputedQualifierRegistrationIds?: string[];
  /** Override the bracket type for pool→elimination. Defaults to 'single_elimination'. */
  eliminationFormat?: 'single_elimination' | 'double_elimination';
}

export interface BracketResult {
  success: boolean;
  stageId: number;
  matchCount: number;
  groupCount: number;
  roundCount: number;
  participantCount: number;
}

interface StoredStage {
  id: number | string;
  name?: string;
  type?: 'single_elimination' | 'double_elimination' | 'round_robin';
  tournament_id?: string;
}

interface StoredParticipant {
  id: number;
  tournament_id: string;
  name: string;
}

interface StoredRound {
  id: number | string;
  stage_id?: number | string;
  group_id?: number | string;
}

interface StoredGroup {
  id: number | string;
  stage_id?: number | string;
  number?: number | string;
}

interface StoredOpponent {
  id: number | string | null;
  result?: 'win' | 'loss' | 'draw';
}

interface StoredMatch {
  id: number | string;
  stage_id: number | string;
  round_id?: number | string;
  group_id?: number | string;
  status: number;
  opponent1?: StoredOpponent | null;
  opponent2?: StoredOpponent | null;
}

interface StoredMatchScore {
  id: string;
  status?: string;
  winnerId?: string;
  scores?: Array<{ score1: number; score2: number }>;
}

interface PoolStanding {
  participantId: number;
  registrationId: string;
  groupId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchPoints: number;
  pointsFor: number;
  pointsAgainst: number;
}

// ============================================
// Main Generator
// ============================================

export function useBracketGenerator() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);

  /**
   * Generate bracket using brackets-manager library with FirestoreStorage
   * Stores all data in category-isolated subcollections
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

      const category = {
        ...(categoryDoc.data() as Omit<Category, 'id'>),
        id: categoryDoc.id,
      } as Category;

      progress.value = 10;

      // 2. Get approved registrations
      const registrationsQuery = query(
        collection(db, 'tournaments', tournamentId, 'registrations'),
        where('categoryId', '==', categoryId),
        where('status', 'in', ['approved', 'checked_in'])
      );

      const registrationsSnap = await getDocs(registrationsQuery);
      const registrations = registrationsSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
      })) as Registration[];

      if (registrations.length < 2) {
        throw new Error('Need at least 2 participants to generate bracket');
      }

      progress.value = 20;

      // 3. Sort by seed — base ranking order (seeded first, then random)
      const baseSorted = sortRegistrationsBySeed(registrations);

      // For pool-to-elimination: apply the configured seeding method
      let finalOrdered: Registration[] = baseSorted;
      let poolSeedOverride: BracketOptions['seedOrdering'];

      if (category.format === 'pool_to_elimination') {
        const teamsPerPool = category.teamsPerPool ?? options.teamsPerPool ?? 4;
        const numPools = calculatePoolGroupCount(registrations.length, teamsPerPool);
        const method: PoolSeedingMethod = category.poolSeedingMethod ?? options.poolSeedingMethod ?? 'serpentine';
        const { ordered, seedOrdering } = orderRegistrationsForPool(baseSorted, method, numPools);
        finalOrdered = ordered;
        poolSeedOverride = seedOrdering;
        logger.debug(`🎯 Pool seeding: method=${method}, numPools=${numPools}, teamsPerPool=${teamsPerPool}`);
      }

      logger.debug(`📊 Generating ${category.format} bracket for ${finalOrdered.length} participants`);

      progress.value = 30;

      // 4. Create FirestoreStorage with category-isolated path
      // This ensures each category's data is completely separate
      const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
      const storage = new ClientFirestoreStorage(db, categoryPath);
      const manager = new BracketsManager(storage);

      logger.debug(`💾 Using FirestoreStorage with path: ${categoryPath}`);

      const participantsData: StoredParticipant[] = finalOrdered.map((reg, index) => ({
        id: index + 1,
        tournament_id: categoryId,
        name: reg.id,
      }));

      await storage.insert('participant', participantsData);
      logger.debug(`✅ Created ${participantsData.length} participants`);

      await new Promise(resolve => setTimeout(resolve, 500));

      logger.debug('🔍 Verifying participants in storage...');
      const verifyParticipants = await storage.select('participant') as any[];
      logger.debug(`   Found ${verifyParticipants?.length || 0} participants`);

      if (verifyParticipants && verifyParticipants.length > 0) {
        logger.debug('   First participant:', verifyParticipants[0]);

        const testSelect = await storage.select('participant', 1);
        logger.debug('   Select by ID 1:', testSelect ? 'FOUND' : 'NOT FOUND');
      }

      progress.value = 40;

      let result: BracketResult;
      if (category.format === 'pool_to_elimination') {
        result = await createPoolStage(
          category,
          manager,
          storage,
          participantsData.length,
          poolSeedOverride ? { ...options, seedOrdering: poolSeedOverride } : options
        );

        await setDoc(
          doc(db, 'tournaments', tournamentId, 'categories', categoryId),
          {
            status: 'active',
            stageId: result.stageId,
            poolStageId: result.stageId,
            eliminationStageId: null,
            poolPhase: 'pool',
            poolGroupCount: result.groupCount,
            poolQualifiersPerGroup: options.qualifiersPerGroup ?? 2,
            bracketGeneratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Write walkover match_scores for BYE matches immediately so standings
        // show correct MP/W counts right after bracket generation (no need to
        // wait for elimination phase). A BYE match has one null opponent.
        await initializeByeWalkovers(
          tournamentId,
          categoryId,
          storage,
          result.stageId,
          participantsData
        );
      } else {
        result = await createStandardStage(
          category,
          manager,
          storage,
          participantsData.length,
          options
        );

        await setDoc(
          doc(db, 'tournaments', tournamentId, 'categories', categoryId),
          {
            status: 'active',
            stageId: result.stageId,
            poolStageId: null,
            eliminationStageId: null,
            poolPhase: null,
            poolGroupCount: null,
            poolQualifiersPerGroup: null,
            poolQualifiedRegistrationIds: [],
            bracketGeneratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      logger.debug(`✅ Bracket generated and saved to ${categoryPath}:`, result);
      progress.value = 100;
      return result;

    } catch (err) {
      logger.error('Error generating bracket:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate bracket';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Generate elimination stage from completed pool-stage results.
   * Starter behavior: pool-stage matches are removed before elimination generation
   * so existing views and adapters do not mix stages.
   */
  async function generateEliminationFromPool(
    tournamentId: string,
    categoryId: string,
    options: BracketOptions = {}
  ): Promise<BracketResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
      const categoryDoc = await getDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId)
      );

      if (!categoryDoc.exists()) {
        throw new Error('Category not found');
      }

      const category = {
        ...(categoryDoc.data() as Omit<Category, 'id'>),
        id: categoryDoc.id,
      } as Category;
      if (category.format !== 'pool_to_elimination') {
        throw new Error('Category is not configured for pool-to-elimination');
      }

      const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
      const storage = new ClientFirestoreStorage(db, categoryPath);
      const manager = new BracketsManager(storage);

      progress.value = 10;

      const stages = asArray(await storage.select<StoredStage>('stage'));
      const poolStage = resolvePoolStage(stages, category.poolStageId);
      if (!poolStage) {
        throw new Error('Pool stage not found. Generate pool play first.');
      }

      const poolStageId = toNumberId(poolStage.id);
      if (poolStageId === null) {
        throw new Error('Invalid pool stage ID');
      }

      const participants = asArray(await storage.select<StoredParticipant>('participant'));
      const poolMatches = asArray(
        await storage.select<StoredMatch>('match', { stage_id: poolStageId })
      );
      const poolRounds = asArray(
        await storage.select<StoredRound>('round', { stage_id: poolStageId })
      );
      const poolGroups = asArray(
        await storage.select<StoredGroup>('group', { stage_id: poolStageId })
      );

      if (participants.length < 2) {
        throw new Error('Need at least 2 participants to generate elimination');
      }
      if (poolMatches.length === 0) {
        throw new Error('No pool matches found. Generate pool play first.');
      }

      progress.value = 25;

      const matchScoresSnapshot = await getDocs(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores`)
      );
      const matchScoresMap = new Map<string, StoredMatchScore>(
        matchScoresSnapshot.docs.map((docSnap) => [
          docSnap.id,
          { ...(docSnap.data() as Omit<StoredMatchScore, 'id'>), id: docSnap.id },
        ])
      );

      const pendingPoolMatches = poolMatches.filter((match) => {
        const score = matchScoresMap.get(String(match.id));
        return !isCompletedMatch(match, score);
      });

      if (pendingPoolMatches.length > 0) {
        throw new Error(
          `Pool stage not complete. ${pendingPoolMatches.length} match(es) still pending.`
        );
      }

      progress.value = 45;

      // Resolve who advances: either from pre-computed dialog selection or legacy per-group logic.
      let qualifierParticipantIds: number[];
      let qualifierRegistrationIds: string[];
      let resolvedGroupCount: number;
      let resolvedQualifiersPerGroup: number;

      if (options.precomputedQualifierRegistrationIds?.length) {
        // New path: dialog pre-computed the ordered list of advancing registration IDs.
        const participantByRegistrationId = new Map<string, number>(
          participants.map((p) => [p.name, p.id])
        );
        qualifierParticipantIds = options.precomputedQualifierRegistrationIds
          .map((rid) => participantByRegistrationId.get(rid))
          .filter((id): id is number => id !== undefined);
        qualifierRegistrationIds = options.precomputedQualifierRegistrationIds;
        resolvedGroupCount = 0; // not applicable for global-rank modes
        resolvedQualifiersPerGroup = 0;
      } else {
        // Legacy path: top N per pool.
        const qualifiers = extractPoolQualifiers({
          participants,
          matches: poolMatches,
          rounds: poolRounds,
          groups: poolGroups,
          matchScores: matchScoresMap,
          requestedQualifiersPerGroup:
            options.qualifiersPerGroup ??
            category.poolQualifiersPerGroup ??
            2,
        });
        qualifierParticipantIds = qualifiers.participantIds;
        qualifierRegistrationIds = qualifiers.registrationIds;
        resolvedGroupCount = qualifiers.groupCount;
        resolvedQualifiersPerGroup = qualifiers.qualifiersPerGroup;
      }

      if (qualifierParticipantIds.length < 2) {
        throw new Error('Not enough qualifiers to generate elimination stage.');
      }

      progress.value = 60;

      // Seed ID counters so the elimination stage receives IDs that don't collide
      // with the pool stage (which already occupies IDs starting at 0 in this path).
      await storage.seedCountersFromExisting(['stage', 'group', 'round', 'match', 'match_game', 'participant']);

      const bracketType = options.eliminationFormat ?? 'single_elimination';
      const eliminationSeeding = createSeedingFromParticipantIds(qualifierParticipantIds);
      const result = await createStageWithStats(
        manager,
        storage,
        categoryId,
        `${category.name} - Elimination`,
        bracketType,
        eliminationSeeding,
        {
          seedOrdering: options.seedOrdering || ['inner_outer'],
          consolationFinal: options.consolationFinal,
        }
      );

      progress.value = 85;

      await setDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId),
        {
          status: 'active',
          stageId: result.stageId,
          eliminationStageId: result.stageId,
          poolPhase: 'elimination',
          poolGroupCount: resolvedGroupCount,
          poolQualifiersPerGroup: resolvedQualifiersPerGroup,
          poolQualifiedRegistrationIds: qualifierRegistrationIds,
          bracketGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      progress.value = 100;
      return result;
    } catch (err) {
      logger.error('Error generating elimination from pool:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate elimination stage';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Generate a level-specific elimination bracket under
   * tournaments/{t}/categories/{c}/levels/{levelId}/...
   */
  async function generateLevelBracket(
    tournamentId: string,
    categoryId: string,
    levelId: string,
    levelName: string,
    orderedRegistrationIds: string[],
    eliminationFormat: LevelEliminationFormat,
    options: BracketOptions = {}
  ): Promise<BracketResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
      if (orderedRegistrationIds.length < 2) {
        throw new Error('Need at least 2 participants to generate level bracket');
      }

      const levelPath = `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`;
      const storage = new ClientFirestoreStorage(db, levelPath);
      const manager = new BracketsManager(storage);

      progress.value = 20;

      await clearBracketStorage(storage);

      const participantsData: StoredParticipant[] = orderedRegistrationIds.map((registrationId, index) => ({
        id: index + 1,
        tournament_id: `${categoryId}:${levelId}`,
        name: registrationId,
      }));
      await storage.insert('participant', participantsData);

      const maxBracketSize = eliminationFormat === 'playoff_8' ? 8 : undefined;
      const seeding = createSeedingArrayWithExistingOrder(
        participantsData.map((participant) => participant.id),
        maxBracketSize
      );

      const stageType = eliminationFormat === 'double_elimination'
        ? 'double_elimination'
        : 'single_elimination';

      progress.value = 60;

      const result = await createStageWithStats(
        manager,
        storage,
        `${categoryId}:${levelId}`,
        levelName,
        stageType,
        seeding,
        {
          seedOrdering: options.seedOrdering || ['inner_outer'],
          grandFinal: stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
          consolationFinal: options.consolationFinal,
        }
      );

      const registrationIdByParticipantId = new Map<number, string>(
        participantsData.map((participant) => [participant.id, participant.name])
      );

      await initializeLevelMatchScores(
        tournamentId,
        categoryId,
        levelId,
        storage,
        result.stageId,
        registrationIdByParticipantId
      );

      progress.value = 100;
      return result;
    } catch (err) {
      logger.error('Error generating level bracket:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate level bracket';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete existing bracket for a category
   */
  async function deleteBracket(
    tournamentId: string,
    categoryId: string
  ): Promise<void> {
    const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = new ClientFirestoreStorage(db, categoryPath);

    // Get all stages for this category
    const stages = asArray(await storage.select<StoredStage>('stage'));

    if (stages.length > 0) {
      for (const stage of stages) {
        const stageId = toNumberId(stage.id);
        if (stageId === null) continue;

        const stageMatches = asArray(
          await storage.select<StoredMatch>('match', { stage_id: stageId })
        );

        if (stageMatches.length > 0) {
          await deleteMatchScoresByIds(tournamentId, categoryId, stageMatches.map((match) => String(match.id)));
        }

        await storage.delete('match', { stage_id: stageId });
        await storage.delete('match_game', { stage_id: stageId });
        await storage.delete('round', { stage_id: stageId });
        await storage.delete('group', { stage_id: stageId });
        await storage.delete('stage', stageId);
      }
    }

    await storage.delete('participant', { tournament_id: categoryId });

    // Update category status
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId),
      {
        status: 'setup',
        stageId: null,
        poolStageId: null,
        eliminationStageId: null,
        poolPhase: null,
        poolGroupCount: null,
        poolQualifiersPerGroup: null,
        poolQualifiedRegistrationIds: [],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    logger.debug(`✅ Deleted bracket from ${categoryPath}`);
  }

  return {
    loading,
    error,
    progress,
    generateBracket,
    generateEliminationFromPool,
    generateLevelBracket,
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

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Order registrations for pool assignment based on the chosen seeding method.
 * All three methods use brackets-manager's `groups.effort_balanced` (serpentine)
 * distribution — the difference is only in how players are ordered before
 * being added as participants.
 *
 * - serpentine:      rank-sorted → effort_balanced snakes top seeds across pools
 * - random_in_tiers: rank-sorted, shuffled within each tier of `numPools` →
 *                    each pool still gets one player from each skill tier, but
 *                    which specific player is randomised
 * - fully_random:    all players shuffled → effort_balanced on a random list =
 *                    effectively fully random pool assignment
 */
function orderRegistrationsForPool(
  sortedByRank: Registration[],
  method: PoolSeedingMethod,
  numPools: number
): { ordered: Registration[]; seedOrdering: BracketOptions['seedOrdering'] } {
  if (method === 'fully_random') {
    return { ordered: fisherYatesShuffle(sortedByRank), seedOrdering: ['groups.effort_balanced'] };
  }

  if (method === 'random_in_tiers') {
    const tiered: Registration[] = [];
    for (let i = 0; i < sortedByRank.length; i += numPools) {
      const tier = sortedByRank.slice(i, i + numPools);
      tiered.push(...fisherYatesShuffle(tier));
    }
    return { ordered: tiered, seedOrdering: ['groups.effort_balanced'] };
  }

  // serpentine — pass rank-sorted; brackets-manager snakes them into pools
  return { ordered: sortedByRank, seedOrdering: ['groups.effort_balanced'] };
}

function createSeedingArray(participantCount: number): (number | null)[] {
  const count = participantCount;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(count, 2))));
  const seeding: (number | null)[] = [];

  for (let i = 0; i < participantCount; i++) {
    seeding.push(i + 1);
  }

  while (seeding.length < bracketSize) {
    seeding.push(null);
  }

  logger.debug('🎯 Seeding array:', seeding.map((s, i) => s ? `Pos${i}:P${s}` : `Pos${i}:BYE`).join(', '));
  logger.debug(`   ${count} participants -> ${bracketSize}-slot bracket (${bracketSize - count} BYEs)`);

  return seeding;
}

function createSequentialSeeding(participantCount: number): number[] {
  return Array.from({ length: participantCount }, (_, index) => index + 1);
}

function toNumberId(value: number | string | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asArray<T>(value: T[] | T | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  return [value];
}

function calculatePoolGroupCount(participantCount: number, teamsPerPool?: number): number {
  const size = teamsPerPool && teamsPerPool >= 2 ? Math.floor(teamsPerPool) : 4;
  // Use floor so each pool gets at least `size` players; extras are spread by brackets-manager
  return Math.max(1, Math.ceil(participantCount / size));
}

function getRoundRobinSeedOrdering(
  seedOrdering?: BracketOptions['seedOrdering']
): BracketOptions['seedOrdering'] {
  if (!seedOrdering || seedOrdering.length === 0) {
    return ['groups.effort_balanced'];
  }

  const groupSeedOrdering = seedOrdering.filter((ordering) => ordering.startsWith('groups.'));
  return groupSeedOrdering.length > 0 ? groupSeedOrdering : ['groups.effort_balanced'];
}

async function createStandardStage(
  category: Category,
  manager: BracketsManager,
  storage: ClientFirestoreStorage,
  participantCount: number,
  options: BracketOptions
): Promise<BracketResult> {
  if (category.format === 'pool_to_elimination') {
    throw new Error('Pool-to-elimination categories must use pool stage generation.');
  }

  const stageType = category.format;
  const roundRobin = stageType === 'round_robin';
  const seeding = roundRobin
    ? createSequentialSeeding(participantCount)
    : createSeedingArray(participantCount);

  if (roundRobin) {
    return createStageWithStats(
      manager,
      storage,
      category.id,
      category.name,
      'round_robin',
      seeding,
      {
        seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),
        groupCount: options.groupCount || 1,
      }
    );
  }

  return createStageWithStats(
    manager,
    storage,
    category.id,
    category.name,
    stageType,
    seeding,
    {
      seedOrdering: options.seedOrdering || ['inner_outer'],
      grandFinal: stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
      consolationFinal: options.consolationFinal,
    }
  );
}

async function createPoolStage(
  category: Category,
  manager: BracketsManager,
  storage: ClientFirestoreStorage,
  participantCount: number,
  options: BracketOptions
): Promise<BracketResult> {
  const teamsPerPool = category.teamsPerPool ?? options.teamsPerPool ?? 4;
  const groupCount = calculatePoolGroupCount(participantCount, teamsPerPool);

  // Pad with nulls (BYEs) so every pool has exactly teamsPerPool slots.
  // createStageWithStats already accepts (number | null)[] — nulls create bye matches.
  // BYE padding: works for any N and any teamsPerPool.
  // When N divides evenly, totalSlots === participantCount → loop never runs.
  // When uneven, null slots are distributed by brackets-manager one per affected pool.
  const totalSlots = groupCount * teamsPerPool;
  const seeding: (number | null)[] = createSequentialSeeding(participantCount);
  while (seeding.length < totalSlots) {
    seeding.push(null);
  }

  return createStageWithStats(
    manager,
    storage,
    category.id,
    `${category.name} - Pool Play`,
    'round_robin',
    seeding,
    {
      seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),
      groupCount,
    }
  );
}

function resolvePoolStage(stages: StoredStage[], poolStageId?: number | null): StoredStage | null {
  if (poolStageId !== undefined && poolStageId !== null) {
    const exactMatch = stages.find((stage) => toNumberId(stage.id) === poolStageId);
    if (exactMatch) return exactMatch;
  }

  // Fall back to the latest round-robin stage.
  const roundRobinStages = stages.filter((stage) => stage.type === 'round_robin');
  if (roundRobinStages.length === 0) return null;

  return roundRobinStages
    .slice()
    .sort((a, b) => (toNumberId(b.id) || 0) - (toNumberId(a.id) || 0))[0];
}

function isCompletedMatch(match: StoredMatch, score?: StoredMatchScore): boolean {
  if (score?.status === 'completed' || score?.status === 'walkover') {
    return true;
  }

  // Fallback to brackets-manager status if match_scores isn't available yet.
  return match.status === 4;
}

function createSeedingFromParticipantIds(participantIds: number[]): (number | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantIds.length, 2))));
  const seeding: (number | null)[] = [...participantIds];

  while (seeding.length < bracketSize) {
    seeding.push(null);
  }

  return seeding;
}

function createSeedingArrayWithExistingOrder(
  participantIds: number[],
  maxBracketSize?: number
): (number | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantIds.length, 2))));
  const targetSize = maxBracketSize || bracketSize;
  const trimmed = participantIds.slice(0, targetSize);
  const seeding: (number | null)[] = [...trimmed];

  while (seeding.length < targetSize) {
    seeding.push(null);
  }

  return seeding;
}

function extractPoolQualifiers(params: {
  participants: StoredParticipant[];
  matches: StoredMatch[];
  rounds: StoredRound[];
  groups: StoredGroup[];
  matchScores: Map<string, StoredMatchScore>;
  requestedQualifiersPerGroup: number;
}): { participantIds: number[]; registrationIds: string[]; groupCount: number; qualifiersPerGroup: number } {
  const roundToGroupMap = new Map<string, string>();
  for (const round of params.rounds) {
    if (round.group_id !== undefined && round.group_id !== null) {
      roundToGroupMap.set(String(round.id), String(round.group_id));
    }
  }

  const participantToGroupMap = new Map<number, string>();
  for (const match of params.matches) {
    const groupId = match.group_id !== undefined && match.group_id !== null
      ? String(match.group_id)
      : roundToGroupMap.get(String(match.round_id || '')) || 'group-1';

    const p1Id = toNumberId(match.opponent1?.id ?? null);
    const p2Id = toNumberId(match.opponent2?.id ?? null);
    if (p1Id !== null && !participantToGroupMap.has(p1Id)) {
      participantToGroupMap.set(p1Id, groupId);
    }
    if (p2Id !== null && !participantToGroupMap.has(p2Id)) {
      participantToGroupMap.set(p2Id, groupId);
    }
  }

  const registrationByParticipantId = new Map<number, string>(
    params.participants.map((participant) => [participant.id, participant.name])
  );
  const participantByRegistrationId = new Map<string, number>(
    params.participants.map((participant) => [participant.name, participant.id])
  );

  const standings = new Map<number, PoolStanding>();
  for (const participant of params.participants) {
    const groupId = participantToGroupMap.get(participant.id) || 'group-1';
    standings.set(participant.id, {
      participantId: participant.id,
      registrationId: participant.name,
      groupId,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchPoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of params.matches) {
    const p1Id = toNumberId(match.opponent1?.id ?? null);
    const p2Id = toNumberId(match.opponent2?.id ?? null);
    if (p1Id === null || p2Id === null) continue;

    const p1Standing = standings.get(p1Id);
    const p2Standing = standings.get(p2Id);
    if (!p1Standing || !p2Standing) continue;

    const score = params.matchScores.get(String(match.id));

    const winnerRegistrationId = score?.winnerId;
    const winnerParticipantId =
      winnerRegistrationId
        ? participantByRegistrationId.get(winnerRegistrationId)
        : match.opponent1?.result === 'win'
          ? p1Id
          : match.opponent2?.result === 'win'
            ? p2Id
            : undefined;

    p1Standing.matchesPlayed += 1;
    p2Standing.matchesPlayed += 1;

    for (const game of score?.scores || []) {
      p1Standing.pointsFor += game.score1;
      p1Standing.pointsAgainst += game.score2;
      p2Standing.pointsFor += game.score2;
      p2Standing.pointsAgainst += game.score1;
    }

    if (winnerParticipantId === p1Id) {
      p1Standing.matchesWon += 1;
      p1Standing.matchPoints += 2;
      p2Standing.matchesLost += 1;
      p2Standing.matchPoints += 1;
    } else if (winnerParticipantId === p2Id) {
      p2Standing.matchesWon += 1;
      p2Standing.matchPoints += 2;
      p1Standing.matchesLost += 1;
      p1Standing.matchPoints += 1;
    }
  }

  // Grant walkover wins to players whose opponent was a BYE (null opponent).
  // The main loop above already skips these via the (p1Id === null || p2Id === null) guard.
  for (const match of params.matches) {
    const p1Id = toNumberId(match.opponent1?.id ?? null);
    const p2Id = toNumberId(match.opponent2?.id ?? null);
    if (p1Id !== null && p2Id !== null) continue; // real match — already handled above
    if (p1Id === null && p2Id === null) continue;  // no players (shouldn't happen)

    const realPlayerId = p1Id ?? p2Id;
    if (realPlayerId === null) continue;

    const standing = standings.get(realPlayerId);
    if (!standing) continue;

    standing.matchesPlayed += 1;
    standing.matchesWon += 1;
    standing.matchPoints += 2; // Win = 2 pts; WO scored 0-0, no pointsFor/Against added
  }

  const standingsByGroup = new Map<string, PoolStanding[]>();
  for (const standing of standings.values()) {
    if (!standingsByGroup.has(standing.groupId)) {
      standingsByGroup.set(standing.groupId, []);
    }
    standingsByGroup.get(standing.groupId)?.push(standing);
  }

  for (const groupStandings of standingsByGroup.values()) {
    groupStandings.sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;

      const aPointDiff = a.pointsFor - a.pointsAgainst;
      const bPointDiff = b.pointsFor - b.pointsAgainst;
      if (bPointDiff !== aPointDiff) return bPointDiff - aPointDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;

      return a.registrationId.localeCompare(b.registrationId);
    });
  }

  const minGroupSize = Math.min(...Array.from(standingsByGroup.values()).map((value) => value.length));
  const qualifiersPerGroup = Math.max(
    1,
    Math.min(
      Math.floor(params.requestedQualifiersPerGroup),
      Number.isFinite(minGroupSize) ? minGroupSize : 1
    )
  );

  const groupOrder = params.groups
    .slice()
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
    .map((group) => String(group.id));

  if (groupOrder.length === 0) {
    groupOrder.push(...Array.from(standingsByGroup.keys()).sort());
  }

  const qualifiedParticipantIds: number[] = [];
  for (let rankIndex = 0; rankIndex < qualifiersPerGroup; rankIndex++) {
    for (const groupId of groupOrder) {
      const qualifier = standingsByGroup.get(groupId)?.[rankIndex];
      if (qualifier) {
        qualifiedParticipantIds.push(qualifier.participantId);
      }
    }
  }

  const qualifiedRegistrationIds = qualifiedParticipantIds
    .map((participantId) => registrationByParticipantId.get(participantId))
    .filter((value): value is string => typeof value === 'string');

  return {
    participantIds: qualifiedParticipantIds,
    registrationIds: qualifiedRegistrationIds,
    groupCount: standingsByGroup.size,
    qualifiersPerGroup,
  };
}

function convertBracketsStatus(status: number): MatchStatus {
  switch (status) {
    case 3:
      return 'in_progress';
    case 4:
      return 'completed';
    case 0:
    case 1:
    case 2:
    default:
      return 'ready';
  }
}

function resolveWinnerRegistrationId(
  match: StoredMatch,
  registrationIdByParticipantId: Map<number, string>
): string | undefined {
  const p1Id = toNumberId(match.opponent1?.id ?? null);
  const p2Id = toNumberId(match.opponent2?.id ?? null);

  if (p1Id === null || p2Id === null) {
    return undefined;
  }

  if (match.opponent1?.result === 'win') {
    return registrationIdByParticipantId.get(p1Id);
  }

  if (match.opponent2?.result === 'win') {
    return registrationIdByParticipantId.get(p2Id);
  }

  return undefined;
}

async function initializeLevelMatchScores(
  tournamentId: string,
  categoryId: string,
  levelId: string,
  storage: ClientFirestoreStorage,
  stageId: number,
  registrationIdByParticipantId: Map<number, string>
): Promise<void> {
  const levelMatches = asArray(await storage.select<StoredMatch>('match', { stage_id: stageId }));
  if (levelMatches.length === 0) {
    return;
  }

  const CHUNK_SIZE = 400;
  for (let i = 0; i < levelMatches.length; i += CHUNK_SIZE) {
    const chunk = levelMatches.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    let operations = 0;

    for (const match of chunk) {
      const p1Id = toNumberId(match.opponent1?.id ?? null);
      const p2Id = toNumberId(match.opponent2?.id ?? null);
      if (p1Id === null || p2Id === null) {
        continue;
      }

      const status = convertBracketsStatus(match.status);
      const winnerId = resolveWinnerRegistrationId(match, registrationIdByParticipantId);
      const payload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (winnerId) {
        payload.winnerId = winnerId;
      }

      if (status === 'completed' || status === 'walkover') {
        payload.completedAt = serverTimestamp();
      }

      batch.set(
        doc(
          db,
          'tournaments',
          tournamentId,
          'categories',
          categoryId,
          'levels',
          levelId,
          'match_scores',
          String(match.id)
        ),
        payload,
        { merge: true }
      );
      operations += 1;
    }

    if (operations > 0) {
      await batch.commit();
    }
  }
}

/**
 * Write walkover match_scores for every BYE match in the pool stage so that
 * standings reflect the correct MP/W values immediately after bracket generation.
 * A BYE match is one where either opponent1 or opponent2 has a null id.
 */
async function initializeByeWalkovers(
  tournamentId: string,
  categoryId: string,
  storage: ClientFirestoreStorage,
  stageId: number,
  participants: StoredParticipant[]
): Promise<void> {
  const allMatches = asArray(
    await storage.select<StoredMatch>('match', { stage_id: stageId })
  );

  // Find all BYE matches — one side has a null / undefined opponent id
  const byeMatches = allMatches.filter(
    (m) =>
      m.opponent1?.id === null ||
      m.opponent1?.id === undefined ||
      m.opponent2?.id === null ||
      m.opponent2?.id === undefined
  );

  if (byeMatches.length === 0) {
    logger.debug('ℹ️ No BYE matches found — skipping walkover initialisation');
    return;
  }

  // participantId (number) → registrationId (name stored in StoredParticipant.name)
  const regIdByParticipantId = new Map<number, string>(
    participants.map((p) => [p.id, p.name])
  );

  const batch = writeBatch(db);

  for (const match of byeMatches) {
    const p1Id = toNumberId(match.opponent1?.id ?? null);
    const p2Id = toNumberId(match.opponent2?.id ?? null);

    // The real player is on the non-null side
    const realParticipantId = p1Id ?? p2Id;
    if (realParticipantId === null) continue;

    const winnerId = regIdByParticipantId.get(realParticipantId);
    if (!winnerId) continue;

    batch.set(
      doc(
        db,
        'tournaments', tournamentId,
        'categories', categoryId,
        'match_scores', String(match.id)
      ),
      {
        status: 'walkover',
        winnerId,
        scores: [],          // WO = 0-0, no game scores
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
  logger.debug(`✅ Wrote ${byeMatches.length} walkover match_scores for BYE matches in stage ${stageId}`);
}

async function deleteMatchScoresByIds(
  tournamentId: string,
  categoryId: string,
  matchIds: string[]
): Promise<void> {
  if (matchIds.length === 0) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const chunk = matchIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const matchId of chunk) {
      batch.delete(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId)
      );
    }

    await batch.commit();
  }
}

async function clearBracketStorage(storage: ClientFirestoreStorage): Promise<void> {
  await storage.delete('match');
  await storage.delete('match_game');
  await storage.delete('round');
  await storage.delete('group');
  await storage.delete('stage');
  await storage.delete('participant');
}

async function createStageWithStats(
  manager: BracketsManager,
  storage: ClientFirestoreStorage,
  categoryId: string,
  stageName: string,
  stageType: 'single_elimination' | 'double_elimination' | 'round_robin',
  seedingIds: (number | null)[],
  settings: {
    seedOrdering?: BracketOptions['seedOrdering'];
    grandFinal?: 'simple' | 'double' | 'none';
    consolationFinal?: boolean;
    groupCount?: number;
  }
): Promise<BracketResult> {
  const stage = await manager.create.stage({
    tournamentId: categoryId,
    name: stageName,
    type: stageType,
    seedingIds,
    settings,
  });

  let stageId = toNumberId(stage?.id);
  if (stageId === null) {
    const stages = asArray(await storage.select<StoredStage>('stage', { tournament_id: categoryId }));
    const matchingStages = stages.filter(
      (storedStage) => storedStage.name === stageName && storedStage.type === stageType
    );
    stageId = toNumberId(matchingStages[0]?.id);
  }

  if (stageId === null) {
    throw new Error(`Failed to resolve stage ID for "${stageName}"`);
  }

  const matches = asArray(await storage.select<StoredMatch>('match', { stage_id: stageId }));
  const groups = asArray(await storage.select<StoredGroup>('group', { stage_id: stageId }));
  const rounds = asArray(await storage.select<StoredRound>('round', { stage_id: stageId }));

  return {
    success: true,
    stageId,
    matchCount: matches.length,
    groupCount: groups.length,
    roundCount: rounds.length,
    participantCount: seedingIds.filter((participantId) => participantId !== null).length,
  };
}
