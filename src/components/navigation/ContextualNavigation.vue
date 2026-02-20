<template>
  <div class="contextual-nav-container">
    <v-card
      variant="tonal"
      :color="statusColor"
      class="mb-4"
    >
      <v-card-text class="pa-4">
        <!-- Step indicator -->
        <div class="d-flex align-center mb-3">
          <v-icon
            start
            size="18"
            class="mr-1"
          >
            {{ stepIcon }}
          </v-icon>
          <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase tracking-wide">
            Step {{ currentStep }} of 4
          </span>
          <v-divider
            class="mx-3"
            vertical
            thickness="1"
            style="height:14px;opacity:.3"
          />
          <span class="text-caption text-medium-emphasis">
            {{ stepLabel }}
          </span>
        </div>

        <!-- What to do next -->
        <div class="text-body-2 font-weight-medium mb-3">
          {{ nextStepHint }}
        </div>

        <!-- Actions with hints -->
        <div class="d-flex flex-wrap gap-4">

          <!-- DRAFT -->
          <div
            v-if="tournamentStatus === 'draft'"
            class="action-block"
          >
            <v-btn
              color="primary"
              @click="openSetupTab"
            >
              <v-icon start>mdi-shape-plus</v-icon>
              Setup Categories
            </v-btn>
            <div class="action-hint">
              Define event types (e.g. Men's Singles, Women's Doubles). Required before opening registration.
            </div>
          </div>

          <div
            v-if="tournamentStatus === 'draft' && isOrganizer"
            class="action-block"
          >
            <v-btn
              color="success"
              @click="openRegistration"
            >
              <v-icon start>mdi-account-plus</v-icon>
              Open Registration
            </v-btn>
            <div class="action-hint">
              Once categories are set, allow players to sign up online.
            </div>
          </div>

          <!-- REGISTRATION -->
          <div
            v-if="tournamentStatus === 'registration'"
            class="action-block"
          >
            <v-btn
              color="primary"
              @click="navigateToRegistrations"
            >
              <v-icon start>mdi-clipboard-check</v-icon>
              Review Registrations
            </v-btn>
            <div class="action-hint">
              Approve or reject player sign-ups. Build the final roster before play begins.
            </div>
          </div>

          <div
            v-if="tournamentStatus === 'registration' && isOrganizer"
            class="action-block"
          >
            <v-btn
              color="success"
              @click="startTournament"
            >
              <v-icon start>mdi-play</v-icon>
              Start Tournament
            </v-btn>
            <div class="action-hint">
              Locks the roster and generates brackets. Do this only when all players are approved.
            </div>
          </div>

          <!-- ACTIVE -->
          <div
            v-if="tournamentStatus === 'active' && !isInMatchControl && isOrganizer"
            class="action-block"
          >
            <v-btn
              color="warning"
              @click="navigateToMatchControl"
            >
              <v-icon start>mdi-view-dashboard</v-icon>
              Enter Match Control
            </v-btn>
            <div class="action-hint">
              Assign courts, call matches, and monitor live scores from one screen.
            </div>
          </div>

          <div
            v-if="tournamentStatus === 'active' && isScorekeeper"
            class="action-block"
          >
            <v-btn
              color="primary"
              @click="navigateToScoring"
            >
              <v-icon start>mdi-scoreboard</v-icon>
              Score Matches
            </v-btn>
            <div class="action-hint">
              Enter scores for your assigned matches as they finish.
            </div>
          </div>

          <div
            v-if="tournamentStatus === 'active' && isInMatchControl"
            class="action-block"
          >
            <v-btn
              color="primary"
              variant="tonal"
              @click="exitMatchControl"
            >
              <v-icon start>mdi-arrow-left</v-icon>
              Exit Match Control
            </v-btn>
            <div class="action-hint">
              Return to the tournament overview dashboard.
            </div>
          </div>

          <!-- COMPLETED -->
          <div
            v-if="tournamentStatus === 'completed'"
            class="action-block"
          >
            <v-btn
              color="primary"
              @click="viewResults"
            >
              <v-icon start>mdi-trophy</v-icon>
              View Leaderboard
            </v-btn>
            <div class="action-hint">
              See final standings, rankings, and results for all categories.
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

