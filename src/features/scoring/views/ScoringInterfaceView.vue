<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchStore, VolunteerSessionExpiredError } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useAuthStore } from '@/stores/auth';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import { BADMINTON_CONFIG } from '@/types';
import { validateCompletedGameScore } from '../utils/validation';
import ScoreCorrectionDialog from '../components/ScoreCorrectionDialog.vue';
import { logger } from '@/utils/logger';

const route = useRoute();
const router = useRouter();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const authStore = useAuthStore();
const volunteerAccessStore = useVolunteerAccessStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const matchId = computed(() => route.params.matchId as string);
const match = computed(() => matchStore.currentMatch);
const tournament = computed(() => tournamentStore.currentTournament);
const { tournamentLogoUrl } = useTournamentBranding(tournament);
const loading = ref(false);
const pageError = ref<string | null>(null);
const initialized = ref(false);
const isVolunteerScorekeeperMode = computed(() => (
  route.meta.volunteerRole === 'scorekeeper' &&
  volunteerAccessStore.hasValidSession(tournamentId.value, 'scorekeeper')
));

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

// Re-PIN dialog: shown when the scorekeeper session expires mid-match
const showRepinDialog = ref(false);
const repinValue = ref('');
const repinSubmitting = ref(false);
const repinError = ref<string | null>(null);

async function submitRepin(): Promise<void> {
  if (!repinValue.value.trim()) return;
  repinSubmitting.value = true;
  repinError.value = null;
  try {
    await volunteerAccessStore.requestSession({
      tournamentId: tournamentId.value,
      role: 'scorekeeper',
      pin: repinValue.value.trim(),
    });
    matchStore.sessionExpiredSignal = false;
    showRepinDialog.value = false;
    repinValue.value = '';
    notificationStore.showToast('success', 'Session renewed — re-tap any points scored during the interruption');
  } catch (err) {
    repinError.value = err instanceof Error ? err.message : 'Invalid PIN';
  } finally {
    repinSubmitting.value = false;
  }
}

// Returns true if the session is valid (or if not in volunteer mode).
// If expired, opens the re-PIN dialog and returns false — caller must abort.
function checkSessionOrPrompt(): boolean {
  if (
    volunteerAccessStore.isVolunteerDevice &&
    !volunteerAccessStore.hasValidSession(tournamentId.value, 'scorekeeper')
  ) {
    showRepinDialog.value = true;
    return false;
  }
  return true;
}

function handleScoringError(error: unknown, fallbackMessage: string): void {
  if (error instanceof VolunteerSessionExpiredError) {
    // Defensive rollback: session expired in the narrow window between the guard
    // check and the Firestore write. Re-fetch to undo the optimistic score mutation.
    if (match.value) {
      matchStore.fetchMatch(
        tournamentId.value,
        matchId.value,
        match.value.categoryId,
        match.value.levelId,
      ).catch(() => {});
    }
    showRepinDialog.value = true;
    return;
  }
  notificationStore.showToast('error', error instanceof Error ? error.message : fallbackMessage);
}

// Watch for server-side PIN rotation rejection surfaced via sessionExpiredSignal
watch(() => matchStore.sessionExpiredSignal, (fired) => {
  if (fired) showRepinDialog.value = true;
});

// Check if user can correct scores
const canCorrectMatch = computed(() => {
  return authStore.isAdmin || authStore.isScorekeeper || isVolunteerScorekeeperMode.value;
});
const manualEntryLabel = computed(() => isVolunteerScorekeeperMode.value ? 'Manual Fallback' : 'Manual Entry');
const manualEntryVariant = computed(() => isVolunteerScorekeeperMode.value ? 'text' : 'outlined');

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

const scoringConfig = computed(() => match.value?.scoringConfig ?? BADMINTON_CONFIG);
const currentGameReadyToComplete = computed(() => {
  if (!currentGame.value || currentGame.value.isComplete) return false;

  const validation = validateCompletedGameScore(
    currentGame.value.score1,
    currentGame.value.score2,
    scoringConfig.value
  );
  return validation.isValid;
});

const scoreEntryLocked = computed(() => currentGameReadyToComplete.value);

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
// Also handles in_progress + no scores: stale state from seeded data or a failed start call.
// Showing Start Match lets the scorekeeper initialize the score doc and unblock scoring.
const canStartMatch = computed(() => {
  if (!match.value?.participant1Id || !match.value.participant2Id) return false;
  if (match.value.status === 'ready') return true;
  if (match.value.status === 'in_progress' && match.value.scores.length === 0) return true;
  return false;
});

