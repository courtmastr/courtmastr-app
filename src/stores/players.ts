// Global Player Store — find-or-create by email, cross-tournament player identity
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { GlobalPlayer } from '@/types';

export const usePlayersStore = defineStore('players', () => {
  const players = ref<GlobalPlayer[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let unsubscribeFn: (() => void) | null = null;

  /**
   * Find an existing global player by email, or create a new one.
   * Uses runTransaction for atomic check-then-write (batch cannot read).
   * Returns the globalPlayerId.
   */
  const findOrCreateByEmail = async (
    email: string,
    data: Pick<GlobalPlayer, 'firstName' | 'lastName' | 'phone' | 'skillLevel'>
  ): Promise<string> => {
    const emailNormalized = email.toLowerCase().trim();
    const indexRef = doc(db, 'playerEmailIndex', emailNormalized);

    return runTransaction(db, async (transaction) => {
      const indexSnap = await transaction.get(indexRef);

      if (indexSnap.exists()) {
        // Global player already exists — return their ID
        return indexSnap.data().playerId as string;
      }

      // Create new global player
      const newPlayerRef = doc(collection(db, 'players'));
      const now = serverTimestamp();

      transaction.set(newPlayerRef, {
        id: newPlayerRef.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        emailNormalized,
        phone: data.phone ?? null,
        skillLevel: data.skillLevel ?? null,
        userId: null,
        isActive: true,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
        stats: {
          overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
        },
      });

      transaction.set(indexRef, {
        playerId: newPlayerRef.id,
        createdAt: now,
      });

      return newPlayerRef.id;
    });
  };

  const fetchPlayers = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const q = query(collection(db, 'players'), orderBy('lastName'), orderBy('firstName'));
      const snap = await getDocs(q);
      players.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer
      );
    } catch (err) {
      error.value = 'Failed to fetch players';
      console.error('Error fetching players:', err);
    } finally {
      loading.value = false;
    }
  };

  const subscribePlayers = (): void => {
    if (unsubscribeFn) return;
    const q = query(collection(db, 'players'), orderBy('lastName'), orderBy('firstName'));
    unsubscribeFn = onSnapshot(q, (snap) => {
      players.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer
      );
    });
  };

  const getPlayerById = (id: string): GlobalPlayer | undefined =>
    players.value.find((p) => p.id === id);

  const updatePlayer = async (id: string, updates: Partial<GlobalPlayer>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'players', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating player:', err);
      throw err;
    }
  };

  const fetchPlayerById = async (id: string): Promise<GlobalPlayer | null> => {
    try {
      const snap = await getDoc(doc(db, 'players', id));
      if (!snap.exists()) return null;
      return convertTimestamps({ id: snap.id, ...snap.data() }) as GlobalPlayer;
    } catch (err) {
      console.error('Error fetching player:', err);
      throw err;
    }
  };

  const fetchOrgPlayers = async (orgTournamentIds: string[]): Promise<void> => {
    if (orgTournamentIds.length === 0) {
      players.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      // Collect unique globalPlayerIds from all tournament player mirrors
      const seenIds = new Set<string>();
      await Promise.all(
        orgTournamentIds.map(async (tournamentId) => {
          const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'players'));
          snap.docs.forEach((d) => {
            const gid = (d.data().globalPlayerId as string) || d.id;
            seenIds.add(gid);
          });
        })
      );

      if (seenIds.size === 0) {
        players.value = [];
        return;
      }

      // Fetch global player records
      const playerDocs = await Promise.all(
        Array.from(seenIds).map((id) => getDoc(doc(db, 'players', id)))
      );
      players.value = playerDocs
        .filter((d) => d.exists())
        .map((d) => convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer);
    } catch (err) {
      error.value = 'Failed to fetch org players';
      console.error('Error fetching org players:', err);
    } finally {
      loading.value = false;
    }
  };

  const unsubscribe = (): void => {
    unsubscribeFn?.();
    unsubscribeFn = null;
  };

  return {
    players,
    loading,
    error,
    findOrCreateByEmail,
    fetchPlayers,
    fetchOrgPlayers,
    subscribePlayers,
    getPlayerById,
    updatePlayer,
    fetchPlayerById,
    unsubscribe,
  };
});
