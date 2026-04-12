import { ref, onUnmounted } from 'vue';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from '@/services/firebase';
import { useMatchStore } from '@/stores/matches';
import { logger } from '@/utils/logger';

interface QueueCandidate {
  matchId: string;
  categoryId: string;
  levelId?: string;
  queuePosition: number;
  plannedStartAtMs: number;
}

function asTimestampMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toDate().getTime();
  return Number.MAX_SAFE_INTEGER;
}

function isPublished(data: Record<string, unknown>): boolean {
  return data.scheduleStatus === 'published' || Boolean(data.publishedAt);
}

function hasPlannedTime(data: Record<string, unknown>): boolean {
  return Boolean(data.plannedStartAt || data.scheduledTime);
}

export function useAutoAssignment(tournamentId: string) {
  const matchStore = useMatchStore();
  const enabled = ref(true);
  const paused = ref(false);
  const processing = ref(false);
  const lastAssignment = ref<Date | null>(null);

  let courtsUnsubscribe: (() => void) | null = null;

  async function loadQueueCandidates(): Promise<QueueCandidate[]> {
    const categorySnap = await getDocs(collection(db, `tournaments/${tournamentId}/categories`));
    const candidates: QueueCandidate[] = [];

    for (const categoryDoc of categorySnap.docs) {
      const categoryId = categoryDoc.id;

      const baseQueueSnap = await getDocs(
        query(
          collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores`),
          where('status', '==', 'scheduled'),
          where('courtId', '==', null)
        )
      );

      for (const matchDoc of baseQueueSnap.docs) {
        const data = matchDoc.data() as Record<string, unknown>;
        if (!hasPlannedTime(data) || !isPublished(data)) continue;

        candidates.push({
          matchId: matchDoc.id,
          categoryId,
          queuePosition: Number(data.queuePosition ?? Number.MAX_SAFE_INTEGER),
          plannedStartAtMs: asTimestampMs(data.plannedStartAt ?? data.scheduledTime),
        });
      }

      const levelSnap = await getDocs(collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`));
      for (const levelDoc of levelSnap.docs) {
        const levelId = levelDoc.id;
        const levelQueueSnap = await getDocs(
          query(
            collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`),
            where('status', '==', 'scheduled'),
            where('courtId', '==', null)
          )
        );

        for (const matchDoc of levelQueueSnap.docs) {
          const data = matchDoc.data() as Record<string, unknown>;
          if (!hasPlannedTime(data) || !isPublished(data)) continue;

          candidates.push({
            matchId: matchDoc.id,
            categoryId,
            levelId,
            queuePosition: Number(data.queuePosition ?? Number.MAX_SAFE_INTEGER),
            plannedStartAtMs: asTimestampMs(data.plannedStartAt ?? data.scheduledTime),
          });
        }
      }
    }

    candidates.sort((a, b) => {
      if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition;
      return a.plannedStartAtMs - b.plannedStartAtMs;
    });

    return candidates;
  }

  function start() {
    const courtsQuery = query(
      collection(db, `tournaments/${tournamentId}/courts`),
      where('status', '==', 'available')
    );

    courtsUnsubscribe = onSnapshot(courtsQuery, async (snapshot) => {
      if (!enabled.value || paused.value || processing.value) return;

      const availableCourts = snapshot.docs.map((courtDoc) => ({ id: courtDoc.id, ...courtDoc.data() }));

      for (const court of availableCourts) {
        if (!enabled.value || paused.value || processing.value) break;
        await assignNextMatchToCourt(court.id);
      }
    });
  }

  async function assignNextMatchToCourt(courtId: string): Promise<void> {
    processing.value = true;

    try {
      const courtRef = doc(db, `tournaments/${tournamentId}/courts`, courtId);
      const courtDoc = await getDoc(courtRef);
      if (!courtDoc.exists() || courtDoc.data().status !== 'available') {
        return;
      }

      const candidates = await loadQueueCandidates();
      if (candidates.length === 0) return;

      for (const candidate of candidates) {
        try {
          await matchStore.assignCourt(
            tournamentId,
            candidate.matchId,
            courtId,
            candidate.categoryId,
            candidate.levelId
          );
          lastAssignment.value = new Date();
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('Blocked:')) {
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      logger.error('Error assigning match to court:', error);
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
