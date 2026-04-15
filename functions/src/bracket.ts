/**
 * Server-side bracket generation operations.
 * All 4 operations mirror the client-side useBracketGenerator.ts composable.
 * Uses FirestoreStorage (admin SDK) instead of ClientFirestoreStorage (client SDK).
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import type { Registration, Category, LevelEliminationFormat } from './types';
import {
  BracketOptions,
  BracketResult,
  StoredStage,
  StoredParticipant,
  StoredMatch,
  sortRegistrationsBySeed,
  orderRegistrationsForPool,
  calculatePoolGroupCount,
  asArray,
  createSeedingFromParticipantIds,
  createSeedingArrayWithExistingOrder,
  resolvePoolStage,
  isCompletedMatch,
  extractPoolQualifiers,
  createStandardStage,
  createPoolStage,
  createStageWithStats,
  initializeByeWalkovers,
  initializeLevelMatchScores,
  deleteMatchScoresByIds,
  clearBracketStorage,
} from './bracketHelpers';

function getDb() {
  return admin.firestore();
}

function getStorage(rootPath: string): FirestoreStorage {
  return new FirestoreStorage(getDb(), rootPath);
}

function getManager(rootPath: string): BracketsManager {
  return new BracketsManager(getStorage(rootPath));
}

// ============================================
// 1. createBracket — standard + pool phase generation
// ============================================

export async function createBracket(
  tournamentId: string,
  categoryId: string,
  options: BracketOptions = {}
): Promise<BracketResult> {
  const db = getDb();

  // 1. Get category details
  const categoryDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .get();

  if (!categoryDoc.exists) throw new Error('Category not found');

  const category: Category = { id: categoryDoc.id, ...(categoryDoc.data() as any) };

  // 2. Get approved/checked_in registrations
  const registrationsSnap = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('registrations')
    .where('categoryId', '==', categoryId)
    .where('status', 'in', ['approved', 'checked_in'])
    .get();

  const registrations: Registration[] = registrationsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  if (registrations.length < 2) {
    throw new Error('Need at least 2 participants to generate bracket');
  }

  // 3. Sort by seed; apply pool seeding method if applicable
  const baseSorted = sortRegistrationsBySeed(registrations);
  let finalOrdered: Registration[] = baseSorted;
  let poolSeedOverride: BracketOptions['seedOrdering'];

  if (category.format === 'pool_to_elimination') {
    const teamsPerPool = category.teamsPerPool ?? options.teamsPerPool ?? 4;
    const numPools = calculatePoolGroupCount(registrations.length, teamsPerPool);
    const method = category.poolSeedingMethod ?? options.poolSeedingMethod ?? 'serpentine';
    const { ordered, seedOrdering } = orderRegistrationsForPool(baseSorted, method, numPools);
    finalOrdered = ordered;
    poolSeedOverride = seedOrdering;
  }

  // 4. Create storage scoped to category
  const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
  const storage = getStorage(categoryPath);
  const manager = getManager(categoryPath);

  // 5. Insert participants (name = registrationId, tournament_id = categoryId)
  const participantsData: Omit<StoredParticipant, 'id'>[] = finalOrdered.map((reg, index) => ({
    id: index + 1,
    tournament_id: categoryId,
    name: reg.id,
  }));

  await storage.insert('participant', participantsData as any);

  // 6. Generate stage
  let result: BracketResult;

  if (category.format === 'pool_to_elimination') {
    result = await createPoolStage(
      category,
      manager,
      storage,
      participantsData.length,
      poolSeedOverride ? { ...options, seedOrdering: poolSeedOverride } : options
    );

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('categories')
      .doc(categoryId)
      .set(
        {
          status: 'active',
          stageId: result.stageId,
          poolStageId: result.stageId,
          eliminationStageId: null,
          poolPhase: 'pool',
          poolGroupCount: result.groupCount,
          poolQualifiersPerGroup: options.qualifiersPerGroup ?? 2,
          bracketGeneratedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await initializeByeWalkovers(
      db,
      tournamentId,
      categoryId,
      storage,
      result.stageId,
      participantsData as StoredParticipant[]
    );
  } else {
    result = await createStandardStage(
      category,
      manager,
      storage,
      participantsData.length,
      options
    );

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('categories')
      .doc(categoryId)
      .set(
        {
          status: 'active',
          stageId: result.stageId,
          poolStageId: null,
          eliminationStageId: null,
          poolPhase: null,
          poolGroupCount: null,
          poolQualifiersPerGroup: null,
          poolQualifiedRegistrationIds: [],
          bracketGeneratedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  return result;
}

// ============================================
// 2. createEliminationFromPool — advance pool → elimination
// ============================================

export async function createEliminationFromPool(
  tournamentId: string,
  categoryId: string,
  options: BracketOptions = {}
): Promise<BracketResult> {
  const db = getDb();

  const categoryDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .get();

  if (!categoryDoc.exists) throw new Error('Category not found');
  const category: Category = { id: categoryDoc.id, ...(categoryDoc.data() as any) };

  if (category.format !== 'pool_to_elimination') {
    throw new Error('Category is not configured for pool-to-elimination');
  }

  const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
  const storage = getStorage(categoryPath);
  const manager = getManager(categoryPath);

  const stages = asArray(await storage.select<StoredStage>('stage'));
  const poolStage = resolvePoolStage(stages, category.poolStageId);
  if (!poolStage) throw new Error('Pool stage not found. Generate pool play first.');

  const poolStageId = poolStage.id;

  const participants = asArray(await storage.select<StoredParticipant>('participant'));
  const poolMatches = asArray(
    await storage.select<StoredMatch>('match', { stage_id: poolStageId })
  );
  const poolRounds = asArray(
    await storage.select('round', { stage_id: poolStageId }) as any
  );
  const poolGroups = asArray(
    await storage.select('group', { stage_id: poolStageId }) as any
  );

  if (participants.length < 2) throw new Error('Need at least 2 participants to generate elimination');
  if (poolMatches.length === 0) throw new Error('No pool matches found. Generate pool play first.');

  // Fetch match_scores to verify completion
  const matchScoresSnap = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .collection('match_scores')
    .get();

  const matchScoresMap = new Map<string, any>(
    matchScoresSnap.docs.map((d) => [d.id, { ...d.data(), id: d.id }])
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

  // Resolve qualifiers
  let qualifierParticipantIds: (number | string)[];
  let qualifierRegistrationIds: string[];
  let resolvedGroupCount: number;
  let resolvedQualifiersPerGroup: number;

  if (options.precomputedQualifierRegistrationIds?.length) {
    const participantByRegistrationId = new Map<string, string | number>(
      participants.map((p) => [p.name, p.id])
    );
    qualifierParticipantIds = options.precomputedQualifierRegistrationIds
      .map((rid) => participantByRegistrationId.get(rid))
      .filter((id): id is string | number => id !== undefined);
    qualifierRegistrationIds = options.precomputedQualifierRegistrationIds;
    resolvedGroupCount = 0;
    resolvedQualifiersPerGroup = 0;
  } else {
    const qualifiers = extractPoolQualifiers({
      participants,
      matches: poolMatches,
      rounds: poolRounds,
      groups: poolGroups,
      matchScores: matchScoresMap,
      requestedQualifiersPerGroup:
        options.qualifiersPerGroup ?? category.poolQualifiersPerGroup ?? 2,
    });
    qualifierParticipantIds = qualifiers.participantIds;
    qualifierRegistrationIds = qualifiers.registrationIds;
    resolvedGroupCount = qualifiers.groupCount;
    resolvedQualifiersPerGroup = qualifiers.qualifiersPerGroup;
  }

  if (qualifierParticipantIds.length < 2) {
    throw new Error('Not enough qualifiers to generate elimination stage.');
  }

  // Server uses auto-generated string IDs — no seedCountersFromExisting needed
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

  await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .set(
      {
        status: 'active',
        stageId: result.stageId,
        eliminationStageId: result.stageId,
        poolPhase: 'elimination',
        poolGroupCount: resolvedGroupCount,
        poolQualifiersPerGroup: resolvedQualifiersPerGroup,
        poolQualifiedRegistrationIds: qualifierRegistrationIds,
        bracketGeneratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return result;
}

// ============================================
// 3. createLevelBracket — level-scoped bracket
// ============================================

export async function createLevelBracket(
  tournamentId: string,
  categoryId: string,
  levelId: string,
  levelName: string,
  orderedRegistrationIds: string[],
  eliminationFormat: LevelEliminationFormat,
  options: BracketOptions = {}
): Promise<BracketResult> {
  if (orderedRegistrationIds.length < 2) {
    throw new Error('Need at least 2 participants to generate level bracket');
  }

  const db = getDb();
  const levelPath = `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`;
  const storage = getStorage(levelPath);
  const manager = getManager(levelPath);

  await clearBracketStorage(storage);

  const participantsData = orderedRegistrationIds.map((registrationId, index) => ({
    id: index + 1,
    tournament_id: `${categoryId}:${levelId}`,
    name: registrationId,
  }));

  await storage.insert('participant', participantsData as any);

  const maxBracketSize = eliminationFormat === 'playoff_8' ? 8 : undefined;
  const seeding = createSeedingArrayWithExistingOrder(
    participantsData.map((p) => p.id),
    maxBracketSize
  );

  const stageType =
    eliminationFormat === 'double_elimination' ? 'double_elimination' : 'single_elimination';

  const result = await createStageWithStats(
    manager,
    storage,
    `${categoryId}:${levelId}`,
    levelName,
    stageType,
    seeding,
    {
      seedOrdering: options.seedOrdering || ['inner_outer'],
      grandFinal:
        stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
      consolationFinal: options.consolationFinal,
    }
  );

  const registrationIdByParticipantId = new Map<string, string>(
    participantsData.map((p) => [String(p.id), p.name])
  );

  await initializeLevelMatchScores(
    db,
    tournamentId,
    categoryId,
    levelId,
    storage,
    result.stageId,
    registrationIdByParticipantId
  );

  return result;
}

// ============================================
// 4. deleteBracket — full cleanup
// ============================================

export async function deleteBracket(
  tournamentId: string,
  categoryId: string
): Promise<void> {
  const db = getDb();
  const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
  const storage = getStorage(categoryPath);

  const stages = asArray(await storage.select<StoredStage>('stage'));

  if (stages.length > 0) {
    for (const stage of stages) {
      const stageId = stage.id;

      const stageMatches = asArray(
        await storage.select<StoredMatch>('match', { stage_id: stageId })
      );

      if (stageMatches.length > 0) {
        await deleteMatchScoresByIds(
          db,
          tournamentId,
          categoryId,
          stageMatches.map((m) => String(m.id))
        );
      }

      await storage.delete('match', { stage_id: stageId });
      await storage.delete('match_game', { stage_id: stageId });
      await storage.delete('round', { stage_id: stageId });
      await storage.delete('group', { stage_id: stageId });
      await storage.delete('stage', stageId as any);
    }
  }

  await storage.delete('participant', { tournament_id: categoryId });

  await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('categories')
    .doc(categoryId)
    .set(
      {
        status: 'setup',
        stageId: null,
        poolStageId: null,
        eliminationStageId: null,
        poolPhase: null,
        poolGroupCount: null,
        poolQualifiersPerGroup: null,
        poolQualifiedRegistrationIds: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
