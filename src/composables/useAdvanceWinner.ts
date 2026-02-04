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
    winnerId: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
      const storage = new ClientFirestoreStorage(db, rootPath);
      const manager = new BracketsManager(storage);

      const match = await manager.storage.select('match', matchId);
      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      const opponent1Id = String(match.opponent1?.id ?? '');
      const opponent2Id = String(match.opponent2?.id ?? '');

      const isOpponent1Winner = winnerId === opponent1Id;
      const isOpponent2Winner = winnerId === opponent2Id;

      if (!isOpponent1Winner && !isOpponent2Winner) {
        console.warn('Winner ID does not match any opponent', {
          winnerId,
          opponent1Id,
          opponent2Id
        });
      }

      await manager.update.match({
        id: matchId,
        opponent1: {
          result: isOpponent1Winner ? 'win' : 'loss'
        },
        opponent2: {
          result: isOpponent2Winner ? 'win' : 'loss'
        }
      });
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
