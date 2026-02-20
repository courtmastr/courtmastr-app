<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import EmptyState from '@/components/common/EmptyState.vue';
import type { Tournament } from '@/types';

const router = useRouter();
const tournamentStore = useTournamentStore();
const authStore = useAuthStore();

const tournaments = computed(() => tournamentStore.tournaments);
const loading = computed(() => tournamentStore.loading);
const isAdmin = computed(() => authStore.isAdmin);

onMounted(() => {
  tournamentStore.subscribeTournaments();
});

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'grey',
    registration: 'info',
    active: 'success',
    completed: 'secondary',
    cancelled: 'error',
  };
  return colors[status] || 'grey';
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    draft: 'mdi-pencil',
    registration: 'mdi-account-plus',
    active: 'mdi-play-circle',
    completed: 'mdi-check-circle',
    cancelled: 'mdi-cancel',
  };
  return icons[status] || 'mdi-help-circle';
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function viewTournament(tournament: Tournament): void {
  router.push(`/tournaments/${tournament.id}`);
}
</script>

<template>
  <v-container>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col>
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold">
              Tournaments
            </h1>
            <p class="text-body-2 text-grey">
              Manage and view tournaments
            </p>
          </div>
          <v-btn
            v-if="isAdmin"
            color="primary"
            prepend-icon="mdi-plus"
            @click="router.push('/tournaments/create')"
          >
            Create Tournament
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Loading State -->
    <v-row v-if="loading && tournaments.length === 0">
      <v-col
        v-for="i in 3"
        :key="i"
        cols="12"
        md="6"
        lg="4"
      >
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-else-if="tournaments.length === 0">
      <v-col cols="12">
        <EmptyState
          icon="mdi-trophy-outline"
          title="No tournaments yet"
          :message="isAdmin ? 'Create your first tournament to get started.' : 'Check back later for upcoming tournaments.'"
          :action="isAdmin ? { label: 'Create Tournament', handler: () => router.push('/tournaments/create') } : undefined"
        />
      </v-col>
    </v-row>

    <!-- Tournament Cards -->
    <v-row v-else>
      <v-col
        v-for="tournament in tournaments"
        :key="tournament.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          class="tournament-card"
          @click="viewTournament(tournament)"
        >
          <v-card-item>
            <template #prepend>
              <v-avatar
                color="primary"
                size="48"
              >
                <v-icon>mdi-trophy</v-icon>
              </v-avatar>
            </template>

            <v-card-title
              style="white-space: normal; line-height: 1.2; height: auto; min-height: 32px;"
              class="mb-1"
            >
              {{ tournament.name }}
            </v-card-title>
            <v-card-subtitle style="white-space: normal; height: auto;">
              {{ formatDate(tournament.startDate) }}
              <span v-if="tournament.location"> - {{ tournament.location }}</span>
            </v-card-subtitle>

            <template #append>
              <v-chip
                :color="getStatusColor(tournament.status)"
                size="small"
              >
                <v-icon
                  start
                  size="small"
                >
                  {{ getStatusIcon(tournament.status) }}
                </v-icon>
                {{ tournament.status }}
              </v-chip>
            </template>
          </v-card-item>

          <v-card-text v-if="tournament.description">
            <p
              class="text-body-2 text-truncate"
              style="white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;"
            >
              {{ tournament.description }}
            </p>
          </v-card-text>

          <v-divider />

          <v-card-actions>
            <v-chip
              size="small"
              variant="outlined"
            >
              <v-icon
                start
                size="small"
              >
                mdi-badminton
              </v-icon>
              {{ tournament.sport }}
            </v-chip>
            <v-chip
              v-if="tournament.format"
              size="small"
              variant="outlined"
              class="ml-2"
            >
              <v-icon
                start
                size="small"
              >
                mdi-tournament
              </v-icon>
              {{ tournament.format.replace('_', ' ') }}
            </v-chip>
            <v-spacer />
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              size="small"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.tournament-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.tournament-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
</style>
