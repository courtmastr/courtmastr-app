<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useAuthStore } from '@/stores/auth';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { BADMINTON_CONFIG } from '@/types';
import ScoreCorrectionDialog from '../components/ScoreCorrectionDialog.vue';

const route = useRoute();
const router = useRouter();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const authStore = useAuthStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const matchId = computed(() => route.params.matchId as string);
const match = computed(() => matchStore.currentMatch);
const loading = ref(false);
const pageError = ref<string | null>(null);
const initialized = ref(false);

// Manual scorecard mode
const manualScores = ref<{ game1: { p1: number; p2: number }; game2: { p1: number; p2: number }; game3: { p1: number; p2: number } }>({
  game1: { p1: 0, p2: 0 },
  game2: { p1: 0, p2: 0 },
  game3: { p1: 0, p2: 0 },
});
const showManualScoreDialog = ref(false);

// Walkover dialog state
const showWalkoverConfirm = ref(false);
const walkoverWinnerId = ref<string | null>(null);

// Score correction dialog state
const showCorrectionDialog = ref(false);

// Check if user can correct scores
const canCorrectMatch = computed(() => {
  return authStore.isAdmin || authStore.isScorekeeper;
});

// Get participant names using composable
const participant1Name = computed(() => {
  if (!match.value?.participant1Id) return 'TBD';
  return getParticipantName(match.value.participant1Id);
});

const participant2Name = computed(() => {
  if (!match.value?.participant2Id) return 'TBD';
  return getParticipantName(match.value.participant2Id);
});

// Current game
const currentGame = computed(() => {
  if (!match.value?.scores || match.value.scores.length === 0) return null;
  return match.value.scores[match.value.scores.length - 1];
});

// Game scores summary
const gamesWon = computed(() => {
  if (!match.value?.scores) return { p1: 0, p2: 0 };

  let p1 = 0;
  let p2 = 0;

  for (const game of match.value.scores) {
    if (game.isComplete) {
      if (game.winnerId === match.value.participant1Id) {
        p1++;
      } else if (game.winnerId === match.value.participant2Id) {
        p2++;
      }
    }
  }

  return { p1, p2 };
});

// Is match complete
const isMatchComplete = computed(() => {
  return match.value?.status === 'completed' || match.value?.status === 'walkover';
});

// Can start match
const canStartMatch = computed(() => {
  return match.value?.status === 'ready' && match.value.participant1Id && match.value.participant2Id;
});

onMounted(async () => {
  const categoryId = route.query.category as string | undefined;

  try {
    await tournamentStore.fetchTournament(tournamentId.value);
    await matchStore.fetchMatch(tournamentId.value, matchId.value, categoryId);
    matchStore.subscribeMatch(tournamentId.value, matchId.value, categoryId);
    registrationStore.subscribeRegistrations(tournamentId.value);
    registrationStore.subscribePlayers(tournamentId.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.toLowerCase().includes('match not found')) {
      pageError.value = 'Match not found';
    } else if (errorMessage.toLowerCase().includes('tournament not found')) {
      pageError.value = 'Tournament not found';
    } else {
      pageError.value = 'Failed to load scoring page';
    }
  } finally {
    initialized.value = true;
  }
});

onUnmounted(() => {
  matchStore.clearCurrentMatch();
});

// Watch for match completion to log activity
watch(
  () => match.value?.status,
  async (newStatus, oldStatus) => {
    if (newStatus === 'completed' && oldStatus === 'in_progress' && match.value) {
      // Match just completed - log activity
      const winnerName = match.value.winnerId === match.value.participant1Id
        ? participant1Name.value
        : participant2Name.value;

      // Build score string
      const scoreString = match.value.scores
        ?.filter((g) => g.isComplete)
        .map((g) => `${g.score1}-${g.score2}`)
        .join(', ') || '';

      // Non-blocking - don't fail if logging fails
      activityStore.logMatchCompleted(
        tournamentId.value,
        matchId.value,
        participant1Name.value,
        participant2Name.value,
        winnerName,
        scoreString,
        courtName.value,
        categoryName.value
      ).catch((err) => console.warn('Activity logging failed:', err));
    }
  }
);

