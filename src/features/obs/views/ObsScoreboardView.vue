<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import BrandLogo from '@/components/common/BrandLogo.vue';
import type { Match, GameScore } from '@/types';

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const categoryFilter = computed(() => route.query.category as string | undefined);
const theme = computed(() => {
  const t = route.query.theme as string;
  return t === 'light' ? 'light' : 'dark';
});
const viewMode = computed(() => {
  const mode = route.query.mode as string;
  return mode === 'ticker' ? 'ticker' : 'full';
});

usePublicPageMetadata({
  title: 'OBS Scoreboard Overlay',
  description: 'CourtMastr OBS scoreboard overlay for live badminton match broadcasts.',
  canonicalPath: route.path,
  noIndex: true,
});

const loading = ref(true);
const tournament = computed(() => tournamentStore.currentTournament);

const inProgressMatches = computed(() => {
  let matches = matchStore.matches.filter((m) => m.status === 'in_progress');
  if (categoryFilter.value) {
    matches = matches.filter((m) => m.categoryId === categoryFilter.value);
  }
  return matches;
});

const readyMatches = computed(() => {
  let matches = matchStore.matches.filter((m) => m.status === 'ready');
  if (categoryFilter.value) {
    matches = matches.filter((m) => m.categoryId === categoryFilter.value);
  }
  return matches.slice(0, 3);
});

const allMatches = computed(() => [...inProgressMatches.value, ...readyMatches.value]);

function getParticipant1Name(match: Match): string {
  return getParticipantName(match.participant1Id);
}

function getParticipant2Name(match: Match): string {
  return getParticipantName(match.participant2Id);
}

function getCurrentGame(match: Match): GameScore {
  if (!match.scores?.length) {
    return { score1: 0, score2: 0, gameNumber: 1, isComplete: false };
  }
  const scores = match.scores;
  const incompleteGame = scores.find((s) => !s.isComplete);
  if (incompleteGame) {
    return incompleteGame;
  }
  return scores[scores.length - 1];
}

function getGamesWon(match: Match, participantId: string | undefined): number {
  if (!match.scores?.length || !participantId) return 0;
  return match.scores.filter((s) => s.isComplete && s.winnerId === participantId).length;
}

onMounted(async () => {
  try {
    loading.value = true;
    await tournamentStore.fetchTournament(tournamentId.value);
    tournamentStore.subscribeTournament(tournamentId.value);
    matchStore.subscribeAllMatches(tournamentId.value);
    registrationStore.subscribeRegistrations(tournamentId.value);
    registrationStore.subscribePlayers(tournamentId.value);
  } catch (err) {
    console.error('Error loading OBS scoreboard:', err);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <!-- Ticker Mode -->
  <div
    v-if="viewMode === 'ticker'"
    :class="['obs-ticker', 'obs-ticker--' + theme]"
  >
    <div
      v-for="match in allMatches.slice(0, 6)"
      :key="`ticker-${match.categoryId}-${match.levelId ?? 'root'}-${match.id}`"
      class="ticker-match"
    >
      <span class="ticker-names">{{ getParticipant1Name(match) }} vs {{ getParticipant2Name(match) }}</span>
      <span class="ticker-score">
        {{ getCurrentGame(match).score1 }} - {{ getCurrentGame(match).score2 }}
      </span>
      <span
        v-if="match.status === 'in_progress'"
        class="ticker-live"
      >LIVE</span>
    </div>
  </div>

  <!-- Full Scoreboard Mode -->
  <div
    v-else
    :class="['obs-full-scoreboard', 'obs-full-scoreboard--' + theme]"
  >
    <div class="scoreboard-header">
      <h1 class="scoreboard-title">
        {{ tournament?.name || 'Live Scores' }}
      </h1>
      <div class="scoreboard-subtitle">
        {{ inProgressMatches.length }} Live Matches
        <span v-if="readyMatches.length"> | {{ readyMatches.length }} Up Next</span>
      </div>
    </div>

    <div
      v-if="loading"
      class="scoreboard-grid"
    >
      <div class="scoreboard-card">
        <div class="card-team">
          <span class="card-team-name">Loading...</span>
        </div>
      </div>
    </div>

    <div
      v-else-if="allMatches.length === 0"
      class="scoreboard-grid"
    >
      <div class="scoreboard-card">
        <div class="card-team">
          <span class="card-team-name">No matches in progress</span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="scoreboard-grid"
    >
      <!-- Live Matches -->
      <div
        v-for="match in inProgressMatches"
        :key="`live-${match.categoryId}-${match.levelId ?? 'root'}-${match.id}`"
        class="scoreboard-card"
      >
        <div class="card-header">
          <span class="card-court">{{ match.courtName || 'Court TBD' }}</span>
          <span class="card-category">{{ match.categoryName || 'Match' }}</span>
        </div>

        <div class="card-team">
          <span class="card-team-name">{{ getParticipant1Name(match) }}</span>
          <div class="card-score">
            <span class="card-games">{{ getGamesWon(match, match.participant1Id) }}</span>
            <span class="card-points">{{ getCurrentGame(match).score1 }}</span>
          </div>
        </div>

        <div
          class="card-team"
          style="opacity: 0.7; font-size: 0.9em;"
        >
          <span class="card-team-name">{{ getParticipant2Name(match) }}</span>
          <div class="card-score">
            <span class="card-games">{{ getGamesWon(match, match.participant2Id) }}</span>
            <span class="card-points">{{ getCurrentGame(match).score2 }}</span>
          </div>
        </div>
      </div>

      <!-- Up Next -->
      <div
        v-for="match in readyMatches"
        :key="`ready-${match.categoryId}-${match.levelId ?? 'root'}-${match.id}`"
        class="scoreboard-card"
        style="opacity: 0.7;"
      >
        <div class="card-header">
          <span class="card-court">{{ match.courtName || 'Up Next' }}</span>
          <span class="card-category">{{ match.categoryName || 'Match' }}</span>
        </div>

        <div class="card-team">
          <span class="card-team-name">{{ getParticipant1Name(match) }}</span>
        </div>
        <div class="card-team">
          <span class="card-team-name">{{ getParticipant2Name(match) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div
    class="obs-courtmaster-watermark"
    aria-hidden="true"
  >
    <BrandLogo
      variant="mark-white"
      :width="16"
      :height="16"
      decorative
      class-name="obs-courtmaster-watermark__logo"
    />
    <span class="obs-courtmaster-watermark__text">CourtMastr</span>
  </div>
</template>

<style scoped>
@import '../obs.css';
</style>
