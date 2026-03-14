<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';
import LiveBadge from '@/components/common/LiveBadge.vue';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Match } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const courts = computed(() => tournamentStore.courts);

// View state
const selectedMatch = ref<Match | null>(null);
const scoringMode = ref(false);
const isStartingMatch = ref(false);
const isUpdatingScore = ref(false);
const hasAutoStartedMatch = ref(false); // Track if we've already auto-started this match
const notFound = ref(false);

// Get matches ready to score or in progress
const scorableMatches = computed(() => {
  return matchStore.matches.filter(
    (m) => m.status === 'ready' || m.status === 'in_progress'
  ).sort((a, b) => {
    // In progress first, then ready
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    return a.matchNumber - b.matchNumber;
  });
});
const hasLiveMatches = computed(() =>
  matchStore.matches.some((match) => match.status === 'in_progress')
);

// Current game for selected match
const currentGame = computed(() => {
  if (!selectedMatch.value?.scores || selectedMatch.value.scores.length === 0) return null;
  return selectedMatch.value.scores[selectedMatch.value.scores.length - 1];
});

// Games won
const gamesWon = computed(() => {
  if (!selectedMatch.value?.scores) return { p1: 0, p2: 0 };

  let p1 = 0;
  let p2 = 0;

  for (const game of selectedMatch.value.scores) {
    if (game.isComplete) {
      if (game.winnerId === selectedMatch.value.participant1Id) p1++;
      else if (game.winnerId === selectedMatch.value.participant2Id) p2++;
    }
  }

  return { p1, p2 };
});

const isMatchComplete = computed(() => {
  return selectedMatch.value?.status === 'completed' || selectedMatch.value?.status === 'walkover';
});

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }

  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});

function getCategoryName(categoryId: string): string {
  const category = tournamentStore.categories.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return 'No Court';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Court';
}

function selectMatch(match: Match) {
  selectedMatch.value = match;
  hasAutoStartedMatch.value = false; // Reset auto-start flag for new match
  // Subscribe to this specific match for real-time updates
  matchStore.subscribeMatch(tournamentId.value, match.id, match.categoryId, match.levelId);
  scoringMode.value = true;
}

function backToList() {
  scoringMode.value = false;
  selectedMatch.value = null;
  hasAutoStartedMatch.value = false;
  matchStore.clearCurrentMatch();
}

