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
          @click.stop="rail = !rail"
        />
      </template>
    </v-list-item>

    <v-divider />

    <!-- Collapsible Tournament Management Section -->
    <v-list
      nav
      density="compact"
    >
      <v-list-group value="tournament-management">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-tournament"
            title="Tournament Management"
            rounded="lg"
            :ripple="false"
          />
        </template>
        
        <v-list-item
          to="/tournaments"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
        
        <v-list-item
          v-if="isOrganizer"
          to="/tournaments/create"
          prepend-icon="mdi-plus-circle"
          title="Create Tournament"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
      </v-list-group>

      <!-- Collapsible Live Operations Section -->
      <v-list-group
        v-if="currentTournamentId"
        value="live-operations"
      >
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-monitor"
            title="Live Operations"
            rounded="lg"
            :ripple="false"
          />
        </template>
        
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/match-control`"
          prepend-icon="mdi-controller"
          title="Match Control"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
        
        <v-list-item
          v-if="isOrganizer"
          :to="`/tournaments/${currentTournamentId}/match-control`"
          prepend-icon="mdi-stadium"
          title="Court Management"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
        
        <v-list-item
          v-if="isScorekeeper"
          :to="`/tournaments/${currentTournamentId}/matches`"
          prepend-icon="mdi-scoreboard"
          title="Score Matches"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
      </v-list-group>

      <!-- Collapsible Registration Section -->
      <v-list-group
        v-if="currentTournamentId && isOrganizer"
        value="registration"
      >
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-account-multiple"
            title="Registration"
            rounded="lg"
            :ripple="false"
          />
        </template>
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/registrations`"
          prepend-icon="mdi-format-list-bulleted"
          title="Manage Registrations"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />

        <v-list-item
          :to="`/tournaments/${currentTournamentId}/participants`"
          prepend-icon="mdi-account-group"
          title="Participants"
          rounded="lg"
          class="ml-4"
          :ripple="false"
        />
      </v-list-group>
    </v-list>

    <!-- User Menu at Bottom -->
    <template #append>
      <v-list
        nav
        density="compact"
      >
        <v-list-group value="user-menu">
          <template #activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-cog"
              title="Settings"
              rounded="lg"
              :ripple="false"
            />
          </template>
          
          <v-list-item
            v-if="currentTournamentId && isOrganizer"
            :to="`/tournaments/${currentTournamentId}/settings`"
            prepend-icon="mdi-cog"
            title="Tournament Settings"
            rounded="lg"
            class="ml-4"
            :ripple="false"
          />

          <v-list-item
            v-if="currentTournamentId"
            :to="`/tournaments/${currentTournamentId}/leaderboard`"
            prepend-icon="mdi-podium-gold"
            title="Leaderboard"
            rounded="lg"
            class="ml-4"
            :ripple="false"
          />
          
          <v-divider class="my-2 ml-4" />
          
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            rounded="lg"
            class="ml-4"
            :ripple="false"
            @click="handleLogout"
          />
        </v-list-group>
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
const isScorekeeper = computed(() => authStore.isScorekeeper);
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

// Group active state
:deep(.v-list-group__items) {
  .v-list-item {
    padding-left: 24px !important;
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 0;
      background-color: $primary-base;
      transition: height 0.2s ease;
      border-radius: 0 4px 4px 0;
    }
    
    &.v-list-item--active::before {
      height: 70%;
    }
  }
}
</style>
