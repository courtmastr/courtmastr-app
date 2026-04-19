/**
 * Server-side bracket generation helpers.
 * Ported from src/composables/useBracketGenerator.ts
 * Uses firebase-admin SDK instead of firebase client SDK.
 * No Vue reactivity, no seedCountersFromExisting (server uses auto-string IDs — no collisions).
 */

import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import type {
  Registration,
  Category,
  MatchStatus,
  PoolSeedingMethod,
} from './types';

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
  precomputedQualifierRegistrationIds?: string[];
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

export interface StoredStage {
  id: number | string;
  name?: string;
  type?: 'single_elimination' | 'double_elimination' | 'round_robin';
  tournament_id?: string;
}

export interface StoredParticipant {
  id: number | string;
  tournament_id: string;
  name: string;
}

export interface StoredRound {
  id: number | string;
  stage_id?: number | string;
  group_id?: number | string;
}

export interface StoredGroup {
  id: number | string;
  stage_id?: number | string;
  number?: number | string;
}

export interface StoredOpponent {
  id: number | string | null;
  result?: 'win' | 'loss' | 'draw';
}

export interface StoredMatch {
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

// ============================================
// Pure helper functions
// ============================================

export function sortRegistrationsBySeed(registrations: Registration[]): Registration[] {
  const seeded = registrations
    .filter((r) => r.seed !== undefined && r.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));

  const unseeded = registrations
    .filter((r) => r.seed === undefined || r.seed === null)
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

export function orderRegistrationsForPool(
  sortedByRank: Registration[],
  method: PoolSeedingMethod,
  numPools: number
): { ordered: Registration[]; seedOrdering: BracketOptions['seedOrdering'] } {
  if (method === 'fully_random') {
    return {
      ordered: fisherYatesShuffle(sortedByRank),
      seedOrdering: ['groups.effort_balanced'],
    };
  }

  if (method === 'random_in_tiers') {
    const tiered: Registration[] = [];
    for (let i = 0; i < sortedByRank.length; i += numPools) {
      const tier = sortedByRank.slice(i, i + numPools);
      tiered.push(...fisherYatesShuffle(tier));
    }
    return { ordered: tiered, seedOrdering: ['groups.effort_balanced'] };
  }

  // serpentine
  return { ordered: sortedByRank, seedOrdering: ['groups.effort_balanced'] };
}

export function createSeedingArray(participantCount: number): (number | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantCount, 2))));
  const seeding: (number | null)[] = [];
  for (let i = 0; i < participantCount; i++) {
    seeding.push(i + 1);
  }
  while (seeding.length < bracketSize) {
    seeding.push(null);
  }
  return seeding;
}

export function createSequentialSeeding(participantCount: number): number[] {
  return Array.from({ length: participantCount }, (_, index) => index + 1);
}

export function toNumberId(value: number | string | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asArray<T>(value: T[] | T | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  return [value];
}

export function calculatePoolGroupCount(participantCount: number, teamsPerPool?: number): number {
  const size = teamsPerPool && teamsPerPool >= 2 ? Math.floor(teamsPerPool) : 4;
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

export function resolvePoolStage(
  stages: StoredStage[],
  poolStageId?: number | null
): StoredStage | null {
  if (poolStageId !== undefined && poolStageId !== null) {
    const exactMatch = stages.find((stage) => toNumberId(stage.id) === poolStageId);
    if (exactMatch) return exactMatch;
  }
  const roundRobinStages = stages.filter((stage) => stage.type === 'round_robin');
  if (roundRobinStages.length === 0) return null;
  return roundRobinStages
    .slice()
    .sort((a, b) => (toNumberId(b.id) || 0) - (toNumberId(a.id) || 0))[0];
}

export function isCompletedMatch(match: StoredMatch, score?: StoredMatchScore): boolean {
  if (score?.status === 'completed' || score?.status === 'walkover') {
    return true;
  }
  return match.status === 4;
}

export function createSeedingFromParticipantIds(
  participantIds: (number | string)[]
): (number | string | null)[] {
  const bracketSize = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(participantIds.length, 2)))
  );
  const seeding: (number | string | null)[] = [...participantIds];
  while (seeding.length < bracketSize) {
    seeding.push(null);
  }
  return seeding;
}

export function createSeedingArrayWithExistingOrder(
  participantIds: (number | string)[],
  maxBracketSize?: number
): (number | string | null)[] {
  const bracketSize = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(participantIds.length, 2)))
  );
  const targetSize = maxBracketSize || bracketSize;
  const trimmed = participantIds.slice(0, targetSize);
  const seeding: (number | string | null)[] = [...trimmed];
  while (seeding.length < targetSize) {
    seeding.push(null);
  }
  return seeding;
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
  registrationIdByParticipantId: Map<string, string>
): string | undefined {
  const p1Id = match.opponent1?.id;
  const p2Id = match.opponent2?.id;

  if (p1Id === null || p1Id === undefined || p2Id === null || p2Id === undefined) {
    return undefined;
  }

  if (match.opponent1?.result === 'win') {
    return registrationIdByParticipantId.get(String(p1Id));
  }

  if (match.opponent2?.result === 'win') {
    return registrationIdByParticipantId.get(String(p2Id));
  }

  return undefined;
}

// ============================================
// Firestore operations (admin SDK)
// ============================================