onMounted(async () => {
  const categoryId = route.query.category as string | undefined;
  const levelId = route.query.level as string | undefined;

  try {
    await tournamentStore.fetchTournament(tournamentId.value);
    await matchStore.fetchMatch(tournamentId.value, matchId.value, categoryId, levelId);
    matchStore.subscribeMatch(tournamentId.value, matchId.value, categoryId, levelId);
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
    // Proactive session check: show re-PIN dialog immediately if the scorer
    // lands on this page with an already-expired session rather than waiting
    // for the first tap to fail.
    if (volunteerAccessStore.isVolunteerDevice && !volunteerAccessStore.hasValidSession(tournamentId.value, 'scorekeeper')) {
      showRepinDialog.value = true;
    }
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
      ).catch((err) => logger.warn('Activity logging failed:', err));
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
  if (!checkSessionOrPrompt()) return;
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
    ).catch((err) => logger.warn('Activity logging failed:', err));
  } catch (error) {
    handleScoringError(error, 'Failed to start match');
  } finally {
    loading.value = false;
  }
}

async function addPoint(participant: 'participant1' | 'participant2') {
  if (isMatchComplete.value || !match.value || scoreEntryLocked.value) return;
  if (!checkSessionOrPrompt()) return;

  try {
    await matchStore.updateScore(
      tournamentId.value,
      matchId.value,
      participant,
      match.value.categoryId,
      match.value.levelId
    );
  } catch (error) {
    handleScoringError(error, 'Failed to update score');
  }
}

async function removePoint(participant: 'participant1' | 'participant2') {
  if (isMatchComplete.value || !match.value) return;
  if (!checkSessionOrPrompt()) return;

  try {
    await matchStore.decrementScore(
      tournamentId.value,
      matchId.value,
      participant,
      match.value.categoryId,
      match.value.levelId
    );
  } catch (error) {
    handleScoringError(error, 'Failed to update score');
  }
}

