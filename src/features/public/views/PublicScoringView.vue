<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { BADMINTON_CONFIG } from '@/types';
import type { Match } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const courts = computed(() => tournamentStore.courts);

// View state
const selectedMatch = ref<Match | null>(null);
const scoringMode = ref(false);

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
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});

function getParticipantName(registrationId: string | undefined): string {
  if (!registrationId) return 'TBD';

  const registration = registrationStore.registrations.find((r) => r.id === registrationId);
  if (!registration) return 'Unknown';

  if (registration.teamName) return registration.teamName;

  const player = registrationStore.players.find((p) => p.id === registration.playerId);
  if (player) return `${player.firstName} ${player.lastName}`;

  return 'Unknown';
}

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
  // Subscribe to this specific match for real-time updates
  matchStore.subscribeMatch(tournamentId.value, match.id);
  scoringMode.value = true;
}

function backToList() {
  scoringMode.value = false;
  selectedMatch.value = null;
  matchStore.clearCurrentMatch();
}

async function startMatch() {
  if (!selectedMatch.value) return;

  try {
    await matchStore.startMatch(tournamentId.value, selectedMatch.value.id);
  } catch (error) {
    console.error('Failed to start match:', error);
  }
}

async function addPoint(participant: 'participant1' | 'participant2') {
  if (!selectedMatch.value || isMatchComplete.value) return;

  try {
    await matchStore.updateScore(tournamentId.value, selectedMatch.value.id, participant);
  } catch (error) {
    console.error('Failed to update score:', error);
  }
}

async function removePoint(participant: 'participant1' | 'participant2') {
  if (!selectedMatch.value || isMatchComplete.value) return;

  try {
    await matchStore.decrementScore(tournamentId.value, selectedMatch.value.id, participant);
  } catch (error) {
    console.error('Failed to update score:', error);
  }
}

// Keep selectedMatch in sync with store updates
const currentMatch = computed(() => matchStore.currentMatch);

// Watch for updates from the store
onMounted(() => {
  // Update selectedMatch when store updates
  setInterval(() => {
    if (selectedMatch.value && currentMatch.value && selectedMatch.value.id === currentMatch.value.id) {
      selectedMatch.value = currentMatch.value;
    }
  }, 500);
});
</script>