async function addPoint(participant: 'participant1' | 'participant2') {
  if (!selectedMatch.value || isMatchComplete.value || isUpdatingScore.value) return;

  isUpdatingScore.value = true;
  try {
    // Auto-start the match if it's in ready status (only once per match)
    if (selectedMatch.value.status === 'ready' && !hasAutoStartedMatch.value) {
      hasAutoStartedMatch.value = true; // Set flag BEFORE starting to prevent duplicates
      isStartingMatch.value = true;
      await matchStore.startMatch(
        tournamentId.value,
        selectedMatch.value.id,
        selectedMatch.value.categoryId,
        selectedMatch.value.levelId
      );
      isStartingMatch.value = false;
      // Wait for Firestore to sync the status change
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    await matchStore.updateScore(
      tournamentId.value,
      selectedMatch.value.id,
      participant,
      selectedMatch.value.categoryId,
      selectedMatch.value.levelId
    );
  } catch (error) {
    console.error('Failed to update score:', error);
  } finally {
    isUpdatingScore.value = false;
  }
}

async function removePoint(participant: 'participant1' | 'participant2') {
  if (!selectedMatch.value || isMatchComplete.value || isUpdatingScore.value) return;

  isUpdatingScore.value = true;
  try {
    await matchStore.decrementScore(
      tournamentId.value,
      selectedMatch.value.id,
      participant,
      selectedMatch.value.categoryId,
      selectedMatch.value.levelId
    );
  } catch (error) {
    console.error('Failed to update score:', error);
  } finally {
    isUpdatingScore.value = false;
  }
}

// Keep selectedMatch in sync with store updates
const currentMatch = computed(() => matchStore.currentMatch);

// Watch for updates from the store - replaces polling mechanism
watch(currentMatch, (newMatch) => {
  if (newMatch && selectedMatch.value && selectedMatch.value.id === newMatch.id) {
    selectedMatch.value = newMatch;
  }
});
</script>

<template>
  <TournamentPublicShell
    :tournament="tournament"
    eyebrow="Public Scoring"
    page-title="Live Match Scoring"
    page-subtitle="Designed for public-facing scoring stations with large touch targets and visible tournament branding."
    fallback-icon="mdi-scoreboard"
    :max-width="960"
  >
    <template #actions>
      <LiveBadge v-if="hasLiveMatches" />
    </template>

    <template #metrics>
      <p class="text-caption text-medium-emphasis">
        Scores update automatically - no refresh needed.
      </p>
    </template>

    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card class="public-scoring__surface-card">
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              Tournament not found
            </h2>
            <p class="text-body-2 text-grey mt-2">
              This tournament does not exist or has been removed.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-else>
      <div class="public-scoring-header mb-4">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div>
            <div class="text-overline public-scoring-header__eyebrow mb-1">
              {{ scoringMode ? 'Live Match' : 'Ready Queue' }}
            </div>
            <h2 class="text-h5 font-weight-bold mb-1">
              {{ scoringMode ? 'Public Scoring Workspace' : 'Select a match to score' }}
            </h2>
            <p class="text-body-2 public-scoring-header__subtitle">
              {{ scoringMode ? 'Point-by-point scoring with visible branding and large tap zones.' : 'Matches appear here as soon as they are assigned and ready.' }}
            </p>
          </div>
          <v-btn
            v-if="scoringMode"
            icon="mdi-arrow-left"
            variant="text"
            @click="backToList"
          />
        </div>
      </div>

      <!-- Match Selection List -->
      <template v-if="!scoringMode">
        <v-card
          v-if="scorableMatches.length === 0"
          class="text-center py-8 public-scoring__surface-card"
        >
          <v-icon
            size="64"
            color="grey-lighten-1"
          >
            mdi-badminton
          </v-icon>
          <p class="text-body-1 text-grey mt-4">
            No matches ready to score
          </p>
          <p class="text-caption text-grey">
            Matches will appear here when assigned to a court
          </p>
        </v-card>

        <v-list
          v-else
          class="pa-0"
        >
          <v-card
            v-for="match in scorableMatches"
            :key="match.id"
            class="mb-3 public-scoring__surface-card"
            :color="match.status === 'in_progress' ? 'success-lighten-5' : undefined"
            @click="selectMatch(match)"
          >
            <v-card-item>
              <template #prepend>
                <v-avatar
                  :color="match.status === 'in_progress' ? 'success' : 'primary'"
                  size="48"
                >
                  <v-icon v-if="match.status === 'in_progress'">
                    mdi-play
                  </v-icon>
                  <span
                    v-else
                    class="text-caption"
                  >#{{ match.matchNumber }}</span>
                </v-avatar>
              </template>

              <v-card-title class="text-body-1">
                {{ getParticipantName(match.participant1Id) }}
                <span class="text-grey mx-1">vs</span>
                {{ getParticipantName(match.participant2Id) }}
              </v-card-title>

              <v-card-subtitle>
                {{ getCategoryName(match.categoryId) }} | {{ getCourtName(match.courtId) }}
              </v-card-subtitle>

              <template #append>
                <div class="text-right">
                  <v-chip
                    :color="match.status === 'in_progress' ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ match.status === 'in_progress' ? 'LIVE' : 'Ready' }}
                  </v-chip>
                </div>
              </template>
            </v-card-item>
          </v-card>
        </v-list>
      </template>

      <!-- Scoring Interface -->
      <template v-else-if="selectedMatch">
        <!-- Match Info Header -->
        <v-card
          class="mb-3 match-header"
          elevation="0"
        >
          <v-card-text class="pa-3 text-center">
            <div class="d-flex justify-center align-center gap-3">
              <v-chip
                size="small"
                variant="flat"
                color="white"
                class="text-primary font-weight-bold"
              >
                {{ getCategoryName(selectedMatch.categoryId) }}
              </v-chip>
              <v-chip
                size="small"
                variant="flat"
                color="white"
                class="text-primary font-weight-bold"
              >
                <v-icon
                  start
                  size="small"
                >
                  mdi-court-tennis
                </v-icon>
                {{ getCourtName(selectedMatch.courtId) }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>

        <!-- Games Scoreboard -->
        <v-card
          v-if="selectedMatch.scores && selectedMatch.scores.length > 0"
          class="mb-4 games-scoreboard public-scoring__surface-card"
          elevation="2"
        >
          <v-card-text class="pa-4">
            <div class="text-center">
              <p class="text-caption text-grey-darken-1 mb-2 text-uppercase font-weight-bold">
                Match Score
              </p>
              <div class="games-score">
                <span
                  class="game-score-number"
                  :class="{ 'leading': gamesWon.p1 > gamesWon.p2 }"
                >{{ gamesWon.p1 }}</span>
                <span class="game-score-separator">-</span>
                <span
                  class="game-score-number"
                  :class="{ 'leading': gamesWon.p2 > gamesWon.p1 }"
                >{{ gamesWon.p2 }}</span>
              </div>
              <p class="text-caption text-grey mt-1">
                GAMES
              </p>
            </div>
          </v-card-text>
        </v-card>

        <!-- Scoring Buttons -->
        <template v-if="selectedMatch.status === 'ready' || (selectedMatch.status === 'in_progress' && currentGame)">
          <!-- Current Game Indicator -->
          <div class="text-center mb-3">
            <v-chip
              color="success"
              variant="flat"
              size="large"
              class="px-6"
            >
              <v-icon start>
                mdi-circle
              </v-icon>
              <span class="text-h6 font-weight-bold">GAME {{ currentGame?.gameNumber || 1 }}</span>
            </v-chip>
          </div>

          <!-- Scoreboard -->
          <v-card
            class="scoreboard-container mb-4 public-scoring__surface-card"
            elevation="4"
          >
            <v-row class="ma-0">
              <!-- Player 1 Score -->
              <v-col
                cols="6"
                class="pa-0"
              >
                <div
                  class="score-panel"
                  :class="{
                    'score-panel-leading': (currentGame?.score1 || 0) > (currentGame?.score2 || 0),
                    'score-panel-updating': isUpdatingScore
                  }"
                  :style="{ opacity: (isUpdatingScore || isStartingMatch) ? 0.7 : 1 }"
                  @click="!isUpdatingScore && !isStartingMatch && addPoint('participant1')"
                >
                  <div class="score-panel-content">
                    <div class="player-name">
                      {{ getParticipantName(selectedMatch.participant1Id) }}
                    </div>
                    <div class="score-display">
                      {{ currentGame?.score1 || 0 }}
                    </div>
                    <v-btn
                      icon
                      size="large"
                      variant="text"
                      class="score-decrement"
                      :disabled="(currentGame?.score1 || 0) === 0 || isUpdatingScore"
                      @click.stop="removePoint('participant1')"
                    >
                      <v-icon size="x-large">
                        mdi-minus-circle-outline
                      </v-icon>
                    </v-btn>
                  </div>
                </div>
              </v-col>

              <!-- Player 2 Score -->
              <v-col
                cols="6"
                class="pa-0"
              >
                <div
                  class="score-panel score-panel-right"
                  :class="{
                    'score-panel-leading': (currentGame?.score2 || 0) > (currentGame?.score1 || 0),
                    'score-panel-updating': isUpdatingScore
                  }"
                  :style="{ opacity: (isUpdatingScore || isStartingMatch) ? 0.7 : 1 }"
                  @click="!isUpdatingScore && !isStartingMatch && addPoint('participant2')"
                >
                  <div class="score-panel-content">
                    <div class="player-name">
                      {{ getParticipantName(selectedMatch.participant2Id) }}
                    </div>
                    <div class="score-display">
                      {{ currentGame?.score2 || 0 }}
                    </div>
                    <v-btn
                      icon
                      size="large"
                      variant="text"
                      class="score-decrement"
                      :disabled="(currentGame?.score2 || 0) === 0 || isUpdatingScore"
                      @click.stop="removePoint('participant2')"
                    >
                      <v-icon size="x-large">
                        mdi-minus-circle-outline
                      </v-icon>
                    </v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card>

          <!-- Instructions -->
          <div class="text-center mb-3">
            <v-chip
              v-if="isUpdatingScore"
              color="info"
              variant="flat"
              size="small"
            >
              <v-icon
                start
                size="small"
              >
                mdi-loading mdi-spin
              </v-icon>
              Updating score...
            </v-chip>
            <v-chip
              v-else-if="isStartingMatch"
              color="warning"
              variant="flat"
              size="small"
            >
              <v-icon
                start
                size="small"
              >
                mdi-loading mdi-spin
              </v-icon>
              Starting match...
            </v-chip>
            <p
              v-else
              class="text-body-2 text-grey-darken-1 mb-0"
            >
              <v-icon size="small">
                mdi-gesture-tap
              </v-icon>
              Tap the score to add a point
            </p>
          </div>

          <!-- Previous Games -->
          <v-card
            v-if="selectedMatch.scores.filter((s: any) => s.isComplete).length > 0"
            class="mt-4 previous-games public-scoring__surface-card"
            elevation="0"
          >
            <v-card-text class="py-3">
              <p class="text-caption text-grey-darken-1 text-center mb-2 text-uppercase font-weight-bold">
                Previous Games
              </p>
              <div class="d-flex justify-center flex-wrap gap-2">
                <v-chip
                  v-for="(game, index) in selectedMatch.scores.filter((s: any) => s.isComplete)"
                  :key="index"
                  :color="game.winnerId === selectedMatch.participant1Id ? 'success' : 'primary'"
                  variant="flat"
                  size="default"
                  class="font-weight-bold"
                >
                  Game {{ game.gameNumber }}: {{ game.score1 }}-{{ game.score2 }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </template>

        <!-- Match Complete -->
        <v-card
          v-else-if="isMatchComplete"
          class="text-center public-scoring__surface-card"
        >
          <v-card-text class="py-8">
            <v-icon
              size="64"
              color="success"
              class="mb-4"
            >
              mdi-trophy
            </v-icon>
            <h2 class="text-h5 font-weight-bold">
              Match Complete!
            </h2>
            <p class="text-body-1 mt-2">
              Winner: {{ selectedMatch.winnerId === selectedMatch.participant1Id
                ? getParticipantName(selectedMatch.participant1Id)
                : getParticipantName(selectedMatch.participant2Id) }}
            </p>
            <p class="text-body-2 text-grey">
              Final: {{ gamesWon.p1 }} - {{ gamesWon.p2 }}
            </p>
            <v-btn
              color="primary"
              class="mt-4"
              @click="backToList"
            >
              Score Another Match
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </template>
  </TournamentPublicShell>
</template>

<style scoped>
.public-scoring-header {
  display: flex;
  flex-direction: column;
}

.public-scoring-header__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.88);
}

