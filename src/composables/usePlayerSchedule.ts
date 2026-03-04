import { ref, computed, watch, onUnmounted } from 'vue';
import { db, collection, query, onSnapshot } from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Match, Registration } from '@/types';

/**
 * Subscribes to all matches for a selected player's category and exposes
 * derived state: upcomingMatches, playedMatches, nextMatch.
 *
 * Can be reused by any view that needs player-centric match data.
 */
export function usePlayerSchedule(
  tournamentId: () => string,
  selectedRegistration: () => Registration | null
) {
  const playerMatches = ref<Match[]>([]);
  let matchUnsubscribe: (() => void) | null = null;

  function subscribe(categoryId: string, registrationId: string) {
    matchUnsubscribe?.();
    playerMatches.value = [];

    const path = `tournaments/${tournamentId()}/categories/${categoryId}/match_scores`;
    matchUnsubscribe = onSnapshot(query(collection(db, path)), (snapshot) => {
      const all = snapshot.docs.map(
        (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as Match
      );
      playerMatches.value = all
        .filter((m) => m.participant1Id === registrationId || m.participant2Id === registrationId)
        .sort((a, b) => (a.plannedStartAt?.getTime() ?? 0) - (b.plannedStartAt?.getTime() ?? 0));
    });
  }

  watch(
    () => selectedRegistration(),
    (reg) => {
      if (reg) {
        subscribe(reg.categoryId, reg.id);
      } else {
        matchUnsubscribe?.();
        playerMatches.value = [];
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    matchUnsubscribe?.();
  });

  const upcomingMatches = computed(() =>
    playerMatches.value.filter(
      (m) => !['completed', 'walkover', 'cancelled'].includes(m.status ?? '')
    )
  );

  const playedMatches = computed(() =>
    playerMatches.value.filter((m) => ['completed', 'walkover'].includes(m.status ?? ''))
  );

  const nextMatch = computed<Match | null>(
    () =>
      upcomingMatches.value.find((m) => m.status === 'in_progress') ??
      upcomingMatches.value.find((m) => m.status === 'ready') ??
      upcomingMatches.value[0] ??
      null
  );

  return { playerMatches, upcomingMatches, playedMatches, nextMatch };
}