async function completeCurrentGame() {
  if (isMatchComplete.value || !match.value || !currentGameReadyToComplete.value) return;
  if (!checkSessionOrPrompt()) return;

  loading.value = true;
  try {
    await matchStore.completeCurrentGame(
      tournamentId.value,
      matchId.value,
      match.value.categoryId,
      match.value.levelId
    );
    notificationStore.showToast('success', 'Game completed');
  } catch (error) {
    handleScoringError(error, 'Failed to complete game');
  } finally {
    loading.value = false;
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
    returnToMatchList();
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
      returnToMatchList();
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

const returnToMatchList = (): void => {
  if (isVolunteerScorekeeperMode.value) {
    router.push({
      name: 'volunteer-scoring-kiosk',
      params: { tournamentId: tournamentId.value },
    });
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push(`/tournaments/${tournamentId.value}/match-control`);
};

const goBack = (): void => {
  returnToMatchList();
};
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
              @click="goBack()"
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
    class="fill-height scoring-shell"
  >
    <v-row
      class="scoring-shell__row"
      justify="center"
      align="center"
    >
      <v-col
        cols="12"
        md="10"
        lg="8"
      >
        <!-- Header -->
        <v-card
          class="scoring-shell__header mb-4"
          elevation="0"
        >
          <v-card-text class="scoring-shell__header-body pa-4 pa-sm-5">
            <div class="d-flex align-center flex-wrap ga-3">
              <div class="scoring-shell__header-brand">
                <v-btn
                  icon="mdi-arrow-left"
                  variant="text"
                  class="scoring-shell__back-btn"
                  aria-label="Back to match list"
                  @click="goBack()"
                />
                <TournamentBrandMark
                  :tournament-name="tournament?.name || 'Tournament'"
                  :logo-url="tournamentLogoUrl"
                  fallback-icon="mdi-scoreboard"
                  :width="72"
                  :height="72"
                  class="scoring-shell__brand-mark"
                />
                <div>
                  <div class="text-overline scoring-shell__eyebrow mb-1">
                    Scorer Station
                  </div>
                  <div class="scoring-shell__tournament mb-1">
                    {{ tournament?.name }}
                  </div>
                  <h1 class="text-h5 scoring-shell__title">
                    Match #{{ match.matchNumber }}
                  </h1>
                  <p class="text-body-2 scoring-shell__subtitle">
                    Round {{ match.round }} • {{ courtName }}
                  </p>
                </div>
              </div>
              <v-spacer />
              <div class="d-flex align-center ga-2 flex-wrap scoring-shell__status-row">
                <v-chip
                  v-if="categoryName"
                  color="info"
                  size="small"
                  variant="tonal"
                >
                  {{ categoryName }}
                </v-chip>
                <v-btn
                  v-if="match.status === 'in_progress' || match.status === 'ready'"
                  :variant="manualEntryVariant"
                  size="small"
                  class="manual-entry-button"
                  @click="openManualScoreDialog"
                >
                  <v-icon start>
                    mdi-clipboard-edit
                  </v-icon>
                  {{ manualEntryLabel }}
                </v-btn>
                <v-chip
                  :color="match.status === 'in_progress' ? 'success' : 'grey'"
                  size="small"
                  class="scoring-shell__status-chip"
                >
                  {{ match.status }}
                </v-chip>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Game Score Summary -->
        <v-card
          v-if="match.scores.length > 0"
          class="mb-4 scoring-shell__games-summary"
          elevation="0"
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
          class="mb-4 scoring-shell__history"
          elevation="0"
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
          class="mb-4 text-center scoring-shell__start"
          elevation="0"
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
        <v-card
          v-else-if="match.status === 'in_progress' && currentGame"
          class="scoring-shell__live"
          elevation="0"
        >
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
                cols="12"
                sm="5"
                class="text-center"
              >
                <v-card
                  variant="outlined"
                  class="pa-4 score-card"
                  :class="{
                    'score-leading': currentGame.score1 > currentGame.score2,
                    'score-card--locked': scoreEntryLocked,
                  }"
                  @click="addPoint('participant1')"
                >
                  <h3 class="text-subtitle-1 font-weight-bold mb-2">
                    {{ participant1Name }}
                  </h3>
                  <div
                    class="text-h1 font-weight-bold score-card__score"
                    :class="getScoreColor(currentGame.score1, currentGame.score2, true)"
                  >
                    {{ currentGame.score1 }}
                  </div>
                  <v-btn
                    variant="tonal"
                    size="large"
                    block
                    class="mt-4 score-card__undo"
                    :disabled="currentGame.score1 === 0"
                    @click.stop="removePoint('participant1')"
                  >
                    <v-icon start>
                      mdi-minus
                    </v-icon>
                    Undo Point
                  </v-btn>
                </v-card>
              </v-col>

              <!-- VS -->
              <v-col
                cols="12"
                sm="2"
                class="d-flex align-center justify-center score-divider"
              >
                <span class="text-h5 text-grey">vs</span>
              </v-col>

              <!-- Player 2 -->
              <v-col
                cols="12"
                sm="5"
                class="text-center"
              >
                <v-card
                  variant="outlined"
                  class="pa-4 score-card"
                  :class="{
                    'score-leading': currentGame.score2 > currentGame.score1,
                    'score-card--locked': scoreEntryLocked,
                  }"
                  @click="addPoint('participant2')"
                >
                  <h3 class="text-subtitle-1 font-weight-bold mb-2">
                    {{ participant2Name }}
                  </h3>
                  <div
                    class="text-h1 font-weight-bold score-card__score"
                    :class="getScoreColor(currentGame.score1, currentGame.score2, false)"
                  >
                    {{ currentGame.score2 }}
                  </div>
                  <v-btn
                    variant="tonal"
                    size="large"
                    block
                    class="mt-4 score-card__undo"
                    :disabled="currentGame.score2 === 0"
                    @click.stop="removePoint('participant2')"
                  >
                    <v-icon start>
                      mdi-minus
                    </v-icon>
                    Undo Point
                  </v-btn>
                </v-card>
              </v-col>
            </v-row>

            <!-- Instructions -->
            <p
              v-if="currentGameReadyToComplete"
              class="text-center text-body-2 text-warning mt-4 font-weight-medium"
            >
              Game point reached. Complete the game or undo the last point.
            </p>
            <p
              v-else
              class="text-center text-body-2 text-grey mt-4"
            >
              Tap on a player's score to add a point
            </p>
            <p
              v-if="isVolunteerScorekeeperMode"
              class="text-center text-caption text-grey mt-2"
            >
              Use Manual Fallback only if point-by-point scoring is unavailable.
            </p>

            <v-btn
              v-if="currentGameReadyToComplete"
              color="primary"
              size="large"
              block
              class="mt-4"
              :loading="loading"
              @click="completeCurrentGame"
            >
              Complete Game
            </v-btn>
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
          class="text-center scoring-shell__complete"
          elevation="0"
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
              @click="goBack()"
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
              :aria-label="`Game 1, ${participant1Name} score`"
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
              :aria-label="`Game 1, ${participant2Name} score`"
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
              :aria-label="`Game 2, ${participant1Name} score`"
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
              :aria-label="`Game 2, ${participant2Name} score`"
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
              :aria-label="`Game 3, ${participant1Name} score`"
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
              :aria-label="`Game 3, ${participant2Name} score`"
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

  <!-- Session Expired / Re-PIN Dialog -->
  <v-dialog
    v-model="showRepinDialog"
    max-width="380"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6 pt-5 px-5">
        Session expired
      </v-card-title>
      <v-card-text class="px-5">
        <p class="text-body-2 mb-4">
          Your scorekeeper session has expired or the PIN was changed. Re-enter the PIN to continue scoring.
        </p>
        <v-alert
          v-if="repinError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ repinError }}
        </v-alert>
        <v-text-field
          v-model="repinValue"
          label="Scorekeeper PIN"
          type="password"
          autocomplete="one-time-code"
          variant="outlined"
          density="comfortable"
          autofocus
          :disabled="repinSubmitting"
          @keyup.enter="submitRepin"
        />
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :loading="repinSubmitting"
          :disabled="!repinValue.trim() || repinSubmitting"
          @click="submitRepin"
        >
          Renew session
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.scoring-shell {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(168deg, rgba(var(--v-theme-primary), 0.07) 0%, rgba(var(--v-theme-surface), 0.95) 43%, rgba(var(--v-theme-secondary), 0.06) 100%);
}

.scoring-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 10% 7%, rgba(var(--v-theme-primary), 0.2), transparent 36%),
    radial-gradient(circle at 88% 14%, rgba(var(--v-theme-info), 0.15), transparent 36%),
    radial-gradient(circle at 52% 96%, rgba(var(--v-theme-secondary), 0.11), transparent 42%);
  z-index: 0;
}

