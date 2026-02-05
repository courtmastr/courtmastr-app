<template>
  <v-navigation-drawer v-model="drawer" :rail="rail" permanent @click="rail = false">
    <!-- User Profile Section -->
    <v-list-item
      :title="currentUser?.displayName || 'User'"
      :subtitle="currentUser?.email"
      nav
    >
      <template #prepend>
        <v-avatar color="primary">
          <span class="text-h6">{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
        </v-avatar>
      </template>
      <template #append>
        <v-btn
          icon="mdi-chevron-left"
          variant="text"
          @click.stop="rail = !rail"
        />
      </template>
    </v-list-item>

    <v-divider />

    <!-- Collapsible Tournament Management Section -->
    <v-list nav density="compact">
      <v-list-group value="tournament-management">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-tournament"
            title="Tournament Management"
            rounded="lg"
          />
        </template>
        
        <v-list-item
          to="/tournaments"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          rounded="lg"
          class="ml-4"
        />
        
        <v-list-item
          to="/tournaments/create"
          prepend-icon="mdi-plus-circle"
          title="Create Tournament"
          rounded="lg"
          class="ml-4"
        />
        
        <v-list-item
          to="/tournaments/archived"
          prepend-icon="mdi-archive"
          title="Archived Tournaments"
          rounded="lg"
          class="ml-4"
        />
      </v-list-group>

      <!-- Collapsible Live Operations Section -->
      <v-list-group value="live-operations">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-monitor"
            title="Live Operations"
            rounded="lg"
          />
        </template>
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/match-control`"
          prepend-icon="mdi-controller"
          title="Match Control"
          rounded="lg"
          class="ml-4"
        />
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/courts`"
          prepend-icon="mdi-stadium"
          title="Court Management"
          rounded="lg"
          class="ml-4"
        />
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/scoring`"
          prepend-icon="mdi-scoreboard"
          title="Scoring Dashboard"
          rounded="lg"
          class="ml-4"
        />
      </v-list-group>

      <!-- Collapsible Registration Section -->
      <v-list-group value="registration">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-account-multiple"
            title="Registration"
            rounded="lg"
          />
        </template>
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/registrations`"
          prepend-icon="mdi-format-list-bulleted"
          title="Manage Registrations"
          rounded="lg"
          class="ml-4"
        />
        
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/participants`"
          prepend-icon="mdi-account-group"
          title="Participants"
          rounded="lg"
          class="ml-4"
        />
      </v-list-group>
    </v-list>

    <!-- User Menu at Bottom -->
    <template #append>
      <v-list nav density="compact">
        <v-list-group value="user-menu">
          <template #activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-cog"
              title="Settings"
              rounded="lg"
            />
          </template>
          
          <v-list-item
            to="/profile"
            prepend-icon="mdi-account"
            title="Profile"
            rounded="lg"
            class="ml-4"
          />
          
          <v-list-item
            to="/preferences"
            prepend-icon="mdi-tune"
            title="Preferences"
            rounded="lg"
            class="ml-4"
          />
          
          <v-divider class="my-2 ml-4" />
          
          <v-list-item
            @click="handleLogout"
            prepend-icon="mdi-logout"
            title="Logout"
            rounded="lg"
            class="ml-4"
          />
        </v-list-group>
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';
import { useRoute } from 'vue-router';

const drawer = ref(true);
const rail = ref(false);

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const route = useRoute();

const currentUser = computed(() => authStore.currentUser);
const currentTournamentId = computed(() => {
  // Try to get tournament ID from route, otherwise use the current tournament from store
  const routeParams = route.params;
  return routeParams.tournamentId as string || tournamentStore.currentTournament?.id || '';
});

function handleLogout() {
  authStore.signOut();
}
</script>