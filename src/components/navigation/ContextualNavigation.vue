<template>
  <div class="contextual-nav-container">
    <v-card
      variant="tonal"
      :color="statusColor"
      class="mb-4"
    >
      <v-card-title class="d-flex align-center">
        <v-icon start>
          mdi-information
        </v-icon>
        Tournament Status: {{ tournamentStatus }}
      </v-card-title>
      <v-card-text>
        <div class="status-actions d-flex flex-wrap gap-2">
          <v-btn 
            v-if="tournamentStatus === 'draft'" 
            color="primary" 
            @click="openSetupTab"
          >
            Setup Categories
          </v-btn>
          <v-btn
            v-if="tournamentStatus === 'draft' && isOrganizer"
            color="success"
            @click="openRegistration"
          >
            Open Registration
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'registration'" 
            color="primary"
            @click="navigateToRegistrations"
          >
            Review Registrations
          </v-btn>
          <v-btn
            v-if="tournamentStatus === 'registration' && isOrganizer"
            color="success" 
            @click="startTournament"
          >
            Start Tournament
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'active' && !isInMatchControl && isOrganizer" 
            color="warning" 
            @click="navigateToMatchControl"
          >
            Enter Match Control
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'active' && isScorekeeper" 
            color="primary"
            @click="navigateToScoring"
          >
            Score Matches
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'active' && isInMatchControl" 
            color="primary" 
            variant="tonal"
            @click="exitMatchControl"
          >
            Exit Match Control
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'completed'" 
            color="primary" 
            @click="viewResults"
          >
            View Leaderboard
          </v-btn>
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
  router.push({
    path: `/tournaments/${tournamentId.value}`,
    query: { tab: 'categories' },
  });
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

.status-actions {
  gap: 8px;
}
</style>
