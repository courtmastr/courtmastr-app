<template>
  <div class="contextual-nav-container">
    <v-card variant="tonal" color="info" class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon start>mdi-information</v-icon>
        Tournament Status: {{ tournamentStatus }}
      </v-card-title>
      <v-card-text>
        <div class="status-actions d-flex flex-wrap gap-2">
          <v-btn 
            v-if="tournamentStatus === 'setup'" 
            color="primary" 
            @click="navigateToBrackets"
          >
            Generate Brackets
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'registration'" 
            color="success" 
            @click="startTournament"
          >
            Start Tournament
          </v-btn>
          <v-btn 
            v-if="tournamentStatus === 'active' && !isInMatchControl" 
            color="warning" 
            @click="navigateToMatchControl"
          >
            Enter Match Control
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
            color="secondary" 
            @click="viewResults"
          >
            View Results
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';

const router = useRouter();
const tournamentStore = useTournamentStore();
const route = useRoute();

const tournamentStatus = computed(() => tournamentStore.currentTournament?.status || 'setup');
const isInMatchControl = computed(() => route.path.includes('/match-control'));

async function navigateToBrackets() {
  // Navigate to bracket generation
  const tournamentId = tournamentStore.currentTournament?.id;
  if (tournamentId) {
    router.push(`/tournaments/${tournamentId}/brackets`);
  }
}

async function startTournament() {
  // Logic to start tournament
  const tournamentId = tournamentStore.currentTournament?.id;
  if (tournamentId) {
    await tournamentStore.updateTournamentStatus(tournamentId, 'active' as const);
  }
}

async function navigateToMatchControl() {
  const tournamentId = tournamentStore.currentTournament?.id;
  if (tournamentId) {
    router.push(`/tournaments/${tournamentId}/match-control`);
  }
}

async function exitMatchControl() {
  const tournamentId = tournamentStore.currentTournament?.id;
  if (tournamentId) {
    router.push(`/tournaments/${tournamentId}`);
  }
}

// function navigateToCourts() {
//   const tournamentId = tournamentStore.currentTournament?.id;
//   if (tournamentId) {
//     router.push(`/tournaments/${tournamentId}/courts`);
//   }
// }

async function viewResults() {
   const tournamentId = tournamentStore.currentTournament?.id;
   if (tournamentId) {
     router.push(`/tournaments/${tournamentId}/results`);
   }
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