import { ref } from 'vue';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import { db } from '@/services/firebase';

export function useAdvanceWinner() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function advanceWinner(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    winnerId: string,
    levelId?: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const rootPath = levelId
        ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`
        : `tournaments/${tournamentId}/categories/${categoryId}`;
      const storage = new ClientFirestoreStorage(db, rootPath);
      const manager = new BracketsManager(storage);

      const match = await manager.storage.select('match', matchId);
      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      // Get participants to convert registration ID to participant ID
      // In brackets-manager: opponent.id = participant.id (numeric)
      // In our system: participant.name = registration ID (Firestore doc ID)
      const participants = await manager.storage.select('participant');

      if (!participants || participants.length === 0) {
        throw new Error('No participants found in tournament');
      }

      const opponent1Id = String(match.opponent1?.id ?? '');
      const opponent2Id = String(match.opponent2?.id ?? '');

      console.log('[advanceWinner] Match opponents:', {
        matchId,
        opponent1Id,
        opponent2Id,
        winnerRegistrationId: winnerId
      });

      // Find participant by registration ID (stored in participant.name field)
      const winnerParticipant = participants.find(p => String(p.name) === winnerId);
      if (!winnerParticipant) {
        console.error('[advanceWinner] Winner participant not found', {
          winnerId,
          allParticipants: participants.map(p => ({ id: p.id, name: p.name }))
        });
        throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
      }

      const winnerParticipantId = String(winnerParticipant.id);
      console.log('[advanceWinner] Found winner participant:', {
        registrationId: winnerId,
        participantId: winnerParticipantId
      });

      const isOpponent1Winner = winnerParticipantId === opponent1Id;
      const isOpponent2Winner = winnerParticipantId === opponent2Id;

      if (!isOpponent1Winner && !isOpponent2Winner) {
        console.error('[advanceWinner] Winner participant ID does not match any opponent', {
          winnerParticipantId,
          opponent1Id,
          opponent2Id
        });
        throw new Error('Winner participant ID does not match any opponent in the match');
      }

      console.log('[advanceWinner] Updating match results:', {
        matchId,
        opponent1Result: isOpponent1Winner ? 'win' : 'loss',
        opponent2Result: isOpponent2Winner ? 'win' : 'loss'
      });

      await manager.update.match({
        id: matchId,
        opponent1: {
          result: isOpponent1Winner ? 'win' : 'loss'
        },
        opponent2: {
          result: isOpponent2Winner ? 'win' : 'loss'
        }
      });

      console.log('[advanceWinner] ✅ Bracket updated successfully');
    } catch (err) {
      console.error('Error advancing winner:', err);
      error.value = err instanceof Error ? err.message : 'Failed to advance winner';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    advanceWinner
  };
}
