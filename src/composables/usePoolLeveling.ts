import { computed, ref } from 'vue';
import {
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from '@/services/firebase';
import type {
  Category,
  LevelingMode,
  LevelGenerationConfig,
  Registration,
  Player,
} from '@/types';
import type { ResolvedMatch } from '@/types/leaderboard';
import { aggregateStats, sortWithBWFTiebreaker } from '@/composables/useLeaderboard';

interface StoredStage {
  id: number | string;
  type?: 'single_elimination' | 'double_elimination' | 'round_robin';
}

interface StoredParticipant {
  id: number;
  name: string; // registrationId
}

interface StoredRound {
  id: number | string;
  group_id?: number | string;
}

interface StoredGroup {
  id: number | string;
  number?: number;
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
  opponent1?: StoredOpponent | null;
  opponent2?: StoredOpponent | null;
  status: number;
}

interface StoredScore {
  id: string;
  status?: string;
  winnerId?: string;
  scores?: Array<{
    gameNumber?: number;
    score1: number;
    score2: number;
    winnerId?: string;
    isComplete?: boolean;
  }>;
}

export interface PoolSummary {
  id: string;
  label: string;
  participantCount: number;
}

export interface PoolMapping {
  poolId: string;
  rank1LevelId: string;
  rank2LevelId: string;
  rank3PlusLevelId: string;
}

export interface PoolLevelParticipant {
  registrationId: string;
  participantName: string;
  poolId: string;
  poolLabel: string;
  poolRank: number;
  globalRank: number;
  seed: number | null;
  matchesWon: number;
  matchPoints: number;
  winRate: number;
  pointDifference: number;
  pointsFor: number;
}

export interface PoolLevelPreview {
  pools: PoolSummary[];
  participants: PoolLevelParticipant[];
  recommendedMode: LevelingMode;
  recommendationReason: string;
  suggestedGlobalBands: number[];
  defaultPoolMappings: PoolMapping[];
  pendingMatches: number;
}

export interface PoolAssignmentResult {
  assignments: Map<string, string>;
  countsByLevelId: Record<string, number>;
}

interface PoolData {
  category: Category;
  registrations: Registration[];
  players: Player[];
  participants: StoredParticipant[];
  groups: StoredGroup[];
  rounds: StoredRound[];
  matches: StoredMatch[];
  scoresByMatchId: Map<string, StoredScore>;
}

function asArray<T>(value: T[] | null): T[] {
  return Array.isArray(value) ? value : [];
}

function toStringId(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export const DEFAULT_LEVEL_NAMES = ['Advanced', 'Intermediate', 'Beginner', 'Level 4', 'Level 5'];

export function getDefaultLevelNames(levelCount: number): string[] {
  return DEFAULT_LEVEL_NAMES.slice(0, levelCount);
}

function getSuggestedGlobalBands(total: number, levelCount: number): number[] {
  const base = Math.floor(total / levelCount);
  let remainder = total % levelCount;

  return Array.from({ length: levelCount }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}

function resolveParticipantName(registration: Registration, playersById: Map<string, Player>): string {
  if (registration.teamName) return registration.teamName;
  if (registration.playerId) {
    const player = playersById.get(registration.playerId);
    if (player) {
      return `${player.firstName} ${player.lastName}`;
    }
  }
  return 'Unknown';
}

async function fetchPoolData(tournamentId: string, categoryId: string): Promise<PoolData> {
  const categoryDoc = await getDoc(doc(db, 'tournaments', tournamentId, 'categories', categoryId));
  if (!categoryDoc.exists()) {
    throw new Error('Category not found');
  }

  const category = {
    ...(categoryDoc.data() as Omit<Category, 'id'>),
    id: categoryDoc.id,
  } as Category;

  const [registrationSnap, playerSnap, stageSnap, participantSnap, matchSnap, roundSnap, groupSnap, scoreSnap] =
    await Promise.all([
      getDocs(
        query(
          collection(db, 'tournaments', tournamentId, 'registrations'),
          where('categoryId', '==', categoryId),
          where('status', 'in', ['approved', 'checked_in'])
        )
      ),
      getDocs(collection(db, 'tournaments', tournamentId, 'players')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'stage')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'participant')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'round')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'group')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores')),
    ]);

  const stages = stageSnap.docs.map((docSnap) => ({
    ...(docSnap.data() as Omit<StoredStage, 'id'>),
    id: docSnap.id,
  })) as StoredStage[];

  const poolStage = category.poolStageId !== null && category.poolStageId !== undefined
    ? stages.find((stage) => Number(stage.id) === Number(category.poolStageId))
    : stages.find((stage) => stage.type === 'round_robin');

  if (!poolStage) {
    throw new Error('Pool stage not found. Generate pool stage first.');
  }

  const poolStageId = Number(poolStage.id);
  const matches = asArray(matchSnap.docs.map((docSnap) => ({
    ...(docSnap.data() as Omit<StoredMatch, 'id'>),
    id: docSnap.id,
  }) as StoredMatch)).filter((match) => Number(match.stage_id) === poolStageId);

  const rounds = asArray(roundSnap.docs.map((docSnap) => ({
    ...(docSnap.data() as Omit<StoredRound, 'id'>),
    id: docSnap.id,
  }) as StoredRound)).filter((round) => Number((round as { stage_id?: number | string }).stage_id ?? poolStageId) === poolStageId);

  const groups = asArray(groupSnap.docs.map((docSnap) => ({
    ...(docSnap.data() as Omit<StoredGroup, 'id'>),
    id: docSnap.id,
  }) as StoredGroup)).filter((group) => Number((group as { stage_id?: number | string }).stage_id ?? poolStageId) === poolStageId);

  return {
    category,
    registrations: registrationSnap.docs.map((docSnap) => ({
      ...(docSnap.data() as Omit<Registration, 'id'>),
      id: docSnap.id,
    })) as Registration[],
    players: playerSnap.docs.map((docSnap) => ({
      ...(docSnap.data() as Omit<Player, 'id'>),
      id: docSnap.id,
    })) as Player[],
    participants: participantSnap.docs.map((docSnap) => ({
      ...(docSnap.data() as Omit<StoredParticipant, 'id'>),
      id: Number((docSnap.data() as { id?: number | string }).id ?? docSnap.id),
    })) as StoredParticipant[],
    groups,
    rounds,
    matches,
    scoresByMatchId: new Map<string, StoredScore>(
      scoreSnap.docs.map((docSnap) => [
        docSnap.id,
        { ...(docSnap.data() as Omit<StoredScore, 'id'>), id: docSnap.id },
      ])
    ),
  };
}

