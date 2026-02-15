<template>
  <v-list nav>
    <!-- Common items for all users -->
    <v-list-item
      to="/tournaments"
      prepend-icon="mdi-tournament"
      title="Tournaments"
    />

    <!-- Admin-only items -->
    <template v-if="isAdmin">
      <v-list-item
        to="/tournaments/create"
        prepend-icon="mdi-plus-circle"
        title="Create Tournament"
      />
    </template>

    <!-- Organizer items -->
    <template v-if="isAdmin || isOrganizer">
      <v-list-item
        to="/tournaments"
        prepend-icon="mdi-view-dashboard"
        title="Tournament Management"
      />
    </template>

    <!-- Scorekeeper items -->
    <template v-if="(isAdmin || isOrganizer || isScorekeeper) && currentTournamentId">
      <v-list-item
        :to="`/tournaments/${currentTournamentId}/matches`"
        prepend-icon="mdi-scoreboard"
        title="Score Matches"
      />
    </template>

    <!-- Player-specific items -->
    <template v-if="isPlayer && currentTournamentId">
      <v-list-item
        :to="`/tournaments/${currentTournamentId}/register`"
        prepend-icon="mdi-account-card-details"
        title="Register"
      />
    </template>
  </v-list>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const route = useRoute();

const isAdmin = computed(() => authStore.userRole === 'admin');
const isOrganizer = computed(() => authStore.userRole === 'organizer');
const isScorekeeper = computed(() => authStore.userRole === 'scorekeeper');
const isPlayer = computed(() => authStore.userRole === 'player');
const currentTournamentId = computed(() => {
  const routeTournamentId = route.params.tournamentId as string | undefined;
  return routeTournamentId || tournamentStore.currentTournament?.id || '';
});
</script>
