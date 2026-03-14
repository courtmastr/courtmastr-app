<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import courtmasterMarkWhite from '@/assets/brand/courtmaster-mark-white.svg';
import type { Match } from '@/types';

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const matchId = computed(() => route.params.matchId as string);
const tournamentId = computed(() => route.params.tournamentId as string);
const categoryId = computed(() => route.query.category as string | undefined);
const theme = computed(() => {
  const t = route.query.theme as string;
  return t === 'light' ? 'light' : 'dark';
});
const position = computed(() => {
  const p = route.query.position as string;
  if (p === 'bottom-left') return 'position-bottom-left';
  if (p === 'bottom-right') return 'position-bottom-right';
  if (p === 'top-left') return 'position-top-left';
  if (p === 'top-right') return 'position-top-right';
  return ''; // Centered bottom (default)
});

const loading = ref(true);
const error = ref<string | null>(null);

const match = computed<Match | null>(() => matchStore.currentMatch);

const p1Name = computed(() => getParticipantName(match.value?.participant1Id));
const p2Name = computed(() => getParticipantName(match.value?.participant2Id));

const currentGame = computed(() => {
  if (!match.value?.scores?.length) {
    return { score1: 0, score2: 0 };
  }
  const scores = match.value.scores;
  const incompleteGame = scores.find((s) => !s.isComplete);
  if (incompleteGame) {
    return incompleteGame;
  }
  return scores[scores.length - 1];
});

const gamesWon1 = computed(() => {
  if (!match.value?.scores?.length || !match.value.participant1Id) return 0;
  return match.value.scores.filter(
    (s) => s.isComplete && s.winnerId === match.value!.participant1Id
  ).length;
});

const gamesWon2 = computed(() => {
  if (!match.value?.scores?.length || !match.value.participant2Id) return 0;
  return match.value.scores.filter(
    (s) => s.isComplete && s.winnerId === match.value!.participant2Id
  ).length;
});

const isLive = computed(() => match.value?.status === 'in_progress');
const courtName = computed(() => match.value?.courtName);
const categoryName = computed(() => match.value?.categoryName);

onMounted(async () => {
  try {
    loading.value = true;
    error.value = null;

    await tournamentStore.fetchTournament(tournamentId.value);
    await matchStore.fetchMatch(
      tournamentId.value,
      matchId.value,
      categoryId.value
    );
    matchStore.subscribeMatch(
      tournamentId.value,
      matchId.value,
      categoryId.value
    );

    registrationStore.subscribeRegistrations(tournamentId.value);
    registrationStore.subscribePlayers(tournamentId.value);
  } catch (err) {
    console.error('Error loading OBS score bug:', err);
    error.value = 'Failed to load match';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  matchStore.clearCurrentMatch();
  registrationStore.unsubscribeAll();
  tournamentStore.unsubscribeAll();
});
</script>

<template>
  <div :class="['obs-score-bug', `obs-score-bug--${theme}`, position]">
    <template v-if="loading">
      <div class="score-bug-loading">
        Loading...
      </div>
    </template>

    <template v-else-if="error || !match">
      <div class="score-bug-loading">
        {{ error || 'No Match' }}
      </div>
    </template>

    <template v-else>
      <!-- Court badge -->
      <div
        v-if="courtName"
        class="score-bug-court"
      >
        {{ courtName }}
      </div>

      <!-- Left Team -->
      <div class="score-bug-team score-bug-team--left">
        <span class="score-bug-name">{{ p1Name }}</span>
        <span class="score-bug-games">{{ gamesWon1 }}</span>
        <span class="score-bug-points">{{ currentGame.score1 }}</span>
      </div>

      <!-- Center (VS or Live) -->
      <div class="score-bug-center">
        <template v-if="isLive">
          <div class="score-bug-live">
            <span class="score-bug-live-dot" />
            <span>LIVE</span>
          </div>
        </template>
        <template v-else>
          <span class="score-bug-vs">VS</span>
        </template>
      </div>

      <!-- Right Team -->
      <div class="score-bug-team score-bug-team--right">
        <span class="score-bug-points">{{ currentGame.score2 }}</span>
        <span class="score-bug-games">{{ gamesWon2 }}</span>
        <span class="score-bug-name">{{ p2Name }}</span>
      </div>

      <!-- Category info -->
      <div
        v-if="categoryName"
        class="score-bug-info"
      >
        {{ categoryName }}
      </div>
    </template>

    <div
      class="obs-courtmaster-watermark"
      aria-hidden="true"
    >
      <img
        :src="courtmasterMarkWhite"
        alt=""
        width="16"
        height="16"
        class="obs-courtmaster-watermark__logo"
      >
      <span class="obs-courtmaster-watermark__text">CourtMastr</span>
    </div>
  </div>
</template>

<style scoped>
@import '../obs.css';
</style>
