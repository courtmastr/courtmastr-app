// Match Store - Pinia store for match and scoring management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  httpsCallable,
  functions,
  increment,
} from '@/services/firebase';
import type { Match, GameScore, Registration, ScoringConfig } from '@/types';
import { BADMINTON_CONFIG } from '@/types';
import {
  getGamesNeeded,
  resolveScoringConfig,
  validateCompletedGameScore,
  type CategoryScoringSource,
} from '@/features/scoring/utils/validation';
import {
  adaptBracketsMatchToLegacyMatch,
  buildMatchStructureMaps,
  type BracketsMatch,
  type Participant,
} from './bracketMatchAdapter';
import { useAdvanceWinner } from '@/composables/useAdvanceWinner';
import { useAuthStore } from '@/stores/auth';
import { useAuditStore } from '@/stores/audit';
import {
  saveManualPlannedTime as saveManualPlannedTimeOp,
  publishMatchSchedule as publishMatchScheduleOp,
} from '@/scheduling/useScheduleStore';
import type { ScoreCorrectionRecord } from '@/types/scoring';

const USE_CLOUD_FUNCTION_FOR_ADVANCE_WINNER = false;

// --- Shared helpers (pure, no store dependency) ---

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  return undefined;
}

function countWins(
  games: GameScore[],
  participant1Id: string,
  participant2Id: string
): { p1Wins: number; p2Wins: number } {
  let p1Wins = 0;
  let p2Wins = 0;
  for (const game of games) {
    if (!game.isComplete) continue;
    if (game.winnerId === participant1Id) p1Wins++;
    else if (game.winnerId === participant2Id) p2Wins++;
  }
  return { p1Wins, p2Wins };
}

function determineWinner(
  games: GameScore[],
  participant1Id: string,
  participant2Id: string,
  config: ScoringConfig
): { isComplete: boolean; winnerId?: string } {
  const gamesNeeded = getGamesNeeded(config);
  const { p1Wins, p2Wins } = countWins(games, participant1Id, participant2Id);

  if (p1Wins >= gamesNeeded) return { isComplete: true, winnerId: participant1Id };
  if (p2Wins >= gamesNeeded) return { isComplete: true, winnerId: participant2Id };
  return { isComplete: false };
}

export interface AssignmentGateInput {
  plannedStartAt?: Date;
  scheduleStatus?: string;
  publishedAt?: Date;
  participant1Id?: string;
  participant2Id?: string;
  participantsCheckedIn?: boolean;
}

export interface AssignmentGateOptions {
  ignoreCheckInGate?: boolean;
}

export function evaluateAssignmentBlockers(
  input: AssignmentGateInput,
  options: AssignmentGateOptions = {}
): string[] {
  const blockers: string[] = [];

  if (!input.plannedStartAt) {
    blockers.push('Blocked: Not scheduled');
  }

  const isPublished = input.scheduleStatus === 'published' || Boolean(input.publishedAt);
  if (!isPublished) {
    blockers.push('Blocked: Not published');
  }

  if (!input.participant1Id || !input.participant2Id) {
    blockers.push('Blocked: Players not checked-in');
    return blockers;
  }

  if (options.ignoreCheckInGate !== true && input.participantsCheckedIn === false) {
    blockers.push('Blocked: Players not checked-in');
  }

  return blockers;
}