// Get court name
const courtName = computed(() => {
  if (!match.value?.courtId) return 'Unknown Court';
  const court = tournamentStore.courts.find((c) => c.id === match.value?.courtId);
  return court?.name || 'Unknown Court';
});

// Get category name
const categoryName = computed(() => {
  if (!match.value?.categoryId) return '';
  const category = tournamentStore.categories.find((c) => c.id === match.value?.categoryId);
  return category?.name || '';
});

async function startMatch() {
  loading.value = true;
  try {
    await matchStore.startMatch(
      tournamentId.value,
      matchId.value,
      match.value?.categoryId,
      match.value?.levelId
    );
    notificationStore.showToast('success', 'Match started!');

    // Log activity (non-blocking - don't fail if logging fails)
    activityStore.logMatchStarted(
      tournamentId.value,
      matchId.value,
      participant1Name.value,
      participant2Name.value,
      courtName.value,
      categoryName.value
    ).catch((err) => console.warn('Activity logging failed:', err));
  } catch (error) {
    notificationStore.showToast('error', 'Failed to start match');
  } finally {
    loading.value = false;
  }
}

async function addPoint(participant: 'participant1' | 'participant2') {
  if (isMatchComplete.value || !match.value) return;

  try {
    await matchStore.updateScore(
      tournamentId.value,
      matchId.value,
      participant,
      match.value.categoryId,
      match.value.levelId
    );
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update score');
  }
}

async function removePoint(participant: 'participant1' | 'participant2') {
  if (isMatchComplete.value || !match.value) return;

  try {
    await matchStore.decrementScore(
      tournamentId.value,
      matchId.value,
      participant,
      match.value.categoryId,
      match.value.levelId
    );
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update score');
  }
}

function requestWalkover(winnerId: string) {
  walkoverWinnerId.value = winnerId;
  showWalkoverConfirm.value = true;
}

async function confirmWalkover() {
  if (!walkoverWinnerId.value) return;
  showWalkoverConfirm.value = false;
  loading.value = true;
  try {
    await matchStore.recordWalkover(
      tournamentId.value,
      matchId.value,
      walkoverWinnerId.value,
      match.value?.categoryId,
      match.value?.levelId
    );
    notificationStore.showToast('success', 'Walkover recorded');
    router.back();
  } catch (error) {
    notificationStore.showToast('error', 'Failed to record walkover');
  } finally {
    loading.value = false;
  }
}

function getScoreColor(score1: number, score2: number, forPlayer1: boolean): string {
  if (forPlayer1) {
    return score1 > score2 ? 'success' : score1 < score2 ? 'error' : '';
  } else {
    return score2 > score1 ? 'success' : score2 < score1 ? 'error' : '';
  }
}

function openManualScoreDialog() {
  // Initialize with existing scores if any
  if (match.value?.scores) {
    match.value.scores.forEach((game, index) => {
      const gameKey = `game${index + 1}` as keyof typeof manualScores.value;
      if (manualScores.value[gameKey]) {
        manualScores.value[gameKey] = { p1: game.score1, p2: game.score2 };
      }
    });
  }
  showManualScoreDialog.value = true;
}

