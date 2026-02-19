<template>
  <v-navigation-drawer
    v-model="drawer"
    :rail="rail"
    @click="rail = false"
  >
    <!-- User Profile Section -->
    <v-list-item
      :title="currentUser?.displayName || 'User'"
      :subtitle="currentUser?.email"
      nav
      :ripple="false"
    >
      <template #prepend>
        <v-avatar color="primary">
          <span class="text-h6">{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
        </v-avatar>
      </template>
      <template #append>
        <v-btn
          v-if="!rail"
          icon="mdi-chevron-left"
          variant="text"
          aria-label="Collapse sidebar"
          @click.stop="rail = !rail"
        />
      </template>
    </v-list-item>

    <v-divider />

    <v-list
      nav
      density="compact"
    >
      <!-- Always visible -->
      <v-list-item
        to="/tournaments"
        prepend-icon="mdi-format-list-bulleted"
        title="Tournaments"
        rounded="lg"
        :ripple="false"
      />
      <v-list-item
        v-if="isOrganizer"
        to="/tournaments/create"
        prepend-icon="mdi-plus-circle"
        title="Create Tournament"
        rounded="lg"
        :ripple="false"
      />

      <!-- Tournament-specific (only when a tournament is active) -->
      <template v-if="currentTournamentId">
        <v-divider class="my-2" />

        <v-list-item
          :to="`/tournaments/${currentTournamentId}`"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/match-control`"
          prepend-icon="mdi-controller"
          title="Match Control"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/live-view`"
          prepend-icon="mdi-monitor-eye"
          title="Live View"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/categories`"
          prepend-icon="mdi-tag-multiple"
          title="Categories"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/courts`"
          prepend-icon="mdi-stadium"
          title="Courts"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/brackets`"
          prepend-icon="mdi-tournament"
          title="Brackets"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/registrations`"
          prepend-icon="mdi-account-multiple"
          title="Registrations"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/leaderboard`"
          prepend-icon="mdi-trophy"
          title="Leaderboard"
          rounded="lg"
          :ripple="false"
        />
      </template>
    </v-list>

    <!-- Bottom: Settings + Logout -->
    <template #append>
      <v-list
        nav
        density="compact"
      >
        <v-divider class="mb-2" />
        <v-list-item
          v-if="currentTournamentId && isOrganizer"
          :to="`/tournaments/${currentTournamentId}/settings`"
          prepend-icon="mdi-cog"
          title="Tournament Settings"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          href="/logout"
          prepend-icon="mdi-logout"
          title="Logout"
          rounded="lg"
          :ripple="false"
          @click.prevent="handleLogout"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';

// Allow parent to control drawer state
const drawer = defineModel<boolean>('drawer');

// Persist rail (minimized) state
// Default to false (expanded) for better organizer usability.
const storedRail = localStorage.getItem('courtmaster_sidebar_rail');
const rail = ref(storedRail === null ? false : storedRail === 'true');

watch(rail, (newValue) => {
  localStorage.setItem('courtmaster_sidebar_rail', String(newValue));
});

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const route = useRoute();
const router = useRouter();

const currentUser = computed(() => authStore.currentUser);
const isOrganizer = computed(() => authStore.isOrganizer);
const currentTournamentId = computed(() => {
  // Try to get tournament ID from route, otherwise use the current tournament from store
  const routeParams = route.params;
  return routeParams.tournamentId as string || tournamentStore.currentTournament?.id || '';
});

async function handleLogout(): Promise<void> {
  await authStore.signOut();
  await router.push('/');
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.v-list-item--nav {
  margin-bottom: 4px;
}

// Active state styling using Design System
:deep(.v-list-item--active) {
  background: linear-gradient(90deg, rgba($primary-base, 0.1), rgba($primary-base, 0.05));
  color: $primary-base !important;
  
  &::before {
    opacity: 0; // Disable default Vuetify overlay to use our gradient
  }
  
  .v-list-item__prepend {
    color: $primary-base;
  }
  
  .v-list-item-title {
    font-weight: $font-weight-bold;
  }
}


</style>
