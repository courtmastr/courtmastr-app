import { ref, onUnmounted } from 'vue';
import type { Transaction } from 'firebase/firestore';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy,
  limit,
  doc,
  runTransaction,
  serverTimestamp,
} from '@/services/firebase';

export function useAutoAssignment(tournamentId: string) {
  const enabled = ref(true);
  const paused = ref(false);
  const processing = ref(false);
  const lastAssignment = ref<Date | null>(null);

  let courtsUnsubscribe: (() => void) | null = null;

  function start() {
    const courtsQuery = query(
      collection(db, `tournaments/${tournamentId}/courts`),
      where('status', '==', 'available')
    );

    courtsUnsubscribe = onSnapshot(courtsQuery, async (snapshot) => {
      if (!enabled.value || paused.value || processing.value) return;

      const availableCourts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      for (const court of availableCourts) {
        if (!enabled.value || paused.value || processing.value) break;
        await assignNextMatchToCourt(court.id);
      }
    });
  }

  async function assignNextMatchToCourt(courtId: string): Promise<void> {
    processing.value = true;

    try {
      await runTransaction(db, async (transaction: Transaction) => {
        const courtRef = doc(db, `tournaments/${tournamentId}/courts`, courtId);
        const courtDoc = await transaction.get(courtRef);

        if (!courtDoc.exists() || courtDoc.data().status !== 'available') {
          throw new Error('Court no longer available');
        }

        const queueQuery = query(
          collection(db, `tournaments/${tournamentId}/match_scores`),
          where('status', '==', 'scheduled'),
          where('courtId', '==', null),
          orderBy('queuePosition', 'asc'),
          limit(1)
        );

        const queueSnapshot = await getDocs(queueQuery);
        if (queueSnapshot.empty) return;

        const matchDoc = queueSnapshot.docs[0];

        transaction.update(doc(db, `tournaments/${tournamentId}/match_scores`, matchDoc.id), {
          courtId,
          status: 'ready',
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(courtRef, {
          status: 'in_use',
          currentMatchId: matchDoc.id,
          assignedMatchId: matchDoc.id,
          updatedAt: serverTimestamp(),
        });
      });

      lastAssignment.value = new Date();
    } catch (error) {
      console.error('Error assigning match to court:', error);
    } finally {
      processing.value = false;
    }
  }

  function pause() {
    paused.value = true;
  }

  function resume() {
    paused.value = false;
  }

  function stop() {
    if (courtsUnsubscribe) {
      courtsUnsubscribe();
      courtsUnsubscribe = null;
    }
  }

  onUnmounted(() => {
    stop();
  });

  return {
    enabled,
    paused,
    processing,
    lastAssignment,
    start,
    pause,
    resume,
    stop,
  };
}