.scoring-shell__row {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 164px);
}

.scoring-shell__header,
.scoring-shell__games-summary,
.scoring-shell__history,
.scoring-shell__start,
.scoring-shell__live,
.scoring-shell__complete {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 20px;
  background: rgba(var(--v-theme-surface), 0.95);
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.06);
}

.scoring-shell__header {
  border-color: rgba(var(--v-theme-primary), 0.16);
}

.scoring-shell__back-btn {
  background: rgba(var(--v-theme-primary), 0.08);
}

.scoring-shell__header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.scoring-shell__brand-mark {
  flex-shrink: 0;
}

.scoring-shell__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.85);
}

.scoring-shell__tournament {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.scoring-shell__title {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  font-weight: 700;
  line-height: 1;
}

.scoring-shell__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.scoring-shell__status-row {
  justify-content: flex-end;
}

.scoring-shell__status-chip {
  text-transform: capitalize;
  letter-spacing: 0.03em;
}

.score-card {
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-surface), 0.9);
}

.score-card:hover {
  transform: translateY(-2px) scale(1.01);
  border-color: rgba(var(--v-theme-primary), 0.72);
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.11);
}

.score-card:active {
  transform: scale(0.99);
}

.score-leading {
  border-color: rgba(var(--v-theme-success), 0.52);
  background-color: rgba(var(--v-theme-success), 0.08);
}

.score-card--locked {
  border-color: rgba(var(--v-theme-warning), 0.45);
  background-color: rgba(var(--v-theme-warning), 0.1);
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

.manual-entry-button {
  opacity: 0.96;
  min-height: 40px;
  border-radius: 10px;
}

.score-card__score {
  line-height: 1;
  letter-spacing: -0.03em;
}

.score-card__undo {
  min-height: 48px;
  border-radius: 12px;
}

.score-divider {
  min-height: 56px;
}

@media (max-width: 599px) {
  .scoring-shell {
    padding-top: 8px;
  }

  .scoring-shell__row {
    min-height: auto;
    align-items: flex-start !important;
  }

  .scoring-shell__header,
  .scoring-shell__games-summary,
  .scoring-shell__history,
  .scoring-shell__start,
  .scoring-shell__live,
  .scoring-shell__complete {
    border-radius: 14px;
  }

  .scoring-shell__header-body {
    padding: 14px !important;
  }

  .scoring-shell__header-brand {
    align-items: flex-start;
  }

  .scoring-shell__brand-mark {
    width: 60px;
    height: 60px;
  }

  .scoring-shell__title {
    font-size: 1.35rem !important;
  }

  .scoring-shell__status-row {
    width: 100%;
    justify-content: space-between;
    margin-top: 6px;
  }

  .score-card {
    min-height: 156px;
    padding: 16px 12px;
  }

  .score-card__score {
    font-size: 3.6rem !important;
  }

  .manual-entry-button {
    min-height: 42px;
    padding-inline: 12px;
  }

  .score-card__undo {
    min-height: 44px;
  }
}
</style>