export const useMatchStore = defineStore('matches', () => {
  const matches = ref<Match[]>([]);
  const currentMatch = ref<Match | null>(null);
  const correctionHistory = ref<ScoreCorrectionRecord[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let matchesUnsubscribe: (() => void) | null = null;
  let currentMatchUnsubscribe: (() => void) | null = null;

  // --- Path helpers ---

  function getBracketBasePath(tournamentId: string, categoryId?: string, levelId?: string): string {
    if (categoryId && levelId) {
      return `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`;
    }
    if (categoryId) {
      return `tournaments/${tournamentId}/categories/${categoryId}`;
    }
    return `tournaments/${tournamentId}`;
  }

  function getMatchScoresPath(tournamentId: string, categoryId?: string, levelId?: string): string {
    return `${getBracketBasePath(tournamentId, categoryId, levelId)}/match_scores`;
  }

  function getMatchPath(tournamentId: string, categoryId?: string, levelId?: string): string {
    return `${getBracketBasePath(tournamentId, categoryId, levelId)}/match`;
  }

  function courtsPath(tournamentId: string): string {
    return `tournaments/${tournamentId}/courts`;
  }

  // --- Interfaces ---

  type AssignCourtOptions = AssignmentGateOptions;

  interface UnscheduleOptions {
    clearInProgressState?: boolean;
    returnStatus?: 'scheduled' | 'ready';
  }

  interface AssignmentValidationData {
    participant1Id?: string;
    participant2Id?: string;
    plannedStartAt?: Date;
    scheduleStatus?: string;
    publishedAt?: Date;
  }

  // --- Shared Firestore operations ---

  function releaseCourtUpdate(tournamentId: string, courtId: string): { ref: ReturnType<typeof doc>; data: Record<string, unknown> } {
    return {
      ref: doc(db, courtsPath(tournamentId), courtId),
      data: {
        status: 'available',
        currentMatchId: null,
        assignedMatchId: null,
        lastFreedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    };
  }

  async function releaseCourt(tournamentId: string, courtId: string): Promise<void> {
    const { ref: courtRef, data } = releaseCourtUpdate(tournamentId, courtId);
    await updateDoc(courtRef, data);
  }

  async function advanceBracket(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    scores: GameScore[],
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    if (USE_CLOUD_FUNCTION_FOR_ADVANCE_WINNER) {
      const updateMatchFn = httpsCallable(functions, 'updateMatch');
      await updateMatchFn({ tournamentId, categoryId, matchId, status: 'completed', winnerId, scores });
    } else {
      if (!categoryId) {
        throw new Error('categoryId is required to advance winner');
      }
      const advancer = useAdvanceWinner();
      await advancer.advanceWinner(tournamentId, categoryId, matchId, winnerId, levelId);
    }
  }

  /**
   * Resolve the courtId for a match, checking multiple sources.
   * Falls back through: match_scores doc -> currentMatch -> matches array -> courts query.
   */
  async function resolveCourtId(
    tournamentId: string,
    matchId: string,
    docCourtId?: string
  ): Promise<string | undefined> {
    if (docCourtId) return docCourtId;

    // In-memory: currentMatch
    const inMemory = currentMatch.value;
    if (inMemory?.id === matchId && inMemory?.courtId) {
      console.log('[resolveCourtId] Using fallback from currentMatch:', inMemory.courtId);
      return inMemory.courtId;
    }

    // In-memory: matches array
    const arrayMatch = matches.value.find(m => m.id === matchId);
    if (arrayMatch?.courtId) {
      console.log('[resolveCourtId] Using fallback from matches array:', arrayMatch.courtId);
      return arrayMatch.courtId;
    }

    // Firestore query: find court by currentMatchId (handles "zombie" courts)
    console.log('[resolveCourtId] Searching courts for currentMatchId:', matchId);
    const q = query(
      collection(db, courtsPath(tournamentId)),
      where('currentMatchId', '==', matchId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const courtId = snapshot.docs[0].id;
      console.log('[resolveCourtId] Found court via query:', courtId);
      return courtId;
    }

    console.warn('[resolveCourtId] No courtId found anywhere for match', matchId);
    return undefined;
  }

  // --- Scoring config resolution ---

  async function getScoringConfigForMatch(
    tournamentId: string,
    categoryId?: string
  ): Promise<ScoringConfig> {
    try {
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentDoc.exists()) return BADMINTON_CONFIG;

      const tournamentSettings = tournamentDoc.data()?.settings as Partial<ScoringConfig> | undefined;
      let categoryData: CategoryScoringSource | undefined;

      if (categoryId) {
        const categoryDoc = await getDoc(doc(db, `tournaments/${tournamentId}/categories`, categoryId));
        if (categoryDoc.exists()) {
          categoryData = categoryDoc.data() as CategoryScoringSource;
        }
      }

      return resolveScoringConfig(
        { settings: tournamentSettings ?? BADMINTON_CONFIG },
        categoryData
      );
    } catch (err) {
      console.error('Error resolving scoring config:', err);
      return BADMINTON_CONFIG;
    }
  }

  // --- Assignment validation ---

  async function resolveAssignmentValidationData(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<AssignmentValidationData> {
    const inMemoryMatch = matches.value.find(
      (match) =>
        match.id === matchId &&
        (categoryId ? match.categoryId === categoryId : true) &&
        ((levelId ?? null) === (match.levelId ?? null))
    );

    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const [scoreSnap, matchSnap] = await Promise.all([
      getDoc(doc(db, matchScoresPath, matchId)),
      getDoc(doc(db, getMatchPath(tournamentId, categoryId, levelId), matchId)),
    ]);

    const scoreData = scoreSnap.exists() ? scoreSnap.data() : undefined;
    const bracketData = matchSnap.exists() ? matchSnap.data() : undefined;

    return {
      participant1Id:
        (scoreData?.participant1Id as string | undefined) ??
        (bracketData?.participant1Id as string | undefined) ??
        inMemoryMatch?.participant1Id,
      participant2Id:
        (scoreData?.participant2Id as string | undefined) ??
        (bracketData?.participant2Id as string | undefined) ??
        inMemoryMatch?.participant2Id,
      plannedStartAt:
        toDate(scoreData?.plannedStartAt) ??
        toDate(scoreData?.scheduledTime) ??
        inMemoryMatch?.plannedStartAt ??
        inMemoryMatch?.scheduledTime,
      scheduleStatus:
        (scoreData?.scheduleStatus as string | undefined) ??
        inMemoryMatch?.scheduleStatus,
      publishedAt:
        toDate(scoreData?.publishedAt) ??
        inMemoryMatch?.publishedAt,
    };
  }

  async function getAssignmentBlockers(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string,
    options: AssignCourtOptions = {}
  ): Promise<string[]> {
    const matchData = await resolveAssignmentValidationData(tournamentId, matchId, categoryId, levelId);
    const participantIds = [matchData.participant1Id, matchData.participant2Id].filter(Boolean) as string[];

    if (participantIds.length < 2) {
      return evaluateAssignmentBlockers(matchData, options);
    }

    let participantsCheckedIn: boolean | undefined;
    if (!options.ignoreCheckInGate) {
      const registrationChecks = await Promise.all(
        participantIds.map((registrationId) =>
          getDoc(doc(db, `tournaments/${tournamentId}/registrations`, registrationId))
        )
      );
      participantsCheckedIn = registrationChecks.every((registrationDoc) => {
        if (!registrationDoc.exists()) return false;
        const data = registrationDoc.data();
        return data?.status === 'checked_in' || data?.isCheckedIn === true;
      });
    }

    return evaluateAssignmentBlockers(
      {
        ...matchData,
        participantsCheckedIn,
      },
      options
    );
  }

  // --- Computed properties ---

  const scheduledMatches = computed(() =>
    matches.value.filter((m) => m.status === 'scheduled')
  );

  const readyMatches = computed(() =>
    matches.value.filter((m) => m.status === 'ready')
  );

  const inProgressMatches = computed(() =>
    matches.value.filter((m) => m.status === 'in_progress')
  );

  const completedMatches = computed(() =>
    matches.value.filter((m) => m.status === 'completed')
  );

  const matchesByCategory = computed(() => {
    const grouped: Record<string, Match[]> = {};
    for (const match of matches.value) {
      (grouped[match.categoryId] ??= []).push(match);
    }
    return grouped;
  });

  const matchesByRound = computed(() => {
    const grouped: Record<number, Match[]> = {};
    for (const match of matches.value) {
      (grouped[match.round] ??= []).push(match);
    }
    return grouped;
  });

  // --- Score overlay: apply match_scores data onto an adapted match ---

  function applyScoreOverlay(adapted: Match, scoreData: Record<string, unknown>, bMatch: BracketsMatch): void {
    // Status -- ignore stale match_scores status when bracket says completed
    if (scoreData.status) {
      const bracketCompleted = bMatch.status === 4;
      const isStale = bracketCompleted && scoreData.status !== 'completed' && scoreData.status !== 'walkover';
      if (!isStale) {
        adapted.status = scoreData.status as Match['status'];
      }
    }

    if (scoreData.scores) adapted.scores = scoreData.scores as GameScore[];

    // Winner
    if (scoreData.winnerId) {
      adapted.winnerId = scoreData.winnerId as string;
    } else if (scoreData.status === 'completed' && Array.isArray(scoreData.scores) && scoreData.scores.length > 0) {
      const lastGame = scoreData.scores[scoreData.scores.length - 1];
      if (lastGame.isComplete && lastGame.winnerId) {
        adapted.winnerId = lastGame.winnerId;
      }
    }

    // Direct fields
    if (scoreData.courtId) adapted.courtId = scoreData.courtId as string;

    // Date fields
    adapted.scheduledTime = toDate(scoreData.scheduledTime) ?? adapted.scheduledTime;
    adapted.startedAt = toDate(scoreData.startedAt) ?? adapted.startedAt;
    adapted.completedAt = toDate(scoreData.completedAt) ?? adapted.completedAt;

    // Time-first scheduling fields
    if (scoreData.plannedStartAt) {
      adapted.plannedStartAt = toDate(scoreData.plannedStartAt);
    } else if (scoreData.scheduledTime && !adapted.plannedStartAt) {
      // Backward-compat shim: treat existing scheduledTime as plannedStartAt for display
      adapted.plannedStartAt = toDate(scoreData.scheduledTime);
    }
    adapted.plannedEndAt = toDate(scoreData.plannedEndAt) ?? adapted.plannedEndAt;
    adapted.publishedAt = toDate(scoreData.publishedAt) ?? adapted.publishedAt;

    if (scoreData.scheduleVersion !== undefined) adapted.scheduleVersion = scoreData.scheduleVersion as number;
    if (scoreData.scheduleStatus) adapted.scheduleStatus = scoreData.scheduleStatus as Match['scheduleStatus'];
    if (scoreData.lockedTime !== undefined) adapted.lockedTime = scoreData.lockedTime as boolean;
    if (scoreData.publishedBy) adapted.publishedBy = scoreData.publishedBy as string;
  }

  // --- Fetch matches ---

  async function resolveTargetScopes(
    tournamentId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<Array<{ categoryId: string; levelId?: string }>> {
    if (categoryId) {
      if (levelId) return [{ categoryId, levelId }];

      // If category has levels, treat level scopes as authoritative
      const levelsSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`)
      );
      const levelScopes = levelsSnap.docs.map((levelDoc) => ({
        categoryId,
        levelId: levelDoc.id,
      }));
      return levelScopes.length > 0 ? levelScopes : [{ categoryId }];
    }

    // No category specified: fetch ALL categories and level scopes
    const catSnap = await getDocs(collection(db, `tournaments/${tournamentId}/categories`));
    const categoryIds = catSnap.docs.map((d) => d.id);
    const levelSnapshots = await Promise.all(
      categoryIds.map((cid) =>
        getDocs(collection(db, `tournaments/${tournamentId}/categories/${cid}/levels`))
      )
    );
    return categoryIds.flatMap((cid, index) => {
      const levelScopes = levelSnapshots[index].docs.map((levelDoc) => ({
        categoryId: cid,
        levelId: levelDoc.id,
      }));
      return levelScopes.length > 0 ? levelScopes : [{ categoryId: cid }];
    });
  }

  async function fetchMatches(
    tournamentId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (levelId && !categoryId) {
        throw new Error('categoryId is required when levelId is provided');
      }

      const targetScopes = await resolveTargetScopes(tournamentId, categoryId, levelId);

      if (targetScopes.length === 0) {
        console.warn('[fetchMatches] No categories found for tournament.');
        matches.value = [];
        return;
      }

      console.log(`[fetchMatches] Fetching matches for ${targetScopes.length} scope(s):`, targetScopes);

      // Fetch global registrations (once)
      const registrationSnap = await getDocs(collection(db, `tournaments/${tournamentId}/registrations`));
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];

      // Fetch category-specific data in parallel
      const allAdaptedMatches: Match[] = [];

      await Promise.all(targetScopes.map(async (scope) => {
        const basePath = getBracketBasePath(tournamentId, scope.categoryId, scope.levelId);

        const [matchSnap, matchScoresSnap, participantSnap, roundSnap, groupSnap] = await Promise.all([
          getDocs(collection(db, `${basePath}/match`)),
          getDocs(collection(db, `${basePath}/match_scores`)),
          getDocs(collection(db, `${basePath}/participant`)),
          getDocs(collection(db, `${basePath}/round`)),
          getDocs(collection(db, `${basePath}/group`)),
        ]);

        const bracketsMatches = matchSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsMatch[];
        const matchScoresMap = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));
        const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];
        const rounds = roundSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const structureMaps = buildMatchStructureMaps(rounds, groups);

        for (const bMatch of bracketsMatches) {
          const adapted = adaptBracketsMatchToLegacyMatch(
            bMatch, registrations, participants, scope.categoryId, tournamentId, structureMaps
          );
          if (!adapted) continue;

          adapted.levelId = scope.levelId;
          const scoreData = matchScoresMap.get(adapted.id);
          if (scoreData) {
            applyScoreOverlay(adapted, scoreData, bMatch);
          }
          allAdaptedMatches.push(adapted);
        }
      }));

      // Sort and update state
      allAdaptedMatches.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });

      if (categoryId) {
        const otherMatches = matches.value.filter((match) => {
          if (match.categoryId !== categoryId) return true;
          // When fetching a single level scope, keep other scopes from same category
          if (levelId) return (match.levelId ?? null) !== levelId;
          // When fetching category without levelId, replace entire category snapshot
          return false;
        });

        const createKey = (m: Match) => `${m.categoryId}-${m.levelId || 'base'}-${m.id}`;
        const seenKeys = new Set<string>();
        const uniqueAdapted = allAdaptedMatches.filter(m => {
          const key = createKey(m);
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
        matches.value = [...otherMatches, ...uniqueAdapted];
      } else {
        matches.value = allAdaptedMatches;
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      error.value = 'Failed to load matches';
    } finally {
      loading.value = false;
    }
  }

  // --- Subscriptions ---

  function subscribeMatches(tournamentId: string, categoryId?: string, levelId?: string): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }

    const refresh = () => fetchMatches(tournamentId, categoryId, levelId);
    const matchPath = getMatchPath(tournamentId, categoryId, levelId);
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    const unsubMatch = onSnapshot(collection(db, matchPath), () => refresh());
    const unsubScores = onSnapshot(collection(db, matchScoresPath), () => refresh());

    matchesUnsubscribe = () => {
      unsubMatch();
      unsubScores();
    };
  }

  /**
   * Subscribe to matches across ALL categories in a tournament.
   *
   * Automatically watches the categories collection for additions/removals,
   * subscribes to each category's /match and /match_scores collections,
   * and aggregates matches from all categories into the matches array.
   *
   * Performance: Creates 2N+1 Firestore listeners (N = number of categories)
   */
  function subscribeAllMatches(tournamentId: string): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }
    matches.value = [];

    const categorySubscriptions = new Map<string, { match: () => void; scores: () => void }>();
    const levelCollectionSubscriptions = new Map<string, () => void>();
    const levelSubscriptions = new Map<string, { match: () => void; scores: () => void }>();
    let categoriesUnsubscribe: (() => void) | null = null;

    const debouncedFetches = new Map<string, ReturnType<typeof setTimeout>>();

    const getScopeKey = (catId: string, lvlId?: string) => `${catId}:${lvlId || 'base'}`;

    const debouncedFetch = (catId: string, lvlId?: string) => {
      const scopeKey = getScopeKey(catId, lvlId);
      const existing = debouncedFetches.get(scopeKey);
      if (existing) clearTimeout(existing);
      debouncedFetches.set(scopeKey, setTimeout(() => {
        fetchMatches(tournamentId, catId, lvlId);
        debouncedFetches.delete(scopeKey);
      }, 300));
    };

    const subscribeToScope = (
      catId: string,
      lvlId: string | undefined,
      subscriptionMap: Map<string, { match: () => void; scores: () => void }>
    ) => {
      const key = lvlId ? getScopeKey(catId, lvlId) : catId;
      if (subscriptionMap.has(key)) return;

      const matchPath = getMatchPath(tournamentId, catId, lvlId);
      const scoresPath = getMatchScoresPath(tournamentId, catId, lvlId);

      const unsubMatch = onSnapshot(collection(db, matchPath), () => debouncedFetch(catId, lvlId));
      const unsubScores = onSnapshot(collection(db, scoresPath), () => debouncedFetch(catId, lvlId));

      subscriptionMap.set(key, { match: unsubMatch, scores: unsubScores });
    };

    const unsubscribeScope = (
      key: string,
      subscriptionMap: Map<string, { match: () => void; scores: () => void }>
    ) => {
      const subs = subscriptionMap.get(key);
      if (!subs) return;
      subs.match();
      subs.scores();
      subscriptionMap.delete(key);
    };

    const unsubscribeLevel = (catId: string, lvlId: string) => {
      unsubscribeScope(getScopeKey(catId, lvlId), levelSubscriptions);
      matches.value = matches.value.filter(
        (match) => !(match.categoryId === catId && match.levelId === lvlId)
      );
    };

    const subscribeToCategoryLevels = (catId: string) => {
      if (levelCollectionSubscriptions.has(catId)) return;

      const unsubLevels = onSnapshot(
        collection(db, `tournaments/${tournamentId}/categories/${catId}/levels`),
        (snapshot) => {
          const currentLevelIds = new Set(snapshot.docs.map(d => d.id));

          for (const lvlId of currentLevelIds) {
            if (!levelSubscriptions.has(getScopeKey(catId, lvlId))) {
              subscribeToScope(catId, lvlId, levelSubscriptions);
            }
          }

          for (const levelKey of Array.from(levelSubscriptions.keys())) {
            const [levelCatId, lvlId] = levelKey.split(':');
            if (levelCatId === catId && lvlId !== 'base' && !currentLevelIds.has(lvlId)) {
              unsubscribeLevel(catId, lvlId);
            }
          }
        },
        (err) => {
          console.error(`Error in levels subscription for category ${catId}:`, err);
        }
      );

      levelCollectionSubscriptions.set(catId, unsubLevels);
    };

    const unsubscribeFromCategory = (catId: string) => {
      unsubscribeScope(catId, categorySubscriptions);

      const levelsUnsub = levelCollectionSubscriptions.get(catId);
      if (levelsUnsub) {
        levelsUnsub();
        levelCollectionSubscriptions.delete(catId);
      }

      for (const levelKey of Array.from(levelSubscriptions.keys())) {
        const [levelCatId, lvlId] = levelKey.split(':');
        if (levelCatId === catId && lvlId !== 'base') {
          unsubscribeLevel(catId, lvlId);
        }
      }
    };

    categoriesUnsubscribe = onSnapshot(
      collection(db, `tournaments/${tournamentId}/categories`),
      (snapshot) => {
        const currentCategoryIds = new Set(snapshot.docs.map(d => d.id));

        for (const catId of currentCategoryIds) {
          if (!categorySubscriptions.has(catId)) {
            subscribeToScope(catId, undefined, categorySubscriptions);
            subscribeToCategoryLevels(catId);
          }
        }

        for (const [catId] of categorySubscriptions) {
          if (!currentCategoryIds.has(catId)) {
            unsubscribeFromCategory(catId);
            matches.value = matches.value.filter(m => m.categoryId !== catId);
          }
        }
      },
      (err) => {
        console.error('Error in categories subscription:', err);
        error.value = 'Lost connection to tournament data';
      }
    );

    matchesUnsubscribe = () => {
      categoriesUnsubscribe?.();
      for (const subs of categorySubscriptions.values()) { subs.match(); subs.scores(); }
      categorySubscriptions.clear();
      for (const unsub of levelCollectionSubscriptions.values()) unsub();
      levelCollectionSubscriptions.clear();
      for (const subs of levelSubscriptions.values()) { subs.match(); subs.scores(); }
      levelSubscriptions.clear();
      for (const timeout of debouncedFetches.values()) clearTimeout(timeout);
      debouncedFetches.clear();
    };
  }

  // --- Fetch single match ---

  async function fetchMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchPath = getMatchPath(tournamentId, categoryId, levelId);
      const matchDoc = await getDoc(doc(db, matchPath, matchId));
      if (!matchDoc.exists()) throw new Error('Match not found');

      const bMatch = { ...matchDoc.data(), id: matchDoc.id } as BracketsMatch;
      const basePath = getBracketBasePath(tournamentId, categoryId, levelId);
      const stageDoc = await getDoc(doc(db, `${basePath}/stage`, String(bMatch.stage_id)));
      const [registrationSnap, participantSnap, roundSnap, groupSnap] = await Promise.all([
        getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
        getDocs(collection(db, `${basePath}/participant`)),
        getDocs(collection(db, `${basePath}/round`)),
        getDocs(collection(db, `${basePath}/group`)),
      ]);
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
      const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];
      const rounds = roundSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const structureMaps = buildMatchStructureMaps(rounds, groups);

      const stage = stageDoc.data() as Record<string, unknown> | undefined;
      const matchCategoryId = categoryId || (stage ? stage.tournament_id as string : '');

      const adapted = adaptBracketsMatchToLegacyMatch(
        bMatch, registrations, participants, matchCategoryId, tournamentId, structureMaps
      );

      if (!adapted) throw new Error('Match found but invalid or empty');

      adapted.levelId = levelId;
      adapted.scoringConfig = await getScoringConfigForMatch(tournamentId, categoryId);

      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      const scoreDoc = await getDoc(doc(db, matchScoresPath, matchId));
      if (scoreDoc.exists()) {
        const scoreData = scoreDoc.data();
        adapted.scores = scoreData.scores || [];
        if (scoreData.courtId) adapted.courtId = scoreData.courtId;
        adapted.scheduledTime = toDate(scoreData.scheduledTime) ?? adapted.scheduledTime;
      }

      currentMatch.value = adapted;
    } catch (err) {
      console.error('Error fetching match:', err);
      error.value = 'Failed to load match';
    } finally {
      loading.value = false;
    }
  }

  function subscribeMatch(tournamentId: string, matchId: string, categoryId?: string, levelId?: string): void {
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }

    const refresh = () => fetchMatch(tournamentId, matchId, categoryId, levelId);
    const matchPath = getMatchPath(tournamentId, categoryId, levelId);
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    const unsubMatch = onSnapshot(
      doc(db, matchPath, matchId),
      () => refresh(),
      (err) => {
        console.error('Error in match subscription:', err);
        error.value = 'Lost connection to match';
      }
    );

    const unsubScores = onSnapshot(
      doc(db, matchScoresPath, matchId),
      () => refresh(),
      (err) => console.error('Error in match_scores subscription:', err)
    );

    currentMatchUnsubscribe = () => {
      unsubMatch();
      unsubScores();
    };
  }

  // --- Match lifecycle operations ---

  async function startMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    const initialScores: GameScore[] = [{
      gameNumber: 1,
      score1: 0,
      score2: 0,
      isComplete: false,
    }];

    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores: initialScores,
        startedAt: serverTimestamp(),
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function updateScore(
    tournamentId: string,
    matchId: string,
    participant: 'participant1' | 'participant2',
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const match = currentMatch.value;
    if (!match) throw new Error('No match selected');
    const config = match.scoringConfig ?? await getScoringConfigForMatch(tournamentId, categoryId);

    const scores = [...match.scores];
    const currentGame = scores[scores.length - 1];

    if (!currentGame || currentGame.isComplete) {
      scores.push({
        gameNumber: scores.length + 1,
        score1: participant === 'participant1' ? 1 : 0,
        score2: participant === 'participant2' ? 1 : 0,
        isComplete: false,
      });
    } else {
      if (participant === 'participant1') currentGame.score1++;
      else currentGame.score2++;

      const validation = validateCompletedGameScore(currentGame.score1, currentGame.score2, config);
      if (validation.isValid) {
        currentGame.isComplete = true;
        currentGame.winnerId = currentGame.score1 > currentGame.score2
          ? match.participant1Id
          : match.participant2Id;
      }
    }

    const matchResult = determineWinner(scores, match.participant1Id!, match.participant2Id!, config);
    if (matchResult.isComplete) {
      await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!, categoryId, levelId);
      return;
    }

    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    await setDoc(
      doc(db, matchScoresPath, matchId),
      { scores, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  async function decrementScore(
    tournamentId: string,
    matchId: string,
    participant: 'participant1' | 'participant2',
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const match = currentMatch.value;
    if (!match) throw new Error('No match selected');

    const scores = [...match.scores];
    const currentGame = scores[scores.length - 1];
    if (!currentGame) return;

    if (participant === 'participant1' && currentGame.score1 > 0) {
      currentGame.score1--;
    } else if (participant === 'participant2' && currentGame.score2 > 0) {
      currentGame.score2--;
    }

    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    await setDoc(
      doc(db, matchScoresPath, matchId),
      { scores, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  async function completeMatch(
    tournamentId: string,
    matchId: string,
    scores: GameScore[],
    winnerId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    // 1. Get current match data to find courtId
    const matchDoc = await getDoc(doc(db, matchScoresPath, matchId));
    const courtId = await resolveCourtId(tournamentId, matchId, matchDoc.data()?.courtId);

    // 2. Write final scores
    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores,
        winnerId,
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 3. Release court if assigned
    if (courtId) {
      await releaseCourt(tournamentId, courtId);
    } else {
      console.warn('[completeMatch] No court to release for match', matchId);
    }

    // 4. Advance bracket
    try {
      await advanceBracket(tournamentId, matchId, winnerId, scores, categoryId, levelId);
      console.log('[completeMatch] Bracket advanced successfully');
    } catch (err) {
      console.error('[completeMatch] Bracket advancement failed:', err);
    }
  }

  /**
   * Record a walkover (forfeit) for a match.
   * Creates a default score for the winner, updates status, and advances the bracket.
   */
  async function recordWalkover(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const scoringConfig = currentMatch.value?.scoringConfig
      ?? await getScoringConfigForMatch(tournamentId, categoryId);
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    const walkoverScores: GameScore[] = [{
      gameNumber: 1,
      score1: winnerId === currentMatch.value?.participant1Id ? scoringConfig.pointsToWin : 0,
      score2: winnerId === currentMatch.value?.participant2Id ? scoringConfig.pointsToWin : 0,
      winnerId,
      isComplete: true,
    }];

    // Get courtId before completing
    const matchDoc = await getDoc(doc(db, matchScoresPath, matchId));
    const courtId = matchDoc.data()?.courtId;

    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores: walkoverScores,
        winnerId,
        status: 'walkover',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (courtId) {
      await releaseCourt(tournamentId, courtId);
    }

    try {
      await advanceBracket(tournamentId, matchId, winnerId, walkoverScores, categoryId, levelId);
      console.log('[recordWalkover] Bracket advanced successfully');
    } catch (err) {
      console.error('[recordWalkover] Bracket advancement failed:', err);
    }
  }

  async function resetMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores: [],
        winnerId: null,
        status: 'scheduled',
        startedAt: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function assignMatchToCourt(
    tournamentId: string,
    matchId: string,
    courtId: string,
    categoryId?: string,
    levelId?: string,
    options: AssignCourtOptions = {}
  ): Promise<void> {
    if (options.ignoreCheckInGate) {
      const authStore = useAuthStore();
      if (authStore.currentUser?.role !== 'admin') {
        throw new Error('Blocked: Only admins can assign anyway when players are not checked-in');
      }
    }

    const blockers = await getAssignmentBlockers(tournamentId, matchId, categoryId, levelId, options);
    if (blockers.length > 0) {
      throw new Error(blockers.join(' | '));
    }

    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const courtRef = doc(db, courtsPath(tournamentId), courtId);
    const courtSnap = await getDoc(courtRef);
    if (!courtSnap.exists()) throw new Error('Court not found');

    const courtData = courtSnap.data();
    if (courtData.status === 'maintenance') {
      throw new Error(`Blocked: Court ${courtData.name || courtId} is in maintenance`);
    }
    if (courtData.status === 'in_use' && courtData.currentMatchId !== matchId) {
      throw new Error(`Court ${courtData.name || courtId} is already in use`);
    }

    const batch = writeBatch(db);
    batch.set(
      doc(db, matchScoresPath, matchId),
      {
        courtId,
        status: 'in_progress',
        startedAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
        queuePosition: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batch.update(courtRef, {
      currentMatchId: matchId,
      assignedMatchId: matchId,
      status: 'in_use',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }

  async function markMatchReady(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    await setDoc(
      doc(db, matchScoresPath, matchId),
      { status: 'ready', updatedAt: serverTimestamp() },
      { merge: true }
    );
    // Legacy helper for scheduled flows; court assignment drives on-court state.
  }

  async function calculateWinner(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    await fetchMatch(tournamentId, matchId, categoryId, levelId);

    const matchData = currentMatch.value;
    if (!matchData) throw new Error('Match not found');
    if (!matchData.participant1Id || !matchData.participant2Id) {
      throw new Error('Match is missing participants');
    }

    const scoringConfig = matchData.scoringConfig
      ?? await getScoringConfigForMatch(tournamentId, categoryId);

    const result = determineWinner(matchData.scores, matchData.participant1Id, matchData.participant2Id, scoringConfig);
    if (!result.winnerId) {
      throw new Error('Could not determine winner from scores');
    }

    await completeMatch(tournamentId, matchId, matchData.scores, result.winnerId, categoryId, levelId);
  }

  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[],
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    await fetchMatch(tournamentId, matchId, categoryId, levelId);
    if (!currentMatch.value) throw new Error('Match not found');

    const matchData = currentMatch.value;
    if (!matchData.participant1Id || !matchData.participant2Id) {
      throw new Error('Match is missing participants');
    }

    const scoringConfig = matchData.scoringConfig
      ?? await getScoringConfigForMatch(tournamentId, categoryId);

    const result = determineWinner(games, matchData.participant1Id, matchData.participant2Id, scoringConfig);

    if (result.isComplete && result.winnerId) {
      await completeMatch(tournamentId, matchId, games, result.winnerId, categoryId, levelId);
    } else {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      await setDoc(
        doc(db, matchScoresPath, matchId),
        { scores: games, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    // Audit logging
    if (result.isComplete && result.winnerId) {
      const auditStore = useAuditStore();
      const participant1Name = matchData.participant1Id || 'Unknown';
      const participant2Name = matchData.participant2Id || 'Unknown';
      const scoreString = games.map(g => `${g.score1}-${g.score2}`).join(', ');
      const winnerName = result.winnerId === matchData.participant1Id ? participant1Name : participant2Name;

      await auditStore.logMatchCompleted(
        tournamentId, matchId, participant1Name, participant2Name, winnerName, scoreString
      );
    }
  }

  // --- Lifecycle & cleanup ---

  function unsubscribeAll(): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }
  }

  function cleanup(): void {
    unsubscribeAll();
    matches.value = [];
    currentMatch.value = null;
  }

  function clearCurrentMatch(): void {
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }
    currentMatch.value = null;
  }

  // --- Queue management ---

  async function reorderQueue(
    tournamentId: string,
    matchIds: string[],
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const batch = writeBatch(db);

    matchIds.forEach((matchId, index) => {
      const match = matches.value.find(m => m.id === matchId);
      if (!match) return;

      const path = getMatchScoresPath(tournamentId, categoryId, levelId);
      batch.update(doc(db, path, matchId), {
        queuePosition: index + 1,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }

  async function resetQueueToFIFO(
    tournamentId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const path = getMatchScoresPath(tournamentId, categoryId, levelId);
    const matchesQuery = query(
      collection(db, path),
      where('status', '==', 'scheduled'),
      where('courtId', '==', null),
      orderBy('queuedAt', 'asc')
    );

    const snapshot = await getDocs(matchesQuery);
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap, index) => {
      batch.update(docSnap.ref, {
        queuePosition: index + 1,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }

  async function sortQueueByRound(
    tournamentId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchesInQueue = matches.value
      .filter(m => m.status === 'scheduled' && !m.courtId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });

    const batch = writeBatch(db);
    const path = getMatchScoresPath(tournamentId, categoryId, levelId);
    matchesInQueue.forEach((match, index) => {
      batch.update(doc(db, path, match.id), { queuePosition: index + 1 });
    });

    await batch.commit();
  }

  async function announceMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const path = getMatchScoresPath(tournamentId, categoryId, levelId);
    await updateDoc(doc(db, path, matchId), {
      calledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function delayMatch(
    tournamentId: string,
    matchId: string,
    categoryId: string,
    reason: string,
    levelId?: string
  ): Promise<void> {
    const path = getMatchScoresPath(tournamentId, categoryId, levelId);

    const queueQuery = query(
      collection(db, path),
      where('status', '==', 'scheduled'),
      orderBy('queuePosition', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(queueQuery);
    const maxPosition = snapshot.empty ? 0 : (snapshot.docs[0].data().queuePosition || 0);

    const match = matches.value.find(m => m.id === matchId);
    const batch = writeBatch(db);

    batch.update(doc(db, path, matchId), {
      queuePosition: maxPosition + 1,
      courtId: null,
      status: 'scheduled',
      delayReason: reason,
      delayedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (match?.courtId) {
      batch.update(doc(db, courtsPath(tournamentId), match.courtId), {
        status: 'available',
        currentMatchId: null,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  async function unscheduleMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    releaseCourtId?: string,
    levelId?: string,
    options: UnscheduleOptions = {}
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const match = matches.value.find(m => m.id === matchId);
    const batch = writeBatch(db);

    const matchUpdate: Record<string, unknown> = {
      courtId: null,
      plannedCourtId: null,
      lockedTime: false,
      status: options.returnStatus ?? 'scheduled',
      updatedAt: serverTimestamp(),
    };

    if (options.clearInProgressState === true) {
      matchUpdate.startedAt = null;
      matchUpdate.completedAt = null;
      matchUpdate.calledAt = null;
      matchUpdate.winnerId = null;
      matchUpdate.scores = [];
    }

    batch.update(doc(db, matchScoresPath, matchId), matchUpdate);

    // Determine correct court to release:
    // 1. Explicitly passed courtId (most reliable for "zombie" fixes)
    // 2. Court currently assigned to match in store
    const courtIdToRelease = releaseCourtId || match?.courtId;
    if (courtIdToRelease) {
      const { ref: courtRef, data } = releaseCourtUpdate(tournamentId, courtIdToRelease);
      batch.update(courtRef, data);
    }

    await batch.commit();
  }

  // --- Score correction ---

  async function correctMatchScore(
    tournamentId: string,
    matchId: string,
    correction: {
      originalScores: GameScore[];
      newScores: GameScore[];
      originalWinnerId?: string;
      newWinnerId?: string;
      reason: string;
    },
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      const authStore = useAuthStore();
      const correctedBy = authStore.currentUser?.id || 'unknown';
      const correctedByName = authStore.currentUser?.displayName || 'Unknown User';

      const batch = writeBatch(db);

      batch.update(doc(db, matchScoresPath, matchId), {
        scores: correction.newScores,
        winnerId: correction.newWinnerId || null,
        status: correction.newWinnerId ? 'completed' : 'in_progress',
        corrected: true,
        correctionCount: increment(1),
        lastCorrectedAt: serverTimestamp(),
        lastCorrectedBy: correctedBy,
        updatedAt: serverTimestamp(),
      });

      const correctionPath = `${matchScoresPath}/${matchId}/corrections`;
      batch.set(doc(collection(db, correctionPath)), {
        originalScores: correction.originalScores,
        newScores: correction.newScores,
        originalWinnerId: correction.originalWinnerId,
        newWinnerId: correction.newWinnerId,
        reason: correction.reason,
        correctedBy,
        correctedByName,
        correctedAt: serverTimestamp(),
      });

      await batch.commit();

      if (correction.originalWinnerId !== correction.newWinnerId) {
        const { useBracketReversal } = await import('@/composables/useBracketReversal');
        const reverser = useBracketReversal();
        await reverser.handleWinnerChange(
          tournamentId, matchId, correction.originalWinnerId, correction.newWinnerId, categoryId
        );
      }

      await fetchMatch(tournamentId, matchId, categoryId, levelId);
    } catch (err) {
      console.error('Error correcting match score:', err);
      error.value = 'Failed to correct match score';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCorrectionHistory(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
      const correctionPath = `${getMatchScoresPath(tournamentId, categoryId, levelId)}/${matchId}/corrections`;
      const q = query(collection(db, correctionPath), orderBy('correctedAt', 'desc'));
      const snapshot = await getDocs(q);

      correctionHistory.value = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          matchId,
          originalScores: data.originalScores,
          newScores: data.newScores,
          originalWinnerId: data.originalWinnerId,
          newWinnerId: data.newWinnerId,
          reason: data.reason,
          correctedBy: data.correctedBy,
          correctedByName: data.correctedByName,
          correctedAt: data.correctedAt?.toDate() || new Date(),
        } as ScoreCorrectionRecord;
      });
    } catch (err) {
      console.error('Error fetching correction history:', err);
      correctionHistory.value = [];
    }
  }

  // --- Consistency checks ---

  async function checkAndFixConsistency(tournamentId: string): Promise<void> {
    console.log('[checkAndFixConsistency] Starting consistency check for tournament:', tournamentId);

    const courtsSnap = await getDocs(collection(db, courtsPath(tournamentId)));
    const courts = courtsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let fixesApplied = 0;

    for (const court of courts) {
      const courtData = court as Record<string, unknown>;
      const currentMatchId = courtData.currentMatchId as string | undefined;

      if (!currentMatchId) continue;

      const matchScore = matches.value.find((match) =>
        match.id === currentMatchId && match.courtId === court.id
      ) ?? matches.value.find((match) => match.id === currentMatchId);
      if (matchScore?.status === 'completed' || matchScore?.status === 'walkover') {
        console.log(`[checkAndFixConsistency] Found zombie court: ${court.id} has completed match ${currentMatchId}`);
        await updateDoc(doc(db, courtsPath(tournamentId), court.id), {
          status: 'available',
          currentMatchId: null,
          updatedAt: serverTimestamp(),
        });
        fixesApplied++;
      }
    }

    console.log(`[checkAndFixConsistency] Completed. Applied ${fixesApplied} fixes.`);
  }

  // --- Schedule management ---

  /**
   * Save a manually set planned time for a single match.
   * Optionally locks the time so automated re-scheduling skips this match.
   */
  async function saveManualPlannedTime(
    tournamentId: string,
    matchId: string,
    plannedStartAt: Date,
    matchDurationMinutes: number,
    locked: boolean,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    await saveManualPlannedTimeOp({
      tournamentId,
      matchId,
      categoryId,
      levelId,
      plannedStartAt,
      matchDurationMinutes,
      locked,
    });
  }

  async function publishMatchSchedule(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string,
    publishedBy = 'system'
  ): Promise<void> {
    await publishMatchScheduleOp({
      tournamentId,
      matchId,
      categoryId,
      levelId,
      publishedBy,
    });
  }

  return {
    matches,
    currentMatch,
    correctionHistory,
    loading,
    error,
    scheduledMatches,
    readyMatches,
    inProgressMatches,
    completedMatches,
    matchesByCategory,
    matchesByRound,
    fetchMatches,
    subscribeMatches,
    subscribeAllMatches,
    fetchMatch,
    subscribeMatch,
    startMatch,
    updateScore,
    decrementScore,
    completeMatch,
    recordWalkover,
    resetMatch,
    assignMatchToCourt,
    assignCourt: assignMatchToCourt,
    markMatchReady,
    calculateWinner,
    submitManualScores,
    reorderQueue,
    resetQueueToFIFO,
    sortQueueByRound,
    announceMatch,
    delayMatch,
    unscheduleMatch,
    unsubscribeAll,
    cleanup,
    clearCurrentMatch,
    correctMatchScore,
    fetchCorrectionHistory,
    checkAndFixConsistency,
    saveManualPlannedTime,
    publishMatchSchedule,
  };
});
