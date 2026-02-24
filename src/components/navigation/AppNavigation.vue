<template>
  <v-navigation-drawer
    v-model="drawer"
    :rail="rail"
    @click="rail = false"
  >
    <!-- Branding Section -->
    <v-list-item
      class="branding-section"
      nav
      :ripple="false"
    >
      <template #prepend>
        <div class="brand-logo-container">
          <img
            v-if="!rail"
            src="@/assets/brand/courtmaster-lockup.svg"
            alt="CourtMaster"
            class="app-logo-expanded"
          >
          <img
            v-else
            src="@/assets/brand/courtmaster-mark.svg"
            alt="CourtMaster"
            class="app-logo-collapsed"
          >
        </div>
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
          v-if="smartBracketPath"
          :to="smartBracketPath"
          prepend-icon="mdi-source-branch"
          title="Smart Bracket"
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

        <!-- Public / Shareable links -->
        <v-divider class="my-2" />
        <v-list-subheader v-if="!rail">
          Public
        </v-list-subheader>
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/bracket`"
          prepend-icon="mdi-tournament"
          title="Public Bracket"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/schedule`"
          prepend-icon="mdi-calendar-clock"
          title="Public Schedule"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          :to="`/tournaments/${currentTournamentId}/score`"
          prepend-icon="mdi-scoreboard"
          title="Score Entry"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          :to="`/obs/${currentTournamentId}/scoreboard`"
          prepend-icon="mdi-television-play"
          title="OBS Scoreboard"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          href=""
          prepend-icon="mdi-video-marker"
          title="OBS Score Bug"
          rounded="lg"
          :ripple="false"
          @click.prevent="showObsHelpDialog = true"
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
    <!-- OBS Score Bug Help Dialog -->
    <v-dialog
      v-model="showObsHelpDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title class="text-h5 pa-4">
          <v-icon
            icon="mdi-video-marker"
            class="mr-2"
          />
          OBS Score Bug URL
        </v-card-title>
        <v-card-text class="pa-4">
          <p class="mb-4">
            The Score Bug shows a single match score. Use it for featured matches on your stream.
          </p>
          <v-alert
            type="info"
            variant="tonal"
            class="mb-4"
          >
            <strong>Scoreboard URL (All Matches):</strong><br>
            <code>{{ `${appOrigin}/obs/${currentTournamentId}/scoreboard` }}</code>
          </v-alert>
          <p class="text-body-2 mb-2">
            For a specific match, use this URL pattern:
          </p>
          <code class="d-block pa-2 bg-grey-lighten-3 rounded mb-4">
            {{ `${appOrigin}/obs/${currentTournamentId}/match/{matchId}?theme=dark` }}
          </code>
          <p class="text-caption text-grey">
            Replace <code>{matchId}</code> with the actual match ID from the match URL.
            Add <code>?theme=light</code> for light theme.
          </p>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            color="primary"
            @click="showObsHelpDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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

const isOrganizer = computed(() => authStore.isOrganizer);
const categories = computed(() => tournamentStore.categories);
const currentTournamentId = computed(() => {
  // Try to get tournament ID from route, otherwise use the current tournament from store
  const routeParams = route.params;
  return routeParams.tournamentId as string || tournamentStore.currentTournament?.id || '';
});

const smartBracketPath = computed(() => {
  const tournamentId = currentTournamentId.value;
  if (!tournamentId) return '';

  const routeCategoryId = route.params.categoryId as string | undefined;
  const categoryId = routeCategoryId || categories.value[0]?.id;
  if (!categoryId) return '';

  return `/tournaments/${tournamentId}/categories/${categoryId}/smart-bracket`;
});

const appOrigin = computed(() => typeof window !== 'undefined' ? window.location.origin : '');

const showObsHelpDialog = ref(false);
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

// Branding Section
.branding-section {
  min-height: 64px;
  display: flex;
  align-items: center;
  margin-top: 8px;
  margin-bottom: 8px;
}

.brand-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.app-logo-expanded {
  height: 32px;
  width: auto;
}

.app-logo-collapsed {
  height: 28px;
  width: auto;
  margin-left: 2px;
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
