<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useTournamentStore } from '@/stores/tournaments';
import type { Court } from '@/types';

const ScoringInterfaceView = defineAsyncComponent(
  () => import('@/features/scoring/views/ScoringInterfaceView.vue')
);

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const courtId = computed(() => route.params.courtId as string);

const court = ref<Court | null>(null);
const courtNotFound = ref(false);
const scoringScope = ref<{ matchId: string; categoryId?: string; levelId?: string } | null>(null);
let unsubscribeCourt: (() => void) | null = null;

interface MatchScoreScopeData {
  courtId?: string | null;
  status?: string | null;
  updatedAt?: { toDate?: () => Date } | Date | null;
  assignedAt?: { toDate?: () => Date } | Date | null;
  startedAt?: { toDate?: () => Date } | Date | null;
  scheduledTime?: { toDate?: () => Date } | Date | null;
}

interface MatchScopeCandidate {
  categoryId: string;
  levelId?: string;
  courtMatches: boolean;
  statusRank: number;
  updatedAtMs: number;
}

const currentMatchId = computed(() => court.value?.currentMatchId ?? null);
const scoringRouteReady = computed(() => {
  if (!currentMatchId.value || !scoringScope.value) return false;
  if (scoringScope.value.matchId !== currentMatchId.value) return false;

  return (
    route.params.matchId === currentMatchId.value &&
    (route.query.category as string | undefined) === scoringScope.value.categoryId &&
    (route.query.level as string | undefined) === scoringScope.value.levelId
  );
});

const MATCH_STATUS_PRIORITY: Record<string, number> = {
  in_progress: 3,
  ready: 2,
  scheduled: 1,
};

const toMillis = (value: MatchScoreScopeData[keyof MatchScoreScopeData]): number => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  return 0;
};

const pickScopeTimestamp = (scoreData: MatchScoreScopeData | undefined): number => {
  const timestamps = [
    scoreData?.updatedAt,
    scoreData?.assignedAt,
    scoreData?.startedAt,
    scoreData?.scheduledTime,
  ];

  for (const candidate of timestamps) {
    const millis = toMillis(candidate);
    if (millis > 0) return millis;
  }

  return 0;
};

const buildMatchScopeCandidate = async (
  matchId: string,
  categoryId: string,
  levelId?: string,
): Promise<MatchScopeCandidate | null> => {
  const basePath = levelId
    ? `tournaments/${tournamentId.value}/categories/${categoryId}/levels/${levelId}`
    : `tournaments/${tournamentId.value}/categories/${categoryId}`;

  const [matchSnap, scoreSnap] = await Promise.all([
    getDoc(doc(db, `${basePath}/match/${matchId}`)),
    getDoc(doc(db, `${basePath}/match_scores/${matchId}`)),
  ]);

  if (!matchSnap.exists() && !scoreSnap.exists()) {
    return null;
  }

  const scoreData = scoreSnap.exists() ? scoreSnap.data() as MatchScoreScopeData : undefined;
  const status = typeof scoreData?.status === 'string' ? scoreData.status : '';

  return {
    categoryId,
    levelId,
    courtMatches: scoreData?.courtId === courtId.value,
    statusRank: MATCH_STATUS_PRIORITY[status] ?? 0,
    updatedAtMs: pickScopeTimestamp(scoreData),
  };
};

const resolveMatchScope = async (matchId: string): Promise<{ categoryId?: string; levelId?: string }> => {
  const candidates: MatchScopeCandidate[] = [];

  for (const category of tournamentStore.categories) {
    const baseCandidate = await buildMatchScopeCandidate(matchId, category.id);
    if (baseCandidate) {
      candidates.push(baseCandidate);
    }

    const levelsSnap = await getDocs(
      collection(db, `tournaments/${tournamentId.value}/categories/${category.id}/levels`)
    );

    for (const levelDoc of levelsSnap.docs) {
      const levelCandidate = await buildMatchScopeCandidate(matchId, category.id, levelDoc.id);
      if (levelCandidate) {
        candidates.push(levelCandidate);
      }
    }
  }

  const bestCandidate = candidates.sort((left, right) =>
    Number(right.courtMatches) - Number(left.courtMatches)
    || right.statusRank - left.statusRank
    || right.updatedAtMs - left.updatedAtMs
  )[0];

  return bestCandidate
    ? { categoryId: bestCandidate.categoryId, levelId: bestCandidate.levelId }
    : {};
};

// Keep the URL matchId param in sync so ScoringInterfaceView can read route.params.matchId
watch(currentMatchId, async (matchId) => {
  scoringScope.value = null;
  if (!matchId) return;

  const scope = await resolveMatchScope(matchId);
  scoringScope.value = { matchId, ...scope };

  await router.replace({
    name: 'volunteer-court-scorer',
    params: {
      tournamentId: tournamentId.value,
      courtId: courtId.value,
      matchId,
    },
    query: {
      ...(scope.categoryId ? { category: scope.categoryId } : {}),
      ...(scope.levelId ? { level: scope.levelId } : {}),
    },
  });
}, { immediate: true });

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    courtNotFound.value = true;
    return;
  }

  const courtRef = doc(db, `tournaments/${tournamentId.value}/courts/${courtId.value}`);
  unsubscribeCourt = onSnapshot(courtRef, (snap) => {
    if (!snap.exists()) {
      courtNotFound.value = true;
      return;
    }
    court.value = { id: snap.id, ...snap.data() } as Court;
  });
});

onUnmounted(() => {
  unsubscribeCourt?.();
});
</script>

<template>
  <div class="court-scorer-root">
    <!-- Court not found -->
    <div
      v-if="courtNotFound"
      class="court-scorer-waiting"
    >
      <v-icon
        size="64"
        color="grey-lighten-2"
        class="mb-4"
      >
        mdi-alert-circle-outline
      </v-icon>
      <div class="text-h6 text-grey">
        Court not found
      </div>
    </div>

    <!-- No match currently assigned to this court -->
    <div
      v-else-if="!currentMatchId"
      class="court-scorer-waiting"
    >
      <v-icon
        size="64"
        color="grey-lighten-2"
        class="mb-4"
      >
        mdi-tennis-ball
      </v-icon>
      <div class="text-h6 text-grey">
        Waiting for match assignment
      </div>
      <div class="text-body-2 text-grey mt-2">
        {{ court?.name ?? 'This court' }} has no match assigned yet.
      </div>
      <div class="text-caption text-grey mt-2">
        This page will update automatically when a match is assigned.
      </div>
    </div>

    <div
      v-else-if="!scoringRouteReady"
      class="court-scorer-waiting"
    >
      <v-progress-circular
        indeterminate
        size="52"
        color="primary"
        class="mb-4"
      />
      <div class="text-h6 text-grey">
        Preparing scorer view
      </div>
      <div class="text-body-2 text-grey mt-2">
        Resolving match details for {{ court?.name ?? 'this court' }}.
      </div>
    </div>

    <!-- Match assigned: mount ScoringInterfaceView, keyed by matchId so it re-mounts on court reassignment -->
    <ScoringInterfaceView
      v-else
      :key="currentMatchId"
    />
  </div>
</template>

<style scoped>
.court-scorer-root {
  min-height: 100vh;
}

.court-scorer-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
}
</style>