async function submitManualScores() {
  if (!match.value) return;

  loading.value = true;
  try {
    // Submit each game score that has been played
    const games = [manualScores.value.game1, manualScores.value.game2, manualScores.value.game3];

    let p1GamesWon = 0;
    let p2GamesWon = 0;
    const validGames: Array<{ p1: number; p2: number; winner: string }> = [];

    for (const game of games) {
      // Skip games where both scores are 0
      if (game.p1 === 0 && game.p2 === 0) continue;

      // Validate: games cannot be tied
      if (game.p1 === game.p2) {
        notificationStore.showToast(
          'error',
          `Game ${validGames.length + 1} cannot be tied (${game.p1}-${game.p2}). One player must win.`
        );
        loading.value = false;
        return;
      }

      // Determine winner
      if (game.p1 > game.p2) {
        p1GamesWon++;
        validGames.push({ ...game, winner: match.value.participant1Id! });
      } else if (game.p2 > game.p1) {
        p2GamesWon++;
        validGames.push({ ...game, winner: match.value.participant2Id! });
      }
    }

    // Submit scores through the store
    await matchStore.submitManualScores(
      tournamentId.value,
      matchId.value,
      validGames.map((g, idx) => ({
        gameNumber: idx + 1,
        score1: g.p1,
        score2: g.p2,
        winnerId: g.winner,
        isComplete: true,
      })),
      match.value.categoryId,
      match.value.levelId
    );

    showManualScoreDialog.value = false;
    notificationStore.showToast('success', 'Scores submitted successfully');

    // If match is complete, go back
    const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
    if (p1GamesWon >= gamesNeeded || p2GamesWon >= gamesNeeded) {
      router.back();
    }
  } catch (error) {
    notificationStore.showToast('error', 'Failed to submit scores');
  } finally {
    loading.value = false;
  }
}

function onScoreCorrected() {
  showCorrectionDialog.value = false;
}
</script>

