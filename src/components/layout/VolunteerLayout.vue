<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import type { VolunteerRole } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const volunteerAccessStore = useVolunteerAccessStore();

const tournamentName = computed(() => {
  const routeTournamentId = route.params.tournamentId as string | undefined;
  const currentTournament = tournamentStore.currentTournament;

  if (currentTournament && currentTournament.id === routeTournamentId) {
    return currentTournament.name;
  }

  return routeTournamentId ? `Tournament ${routeTournamentId}` : 'Tournament';
});

const volunteerRole = computed(() => route.meta.volunteerRole as VolunteerRole | undefined);

const volunteerRoleLabel = computed(() => {
  if (volunteerRole.value === 'scorekeeper') {
    return 'Scorekeeper';
  }

  return 'Check-in';
});

const accessRouteName = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'volunteer-scoring-access'
    : 'volunteer-checkin-access'
));

const exitVolunteerMode = async (): Promise<void> => {
  volunteerAccessStore.clearSession();
  await router.push({
    name: accessRouteName.value,
    params: { tournamentId: route.params.tournamentId as string },
  });
};
</script>

<template>
  <v-layout class="volunteer-layout">
    <v-app-bar
      flat
      border="b"
      class="volunteer-app-bar"
    >
      <div class="d-flex flex-column">
        <span class="text-overline text-medium-emphasis">Volunteer Mode</span>
        <span class="text-subtitle-1 font-weight-bold">{{ tournamentName }}</span>
      </div>

      <v-spacer />

      <v-chip
        size="small"
        color="primary"
        variant="tonal"
        class="mr-2"
      >
        {{ volunteerRoleLabel }}
      </v-chip>

      <v-btn
        v-if="volunteerAccessStore.currentSession"
        variant="text"
        @click="exitVolunteerMode"
      >
        Exit volunteer mode
      </v-btn>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-layout>
</template>

<style scoped>
.volunteer-layout {
  min-height: 100vh;
}

.volunteer-app-bar {
  background: rgb(var(--v-theme-surface));
}
</style>
