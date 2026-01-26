// Match Store - Pinia store for match and scoring management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  httpsCallable,
  functions,
} from '@/services/firebase';
import type { Match, MatchStatus, GameScore } from '@/types';
import { BADMINTON_CONFIG } from '@/types';
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

  // Fetch matches for a tournament
  async function fetchMatches(tournamentId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      let q;
      if (categoryId) {
        q = query(
          collection(db, `tournaments/${tournamentId}/matches`),
          where('categoryId', '==', categoryId),
          orderBy('round'),
          orderBy('matchNumber')
        );
      } else {
        q = query(
          collection(db, `tournaments/${tournamentId}/matches`),
          orderBy('round'),
          orderBy('matchNumber')
        );
      }

      const snapshot = await getDocs(q);
      matches.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Match[];
    } catch (err) {
      console.error('Error fetching matches:', err);
      error.value = 'Failed to load matches';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time match updates
  function subscribeMatches(tournamentId: string, categoryId?: string): void {
    if (matchesUnsubscribe) matchesUnsubscribe();

    let q;
    if (categoryId) {
      q = query(
        collection(db, `tournaments/${tournamentId}/matches`),
        where('categoryId', '==', categoryId),
        orderBy('round'),
        orderBy('matchNumber')
      );
    } else {
      q = query(
        collection(db, `tournaments/${tournamentId}/matches`),
        orderBy('round'),
        orderBy('matchNumber')
      );
    }

    matchesUnsubscribe = onSnapshot(q, (snapshot) => {
      matches.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Match[];
    }, (err) => {
      console.error('Error in matches subscription:', err);
      error.value = 'Lost connection to matches';
    });
  }

  // Fetch single match
  async function fetchMatch(tournamentId: string, matchId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchDoc = await getDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId)
      );

      if (!matchDoc.exists()) {
        throw new Error('Match not found');
      }

      currentMatch.value = {
        id: matchDoc.id,
        ...convertTimestamps(matchDoc.data()),
      } as Match;
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

    currentMatchUnsubscribe = onSnapshot(
      doc(db, `tournaments/${tournamentId}/matches`, matchId),
      (doc) => {
        if (doc.exists()) {
          currentMatch.value = {
            id: doc.id,
            ...convertTimestamps(doc.data()),
          } as Match;
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
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          status: 'in_progress' as MatchStatus,
          startedAt: serverTimestamp(),
          scores: [{ gameNumber: 1, score1: 0, score2: 0, isComplete: false }],
          updatedAt: serverTimestamp(),
        }
      );
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
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          scores,
          updatedAt: serverTimestamp(),
        }
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
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          scores,
          updatedAt: serverTimestamp(),
        }
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
      // Get match data first to get progression info
      const matchDoc = await getDoc(doc(db, `tournaments/${tournamentId}/matches`, matchId));
      const matchData = matchDoc.data();

      // Update match as completed
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          status: 'completed' as MatchStatus,
          scores,
          winnerId,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      // Try cloud function first
      try {
        const advanceWinnerFn = httpsCallable(functions, 'advanceWinner');
        await advanceWinnerFn({ tournamentId, matchId, winnerId });
        console.log('[completeMatch] Cloud function advanced winner successfully');
      } catch (cloudErr) {
        console.warn('[completeMatch] Cloud function failed, using client-side fallback:', cloudErr);

        // Client-side fallback: advance winner directly
        await advanceWinnerClientSide(tournamentId, matchData, winnerId);
      }
    } catch (err) {
      console.error('Error completing match:', err);
      throw err;
    }
  }

  // Client-side fallback for advancing winner
  async function advanceWinnerClientSide(
    tournamentId: string,
    matchData: Record<string, unknown> | undefined,
    winnerId: string
  ): Promise<void> {
    if (!matchData) return;

    // Advance winner to next match
    if (matchData.nextMatchId && matchData.nextMatchSlot) {
      const nextMatchSlot = matchData.nextMatchSlot as string;
      console.log(`[advanceWinnerClientSide] Advancing winner ${winnerId} to match ${matchData.nextMatchId} slot ${nextMatchSlot}`);

      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchData.nextMatchId as string),
        {
          [`${nextMatchSlot}Id`]: winnerId,
          updatedAt: serverTimestamp(),
        }
      );
    }

    // For double elimination, handle loser advancement
    if (matchData.loserNextMatchId && matchData.loserNextMatchSlot) {
      const loserId = matchData.participant1Id === winnerId
        ? matchData.participant2Id
        : matchData.participant1Id;

      const loserNextMatchSlot = matchData.loserNextMatchSlot as string;
      console.log(`[advanceWinnerClientSide] Advancing loser ${loserId} to match ${matchData.loserNextMatchId} slot ${loserNextMatchSlot}`);

      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchData.loserNextMatchId as string),
        {
          [`${loserNextMatchSlot}Id`]: loserId,
          updatedAt: serverTimestamp(),
        }
      );
    }

    // Release court and auto-assign next match
    if (matchData.courtId) {
      const courtId = matchData.courtId as string;

      // Release the court first
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          status: 'available',
          currentMatchId: null,
          updatedAt: serverTimestamp(),
        }
      );

      // Auto-assign next pending match to this court
      await autoAssignNextMatch(tournamentId, courtId);
    }
  }

  // Auto-assign the next pending match to a freed court
  async function autoAssignNextMatch(tournamentId: string, courtId: string): Promise<void> {
    try {
      // First, check if there's a match already scheduled for this court
      const scheduledForCourtQuery = query(
        collection(db, `tournaments/${tournamentId}/matches`),
        where('courtId', '==', courtId),
        where('status', '==', 'scheduled')
      );
      const scheduledForCourt = await getDocs(scheduledForCourtQuery);

      let nextMatch: { id: string; data: Record<string, unknown> } | null = null;

      if (!scheduledForCourt.empty) {
        // Find the match with both participants ready (sorted by scheduled time or round)
        for (const matchDoc of scheduledForCourt.docs) {
          const data = matchDoc.data();
          if (data.participant1Id && data.participant2Id) {
            nextMatch = { id: matchDoc.id, data };
            break;
          }
        }
      }

      // If no pre-scheduled match, find the next pending match in the queue
      if (!nextMatch) {
        const pendingQuery = query(
          collection(db, `tournaments/${tournamentId}/matches`),
          where('status', '==', 'scheduled'),
          orderBy('round'),
          orderBy('matchNumber')
        );
        const pendingMatches = await getDocs(pendingQuery);

        for (const matchDoc of pendingMatches.docs) {
          const data = matchDoc.data();
          // Find first match with both participants and no court assigned
          if (data.participant1Id && data.participant2Id && !data.courtId) {
            nextMatch = { id: matchDoc.id, data };
            break;
          }
        }
      }

      if (nextMatch) {
        console.log(`[autoAssignNextMatch] Assigning match ${nextMatch.id} to court ${courtId}`);
        await assignCourt(tournamentId, nextMatch.id, courtId);
      } else {
        console.log(`[autoAssignNextMatch] No pending matches to assign to court ${courtId}`);
      }
    } catch (err) {
      console.error('[autoAssignNextMatch] Error auto-assigning next match:', err);
      // Don't throw - this is a best-effort optimization
    }
  }

  // Record walkover
  async function recordWalkover(
    tournamentId: string,
    matchId: string,
    winnerId: string
  ): Promise<void> {
    try {
      // Get match data first to get progression info
      const matchDoc = await getDoc(doc(db, `tournaments/${tournamentId}/matches`, matchId));
      const matchData = matchDoc.data();

      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          status: 'walkover' as MatchStatus,
          winnerId,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      // Try cloud function first
      try {
        const advanceWinnerFn = httpsCallable(functions, 'advanceWinner');
        await advanceWinnerFn({ tournamentId, matchId, winnerId });
        console.log('[recordWalkover] Cloud function advanced winner successfully');
      } catch (cloudErr) {
        console.warn('[recordWalkover] Cloud function failed, using client-side fallback:', cloudErr);
        await advanceWinnerClientSide(tournamentId, matchData, winnerId);
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
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          courtId,
          status: 'ready' as MatchStatus,
          updatedAt: serverTimestamp(),
        }
      );

      // Update court status
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

  // Mark a pre-scheduled match as ready (court already assigned via auto-schedule)
  // This is different from assignCourt which assigns a NEW court
  async function markMatchReady(
    tournamentId: string,
    matchId: string,
    courtId: string
  ): Promise<void> {
    try {
      // Update match status to ready
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/matches`, matchId),
        {
          status: 'ready' as MatchStatus,
          updatedAt: serverTimestamp(),
        }
      );

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

  // Submit manual scores (for manual scorecard entry)
  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[]
  ): Promise<void> {
    try {
      // Get match data for participant IDs
      const matchDoc = await getDoc(doc(db, `tournaments/${tournamentId}/matches`, matchId));
      if (!matchDoc.exists()) throw new Error('Match not found');

      const matchData = matchDoc.data();
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
        // Just update the scores (match still in progress)
        await updateDoc(
          doc(db, `tournaments/${tournamentId}/matches`, matchId),
          {
            status: 'in_progress' as MatchStatus,
            scores: games,
            startedAt: matchData.startedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
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

  // Helper: Convert Firestore Timestamps to Dates
  function convertTimestamps(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Timestamp) {
        result[key] = value.toDate();
      } else if (value && typeof value === 'object' && 'toDate' in value) {
        result[key] = (value as Timestamp).toDate();
      } else {
        result[key] = value;
      }
    }

    return result;
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