export async function createStageWithStats(
  manager: BracketsManager,
  storage: FirestoreStorage,
  categoryId: string,
  stageName: string,
  stageType: 'single_elimination' | 'double_elimination' | 'round_robin',
  seedingIds: (number | string | null)[],
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
    seedingIds: seedingIds as any,
    settings: settings as any,
  });

  let stageId = toNumberId(stage?.id);
  if (stageId === null) {
    const stages = asArray(
      await storage.select<StoredStage>('stage', { tournament_id: categoryId })
    );
    const matchingStages = stages.filter(
      (s) => s.name === stageName && s.type === stageType
    );
    stageId = toNumberId(matchingStages[0]?.id) ?? (matchingStages[0]?.id as any);
  }

  if (stageId === null) {
    throw new Error(`Failed to resolve stage ID for "${stageName}"`);
  }

  const matches = asArray(
    await storage.select<StoredMatch>('match', { stage_id: stageId })
  );
  const groups = asArray(
    await storage.select<StoredGroup>('group', { stage_id: stageId })
  );
  const rounds = asArray(
    await storage.select<StoredRound>('round', { stage_id: stageId })
  );

  return {
    success: true,
    stageId,
    matchCount: matches.length,
    groupCount: groups.length,
    roundCount: rounds.length,
    participantCount: seedingIds.filter((id) => id !== null).length,
  };
}

export async function createStandardStage(
  category: Category,
  manager: BracketsManager,
  storage: FirestoreStorage,
  participantCount: number,
  options: BracketOptions
): Promise<BracketResult> {
  if (category.format === 'pool_to_elimination') {
    throw new Error('Pool-to-elimination categories must use pool stage generation.');
  }

  const stageType = category.format as 'single_elimination' | 'double_elimination' | 'round_robin';
  const roundRobin = stageType === 'round_robin';
  const seeding = roundRobin
    ? createSequentialSeeding(participantCount)
    : createSeedingArray(participantCount);

  if (roundRobin) {
    return createStageWithStats(manager, storage, category.id, category.name, 'round_robin', seeding, {
      seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),
      groupCount: options.groupCount || 1,
    });
  }

  return createStageWithStats(manager, storage, category.id, category.name, stageType, seeding, {
    seedOrdering: options.seedOrdering || ['inner_outer'],
    grandFinal: stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
    consolationFinal: options.consolationFinal,
  });
}

export async function createPoolStage(
  category: Category,
  manager: BracketsManager,
  storage: FirestoreStorage,
  participantCount: number,
  options: BracketOptions
): Promise<BracketResult> {
  const teamsPerPool = category.teamsPerPool ?? options.teamsPerPool ?? 4;
  const groupCount = calculatePoolGroupCount(participantCount, teamsPerPool);

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

export async function initializeByeWalkovers(
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  storage: FirestoreStorage,
  stageId: number | string,
  participants: StoredParticipant[]
): Promise<void> {
  const allMatches = asArray(
    await storage.select<StoredMatch>('match', { stage_id: stageId })
  );

  const byeMatches = allMatches.filter(
    (m) =>
      m.opponent1?.id === null ||
      m.opponent1?.id === undefined ||
      m.opponent2?.id === null ||
      m.opponent2?.id === undefined
  );

  if (byeMatches.length === 0) return;

  const regIdByParticipantId = new Map<string, string>(
    participants.map((p) => [String(p.id), p.name])
  );

  const batch = db.batch();

  for (const match of byeMatches) {
    const p1Id = match.opponent1?.id;
    const p2Id = match.opponent2?.id;
    const p1IsReal = p1Id !== null && p1Id !== undefined;
    const realParticipantId = p1IsReal ? String(p1Id) : p2Id !== null && p2Id !== undefined ? String(p2Id) : null;
    if (realParticipantId === null) continue;

    const winnerId = regIdByParticipantId.get(realParticipantId);
    if (!winnerId) continue;

    batch.set(
      db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .collection('match_scores')
        .doc(String(match.id)),
      {
        status: 'walkover',
        winnerId,
        scores: [],
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function initializeLevelMatchScores(
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  levelId: string,
  storage: FirestoreStorage,
  stageId: number | string,
  registrationIdByParticipantId: Map<string, string>
): Promise<void> {
  const levelMatches = asArray(
    await storage.select<StoredMatch>('match', { stage_id: stageId })
  );
  if (levelMatches.length === 0) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < levelMatches.length; i += CHUNK_SIZE) {
    const chunk = levelMatches.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    let ops = 0;

    for (const match of chunk) {
      const p1Id = match.opponent1?.id;
      const p2Id = match.opponent2?.id;
      if (p1Id === null || p1Id === undefined || p2Id === null || p2Id === undefined) continue;

      const status = convertBracketsStatus(match.status);
      const winnerId = resolveWinnerRegistrationId(match, registrationIdByParticipantId);
      const payload: Record<string, unknown> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (winnerId) payload.winnerId = winnerId;
      if (status === 'completed' || status === 'walkover') {
        payload.completedAt = FieldValue.serverTimestamp();
      }

      batch.set(
        db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('categories')
          .doc(categoryId)
          .collection('levels')
          .doc(levelId)
          .collection('match_scores')
          .doc(String(match.id)),
        payload,
        { merge: true }
      );
      ops += 1;
    }

    if (ops > 0) await batch.commit();
  }
}

export async function deleteMatchScoresByIds(
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  matchIds: string[]
): Promise<void> {
  if (matchIds.length === 0) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const chunk = matchIds.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const matchId of chunk) {
      batch.delete(
        db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('categories')
          .doc(categoryId)
          .collection('match_scores')
          .doc(matchId)
      );
    }

    await batch.commit();
  }
}

export async function clearBracketStorage(storage: FirestoreStorage): Promise<void> {
  await storage.delete('match');
  await storage.delete('match_game');
  await storage.delete('round');
  await storage.delete('group');
  await storage.delete('stage');
  await storage.delete('participant');
}