.public-scoring-header__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.public-scoring__surface-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 24px;
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.06);
}

/* Match Header */
.match-header {
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.92) 0%, rgba(var(--v-theme-secondary), 0.84) 100%);
}

/* Games Scoreboard */
.games-scoreboard {
  background: linear-gradient(to bottom, #f8f9fa, #ffffff);
  border: 3px solid #e0e0e0;
}

.games-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin: 0.5rem 0;
}

.game-score-number {
  font-size: 3.5rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: #424242;
  transition: all 0.3s ease;
}

.game-score-number.leading {
  color: rgb(var(--v-theme-success));
  transform: scale(1.1);
}

.game-score-separator {
  font-size: 2.5rem;
  font-weight: 300;
  color: #9e9e9e;
}

/* Scoreboard Container */
.scoreboard-container {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
}

/* Score Panels */
.score-panel {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: all 0.3s ease;
  background: linear-gradient(to bottom, #fafafa, #f5f5f5);
  border-right: 2px solid #e0e0e0;
  position: relative;
}

.score-panel-right {
  border-right: none;
  border-left: 2px solid #e0e0e0;
}

.score-panel:active {
  transform: scale(0.98);
  background: linear-gradient(to bottom, #e3f2fd, #bbdefb);
}

.score-panel-leading {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border-color: rgb(var(--v-theme-success));
  box-shadow: inset 0 0 0 3px rgba(var(--v-theme-success), 0.3);
}

.score-panel-updating {
  animation: scoreboardPulse 1s ease-in-out infinite;
}

@keyframes scoreboardPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Score Panel Content */
.score-panel-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  width: 100%;
}

.player-name {
  font-size: 1rem;
  font-weight: 600;
  color: #424242;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.score-display {
  font-size: 6rem;
  font-weight: 900;
  color: #212121;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.score-decrement {
  color: #757575;
  transition: all 0.2s ease;
}

.score-decrement:hover:not(:disabled) {
  color: #f44336;
  transform: scale(1.1);
}

.score-decrement:disabled {
  opacity: 0.3;
}

.success-lighten-5 {
  background-color: rgba(var(--v-theme-success), 0.05) !important;
}

.previous-games {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
}

/* Mobile-specific improvements */
@media (max-width: 600px) {
  .score-panel {
    min-height: 240px;
  }

  .player-name {
    font-size: 0.875rem;
  }

  .score-display {
    font-size: 4.5rem;
  }

  .game-score-number {
    font-size: 3rem;
  }

  .game-score-separator {
    font-size: 2rem;
  }

  .score-decrement {
    min-width: 56px;
    min-height: 56px;
  }
}

/* Tablet adjustments */
@media (min-width: 601px) and (max-width: 960px) {
  .score-display {
    font-size: 5rem;
  }
}
</style>