const router = useRouter();
const tournamentStore = useTournamentStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const route = useRoute();

const tournamentId = computed(() => {
  const routeTournamentId = route.params.tournamentId as string | undefined;
  return routeTournamentId || tournamentStore.currentTournament?.id || '';
});
const tournamentStatus = computed(() => tournamentStore.currentTournament?.status || 'draft');
const isOrganizer = computed(() => authStore.isOrganizer);
const isScorekeeper = computed(() => authStore.isScorekeeper);
const isInMatchControl = computed(() => route.path.includes('/match-control'));
const statusColor = computed(() => {
  if (tournamentStatus.value === 'active') return 'success';
  if (tournamentStatus.value === 'registration') return 'info';
  if (tournamentStatus.value === 'completed') return 'secondary';
  return 'primary';
});

const currentStep = computed(() => {
  if (tournamentStatus.value === 'draft') return 1;
  if (tournamentStatus.value === 'registration') return 2;
  if (tournamentStatus.value === 'active') return 3;
  return 4;
});

const stepLabel = computed(() => {
  if (tournamentStatus.value === 'draft') return 'Draft — Configure your tournament';
  if (tournamentStatus.value === 'registration') return 'Registration — Players signing up';
  if (tournamentStatus.value === 'active') return 'Live — Tournament in progress';
  return 'Completed — Tournament finished';
});

const stepIcon = computed(() => {
  if (tournamentStatus.value === 'draft') return 'mdi-pencil-box-outline';
  if (tournamentStatus.value === 'registration') return 'mdi-account-group';
  if (tournamentStatus.value === 'active') return 'mdi-lightning-bolt';
  return 'mdi-trophy';
});

const nextStepHint = computed(() => {
  if (tournamentStatus.value === 'draft')
    return 'Create your event categories first, then open registration so players can sign up.';
  if (tournamentStatus.value === 'registration')
    return 'Review and approve player sign-ups. When the roster is complete, start the tournament to generate brackets.';
  if (tournamentStatus.value === 'active')
    return 'Use Match Control to assign courts and call matches. Scorekeepers can enter scores in real time.';
  return 'The tournament is over. Check final standings on the leaderboard.';
});

onMounted(async () => {
  if (!tournamentId.value) return;
  if (tournamentStore.currentTournament?.id === tournamentId.value) return;

  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch (error) {
    console.error('Error loading tournament for contextual navigation:', error);
  }
});

async function openRegistration() {
  if (!tournamentId.value) return;
  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, 'registration');
    notificationStore.showToast('success', 'Registration opened');
  } catch (error) {
    console.error('Failed to open registration:', error);
    notificationStore.showToast('error', 'Failed to open registration');
  }
}

function openSetupTab() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}/categories`);
}

function navigateToRegistrations() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}/registrations`);
}

async function startTournament() {
  if (!tournamentId.value) return;

  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, 'active');
    notificationStore.showToast('success', 'Tournament started');
  } catch (error) {
    console.error('Failed to start tournament:', error);
    notificationStore.showToast('error', 'Failed to start tournament');
  }
}

function navigateToMatchControl() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}/match-control`);
}

function navigateToScoring() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}/matches`);
}

function exitMatchControl() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}`);
}

function viewResults() {
  if (!tournamentId.value) return;
  router.push(`/tournaments/${tournamentId.value}/leaderboard`);
}
</script>

<style scoped>
.contextual-nav-container {
  margin-bottom: 16px;
}

.action-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.action-hint {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.4;
  max-width: 220px;
}

.tracking-wide {
  letter-spacing: 0.05em;
}
</style>