<template>
  <v-container fluid class="pa-2">
    <!-- Header -->
    <div class="d-flex align-center mb-4">
      <v-btn
        v-if="scoringMode"
        icon="mdi-arrow-left"
        variant="text"
        @click="backToList"
      />
      <div class="ml-2">
        <h1 class="text-h6 font-weight-bold">{{ tournament?.name }}</h1>
        <p class="text-caption text-grey">
          {{ scoringMode ? 'Scoring' : 'Select a match to score' }}
        </p>
      </div>
    </div>

    <!-- Match Selection List -->
    <template v-if="!scoringMode">
      <v-card v-if="scorableMatches.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-badminton</v-icon>
        <p class="text-body-1 text-grey mt-4">No matches ready to score</p>
        <p class="text-caption text-grey">Matches will appear here when assigned to a court</p>
      </v-card>

      <v-list v-else class="pa-0">
        <v-card
          v-for="match in scorableMatches"
          :key="match.id"
          class="mb-3"
          :color="match.status === 'in_progress' ? 'success-lighten-5' : undefined"
          @click="selectMatch(match)"
        >
          <v-card-item>
            <template #prepend>
              <v-avatar
                :color="match.status === 'in_progress' ? 'success' : 'primary'"
                size="48"
              >
                <v-icon v-if="match.status === 'in_progress'">mdi-play</v-icon>
                <span v-else class="text-caption">#{{ match.matchNumber }}</span>
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
      <!-- Match Info -->
      <v-card class="mb-3" variant="outlined">
        <v-card-text class="pa-2 text-center">
          <v-chip size="small" variant="tonal" class="mr-2">
            {{ getCategoryName(selectedMatch.categoryId) }}
          </v-chip>
          <v-chip size="small" color="primary" variant="tonal">
            {{ getCourtName(selectedMatch.courtId) }}
          </v-chip>
        </v-card-text>
      </v-card>

      <!-- Games Score -->
      <v-card v-if="selectedMatch.scores && selectedMatch.scores.length > 0" class="mb-3">
        <v-card-text class="text-center py-2">
          <div class="text-h4 font-weight-bold">
            {{ gamesWon.p1 }} - {{ gamesWon.p2 }}
          </div>
          <p class="text-caption text-grey mb-0">Games</p>
        </v-card-text>
      </v-card>

      <!-- Start Match Button -->
      <v-card v-if="selectedMatch.status === 'ready'" class="mb-3 text-center">
        <v-card-text class="py-8">
          <p class="text-body-1 mb-4">Ready to start?</p>
          <v-btn
            color="success"
            size="x-large"
            @click="startMatch"
          >
            <v-icon start size="large">mdi-play</v-icon>
            Start Match
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Scoring Buttons -->
      <template v-else-if="selectedMatch.status === 'in_progress' && currentGame">
        <!-- Current Game Label -->
        <div class="text-center mb-2">
          <v-chip color="success" variant="flat" size="small">
            <v-icon start size="small">mdi-record</v-icon>
            Game {{ currentGame.gameNumber }}
          </v-chip>
        </div>

        <v-row>
          <!-- Player 1 -->
          <v-col cols="6" class="pr-1">
            <v-card
              class="score-card pa-4"
              :class="{ 'score-leading': currentGame.score1 > currentGame.score2 }"
              @click="addPoint('participant1')"
            >
              <div class="text-center">
                <p class="text-body-2 font-weight-medium mb-2 text-truncate">
                  {{ getParticipantName(selectedMatch.participant1Id) }}
                </p>
                <div class="text-h1 font-weight-bold score-number">
                  {{ currentGame.score1 }}
                </div>
                <v-btn
                  variant="text"
                  size="small"
                  class="mt-2"
                  @click.stop="removePoint('participant1')"
                  :disabled="currentGame.score1 === 0"
                >
                  <v-icon>mdi-minus</v-icon>
                </v-btn>
              </div>
            </v-card>
          </v-col>

          <!-- Player 2 -->
          <v-col cols="6" class="pl-1">
            <v-card
              class="score-card pa-4"
              :class="{ 'score-leading': currentGame.score2 > currentGame.score1 }"
              @click="addPoint('participant2')"
            >
              <div class="text-center">
                <p class="text-body-2 font-weight-medium mb-2 text-truncate">
                  {{ getParticipantName(selectedMatch.participant2Id) }}
                </p>
                <div class="text-h1 font-weight-bold score-number">
                  {{ currentGame.score2 }}
                </div>
                <v-btn
                  variant="text"
                  size="small"
                  class="mt-2"
                  @click.stop="removePoint('participant2')"
                  :disabled="currentGame.score2 === 0"
                >
                  <v-icon>mdi-minus</v-icon>
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Instructions -->
        <p class="text-center text-caption text-grey mt-3">
          Tap the score to add a point
        </p>

        <!-- Previous Games -->
        <v-card v-if="selectedMatch.scores.filter((s: any) => s.isComplete).length > 0" class="mt-4">
          <v-card-text class="py-2">
            <div class="d-flex justify-center flex-wrap gap-2">
              <v-chip
                v-for="(game, index) in selectedMatch.scores.filter((s: any) => s.isComplete)"
                :key="index"
                :color="game.winnerId === selectedMatch.participant1Id ? 'success' : 'error'"
                variant="tonal"
                size="small"
              >
                G{{ game.gameNumber }}: {{ game.score1 }}-{{ game.score2 }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </template>

      <!-- Match Complete -->
      <v-card v-else-if="isMatchComplete" class="text-center">
        <v-card-text class="py-8">
          <v-icon size="64" color="success" class="mb-4">mdi-trophy</v-icon>
          <h2 class="text-h5 font-weight-bold">Match Complete!</h2>
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
  </v-container>
</template>

<style scoped>
.score-card {
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.score-card:active {
  transform: scale(0.98);
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.score-leading {
  border: 2px solid rgb(var(--v-theme-success));
  background-color: rgba(var(--v-theme-success), 0.05);
}

.score-number {
  font-size: 4rem;
  line-height: 1;
}

.success-lighten-5 {
  background-color: rgba(var(--v-theme-success), 0.05) !important;
}
</style>