function buildPoolSummaries(
  matches: StoredMatch[],
  rounds: StoredRound[],
  groups: StoredGroup[],
  participantById: Map<number, string>
): { pools: PoolSummary[]; participantPoolByRegistrationId: Map<string, string>; poolLabelById: Map<string, string> } {
  const roundGroupByRoundId = new Map<string, string>();
  for (const round of rounds) {
    const groupId = toStringId(round.group_id);
    if (groupId) {
      roundGroupByRoundId.set(String(round.id), groupId);
    }
  }

  const poolLabelById = new Map<string, string>();
  groups
    .slice()
    .sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0))
    .forEach((group, index) => {
      const id = String(group.id);
      const label = group.number ? `Pool ${group.number}` : `Pool ${index + 1}`;
      poolLabelById.set(id, label);
    });

  const participantPoolByRegistrationId = new Map<string, string>();
  for (const match of matches) {
    const groupId =
      toStringId(match.group_id) ??
      roundGroupByRoundId.get(String(match.round_id ?? '')) ??
      'pool-default';

    const p1Id = match.opponent1?.id !== null && match.opponent1?.id !== undefined ? Number(match.opponent1.id) : null;
    const p2Id = match.opponent2?.id !== null && match.opponent2?.id !== undefined ? Number(match.opponent2.id) : null;

    if (p1Id !== null && participantById.has(p1Id)) {
      participantPoolByRegistrationId.set(participantById.get(p1Id) as string, groupId);
    }
    if (p2Id !== null && participantById.has(p2Id)) {
      participantPoolByRegistrationId.set(participantById.get(p2Id) as string, groupId);
    }
  }

  const countByPoolId = new Map<string, number>();
  for (const poolId of participantPoolByRegistrationId.values()) {
    countByPoolId.set(poolId, (countByPoolId.get(poolId) || 0) + 1);
  }

  const pools: PoolSummary[] = [...countByPoolId.entries()]
    .map(([id, participantCount], index) => ({
      id,
      label: poolLabelById.get(id) || `Pool ${index + 1}`,
      participantCount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { pools, participantPoolByRegistrationId, poolLabelById };
}

function isCompletedPoolMatch(match: StoredMatch, score: StoredScore | undefined): boolean {
  const hasParticipants =
    match.opponent1?.id !== null &&
    match.opponent1?.id !== undefined &&
    match.opponent2?.id !== null &&
    match.opponent2?.id !== undefined;

  if (!hasParticipants) return true;
  if (score?.status === 'completed' || score?.status === 'walkover') return true;
  return match.status === 4;
}

function buildResolvedPoolMatches(
  categoryId: string,
  matches: StoredMatch[],
  scoresByMatchId: Map<string, StoredScore>,
  participantById: Map<number, string>
): { matches: ResolvedMatch[]; pendingMatches: number } {
  const resolved: ResolvedMatch[] = [];
  let pendingMatches = 0;

  for (const match of matches) {
    const score = scoresByMatchId.get(String(match.id));
    const completed = isCompletedPoolMatch(match, score);

    const p1ParticipantId =
      match.opponent1?.id !== null && match.opponent1?.id !== undefined
        ? Number(match.opponent1.id)
        : null;
    const p2ParticipantId =
      match.opponent2?.id !== null && match.opponent2?.id !== undefined
        ? Number(match.opponent2.id)
        : null;

    if (p1ParticipantId === null || p2ParticipantId === null) continue;

    if (!completed) {
      pendingMatches += 1;
      continue;
    }

    const p1RegistrationId = participantById.get(p1ParticipantId);
    const p2RegistrationId = participantById.get(p2ParticipantId);
    if (!p1RegistrationId || !p2RegistrationId) continue;

    const winnerId =
      score?.winnerId ||
      (match.opponent1?.result === 'win'
        ? p1RegistrationId
        : match.opponent2?.result === 'win'
          ? p2RegistrationId
          : undefined);

    if (!winnerId) continue;

    resolved.push({
      id: String(match.id),
      categoryId,
      participant1Id: p1RegistrationId,
      participant2Id: p2RegistrationId,
      winnerId,
      scores: (score?.scores || []).map((game, index) => ({
        gameNumber: game.gameNumber || index + 1,
        score1: game.score1,
        score2: game.score2,
        winnerId: game.winnerId,
        isComplete: game.isComplete ?? true,
      })),
      round: 0,
      bracket: 'winners',
      completedAt: undefined,
    });
  }

  return { matches: resolved, pendingMatches };
}

function rankPools(
  category: Category,
  registrations: Registration[],
  players: Player[],
  pools: PoolSummary[],
  participantPoolByRegistrationId: Map<string, string>,
  resolvedPoolMatches: ResolvedMatch[],
  poolLabelById: Map<string, string>
): PoolLevelParticipant[] {
  const categoryMap = new Map<string, Category>([[category.id, category]]);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const participants: PoolLevelParticipant[] = [];

  for (const pool of pools) {
    const registrationIds = registrations
      .map((registration) => registration.id)
      .filter((registrationId) => participantPoolByRegistrationId.get(registrationId) === pool.id);

    const poolRegistrations = registrations.filter((registration) => registrationIds.includes(registration.id));
    const poolMatches = resolvedPoolMatches.filter(
      (match) =>
        registrationIds.includes(match.participant1Id) &&
        registrationIds.includes(match.participant2Id)
    );

    const stats = aggregateStats(poolRegistrations, poolMatches, categoryMap, players);
    const entries = Array.from(stats.values());
    const sorted = sortWithBWFTiebreaker(entries, poolMatches).sorted;

    sorted.forEach((entry, index) => {
      const registration = poolRegistrations.find((item) => item.id === entry.registrationId);
      participants.push({
        registrationId: entry.registrationId,
        participantName: registration ? resolveParticipantName(registration, playersById) : entry.participantName,
        poolId: pool.id,
        poolLabel: poolLabelById.get(pool.id) || pool.label,
        poolRank: index + 1,
        globalRank: 0,
        seed: registration?.seed ?? null,
        matchesWon: entry.matchesWon,
        matchPoints: entry.matchPoints,
        winRate: entry.winRate,
        pointDifference: entry.pointDifference,
        pointsFor: entry.pointsFor,
      });
    });
  }

  const globallySorted = participants
    .slice()
    .sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.participantName.localeCompare(b.participantName);
    });

  globallySorted.forEach((participant, index) => {
    participant.globalRank = index + 1;
  });

  return participants.sort((a, b) => a.globalRank - b.globalRank);
}

