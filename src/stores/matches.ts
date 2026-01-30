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
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  httpsCallable,
  functions,
} from '@/services/firebase';
import type { Match, GameScore } from '@/types';
import { BADMINTON_CONFIG } from '@/types';
import { adaptBracketsMatchToLegacyMatch, type BracketsMatch, type BracketsParticipant, type BracketsRound, type BracketsGroup } from './bracketMatchAdapter';
// Note: Activity logging is handled at the view level where participant/court names are available

export const useMatchStore = defineStore('matches', () => {
  // State
  const matches = ref<Match[]>([]);
  const currentMatch = ref<Match | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Real-time listeners
  let matchesUnsubscribe: (() => void) | null = null;
  let currentMatchUnsubscribe: (() => void) | null = null;

  // Getters
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

  // Fetch matches for a tournament (reading from brackets-manager collections)
  async function fetchMatches(tournamentId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      // We need to fetch from multiple collections to reconstruct the match data
      // 1. Get Stages (to filter by category/tournament_id)
      let stageQuery;
      if (categoryId) {
        stageQuery = query(
          collection(db, `tournaments/${tournamentId}/stage`),
          where('tournament_id', '==', categoryId)
        );
      } else {
        stageQuery = collection(db, `tournaments/${tournamentId}/stage`);
      }
      const stageSnap = await getDocs(stageQuery);
      const stageIds = stageSnap.docs.map(d => d.id);

      if (stageIds.length === 0) {
        matches.value = [];
        return;
      }

      // 2. Fetch all related data
      // Note: In a real app we might want to optimize this, but for < 1000 matches it's fine
      // match, participant, round, group
      const [matchSnap, participantSnap, roundSnap, groupSnap] = await Promise.all([
        getDocs(query(collection(db, `tournaments/${tournamentId}/match`), where('stage_id', 'in', stageIds))),
        getDocs(collection(db, `tournaments/${tournamentId}/participant`)),
        getDocs(query(collection(db, `tournaments/${tournamentId}/round`), where('stage_id', 'in', stageIds))),
        getDocs(query(collection(db, `tournaments/${tournamentId}/group`), where('stage_id', 'in', stageIds)))
      ]);

      const bracketsMatches = matchSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsMatch[];
      const participants = participantSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsParticipant[];
      const rounds = roundSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsRound[];
      const groups = groupSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsGroup[];

      // 3. Adapt matches
      const adaptedMatches: Match[] = [];
      const stages = stageSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const bMatch of bracketsMatches) {
        // Find categoryId for this match's stage
        const stage = stages.find(s => s.id === bMatch.stage_id);
        // stage.tournament_id IS the categoryId in our usage in bracket.ts
        const matchCategoryId = stage ? (stage as any).tournament_id : categoryId || '';

        const adapted = adaptBracketsMatchToLegacyMatch(
          bMatch,
          rounds,
          groups,
          participants,
          matchCategoryId,
          tournamentId
        );

        if (adapted) {
          adaptedMatches.push(adapted);
        }
      }

      // Sort by round then match number
      adaptedMatches.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });

      matches.value = adaptedMatches;

    } catch (err) {
      console.error('Error fetching matches:', err);
      error.value = 'Failed to load matches';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time match updates (brackets-manager collections)
  function subscribeMatches(tournamentId: string, categoryId?: string): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }

    // We need to listen to multiple collections. 
    // Simplified strategy: Listen to 'match' and 'participant' mainly.
    // 'stage', 'group', 'round' change less often, so we can fetch them once or listen lazily.
    // For correctness, we'll listen to all relevant ones but assume stage/group/round are stable after creation.

    // 1. Fetch static structure (Stages, Groups, Rounds) first
    // In a full implementation, we might want to listen to these too if stages are added dynamically.
    // For now, let's fetch them once to resolve IDs, then listen to matches/participants.

    const unsubscibers: (() => void)[] = [];

    // Helper to refresh data when something changes
    const refresh = async () => {
      // This is a bit heavy (re-fetching on every change), but ensures consistency.
      // Optimization: Manage local state for each collection and re-compute changes.
      await fetchMatches(tournamentId, categoryId);
    };

    // Listen to matches
    // Note: We can't easily filter by stage_id in onSnapshot if we don't know stage IDs yet or if there are multiple.
    // So we listen to all matches for the tournament and filter in memory (in fetchMatches/adapter).
    const qMatch = collection(db, `tournaments/${tournamentId}/match`);
    const unsubMatch = onSnapshot(qMatch, () => refresh());
    unsubscibers.push(unsubMatch);

    // Listen to participants (names might change, or new mapping)
    const qPart = collection(db, `tournaments/${tournamentId}/participant`);
    const unsubPart = onSnapshot(qPart, () => refresh());
    unsubscibers.push(unsubPart);

    // Store unsub
    matchesUnsubscribe = () => {
      unsubscibers.forEach(u => u());
    };
  }

  // Fetch single match (from brackets-manager)
  async function fetchMatch(tournamentId: string, matchId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchDoc = await getDoc(doc(db, `tournaments/${tournamentId}/match`, matchId));
      if (!matchDoc.exists()) throw new Error('Match not found');

      const bMatch = { ...matchDoc.data(), id: matchDoc.id } as BracketsMatch;

      // We need supporting data to adapt
      const stageDoc = await getDoc(doc(db, `tournaments/${tournamentId}/stage`, bMatch.stage_id));
      const groupDoc = await getDoc(doc(db, `tournaments/${tournamentId}/group`, bMatch.group_id));
      const roundDoc = await getDoc(doc(db, `tournaments/${tournamentId}/round`, bMatch.round_id));

      // Get all participants to resolve names
      const partQuery = collection(db, `tournaments/${tournamentId}/participant`);
      const partReq = await getDocs(partQuery);
      const participants = partReq.docs.map(d => ({ id: d.id, ...d.data() })) as BracketsParticipant[];

      const stage = stageDoc.data() as any;
      const categoryId = stage ? stage.tournament_id : '';

      const adapted = adaptBracketsMatchToLegacyMatch(
        bMatch,
        [roundDoc.data() ? { ...roundDoc.data(), id: roundDoc.id } as BracketsRound : { id: '', number: 1, stage_id: '', group_id: '' }],
        [groupDoc.data() ? { ...groupDoc.data(), id: groupDoc.id } as BracketsGroup : { id: '', stage_id: '', number: 1 }],
        participants,
        categoryId,
        tournamentId
      );

      if (adapted) {
        // Fetch scores from match_scores collection
        const scoreDoc = await getDoc(doc(db, `tournaments/${tournamentId}/match_scores`, matchId));
        if (scoreDoc.exists()) {
          const scoreData = scoreDoc.data();
          adapted.scores = scoreData.scores || [];
          if (scoreData.courtId) adapted.courtId = scoreData.courtId;
          if (scoreData.scheduledTime) adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp ? scoreData.scheduledTime.toDate() : scoreData.scheduledTime;
          // Status from brackets match takes precedence, unless it's strictly scoring related and missing?
          // No, brackets match status is the truth for bracket progression.
        }

        currentMatch.value = adapted;
      } else {
        throw new Error('Match found but invalid or empty');
      }

    } catch (err) {
      console.error('Error fetching match:', err);
      error.value = 'Failed to load match';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to single match updates
  function subscribeMatch(tournamentId: string, matchId: string): void {
    if (currentMatchUnsubscribe) currentMatchUnsubscribe();

    // Listen to the match document
    currentMatchUnsubscribe = onSnapshot(
      doc(db, `tournaments/${tournamentId}/match`, matchId),
      async (docSnap) => {
        if (docSnap.exists()) {
          // We re-fetch to get linked data. 
          // Optimization: we could store linked data in state if we are coming from list view
          await fetchMatch(tournamentId, matchId);
        }
      },
      (err) => {
        console.error('Error in match subscription:', err);
        error.value = 'Lost connection to match';
      }
    );
  }

  // Start a match
  async function startMatch(tournamentId: string, matchId: string): Promise<void> {
    try {
      const scores = [{ gameNumber: 1, score1: 0, score2: 0, isComplete: false }];

      // 1. Write to match_scores (Optimistic update)
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          scores,
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Call Cloud Function to update bracket status
      const updateMatchFn = httpsCallable(functions, 'updateMatch');
      await updateMatchFn({
        tournamentId,
        matchId,
        status: 'in_progress',
        scores
      });

    } catch (err) {
      console.error('Error starting match:', err);
      throw err;
    }
  }

  // Update score (main scoring function)
  async function updateScore(
    tournamentId: string,
    matchId: string,
    participant: 'participant1' | 'participant2'
  ): Promise<void> {
    if (!currentMatch.value) return;

    const match = currentMatch.value;
    const scores = [...match.scores];
    const currentGame = scores[scores.length - 1];

    if (!currentGame || currentGame.isComplete) {
      // Start new game if needed
      if (scores.length < BADMINTON_CONFIG.gamesPerMatch) {
        scores.push({
          gameNumber: scores.length + 1,
          score1: participant === 'participant1' ? 1 : 0,
          score2: participant === 'participant2' ? 1 : 0,
          isComplete: false,
        });
      }
    } else {
      // Update current game score
      if (participant === 'participant1') {
        currentGame.score1++;
      } else {
        currentGame.score2++;
      }

      // Check if game is complete
      const gameResult = checkGameComplete(currentGame);
      if (gameResult.isComplete) {
        currentGame.isComplete = true;
        currentGame.winnerId = gameResult.winnerId === 1
          ? match.participant1Id
          : match.participant2Id;

        // Check if match is complete
        const matchResult = checkMatchComplete(scores, match.participant1Id!, match.participant2Id!);
        if (matchResult.isComplete) {
          await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!);
          return;
        }
      }
    }

    try {
      // Write scores to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          scores,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating score:', err);
      throw err;
    }
  }

  // Decrement score (undo)
  async function decrementScore(
    tournamentId: string,
    matchId: string,
    participant: 'participant1' | 'participant2'
  ): Promise<void> {
    if (!currentMatch.value) return;

    const match = currentMatch.value;
    const scores = [...match.scores];
    const currentGame = scores[scores.length - 1];

    if (!currentGame) return;

    // Decrement the score
    if (participant === 'participant1' && currentGame.score1 > 0) {
      currentGame.score1--;
    } else if (participant === 'participant2' && currentGame.score2 > 0) {
      currentGame.score2--;
    }

    // If game was marked complete, unmark it
    if (currentGame.isComplete) {
      currentGame.isComplete = false;
      currentGame.winnerId = undefined;
    }

    try {
      // Write scores to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          scores,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error decrementing score:', err);
      throw err;
    }
  }

  // Complete match
  async function completeMatch(
    tournamentId: string,
    matchId: string,
    scores: GameScore[],
    winnerId: string
  ): Promise<void> {
    try {
      // 1. Write final scores to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          scores,
          winnerId,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Call Cloud Function to advance bracket
      try {
        const updateMatchFn = httpsCallable(functions, 'updateMatch');
        await updateMatchFn({
          tournamentId,
          matchId,
          status: 'completed',
          winnerId,
          scores
        });
        console.log('[completeMatch] Cloud function advanced bracket successfully');
      } catch (cloudErr) {
        console.error('[completeMatch] Cloud function failed:', cloudErr);
        // We can't do client-side fallback easily with brackets-manager
        throw cloudErr;
      }
    } catch (err) {
      console.error('Error completing match:', err);
      throw err;
    }
  }

  // Client-side fallback for advancing winner





  // Record walkover
  async function recordWalkover(
    tournamentId: string,
    matchId: string,
    winnerId: string
  ): Promise<void> {
    try {
      // 1. Write to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          winnerId,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Call Cloud Function
      try {
        const updateMatchFn = httpsCallable(functions, 'updateMatch');
        await updateMatchFn({
          tournamentId,
          matchId,
          status: 'completed',
          winnerId
        });
        console.log('[recordWalkover] Cloud function advanced bracket successfully');
      } catch (cloudErr) {
        console.error('[recordWalkover] Cloud function failed:', cloudErr);
        throw cloudErr;
      }
    } catch (err) {
      console.error('Error recording walkover:', err);
      throw err;
    }
  }

  // Assign match to court
  async function assignCourt(
    tournamentId: string,
    matchId: string,
    courtId: string
  ): Promise<void> {
    try {
      // 1. Write court info to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          courtId,
          scheduledTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Update status via Cloud Function (to set status=ready in brackets-manager)
      // Actually, we can just update match_score status if we want, but brackets-manager match status needs to stay in sync.
      // Status 2 = ready.
      const updateMatchFn = httpsCallable(functions, 'updateMatch');
      await updateMatchFn({
        tournamentId,
        matchId,
        status: 'ready' // This maps to 2 in brackets-manager
      });

      // Update court status (legacy courts collection is fine to keep as is, it's independent)
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          status: 'in_use',
          currentMatchId: matchId,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error assigning court:', err);
      throw err;
    }
  }

  // Mark a pre-scheduled match as ready
  async function markMatchReady(
    tournamentId: string,
    matchId: string,
    courtId: string
  ): Promise<void> {
    try {
      // 1. Call Cloud Function to set status
      const updateMatchFn = httpsCallable(functions, 'updateMatch');
      await updateMatchFn({
        tournamentId,
        matchId,
        status: 'ready'
      });

      // Update court status to in_use
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          status: 'in_use',
          currentMatchId: matchId,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error marking match ready:', err);
      throw err;
    }
  }

  // Submit manual scores
  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[]
  ): Promise<void> {
    try {
      // Get match data (from brackets-manager) via our fetch logic
      // We assume currentMatch might not be set if we are calling this from list
      // So let's fetch it first to be safe
      await fetchMatch(tournamentId, matchId);
      if (!currentMatch.value) throw new Error('Match not found');

      const matchData = currentMatch.value;
      const participant1Id = matchData.participant1Id;
      const participant2Id = matchData.participant2Id;

      // Calculate match winner
      let p1Wins = 0;
      let p2Wins = 0;
      for (const game of games) {
        if (game.winnerId === participant1Id) p1Wins++;
        else if (game.winnerId === participant2Id) p2Wins++;
      }

      const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
      const isMatchComplete = p1Wins >= gamesNeeded || p2Wins >= gamesNeeded;
      const winnerId = p1Wins >= gamesNeeded ? participant1Id : (p2Wins >= gamesNeeded ? participant2Id : null);

      if (isMatchComplete && winnerId) {
        // Complete the match
        await completeMatch(tournamentId, matchId, games, winnerId);
      } else {
        // Just update scores
        await setDoc(
          doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
          {
            scores: games,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Update status to in_progress
        const updateMatchFn = httpsCallable(functions, 'updateMatch');
        await updateMatchFn({
          tournamentId,
          matchId,
          status: 'in_progress',
          scores: games
        });
      }
    } catch (err) {
      console.error('Error submitting manual scores:', err);
      throw err;
    }
  }

  // Helper: Check if game is complete (badminton rules)
  function checkGameComplete(game: GameScore): { isComplete: boolean; winnerId?: number } {
    const { score1, score2 } = game;
    const { pointsToWin, mustWinBy, maxPoints } = BADMINTON_CONFIG;

    // Check for max points (30)
    if (score1 === maxPoints) {
      return { isComplete: true, winnerId: 1 };
    }
    if (score2 === maxPoints) {
      return { isComplete: true, winnerId: 2 };
    }

    // Check for win by 2 after reaching 21
    if (score1 >= pointsToWin && score1 - score2 >= mustWinBy) {
      return { isComplete: true, winnerId: 1 };
    }
    if (score2 >= pointsToWin && score2 - score1 >= mustWinBy) {
      return { isComplete: true, winnerId: 2 };
    }

    return { isComplete: false };
  }

  // Helper: Check if match is complete (best of 3)
  function checkMatchComplete(
    scores: GameScore[],
    participant1Id: string,
    participant2Id: string
  ): { isComplete: boolean; winnerId?: string } {
    const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
    let p1Wins = 0;
    let p2Wins = 0;

    for (const game of scores) {
      if (game.isComplete) {
        if (game.winnerId === participant1Id) {
          p1Wins++;
        } else if (game.winnerId === participant2Id) {
          p2Wins++;
        }
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

  // Cleanup subscriptions
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

  // Clear current match
  function clearCurrentMatch(): void {
    currentMatch.value = null;
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }
  }

  return {
    // State
    matches,
    currentMatch,
    loading,
    error,
    // Getters
    scheduledMatches,
    readyMatches,
    inProgressMatches,
    completedMatches,
    matchesByCategory,
    matchesByRound,
    // Actions
    fetchMatches,
    subscribeMatches,
    fetchMatch,
    subscribeMatch,
    startMatch,
    updateScore,
    decrementScore,
    completeMatch,
    submitManualScores,
    recordWalkover,
    assignCourt,
    markMatchReady,
    unsubscribeAll,
    clearCurrentMatch,
  };
});
