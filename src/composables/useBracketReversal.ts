// Bracket Reversal Composable
// Handles reversing bracket advancement when match winners change

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from '@/services/firebase';
import { logger } from '@/utils/logger';

export function useBracketReversal() {

  /**
   * Reverse a winner's advancement through the bracket
   * Removes the participant from all subsequent matches
   */
  async function reverseWinnerAdvancement(
    tournamentId: string,
    sourceMatchId: string,
    winnerRegistrationId: string,
    categoryId?: string
  ): Promise<void> {
    logger.debug('[reverseWinnerAdvancement] Starting reversal:', {
      tournamentId,
      sourceMatchId,
      winnerRegistrationId,
      categoryId,
    });

    const basePath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}`
      : `tournaments/${tournamentId}`;

    // Find the participant record for this registration
    const participantQuery = query(
      collection(db, `${basePath}/participant`),
      where('name', '==', winnerRegistrationId)
    );
    const participantSnap = await getDocs(participantQuery);
    
    if (participantSnap.empty) {
      logger.warn('[reverseWinnerAdvancement] No participant found for registration:', winnerRegistrationId);
      return;
    }

    const participantId = participantSnap.docs[0].id;

    // Find all matches where this participant appears as an opponent
    const matchesQuery = query(
      collection(db, `${basePath}/match`),
      where('opponent1.id', '==', participantId)
    );
    
    const matchesQuery2 = query(
      collection(db, `${basePath}/match`),
      where('opponent2.id', '==', participantId)
    );

    const [matchesSnap1, matchesSnap2] = await Promise.all([
      getDocs(matchesQuery),
      getDocs(matchesQuery2),
    ]);

    const allMatches = [...matchesSnap1.docs, ...matchesSnap2.docs];
    
    if (allMatches.length === 0) {
      logger.debug('[reverseWinnerAdvancement] No subsequent matches found');
      return;
    }

    logger.debug(`[reverseWinnerAdvancement] Found ${allMatches.length} matches to clean up`);

    const batch = writeBatch(db);
    const matchesToReset: string[] = [];

    for (const matchDoc of allMatches) {
      const matchData = matchDoc.data();
      
      // Skip the source match itself
      if (matchDoc.id === sourceMatchId) continue;

      // Clear opponent slot
      if (matchData.opponent1?.id === participantId) {
        batch.update(matchDoc.ref, {
          'opponent1.id': null,
          'opponent1.registrationId': null,
          'opponent1.position': null,
          updatedAt: serverTimestamp(),
        });
      }
      
      if (matchData.opponent2?.id === participantId) {
        batch.update(matchDoc.ref, {
          'opponent2.id': null,
          'opponent2.registrationId': null,
          'opponent2.position': null,
          updatedAt: serverTimestamp(),
        });
      }

      // If this match was completed, we need to reset it too
      if (matchData.status === 4) { // 4 = completed in brackets-manager
        matchesToReset.push(matchDoc.id);
        batch.update(matchDoc.ref, {
          status: 2, // 2 = waiting in brackets-manager
          opponent1: { id: null, position: null },
          opponent2: { id: null, position: null },
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    logger.debug(`[reverseWinnerAdvancement] Cleared ${allMatches.length} matches, ${matchesToReset.length} need recursive reset`);

    // Recursively reset downstream matches
    for (const matchId of matchesToReset) {
      // Find who won this match and reverse their advancement too
      const matchScoresPath = categoryId
        ? `${basePath}/match_scores/${matchId}`
        : `${basePath}/match_scores/${matchId}`;
      
      const matchScoreDoc = await getDoc(doc(db, matchScoresPath));
      if (matchScoreDoc.exists()) {
        const scoreData = matchScoreDoc.data();
        if (scoreData.winnerId && scoreData.winnerId !== winnerRegistrationId) {
          // This match had a different winner, reverse them too
          await reverseWinnerAdvancement(tournamentId, matchId, scoreData.winnerId, categoryId);
        }
      }
    }
  }

  /**
   * Handle winner change - reverse old winner and advance new winner
   */
  async function handleWinnerChange(
    tournamentId: string,
    matchId: string,
    oldWinnerId: string | undefined,
    newWinnerId: string | undefined,
    categoryId?: string
  ): Promise<void> {
    logger.debug('[handleWinnerChange] Processing winner change:', {
      tournamentId,
      matchId,
      oldWinnerId,
      newWinnerId,
      categoryId,
    });

    // 1. Reverse old winner's advancement
    if (oldWinnerId) {
      await reverseWinnerAdvancement(tournamentId, matchId, oldWinnerId, categoryId);
    }

    // 2. Advance new winner (use existing logic)
    if (newWinnerId) {
      const { useAdvanceWinner } = await import('@/composables/useAdvanceWinner');
      const advancer = useAdvanceWinner();
      await advancer.advanceWinner(tournamentId, categoryId || '', matchId, newWinnerId);
    }

    logger.debug('[handleWinnerChange] Winner change complete');
  }

  return {
    reverseWinnerAdvancement,
    handleWinnerChange,
  };
}