function recommendMode(pools: PoolSummary[]): { mode: LevelingMode; reason: string } {
  if (pools.length === 0) {
    return {
      mode: 'global_bands',
      reason: 'No pools found. Global bands is recommended.',
    };
  }

  const sizes = pools.map((pool) => pool.participantCount);
  const maxSize = Math.max(...sizes);
  const minSize = Math.min(...sizes);
  const balanced = maxSize - minSize <= 1;

  if (balanced) {
    return {
      mode: 'pool_position',
      reason: 'Pools are balanced. Pool-position assignment is recommended.',
    };
  }

  return {
    mode: 'global_bands',
    reason: 'Pools are uneven. Global bands should produce fairer levels.',
  };
}

export function buildDefaultPoolMappings(pools: PoolSummary[], levelIds: string[]): PoolMapping[] {
  const rank1LevelId = levelIds[0];
  const rank2LevelId = levelIds[Math.min(1, levelIds.length - 1)];
  const rank3PlusLevelId = levelIds[Math.min(2, levelIds.length - 1)];

  return pools.map((pool) => ({
    poolId: pool.id,
    rank1LevelId,
    rank2LevelId,
    rank3PlusLevelId,
  }));
}

export function assignByPoolPosition(
  participants: PoolLevelParticipant[],
  poolMappings: PoolMapping[]
): PoolAssignmentResult {
  const mappingByPool = new Map(poolMappings.map((mapping) => [mapping.poolId, mapping]));
  const assignments = new Map<string, string>();
  const countsByLevelId: Record<string, number> = {};

  for (const participant of participants) {
    const mapping = mappingByPool.get(participant.poolId);
    if (!mapping) continue;

    let levelId = mapping.rank3PlusLevelId;
    if (participant.poolRank === 1) {
      levelId = mapping.rank1LevelId;
    } else if (participant.poolRank === 2) {
      levelId = mapping.rank2LevelId;
    }

    assignments.set(participant.registrationId, levelId);
    countsByLevelId[levelId] = (countsByLevelId[levelId] || 0) + 1;
  }

  return { assignments, countsByLevelId };
}

