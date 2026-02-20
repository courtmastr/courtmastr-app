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
import type { ScoreCorrectionRecord } from '@/types/scoring';

const USE_CLOUD_FUNCTION_FOR_ADVANCE_WINNER = false;

export const useMatchStore = defineStore('matches', () => {
  const matches = ref<Match[]>([]);
  const currentMatch = ref<Match | null>(null);
  const correctionHistory = ref<ScoreCorrectionRecord[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let matchesUnsubscribe: (() => void) | null = null;
  let currentMatchUnsubscribe: (() => void) | null = null;

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

  async function getScoringConfigForMatch(
    tournamentId: string,
    categoryId?: string
  ): Promise<ScoringConfig> {
    try {
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentDoc.exists()) {
        return BADMINTON_CONFIG;
      }

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
      if (!grouped[match.categoryId]) {
        grouped[match.categoryId] = [];
      }
      grouped[match.categoryId].push(match);
    }
    return grouped;
  });

  const matchesByRound = computed(() => {
    const grouped: Record<number, Match[]> = {};
    for (const match of matches.value) {
      if (!grouped[match.round]) {
        grouped[match.round] = [];
      }
      grouped[match.round].push(match);
    }
    return grouped;
  });

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

      // Determine which scopes to fetch
      let targetScopes: Array<{ categoryId: string; levelId?: string }> = [];
      if (categoryId) {
        if (levelId) {
          targetScopes = [{ categoryId, levelId }];
        } else {
          // If category has levels, treat level scopes as authoritative and
          // avoid mixing stale base-category bracket docs with level brackets.
          const levelsSnap = await getDocs(
            collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`)
          );
          const levelScopes = levelsSnap.docs.map((levelDoc) => ({
            categoryId,
            levelId: levelDoc.id,
          }));
          targetScopes = levelScopes.length > 0 ? levelScopes : [{ categoryId }];
        }
      } else {
        // If no category specified, fetch ALL categories and level scopes for the tournament
        const catSnap = await getDocs(collection(db, `tournaments/${tournamentId}/categories`));
        const categoryIds = catSnap.docs.map((d) => d.id);
        const levelSnapshots = await Promise.all(
          categoryIds.map((cid) =>
            getDocs(collection(db, `tournaments/${tournamentId}/categories/${cid}/levels`))
          )
        );
        targetScopes = categoryIds.flatMap((cid, index) => {
          const levelScopes = levelSnapshots[index].docs.map((levelDoc) => ({
            categoryId: cid,
            levelId: levelDoc.id,
          }));
          return levelScopes.length > 0 ? levelScopes : [{ categoryId: cid }];
        });

        if (targetScopes.length === 0) {
          console.warn('[fetchMatches] No categories found for tournament.');
          matches.value = [];
          return;
        }
      }

      console.log(`[fetchMatches] Fetching matches for ${targetScopes.length} scope(s):`, targetScopes);

      // Fetch global registrations (once)
      const registrationSnap = await getDocs(collection(db, `tournaments/${tournamentId}/registrations`));
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];

      // Fetch category-specific data in parallel
      const allAdaptedMatches: Match[] = [];

      await Promise.all(targetScopes.map(async (scope) => {
        const basePath = getBracketBasePath(tournamentId, scope.categoryId, scope.levelId);
        const matchPath = `${basePath}/match`;
        const matchScoresPath = `${basePath}/match_scores`;
        const participantPath = `${basePath}/participant`;
        const roundPath = `${basePath}/round`;
        const groupPath = `${basePath}/group`;

        const [matchSnap, matchScoresSnap, participantSnap, roundSnap, groupSnap] = await Promise.all([
          getDocs(collection(db, matchPath)),
          getDocs(collection(db, matchScoresPath)),
          getDocs(collection(db, participantPath)),
          getDocs(collection(db, roundPath)),
          getDocs(collection(db, groupPath)),
        ]);

        const bracketsMatches = matchSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsMatch[];
        const matchScoresMap = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));
        const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];
        const rounds = roundSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const structureMaps = buildMatchStructureMaps(rounds, groups);

        // Adapt matches for this scope
        for (const bMatch of bracketsMatches) {
          const adapted = adaptBracketsMatchToLegacyMatch(
            bMatch,
            registrations,
            participants,
            scope.categoryId,
            tournamentId,
            structureMaps
          );

          if (adapted) {
            adapted.levelId = scope.levelId;
            const scoreData = matchScoresMap.get(adapted.id);
            if (scoreData) {
              if (scoreData.status) {
                const bracketCompleted = bMatch.status === 4;
                if (bracketCompleted && scoreData.status !== 'completed' && scoreData.status !== 'walkover') {
                  // Ignore stale status
                } else {
                  adapted.status = scoreData.status;
                }
              }
              if (scoreData.scores) adapted.scores = scoreData.scores;

              if (scoreData.winnerId) {
                adapted.winnerId = scoreData.winnerId;
              } else if (scoreData.status === 'completed' && scoreData.scores?.length > 0) {
                const lastGame = scoreData.scores[scoreData.scores.length - 1];
                if (lastGame.isComplete && lastGame.winnerId) {
                  adapted.winnerId = lastGame.winnerId;
                }
              }

              if (scoreData.courtId) adapted.courtId = scoreData.courtId;
              if (scoreData.scheduledTime) adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp ? scoreData.scheduledTime.toDate() : scoreData.scheduledTime;
              if (scoreData.startedAt) adapted.startedAt = scoreData.startedAt instanceof Timestamp ? scoreData.startedAt.toDate() : scoreData.startedAt;
              if (scoreData.completedAt) adapted.completedAt = scoreData.completedAt instanceof Timestamp ? scoreData.completedAt.toDate() : scoreData.completedAt;
            }
            allAdaptedMatches.push(adapted);
          }
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

          // When fetching a single level scope, keep other scopes from same category.
          if (levelId) {
            const matchLevelId = match.levelId ?? null;
            return matchLevelId !== levelId;
          }

          // When fetching category without levelId, replace the entire category
          // snapshot (base + levels) with fresh scoped data.
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
        console.log(`📊 Merged matches: ${otherMatches.length} kept + ${uniqueAdapted.length} refreshed`);
      } else {
        matches.value = allAdaptedMatches;
        console.log(`📊 Replaced all matches: ${allAdaptedMatches.length} total`);
      }

    } catch (err) {
      console.error('Error fetching matches:', err);
      error.value = 'Failed to load matches';
    } finally {
      loading.value = false;
    }
  }

  function subscribeMatches(tournamentId: string, categoryId?: string, levelId?: string): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }

    const unsubscibers: (() => void)[] = [];

    const refresh = async () => {
      await fetchMatches(tournamentId, categoryId, levelId);
    };

    const matchPath = getMatchPath(tournamentId, categoryId, levelId);
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    // Subscribe to /match collection (bracket structure changes)
    const qMatch = collection(db, matchPath);
    const unsubMatch = onSnapshot(qMatch, () => refresh());
    unsubscibers.push(unsubMatch);

    // Subscribe to /match_scores collection (operational data changes)
    const qScores = collection(db, matchScoresPath);
    const unsubScores = onSnapshot(qScores, () => refresh());
    unsubscibers.push(unsubScores);

    matchesUnsubscribe = () => {
      unsubscibers.forEach(u => u());
    };
  }

  /**
   * Subscribe to matches across ALL categories in a tournament.
   *
   * This method automatically:
   * - Watches the categories collection for additions/removals
   * - Subscribes to each category's /match and /match_scores collections
   * - Aggregates matches from all categories into the matches array
   * - Handles cleanup when categories are removed
   * - Manages all Firestore listeners properly on unmount
   *
   * Ideal for views that need to display matches from multiple categories:
   * - Match Control (tournament-wide scheduling)
   * - Live Scores (public display)
   * - Tournament Dashboard (overview)
   *
   * Performance: Creates 2N+1 Firestore listeners (N = number of categories)
   * - 1 listener for categories collection
   * - N listeners for /match collections
   * - N listeners for /match_scores collections
   *
   * @param tournamentId - The tournament ID to subscribe to
   *
   * @example
   * // In a component
   * onMounted(() => {
   *   matchStore.subscribeAllMatches(tournamentId.value);
   * });
   *
   * onUnmounted(() => {
   *   matchStore.unsubscribeAll(); // Cleans up all listeners
   * });
   *
   * @see subscribeMatches - For single-category subscriptions (more efficient)
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

    const getScopeKey = (categoryId: string, levelId?: string) =>
      `${categoryId}:${levelId || 'base'}`;

    const debouncedFetch = (categoryId: string, levelId?: string) => {
      const scopeKey = getScopeKey(categoryId, levelId);
      const existing = debouncedFetches.get(scopeKey);
      if (existing) clearTimeout(existing);
      debouncedFetches.set(scopeKey, setTimeout(() => {
        fetchMatches(tournamentId, categoryId, levelId);
        debouncedFetches.delete(scopeKey);
      }, 300));
    };

    const subscribeToCategory = (categoryId: string) => {
      if (categorySubscriptions.has(categoryId)) return;

      const matchPath = getMatchPath(tournamentId, categoryId);
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);

      const unsubMatch = onSnapshot(collection(db, matchPath), () => {
        debouncedFetch(categoryId);
      });

      const unsubScores = onSnapshot(collection(db, matchScoresPath), () => {
        debouncedFetch(categoryId);
      });

      categorySubscriptions.set(categoryId, { match: unsubMatch, scores: unsubScores });
    };

    const subscribeToLevel = (categoryId: string, levelId: string) => {
      const levelKey = getScopeKey(categoryId, levelId);
      if (levelSubscriptions.has(levelKey)) return;

      const matchPath = getMatchPath(tournamentId, categoryId, levelId);
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

      const unsubMatch = onSnapshot(collection(db, matchPath), () => {
        debouncedFetch(categoryId, levelId);
      });

      const unsubScores = onSnapshot(collection(db, matchScoresPath), () => {
        debouncedFetch(categoryId, levelId);
      });

      levelSubscriptions.set(levelKey, { match: unsubMatch, scores: unsubScores });
    };

    const unsubscribeLevel = (categoryId: string, levelId: string) => {
      const levelKey = getScopeKey(categoryId, levelId);
      const subs = levelSubscriptions.get(levelKey);
      if (!subs) return;

      subs.match();
      subs.scores();
      levelSubscriptions.delete(levelKey);

      matches.value = matches.value.filter(
        (match) => !(match.categoryId === categoryId && match.levelId === levelId)
      );
    };

    const subscribeToCategoryLevels = (categoryId: string) => {
      if (levelCollectionSubscriptions.has(categoryId)) return;

      const unsubLevels = onSnapshot(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`),
        (snapshot) => {
          const currentLevelIds = new Set(snapshot.docs.map(d => d.id));

          for (const levelId of currentLevelIds) {
            if (!levelSubscriptions.has(getScopeKey(categoryId, levelId))) {
              subscribeToLevel(categoryId, levelId);
            }
          }

          for (const levelKey of Array.from(levelSubscriptions.keys())) {
            const [levelCategoryId, levelId] = levelKey.split(':');
            if (levelCategoryId === categoryId && levelId !== 'base' && !currentLevelIds.has(levelId)) {
              unsubscribeLevel(categoryId, levelId);
            }
          }
        },
        (err) => {
          console.error(`Error in levels subscription for category ${categoryId}:`, err);
        }
      );

      levelCollectionSubscriptions.set(categoryId, unsubLevels);
    };

    const unsubscribeFromCategory = (categoryId: string) => {
      const subs = categorySubscriptions.get(categoryId);
      if (subs) {
        subs.match();
        subs.scores();
        categorySubscriptions.delete(categoryId);
      }

      const levelsUnsub = levelCollectionSubscriptions.get(categoryId);
      if (levelsUnsub) {
        levelsUnsub();
        levelCollectionSubscriptions.delete(categoryId);
      }

      for (const levelKey of Array.from(levelSubscriptions.keys())) {
        const [levelCategoryId, levelId] = levelKey.split(':');
        if (levelCategoryId === categoryId && levelId !== 'base') {
          unsubscribeLevel(categoryId, levelId);
        }
      }
    };

    categoriesUnsubscribe = onSnapshot(
      collection(db, `tournaments/${tournamentId}/categories`),
      (snapshot) => {
        const currentCategoryIds = new Set(snapshot.docs.map(d => d.id));

        for (const categoryId of currentCategoryIds) {
          if (!categorySubscriptions.has(categoryId)) {
            subscribeToCategory(categoryId);
            subscribeToCategoryLevels(categoryId);
            // Note: No immediate fetch needed - the onSnapshot listeners in subscribeToCategory will fire and fetch
          }
        }

        for (const [categoryId] of categorySubscriptions) {
          if (!currentCategoryIds.has(categoryId)) {
            unsubscribeFromCategory(categoryId);
            matches.value = matches.value.filter(m => m.categoryId !== categoryId);
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
      for (const [_, subs] of categorySubscriptions) {
        subs.match();
        subs.scores();
      }
      categorySubscriptions.clear();
      for (const unsubLevels of levelCollectionSubscriptions.values()) {
        unsubLevels();
      }
      levelCollectionSubscriptions.clear();
      for (const [_, subs] of levelSubscriptions) {
        subs.match();
        subs.scores();
      }
      levelSubscriptions.clear();
      for (const timeout of debouncedFetches.values()) {
        clearTimeout(timeout);
      }
      debouncedFetches.clear();
    };
  }

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
      const stagePath = `${basePath}/stage`;
      const participantPath = `${basePath}/participant`;
      const roundPath = `${basePath}/round`;
      const groupPath = `${basePath}/group`;
      const stageDoc = await getDoc(doc(db, stagePath, String(bMatch.stage_id)));
      const [registrationSnap, participantSnap, roundSnap, groupSnap] = await Promise.all([
        getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
        getDocs(collection(db, participantPath)),
        getDocs(collection(db, roundPath)),
        getDocs(collection(db, groupPath)),
      ]);
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
      const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];
      const rounds = roundSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const structureMaps = buildMatchStructureMaps(rounds, groups);

      const stage = stageDoc.data() as any;
      const matchCategoryId = categoryId || (stage ? stage.tournament_id : '');

      const adapted = adaptBracketsMatchToLegacyMatch(
        bMatch,
        registrations,
        participants,
        matchCategoryId,
        tournamentId,
        structureMaps
      );

      if (adapted) {
        adapted.levelId = levelId;
        adapted.scoringConfig = await getScoringConfigForMatch(tournamentId, categoryId);

        const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
        const scoreDoc = await getDoc(doc(db, matchScoresPath, matchId));
        if (scoreDoc.exists()) {
          const scoreData = scoreDoc.data();
          adapted.scores = scoreData.scores || [];
          if (scoreData.courtId) adapted.courtId = scoreData.courtId;
          if (scoreData.scheduledTime) adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp ? scoreData.scheduledTime.toDate() : scoreData.scheduledTime;
        }

        currentMatch.value = adapted;
      } else {
        throw new Error('Match found but invalid or empty');
      }

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

    const unsubscribers: (() => void)[] = [];

    const refresh = async () => {
      await fetchMatch(tournamentId, matchId, categoryId, levelId);
    };

    const matchPath = getMatchPath(tournamentId, categoryId, levelId);
    const unsubMatch = onSnapshot(
      doc(db, matchPath, matchId),
      () => refresh(),
      (err) => {
        console.error('Error in match subscription:', err);
        error.value = 'Lost connection to match';
      }
    );
    unsubscribers.push(unsubMatch);

    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
    const unsubScores = onSnapshot(
      doc(db, matchScoresPath, matchId),
      () => refresh(),
      (err) => {
        console.error('Error in match_scores subscription:', err);
      }
    );
    unsubscribers.push(unsubScores);

    currentMatchUnsubscribe = () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  async function startMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    console.log('[matchStore.startMatch] Starting match', {
      tournamentId,
      matchId,
      categoryId,
      levelId,
      matchScoresPath,
    });

    try {
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

      console.log('[matchStore.startMatch] ✅ Match scores updated successfully', {
        matchId,
        status: 'in_progress',
        path: matchScoresPath,
      });
    } catch (err) {
      console.error('[matchStore.startMatch] ❌ Error starting match:', err);
      throw err;
    }
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

      const score1 = currentGame.score1;
      const score2 = currentGame.score2;
      const validation = validateCompletedGameScore(score1, score2, config);

      if (validation.isValid) {
        currentGame.isComplete = true;
        currentGame.winnerId = score1 > score2 ? match.participant1Id : match.participant2Id;

        console.log(`[updateScore] Game ${currentGame.gameNumber} complete:`, {
          finalScore: `${score1}-${score2}`,
          winnerId: currentGame.winnerId
        });
      }
    }

    const matchResult = checkMatchComplete(scores, match.participant1Id!, match.participant2Id!, config);
    if (matchResult.isComplete) {
      await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!, categoryId, levelId);
      return;
    }
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores,
        updatedAt: serverTimestamp(),
      },
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
      {
        scores,
        updatedAt: serverTimestamp(),
      },
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
    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

      console.log('[completeMatch] Starting completion:', {
        matchId,
        categoryId,
        winnerId,
        matchScoresPath,
        scores: scores.map(s => `${s.score1}-${s.score2}`)
      });

      // 1. Get current match data to release court
      const matchDoc = await getDoc(doc(db, matchScoresPath, matchId));
      const matchData = matchDoc.data();
      let courtId = matchData?.courtId;

      console.log('[completeMatch] match_scores doc:', {
        exists: matchDoc.exists(),
        courtId,
        status: matchData?.status,
        allFields: matchData ? Object.keys(matchData) : 'N/A'
      });

      // Fallback: check in-memory match data if courtId not found in doc
      if (!courtId) {
        const inMemoryMatch = currentMatch.value;
        if (inMemoryMatch?.id === matchId && inMemoryMatch?.courtId) {
          courtId = inMemoryMatch.courtId;
          console.log('[completeMatch] Using fallback courtId from currentMatch:', courtId);
        } else {
          // Second fallback: check the matches array
          const arrayMatch = matches.value.find(m => m.id === matchId);
          if (arrayMatch?.courtId) {
            courtId = arrayMatch.courtId;
            console.log('[completeMatch] Using fallback courtId from matches array:', courtId);
          } else {
            // Third fallback: Query courts collection for currentMatchId
            // This handles "Zombie Courts" where the match lost the link but the court still has it.
            console.log('[completeMatch] 🔍 Searching courts for currentMatchId:', matchId);
            const courtsRef = collection(db, `tournaments/${tournamentId}/courts`);
            const q = query(courtsRef, where('currentMatchId', '==', matchId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              courtId = querySnapshot.docs[0].id;
              console.log('[completeMatch] ✅ Found court via currentMatchId query:', courtId);
            } else {
              console.warn('[completeMatch] ⚠️ No courtId found anywhere for match', matchId);
            }
          }
        }
      }

      // 2. Write final scores to match_scores
      await setDoc(
        doc(db, matchScoresPath, matchId),
        {
          scores,
          winnerId,
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Don't clear courtId from the match record so we have history, 
          // but logically the court is free.
        },
        { merge: true }
      );

      console.log('[completeMatch] ✅ Match scores written, status=completed');

      // 3. Release court if assigned
      if (courtId) {
        console.log('[completeMatch] Releasing court:', courtId);
        await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
          status: 'available',
          currentMatchId: null,
          assignedMatchId: null,
          lastFreedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('[completeMatch] ✅ Court', courtId, 'released');
      } else {
        console.warn('[completeMatch] ⚠️ No court to release for match', matchId);
      }

      try {
        if (USE_CLOUD_FUNCTION_FOR_ADVANCE_WINNER) {
          const updateMatchFn = httpsCallable(functions, 'updateMatch');
          await updateMatchFn({
            tournamentId,
            categoryId,
            matchId,
            status: 'completed',
            winnerId,
            scores
          });
        } else {
          const advancer = useAdvanceWinner();
          if (!categoryId) {
            throw new Error('categoryId is required to advance winner');
          }
          await advancer.advanceWinner(tournamentId, categoryId, matchId, winnerId, levelId);
        }
        console.log('[completeMatch] Bracket advanced successfully');
      } catch (cloudErr) {
        console.error('[completeMatch] Bracket advancement failed:', cloudErr);
      }
    } catch (err) {
      console.error('Error completing match:', err);
      throw err;
    }
  }

  /**
   * Record a walkover (forfeit) for a match.
   *
   * A walkover occurs when one player cannot compete (injury, no-show, etc.).
   * This function:
   * - Creates a default 21-0 score for the winner
   * - Updates match status to 'walkover'
   * - Advances the bracket via Cloud Function
   *
   * @param tournamentId - Tournament ID
   * @param matchId - Match ID
   * @param winnerId - Registration ID of the winner (player who didn't forfeit)
   * @param categoryId - Optional category ID for category-level matches
   */
  async function recordWalkover(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
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

      // Get current match data to release court
      const matchDoc = await getDoc(doc(db, matchScoresPath, matchId));
      const matchData = matchDoc.data();
      const courtId = matchData?.courtId;

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

      // Release court if assigned
      if (courtId) {
        await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
          status: 'available',
          currentMatchId: null,
          assignedMatchId: null,
          lastFreedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        if (USE_CLOUD_FUNCTION_FOR_ADVANCE_WINNER) {
          const updateMatchFn = httpsCallable(functions, 'updateMatch');
          await updateMatchFn({
            tournamentId,
            categoryId,
            matchId,
            status: 'completed',
            winnerId,
            scores: walkoverScores
          });
        } else {
          const advancer = useAdvanceWinner();
          if (!categoryId) {
            throw new Error('categoryId is required to advance winner');
          }
          await advancer.advanceWinner(tournamentId, categoryId, matchId, winnerId, levelId);
        }
        console.log('[recordWalkover] Bracket advanced successfully');
      } catch (cloudErr) {
        console.error('[recordWalkover] Bracket advancement failed:', cloudErr);
      }
    } catch (err) {
      console.error('Error recording walkover:', err);
      throw err;
    }
  }

  async function resetMatch(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
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
    } catch (err) {
      console.error('Error resetting match:', err);
      throw err;
    }
  }

  async function assignMatchToCourt(
    tournamentId: string,
    matchId: string,
    courtId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      await setDoc(
        doc(db, matchScoresPath, matchId),
        {
          courtId,
          status: 'ready',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
        currentMatchId: matchId,
        status: 'in_use',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error assigning match to court:', err);
      throw err;
    }
  }

  async function markMatchReady(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
      await setDoc(
        doc(db, matchScoresPath, matchId),
        {
          status: 'ready',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const courtSnap = await getDoc(doc(db, matchScoresPath, matchId));
      const courtId = courtSnap.data()?.courtId;
      if (courtId) {
        await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
          currentMatchId: matchId,
          status: 'in_use',
        });
      }
    } catch (err) {
      console.error('Error marking match ready:', err);
      throw err;
    }
  }

  async function calculateWinner(
    tournamentId: string,
    matchId: string,
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId, categoryId, levelId);

      const matchData = currentMatch.value;
      if (!matchData) throw new Error('Match not found');

      const participant1Id = matchData.participant1Id;
      const participant2Id = matchData.participant2Id;

      if (!participant1Id || !participant2Id) {
        throw new Error('Match is missing participants');
      }

      const scoringConfig = matchData.scoringConfig
        ?? await getScoringConfigForMatch(tournamentId, categoryId);
      const games = matchData.scores;
      const gamesNeeded = getGamesNeeded(scoringConfig);

      let p1Wins = 0;
      let p2Wins = 0;

      for (const game of games) {
        if (game.winnerId === participant1Id) p1Wins++;
        else if (game.winnerId === participant2Id) p2Wins++;
      }

      const winnerId = p1Wins >= gamesNeeded ? participant1Id : (p2Wins >= gamesNeeded ? participant2Id : null);

      if (!winnerId) {
        throw new Error('Could not determine winner from scores');
      }

      await completeMatch(tournamentId, matchId, games, winnerId, categoryId, levelId);
    } catch (err) {
      console.error('Error calculating winner:', err);
      throw err;
    }
  }

  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[],
    categoryId?: string,
    levelId?: string
  ): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId, categoryId, levelId);
      if (!currentMatch.value) throw new Error('Match not found');

      const matchData = currentMatch.value;
      const participant1Id = matchData.participant1Id;
      const participant2Id = matchData.participant2Id;

      if (!participant1Id || !participant2Id) {
        throw new Error('Match is missing participants');
      }

      const scoringConfig = matchData.scoringConfig
        ?? await getScoringConfigForMatch(tournamentId, categoryId);

      let p1Wins = 0;
      let p2Wins = 0;
      for (const game of games) {
        if (game.winnerId === participant1Id) p1Wins++;
        else if (game.winnerId === participant2Id) p2Wins++;
      }

      const gamesNeeded = getGamesNeeded(scoringConfig);

      console.log('[submitManualScores] Win calculation:', {
        p1Wins,
        p2Wins,
        gamesNeeded,
        gamesPerMatch: scoringConfig.gamesPerMatch,
        totalGames: games.length,
        games: games.map(g => ({ w: g.winnerId, s1: g.score1, s2: g.score2 }))
      });

      const isMatchComplete = p1Wins >= gamesNeeded || p2Wins >= gamesNeeded;
      const winnerId = p1Wins >= gamesNeeded ? participant1Id : (p2Wins >= gamesNeeded ? participant2Id : null);

      if (isMatchComplete && winnerId) {
        console.log('[submitManualScores] Match complete! Winner:', winnerId);
        await completeMatch(tournamentId, matchId, games, winnerId, categoryId, levelId);
      } else {
        const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
        await setDoc(
          doc(db, matchScoresPath, matchId),
          {
            scores: games,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const auditStore = useAuditStore();
      const participant1Name = matchData.participant1Id || 'Unknown';
      const participant2Name = matchData.participant2Id || 'Unknown';
      const scoreString = games.map(g => `${g.score1}-${g.score2}`).join(', ');

      if (isMatchComplete && winnerId) {
        const winnerName = winnerId === participant1Id ? participant1Name : participant2Name;
        await auditStore.logMatchCompleted(
          tournamentId,
          matchId,
          participant1Name,
          participant2Name,
          winnerName,
          scoreString
        );
      }
    } catch (err) {
      console.error('Error submitting manual scores:', err);
      throw err;
    }
  }

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

  function checkMatchComplete(
    games: GameScore[],
    participant1Id: string,
    participant2Id: string,
    scoringConfig: ScoringConfig
  ): { isComplete: boolean; winnerId?: string } {
    const gamesNeeded = getGamesNeeded(scoringConfig);

    let p1Wins = 0;
    let p2Wins = 0;

    for (const game of games) {
      if (!game.isComplete) continue;

      if (game.winnerId === participant1Id) {
        p1Wins++;
      } else if (game.winnerId === participant2Id) {
        p2Wins++;
      }
    }

    if (p1Wins >= gamesNeeded) {
      return { isComplete: true, winnerId: participant1Id };
    }
    if (p2Wins >= gamesNeeded) {
      return { isComplete: true, winnerId: participant2Id };
    }

    return { isComplete: false };
  }

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

    snapshot.docs.forEach((doc, index) => {
      batch.update(doc.ref, {
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
    const matchesInQueue = matches.value.filter(
      m => m.status === 'scheduled' && !m.courtId
    );

    const sorted = matchesInQueue.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.matchNumber - b.matchNumber;
    });

    const batch = writeBatch(db);
    sorted.forEach((match, index) => {
      const path = getMatchScoresPath(tournamentId, categoryId, levelId);
      batch.update(doc(db, path, match.id), {
        queuePosition: index + 1,
      });
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
      batch.update(doc(db, `tournaments/${tournamentId}/courts`, match.courtId), {
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
    levelId?: string
  ): Promise<void> {
    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);

      const match = matches.value.find(m => m.id === matchId);
      const batch = writeBatch(db);

      batch.update(doc(db, matchScoresPath, matchId), {
        courtId: null,
        status: 'scheduled',
        updatedAt: serverTimestamp(),
      });

      // Determine correct court to release:
      // 1. Explicitly passed courtId (most reliable for "zombie" fixes)
      // 2. Court currently assigned to match in store
      const courtIdToRelease = releaseCourtId || match?.courtId;

      if (courtIdToRelease) {
        batch.update(doc(db, `tournaments/${tournamentId}/courts`, courtIdToRelease), {
          status: 'available',
          currentMatchId: null,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      console.error('Error unscheduling match:', err);
      throw err;
    }
  }

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
          tournamentId,
          matchId,
          correction.originalWinnerId,
          correction.newWinnerId,
          categoryId
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

      const q = query(
        collection(db, correctionPath),
        orderBy('correctedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      correctionHistory.value = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
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

  async function checkAndFixConsistency(tournamentId: string): Promise<void> {
    console.log('[checkAndFixConsistency] Starting consistency check for tournament:', tournamentId);

    try {
      // Fetch all courts for this tournament
      const courtsSnap = await getDocs(collection(db, `tournaments/${tournamentId}/courts`));
      const courts = courtsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch all match_scores for this tournament
      const matchScoresSnap = await getDocs(collection(db, `tournaments/${tournamentId}/match_scores`));
      const matchScores = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));

      let fixesApplied = 0;

      for (const court of courts) {
        const courtData = court as any;
        const currentMatchId = courtData.currentMatchId;

        if (currentMatchId) {
          const matchScore = matchScores.get(currentMatchId);

          // Check if match is completed but court still shows it as active
          if (matchScore?.status === 'completed' || matchScore?.status === 'walkover') {
            console.log(`[checkAndFixConsistency] Found zombie court: ${court.id} has completed match ${currentMatchId}`);

            // Release the court
            await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, court.id), {
              status: 'available',
              currentMatchId: null,
              updatedAt: serverTimestamp(),
            });

            fixesApplied++;
          }
        }
      }

      console.log(`[checkAndFixConsistency] Completed. Applied ${fixesApplied} fixes.`);
    } catch (err) {
      console.error('[checkAndFixConsistency] Error during consistency check:', err);
      throw err;
    }
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
  };
});
