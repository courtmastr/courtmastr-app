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
  onSnapshot,
  serverTimestamp,
  Timestamp,
  httpsCallable,
  functions,
} from '@/services/firebase';
import type { Match, GameScore, Registration } from '@/types';
import { BADMINTON_CONFIG } from '@/types';
import { adaptBracketsMatchToLegacyMatch, type BracketsMatch } from './bracketMatchAdapter';

export const useMatchStore = defineStore('matches', () => {
  const matches = ref<Match[]>([]);
  const currentMatch = ref<Match | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let matchesUnsubscribe: (() => void) | null = null;
  let currentMatchUnsubscribe: (() => void) | null = null;

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

  async function fetchMatches(tournamentId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
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

      const [matchSnap, registrationSnap, matchScoresSnap] = await Promise.all([
        getDocs(query(collection(db, `tournaments/${tournamentId}/match`), where('stage_id', 'in', stageIds))),
        getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
        getDocs(collection(db, `tournaments/${tournamentId}/match_scores`))
      ]);

      const bracketsMatches = matchSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsMatch[];
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
      const matchScoresMap = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));

      const adaptedMatches: Match[] = [];
      const stages = stageSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const bMatch of bracketsMatches) {
        const stage = stages.find(s => s.id === bMatch.stage_id);
        const matchCategoryId = stage ? (stage as any).tournament_id : categoryId || '';

        const adapted = adaptBracketsMatchToLegacyMatch(
          bMatch,
          registrations,
          matchCategoryId,
          tournamentId
        );

        if (adapted) {
          const scoreData = matchScoresMap.get(adapted.id);
          if (scoreData) {
            if (scoreData.status) adapted.status = scoreData.status;
            if (scoreData.scores) adapted.scores = scoreData.scores;
            if (scoreData.courtId) adapted.courtId = scoreData.courtId;
            if (scoreData.scheduledTime) adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp ? scoreData.scheduledTime.toDate() : scoreData.scheduledTime;
            if (scoreData.startedAt) adapted.startedAt = scoreData.startedAt instanceof Timestamp ? scoreData.startedAt.toDate() : scoreData.startedAt;
            if (scoreData.completedAt) adapted.completedAt = scoreData.completedAt instanceof Timestamp ? scoreData.completedAt.toDate() : scoreData.completedAt;
          }
          adaptedMatches.push(adapted);
        }
      }

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

  function subscribeMatches(tournamentId: string, categoryId?: string): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }

    const unsubscibers: (() => void)[] = [];

    const refresh = async () => {
      await fetchMatches(tournamentId, categoryId);
    };

    const qMatch = collection(db, `tournaments/${tournamentId}/match`);
    const unsubMatch = onSnapshot(qMatch, () => refresh());
    unsubscibers.push(unsubMatch);

    const qScores = collection(db, `tournaments/${tournamentId}/match_scores`);
    const unsubScores = onSnapshot(qScores, () => refresh());
    unsubscibers.push(unsubScores);

    matchesUnsubscribe = () => {
      unsubscibers.forEach(u => u());
    };
  }

  async function fetchMatch(tournamentId: string, matchId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchDoc = await getDoc(doc(db, `tournaments/${tournamentId}/match`, matchId));
      if (!matchDoc.exists()) throw new Error('Match not found');

      const bMatch = { ...matchDoc.data(), id: matchDoc.id } as BracketsMatch;

      const stageDoc = await getDoc(doc(db, `tournaments/${tournamentId}/stage`, bMatch.stage_id));
      const registrationSnap = await getDocs(collection(db, `tournaments/${tournamentId}/registrations`));
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];

      const stage = stageDoc.data() as any;
      const categoryId = stage ? stage.tournament_id : '';

      const adapted = adaptBracketsMatchToLegacyMatch(
        bMatch,
        registrations,
        categoryId,
        tournamentId
      );

      if (adapted) {
        const scoreDoc = await getDoc(doc(db, `tournaments/${tournamentId}/match_scores`, matchId));
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

  function subscribeMatch(tournamentId: string, matchId: string): void {
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }

    currentMatchUnsubscribe = onSnapshot(
      doc(db, `tournaments/${tournamentId}/match`, matchId),
      async () => {
        await fetchMatch(tournamentId, matchId);
      },
      (err) => {
        console.error('Error in match subscription:', err);
        error.value = 'Lost connection to match';
      }
    );
  }

  async function startMatch(tournamentId: string, matchId: string): Promise<void> {
    try {
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          startedAt: serverTimestamp(),
          status: 'in_progress',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error starting match:', err);
      throw err;
    }
  }

  async function updateScore(
    tournamentId: string,
    matchId: string,
    participant: 'participant1' | 'participant2'
  ): Promise<void> {
    const match = currentMatch.value;
    if (!match) throw new Error('No match selected');

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
    }

    const matchResult = checkMatchComplete(scores, match.participant1Id!, match.participant2Id!);
    if (matchResult.isComplete) {
      await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!);
      return;
    }

    await setDoc(
      doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
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
    participant: 'participant1' | 'participant2'
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

    await setDoc(
      doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
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
    winnerId: string
  ): Promise<void> {
    try {
      // 1. Write final scores to match_scores
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          scores,
          winnerId,
          status: 'completed',
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
        // Don't throw - match score is saved, bracket can be fixed manually
      }
    } catch (err) {
      console.error('Error completing match:', err);
      throw err;
    }
  }

  async function resetMatch(tournamentId: string, matchId: string): Promise<void> {
    try {
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
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
    courtId: string
  ): Promise<void> {
    try {
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
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

  async function markMatchReady(tournamentId: string, matchId: string): Promise<void> {
    try {
      await setDoc(
        doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
        {
          status: 'ready',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const courtSnap = await getDoc(doc(db, `tournaments/${tournamentId}/match_scores`, matchId));
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

  async function calculateWinner(tournamentId: string, matchId: string): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId);

      const matchData = currentMatch.value;
      if (!matchData) throw new Error('Match not found');

      const participant1Id = matchData.participant1Id;
      const participant2Id = matchData.participant2Id;

      if (!participant1Id || !participant2Id) {
        throw new Error('Match is missing participants');
      }

      const games = matchData.scores;
      const gamesNeeded = Math.ceil(games.length / 2);

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

      await completeMatch(tournamentId, matchId, games, winnerId);
    } catch (err) {
      console.error('Error calculating winner:', err);
      throw err;
    }
  }

  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[]
  ): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId);
      if (!currentMatch.value) throw new Error('Match not found');

      const matchData = currentMatch.value;
      const participant1Id = matchData.participant1Id;
      const participant2Id = matchData.participant2Id;

      if (!participant1Id || !participant2Id) {
        throw new Error('Match is missing participants');
      }

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
        await completeMatch(tournamentId, matchId, games, winnerId);
      } else {
        await setDoc(
          doc(db, `tournaments/${tournamentId}/match_scores`, matchId),
          {
            scores: games,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Error submitting manual scores:', err);
      throw err;
    }
  }

  function cleanup(): void {
    if (matchesUnsubscribe) {
      matchesUnsubscribe();
      matchesUnsubscribe = null;
    }
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }
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
    participant2Id: string
  ): { isComplete: boolean; winnerId?: string } {
    const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);

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

  return {
    matches,
    currentMatch,
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
    fetchMatch,
    subscribeMatch,
    startMatch,
    updateScore,
    decrementScore,
    completeMatch,
    resetMatch,
    assignMatchToCourt,
    markMatchReady,
    calculateWinner,
    submitManualScores,
    cleanup,
    clearCurrentMatch,
  };
});
