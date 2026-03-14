<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import { useTournamentStore } from '@/stores/tournaments';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import type { VolunteerRole } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const volunteerAccessStore = useVolunteerAccessStore();
const tournament = computed(() => tournamentStore.currentTournament);
const { tournamentLogoUrl } = useTournamentBranding(tournament);

const tournamentName = computed(() => {
  const routeTournamentId = route.params.tournamentId as string | undefined;
  const currentTournament = tournamentStore.currentTournament;

  if (currentTournament && currentTournament.id === routeTournamentId) {
    return currentTournament.name;
  }

  return routeTournamentId ? `Tournament ${routeTournamentId}` : 'Tournament';
});

watch(
  () => route.params.tournamentId as string | undefined,
  async (routeTournamentId) => {
    if (!routeTournamentId) return;
    if (tournamentStore.currentTournament?.id === routeTournamentId) return;

    try {
      await tournamentStore.fetchTournament(routeTournamentId);
    } catch (error) {
      console.error('Error loading tournament branding for volunteer layout:', error);
    }
  },
  { immediate: true }
);

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
      class="volunteer-app-bar"
    >
      <div
        class="volunteer-app-bar__glow"
        aria-hidden="true"
      />

      <div class="volunteer-app-bar__brand">
        <TournamentBrandMark
          :tournament-name="tournamentName"
          :logo-url="tournamentLogoUrl"
          :fallback-icon="volunteerRole === 'scorekeeper' ? 'mdi-scoreboard' : 'mdi-account-check'"
          :width="44"
          :height="44"
          class="volunteer-app-bar__mark"
        />
        <div class="d-flex flex-column">
          <span class="text-overline volunteer-app-bar__eyebrow">Volunteer Mode</span>
          <span class="text-subtitle-1 font-weight-bold volunteer-app-bar__name">{{ tournamentName }}</span>
        </div>
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
  background:
    linear-gradient(150deg, #f7fbff 0%, #eff5ff 30%, #fbf9f6 62%, #eef8f1 100%);
}

.volunteer-app-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  overflow: hidden;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.74);
  backdrop-filter: blur(16px);
}

.volunteer-app-bar__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 18%, rgba(var(--v-theme-primary), 0.16), transparent 28%),
    radial-gradient(circle at 84% 12%, rgba(var(--v-theme-secondary), 0.12), transparent 24%);
}

.volunteer-app-bar__brand {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.volunteer-app-bar__mark {
  flex-shrink: 0;
}

.volunteer-app-bar__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.88);
}

.volunteer-app-bar__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .volunteer-app-bar__mark {
    display: none;
  }
}
</style>