<template>
  <v-container
    v-if="pageError"
    class="fill-height"
  >
    <v-row
      justify="center"
      align="center"
    >
      <v-col
        cols="12"
        md="8"
        lg="6"
      >
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              {{ pageError }}
            </h2>
            <p class="text-body-2 text-grey mt-2">
              The scoring page could not be opened for this route.
            </p>
            <v-btn
              class="mt-4"
              color="primary"
              @click="router.back()"
            >
              Go Back
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <v-container
    v-else-if="match"
    class="fill-height"
  >
    <v-row
      justify="center"
      align="center"
    >
      <v-col
        cols="12"
        md="10"
        lg="8"
      >
        <!-- Header -->
        <div class="d-flex align-center mb-4">
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            @click="router.back()"
          />
          <div class="ml-2">
            <h1 class="text-h6 font-weight-bold">
              Match #{{ match.matchNumber }}
            </h1>
            <p class="text-body-2 text-grey">
              Round {{ match.round }}
            </p>
          </div>
          <v-spacer />
          <v-btn
            v-if="match.status === 'in_progress' || match.status === 'ready'"
            variant="outlined"
            size="small"
            class="mr-2"
            @click="openManualScoreDialog"
          >
            <v-icon start>
              mdi-clipboard-edit
            </v-icon>
            Manual Entry
          </v-btn>
          <v-chip
            :color="match.status === 'in_progress' ? 'success' : 'grey'"
            size="small"
          >
            {{ match.status }}
          </v-chip>
        </div>

        <!-- Game Score Summary -->
        <v-card
          v-if="match.scores.length > 0"
          class="mb-4"
        >
          <v-card-text class="text-center">
            <div class="text-h2 font-weight-bold">
              {{ gamesWon.p1 }} - {{ gamesWon.p2 }}
            </div>
            <p class="text-body-2 text-grey">
              Games
            </p>
          </v-card-text>
        </v-card>

        <!-- Previous Games -->
        <v-card
          v-if="match.scores.filter((s: any) => s.isComplete).length > 0"
          class="mb-4"
        >
          <v-card-title class="text-subtitle-1">
            Previous Games
          </v-card-title>
          <v-card-text>
            <v-row justify="center">
              <v-col
                v-for="(game, index) in match.scores.filter((s: any) => s.isComplete)"
                :key="index"
                cols="auto"
              >
                <v-chip
                  :color="game.winnerId === match.participant1Id ? 'success' : 'error'"
                  variant="outlined"
                >
                  Game {{ game.gameNumber }}: {{ game.score1 }}-{{ game.score2 }}
                </v-chip>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Start Match Button -->
        <v-card
          v-if="canStartMatch"
          class="mb-4 text-center"
        >
          <v-card-text>
            <p class="text-body-1 mb-4">
              Match is ready to begin
            </p>
            <v-btn
              color="success"
              size="x-large"
              :loading="loading"
              @click="startMatch"
            >
              <v-icon start>
                mdi-play
              </v-icon>
              Start Match
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Scoring Interface -->
        <v-card v-else-if="match.status === 'in_progress' && currentGame">
          <v-card-text>
            <!-- Current Game Score -->
            <div class="text-center mb-4">
              <p class="text-overline text-grey">
                Game {{ currentGame.gameNumber }}
              </p>
            </div>

            <v-row>
              <!-- Player 1 -->
              <v-col
                cols="5"
                class="text-center"
              >
                <v-card
                  variant="outlined"
                  class="pa-4 score-card"
                  :class="{ 'score-leading': currentGame.score1 > currentGame.score2 }"
                  @click="addPoint('participant1')"
                >
                  <h3 class="text-subtitle-1 font-weight-bold mb-2">
                    {{ participant1Name }}
                  </h3>
                  <div
                    class="text-h1 font-weight-bold"
                    :class="getScoreColor(currentGame.score1, currentGame.score2, true)"
                  >
                    {{ currentGame.score1 }}
                  </div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-2"
                    :disabled="currentGame.score1 === 0"
                    @click.stop="removePoint('participant1')"
                  >
                    <v-icon>mdi-minus</v-icon>
                  </v-btn>
                </v-card>
              </v-col>

              <!-- VS -->
              <v-col
                cols="2"
                class="d-flex align-center justify-center"
              >
                <span class="text-h5 text-grey">vs</span>
              </v-col>

              <!-- Player 2 -->
              <v-col
                cols="5"
                class="text-center"
              >
                <v-card
                  variant="outlined"
                  class="pa-4 score-card"
                  :class="{ 'score-leading': currentGame.score2 > currentGame.score1 }"
                  @click="addPoint('participant2')"
                >
                  <h3 class="text-subtitle-1 font-weight-bold mb-2">
                    {{ participant2Name }}
                  </h3>
                  <div
                    class="text-h1 font-weight-bold"
                    :class="getScoreColor(currentGame.score1, currentGame.score2, false)"
                  >
                    {{ currentGame.score2 }}
                  </div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-2"
                    :disabled="currentGame.score2 === 0"
                    @click.stop="removePoint('participant2')"
                  >
                    <v-icon>mdi-minus</v-icon>
                  </v-btn>
                </v-card>
              </v-col>
            </v-row>

            <!-- Instructions -->
            <p class="text-center text-body-2 text-grey mt-4">
              Tap on a player's score to add a point
            </p>
          </v-card-text>

          <v-divider />

          <!-- Actions -->
          <v-card-actions class="justify-center">
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  variant="text"
                  color="warning"
                >
                  <v-icon start>
                    mdi-flag
                  </v-icon>
                  Walkover
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="requestWalkover(match.participant1Id!)">
                  {{ participant1Name }} wins (walkover)
                </v-list-item>
                <v-list-item @click="requestWalkover(match.participant2Id!)">
                  {{ participant2Name }} wins (walkover)
                </v-list-item>
              </v-list>
            </v-menu>
          </v-card-actions>
        </v-card>

        <!-- Match Complete -->
        <v-card
          v-else-if="isMatchComplete"
          class="text-center"
        >
          <v-card-text>
            <v-icon
              size="64"
              color="success"
              class="mb-4"
            >
              mdi-trophy
            </v-icon>
            <h2 class="text-h5 font-weight-bold">
              Match Complete
            </h2>
            <p class="text-body-1 mt-2">
              Winner: {{ match.winnerId === match.participant1Id ? participant1Name : participant2Name }}
            </p>
            <p class="text-body-2 text-grey mt-2">
              Final Score: {{ gamesWon.p1 }} - {{ gamesWon.p2 }}
            </p>
            <v-btn
              color="primary"
              class="mt-4"
              @click="router.back()"
            >
              Back to Matches
            </v-btn>

            <v-btn
              v-if="canCorrectMatch"
              color="warning"
              variant="outlined"
              class="mt-4 ml-2"
              prepend-icon="mdi-pencil"
              @click="showCorrectionDialog = true"
            >
              Correct Score
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Loading -->
  <v-container
    v-else
    class="fill-height"
  >
    <v-row
      align="center"
      justify="center"
    >
      <v-progress-circular
        v-if="!initialized"
        indeterminate
        size="64"
        color="primary"
      />
      <v-alert
        v-else
        type="error"
        variant="tonal"
      >
        Failed to load match details.
      </v-alert>
    </v-row>
  </v-container>

  <!-- Walkover Confirmation Dialog -->
  <v-dialog
    v-model="showWalkoverConfirm"
    max-width="400"
    persistent
  >
    <v-card>
      <v-card-title>Record Walkover?</v-card-title>
      <v-card-text>This will end the match immediately. Are you sure?</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showWalkoverConfirm = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          @click="confirmWalkover"
        >
          Confirm Walkover
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Manual Score Entry Dialog -->
  <v-dialog
    v-model="showManualScoreDialog"
    max-width="500"
    persistent
  >
    <v-card v-if="match">
      <v-card-title class="d-flex align-center">
        <v-icon start>
          mdi-clipboard-edit
        </v-icon>
        Manual Score Entry
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-grey mb-4">
          Enter the final scores for each game. Leave games at 0-0 if not played.
        </p>

        <!-- Player Names Header -->
        <v-row class="text-center mb-2">
          <v-col cols="4" />
          <v-col
            cols="4"
            class="font-weight-medium text-body-2"
          >
            {{ participant1Name }}
          </v-col>
          <v-col
            cols="4"
            class="font-weight-medium text-body-2"
          >
            {{ participant2Name }}
          </v-col>
        </v-row>

        <!-- Game 1 -->
        <v-row
          align="center"
          class="mb-2"
        >
          <v-col cols="4">
            <span class="font-weight-medium">Game 1</span>
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game1.p1"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game1.p2"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
        </v-row>

        <!-- Game 2 -->
        <v-row
          align="center"
          class="mb-2"
        >
          <v-col cols="4">
            <span class="font-weight-medium">Game 2</span>
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game2.p1"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game2.p2"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
        </v-row>

        <!-- Game 3 -->
        <v-row align="center">
          <v-col cols="4">
            <span class="font-weight-medium">Game 3</span>
            <span class="text-caption text-grey d-block">(if needed)</span>
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game3.p1"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="manualScores.game3.p2"
              type="number"
              min="0"
              max="30"
              variant="outlined"
              density="compact"
              hide-details
              class="centered-input"
            />
          </v-col>
        </v-row>

        <v-alert
          type="info"
          variant="tonal"
          class="mt-4"
          density="compact"
        >
          <div class="text-caption">
            Enter complete game scores. The match winner will be determined automatically (best of 3).
          </div>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showManualScoreDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          @click="submitManualScores"
        >
          Submit Scores
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Score Correction Dialog -->
  <score-correction-dialog
    v-model="showCorrectionDialog"
    :match="match"
    :tournament-id="tournamentId"
    :category-id="match?.categoryId"
    :scoring-config="match?.scoringConfig || BADMINTON_CONFIG"
    @corrected="onScoreCorrected"
  />
</template>

<style scoped>
.score-card {
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.score-card:hover {
  transform: scale(1.02);
  border-color: rgb(var(--v-theme-primary));
}

.score-card:active {
  transform: scale(0.98);
}

.score-leading {
  border-color: rgb(var(--v-theme-success));
  background-color: rgba(var(--v-theme-success), 0.05);
}

.text-success {
  color: rgb(var(--v-theme-success));
}

.text-error {
  color: rgb(var(--v-theme-error));
}

.centered-input :deep(input) {
  text-align: center;
  font-weight: bold;
  font-size: 1.2rem;
}
</style>
