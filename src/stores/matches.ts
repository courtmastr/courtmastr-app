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
import { adaptBracketsMatchToLegacyMatch, type BracketsMatch, type Participant } from './bracketMatchAdapter';

export const useMatchStore = defineStore('matches', () => {
  const matches = ref<Match[]>([]);
  const currentMatch = ref<Match | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let matchesUnsubscribe: (() => void) | null = null;
  let currentMatchUnsubscribe: (() => void) | null = null;

  function getMatchScoresPath(tournamentId: string, categoryId?: string): string {
    return categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;
  }

  function getMatchPath(tournamentId: string, categoryId?: string): string {
    return categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match`
      : `tournaments/${tournamentId}/match`;
  }

  function getStagePath(tournamentId: string, categoryId?: string): string {
    return categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/stage`
      : `tournaments/${tournamentId}/stage`;
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

  async function fetchMatches(tournamentId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      // Build category-level paths for bracket data
      const stagePath = categoryId 
        ? `tournaments/${tournamentId}/categories/${categoryId}/stage`
        : `tournaments/${tournamentId}/stage`;
      const matchPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match`
        : `tournaments/${tournamentId}/match`;
      const matchScoresPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
        : `tournaments/${tournamentId}/match_scores`;
      const participantPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/participant`
        : `tournaments/${tournamentId}/participant`;

      let stageQuery;
      if (categoryId) {
        stageQuery = query(
          collection(db, stagePath),
          where('tournament_id', '==', categoryId)
        );
      } else {
        stageQuery = collection(db, stagePath);
      }
      const stageSnap = await getDocs(stageQuery);
      const stageIds = stageSnap.docs.map(d => d.id);

      if (stageIds.length === 0) {
        matches.value = [];
        return;
      }

      const numericStageIds = stageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

      const [matchSnap, registrationSnap, matchScoresSnap, participantSnap] = await Promise.all([
        getDocs(query(collection(db, matchPath), where('stage_id', 'in', numericStageIds))),
        getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
        getDocs(collection(db, matchScoresPath)),
        getDocs(collection(db, participantPath))
      ]);

      const bracketsMatches = matchSnap.docs.map(d => ({ ...d.data(), id: d.id })) as BracketsMatch[];
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
      const matchScoresMap = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));
      const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];

      const adaptedMatches: Match[] = [];
      const stages = stageSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const bMatch of bracketsMatches) {
        const stage = stages.find(s => s.id === bMatch.stage_id);
        const matchCategoryId = stage ? (stage as any).tournament_id : categoryId || '';

        const adapted = adaptBracketsMatchToLegacyMatch(
          bMatch,
          registrations,
          participants,
          matchCategoryId,
          tournamentId
        );

        if (adapted) {
          const scoreData = matchScoresMap.get(adapted.id);
          if (scoreData) {
            // STATUS HANDLING:
            // - /match.status (number 0-4) - brackets-manager internal use only
            // - /match_scores.status (string) - authoritative for UI display
            // - Always use match_scores.status when available
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

    // Build category-level paths for subscriptions
    const matchPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match`
      : `tournaments/${tournamentId}/match`;
    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

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

  async function fetchMatch(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const matchPath = getMatchPath(tournamentId, categoryId);
      const matchDoc = await getDoc(doc(db, matchPath, matchId));
      if (!matchDoc.exists()) throw new Error('Match not found');

      const bMatch = { ...matchDoc.data(), id: matchDoc.id } as BracketsMatch;

      const stagePath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/stage`
        : `tournaments/${tournamentId}/stage`;
      const participantPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/participant`
        : `tournaments/${tournamentId}/participant`;
      const stageDoc = await getDoc(doc(db, stagePath, bMatch.stage_id));
      const registrationSnap = await getDocs(collection(db, `tournaments/${tournamentId}/registrations`));
      const participantSnap = await getDocs(collection(db, participantPath));
      const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
      const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];

      const stage = stageDoc.data() as any;
      const matchCategoryId = stage ? stage.tournament_id : categoryId || '';

      const adapted = adaptBracketsMatchToLegacyMatch(
        bMatch,
        registrations,
        participants,
        matchCategoryId,
        tournamentId
      );

      if (adapted) {
        const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
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

  function subscribeMatch(tournamentId: string, matchId: string, categoryId?: string): void {
    if (currentMatchUnsubscribe) {
      currentMatchUnsubscribe();
      currentMatchUnsubscribe = null;
    }

    const matchPath = getMatchPath(tournamentId, categoryId);
    currentMatchUnsubscribe = onSnapshot(
      doc(db, matchPath, matchId),
      async () => {
        await fetchMatch(tournamentId, matchId, categoryId);
      },
      (err) => {
        console.error('Error in match subscription:', err);
        error.value = 'Lost connection to match';
      }
    );
  }

  async function startMatch(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
    try {
      const matchScoresPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
        : `tournaments/${tournamentId}/match_scores`;
      await setDoc(
        doc(db, matchScoresPath, matchId),
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
    participant: 'participant1' | 'participant2',
    categoryId?: string
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
      await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!, categoryId);
      return;
    }

    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

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
    categoryId?: string
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

    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

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
    categoryId?: string
  ): Promise<void> {
    try {
      const matchScoresPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
        : `tournaments/${tournamentId}/match_scores`;
      const matchPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match`
        : `tournaments/${tournamentId}/match`;

      // 1. Write final scores to match_scores
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

      // 2. Call Cloud Function to advance bracket
      try {
        const updateMatchFn = httpsCallable(functions, 'updateMatch');
        let bracketWinnerId: string | number = winnerId;

        try {
          const matchDoc = await getDoc(doc(db, matchPath, matchId));
          if (matchDoc.exists()) {
            const bMatch = matchDoc.data() as BracketsMatch;
            const opponent1 = bMatch.opponent1;
            const opponent2 = bMatch.opponent2;
            const opponent1RegistrationId = opponent1?.registrationId ?? opponent1?.id?.toString();
            const opponent2RegistrationId = opponent2?.registrationId ?? opponent2?.id?.toString();

            if (opponent1RegistrationId === winnerId) {
              bracketWinnerId = opponent1?.id ?? winnerId;
            } else if (opponent2RegistrationId === winnerId) {
              bracketWinnerId = opponent2?.id ?? winnerId;
            } else if (opponent1?.id?.toString() === winnerId) {
              bracketWinnerId = opponent1.id;
            } else if (opponent2?.id?.toString() === winnerId) {
              bracketWinnerId = opponent2.id;
            } else {
              console.warn('[completeMatch] Winner registration ID did not match bracket opponents', {
                matchId,
                winnerId,
                opponent1Id: opponent1?.id,
                opponent2Id: opponent2?.id,
                opponent1RegistrationId,
                opponent2RegistrationId,
              });
            }
          } else {
            console.warn('[completeMatch] Bracket match not found for winner mapping', { matchId });
          }
        } catch (mapErr) {
          console.warn('[completeMatch] Failed to map winner to bracket opponent ID', mapErr);
        }

        await updateMatchFn({
          tournamentId,
          matchId,
          status: 'completed',
          winnerId: bracketWinnerId,
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

  async function resetMatch(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
    try {
      const matchScoresPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
        : `tournaments/${tournamentId}/match_scores`;
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
    categoryId?: string
  ): Promise<void> {
    try {
      const matchScoresPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
        : `tournaments/${tournamentId}/match_scores`;
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

  async function markMatchReady(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
    try {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
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

  async function calculateWinner(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId, categoryId);

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

      await completeMatch(tournamentId, matchId, games, winnerId, categoryId);
    } catch (err) {
      console.error('Error calculating winner:', err);
      throw err;
    }
  }

  async function submitManualScores(
    tournamentId: string,
    matchId: string,
    games: GameScore[],
    categoryId?: string
  ): Promise<void> {
    try {
      await fetchMatch(tournamentId, matchId, categoryId);
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
        await completeMatch(tournamentId, matchId, games, winnerId, categoryId);
      } else {
        const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
        await setDoc(
          doc(db, matchScoresPath, matchId),
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
    assignCourt: assignMatchToCourt,
    markMatchReady,
    calculateWinner,
    submitManualScores,
    unsubscribeAll,
    cleanup,
    clearCurrentMatch,
  };
});
