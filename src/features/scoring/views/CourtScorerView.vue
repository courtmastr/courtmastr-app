<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, onSnapshot } from 'firebase/firestore';
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
let unsubscribeCourt: (() => void) | null = null;

const currentMatchId = computed(() => court.value?.currentMatchId ?? null);

// Keep the URL matchId param in sync so ScoringInterfaceView can read route.params.matchId
watch(currentMatchId, (matchId) => {
  if (!matchId) return;
  router.replace({
    name: 'volunteer-court-scorer',
    params: {
      tournamentId: tournamentId.value,
      courtId: courtId.value,
      matchId,
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