export function assignByGlobalBands(
  participants: PoolLevelParticipant[],
  globalBands: number[],
  levelIds: string[]
): PoolAssignmentResult {
  const sorted = participants.slice().sort((a, b) => a.globalRank - b.globalRank);
  const assignments = new Map<string, string>();
  const countsByLevelId: Record<string, number> = {};

  let cursor = 0;
  for (let i = 0; i < levelIds.length; i++) {
    const levelId = levelIds[i];
    const slots = globalBands[i] || 0;

    for (let j = 0; j < slots && cursor < sorted.length; j++) {
      const participant = sorted[cursor++];
      assignments.set(participant.registrationId, levelId);
      countsByLevelId[levelId] = (countsByLevelId[levelId] || 0) + 1;
    }
  }

  while (cursor < sorted.length) {
    const fallbackLevel = levelIds[levelIds.length - 1];
    const participant = sorted[cursor++];
    assignments.set(participant.registrationId, fallbackLevel);
    countsByLevelId[fallbackLevel] = (countsByLevelId[fallbackLevel] || 0) + 1;
  }

  return { assignments, countsByLevelId };
}

export function usePoolLeveling() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const preview = ref<PoolLevelPreview | null>(null);

  const hasPendingPoolMatches = computed(() => (preview.value?.pendingMatches || 0) > 0);

  async function generatePreview(
    tournamentId: string,
    categoryId: string,
    levelCount: number
  ): Promise<PoolLevelPreview> {
    loading.value = true;
    error.value = null;

    try {
      const safeLevelCount = Math.min(5, Math.max(2, Math.floor(levelCount)));
      const poolData = await fetchPoolData(tournamentId, categoryId);

      const participantById = new Map<number, string>(
        poolData.participants.map((participant) => [participant.id, participant.name])
      );
      const { pools, participantPoolByRegistrationId, poolLabelById } = buildPoolSummaries(
        poolData.matches,
        poolData.rounds,
        poolData.groups,
        participantById
      );

      const { matches: resolvedMatches, pendingMatches } = buildResolvedPoolMatches(
        poolData.category.id,
        poolData.matches,
        poolData.scoresByMatchId,
        participantById
      );

      const rankedParticipants = rankPools(
        poolData.category,
        poolData.registrations,
        poolData.players,
        pools,
        participantPoolByRegistrationId,
        resolvedMatches,
        poolLabelById
      );

      const recommendation = recommendMode(pools);
      const suggestedGlobalBands = getSuggestedGlobalBands(rankedParticipants.length, safeLevelCount);
      const levelNames = getDefaultLevelNames(safeLevelCount);
      const levelIds = levelNames.map((_, index) => `level-${index + 1}`);
      const defaultPoolMappings = buildDefaultPoolMappings(pools, levelIds);

      const nextPreview: PoolLevelPreview = {
        pools,
        participants: rankedParticipants,
        recommendedMode: recommendation.mode,
        recommendationReason: recommendation.reason,
        suggestedGlobalBands,
        defaultPoolMappings,
        pendingMatches,
      };

      preview.value = nextPreview;
      return nextPreview;
    } catch (err) {
      console.error('Error generating pool-level preview:', err);
      error.value = err instanceof Error ? err.message : 'Failed to build level preview';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function buildDefaultConfig(
    levelCount: number,
    recommendedMode: LevelingMode
  ): Pick<LevelGenerationConfig, 'mode' | 'levelCount' | 'levelNames' | 'recommendedMode'> {
    const safeLevelCount = Math.min(5, Math.max(2, Math.floor(levelCount)));
    return {
      mode: recommendedMode,
      levelCount: safeLevelCount,
      levelNames: getDefaultLevelNames(safeLevelCount),
      recommendedMode,
    };
  }

  return {
    loading,
    error,
    preview,
    hasPendingPoolMatches,
    generatePreview,
    buildDefaultConfig,
  };
}
