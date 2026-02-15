<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useActivityStore } from '@/stores/activities';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import ActivityFeed from '@/components/ActivityFeed.vue';

const route = useRoute();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const activityStore = useActivityStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const courts = computed(() => tournamentStore.courts);
const inProgressMatches = computed(() => matchStore.inProgressMatches);
const recentlyCompletedMatches = computed(() =>
  matchStore.completedMatches
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
    .slice(0, 5)
);
const activities = computed(() => activityStore.recentActivities);
const notFound = ref(false);

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  activityStore.subscribeActivities(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  activityStore.unsubscribe();
});

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return 'Court';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Court';
}

function getCurrentScore(match: any): string {
  if (match.scores.length === 0) return '0 - 0';
  const current = match.scores[match.scores.length - 1];
  return `${current.score1} - ${current.score2}`;
}

function getGamesScore(match: any): string {
  let p1 = 0;
  let p2 = 0;
  for (const game of match.scores) {
    if (game.isComplete) {
      if (game.winnerId === match.participant1Id) p1++;
      else if (game.winnerId === match.participant2Id) p2++;
    }
  }
  return `${p1} - ${p2}`;
}
</script>

<template>
  <v-container fluid>
    <!-- Not Found -->
    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon size="64" color="grey-lighten-1">mdi-alert-circle-outline</v-icon>
            <h2 class="text-h6 mt-4">Tournament not found</h2>
            <p class="text-body-2 text-grey mt-2">
              This tournament does not exist or has been removed.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-else>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div v-if="tournament">
          <h1 class="text-h4 font-weight-bold">{{ tournament.name }}</h1>
          <p class="text-body-2 text-grey">Live Scores</p>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <!-- Live Matches -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon start color="success">mdi-broadcast</v-icon>
            Live Matches
            <v-chip v-if="inProgressMatches.length > 0" color="success" size="small" class="ml-2">
              {{ inProgressMatches.length }} active
            </v-chip>
          </v-card-title>

          <v-card-text v-if="inProgressMatches.length === 0" class="text-center py-8">
            <v-icon size="64" color="grey-lighten-1">mdi-badminton</v-icon>
            <p class="text-body-1 text-grey mt-4">No matches in progress</p>
          </v-card-text>

          <v-list v-else>
            <v-list-item
              v-for="match in inProgressMatches"
              :key="match.id"
              class="live-match-item"
            >
              <v-row align="center" no-gutters>
                <v-col cols="12" sm="3">
                  <v-chip color="success" size="small" variant="tonal">
                    <v-icon start size="small">mdi-record</v-icon>
                    {{ getCourtName(match.courtId) }}
                  </v-chip>
                </v-col>

                <v-col cols="12" sm="6" class="text-center my-2 my-sm-0">
                  <div class="d-flex align-center justify-center">
                    <div class="text-right flex-grow-1">
                      <span class="font-weight-medium">
                        {{ getParticipantName(match.participant1Id) }}
                      </span>
                    </div>

                    <div class="score-display mx-4">
                      <div class="current-score text-h4 font-weight-bold">
                        {{ getCurrentScore(match) }}
                      </div>
                      <div class="games-score text-caption text-grey">
                        Games: {{ getGamesScore(match) }}
                      </div>
                    </div>

                    <div class="text-left flex-grow-1">
                      <span class="font-weight-medium">
                        {{ getParticipantName(match.participant2Id) }}
                      </span>
                    </div>
                  </div>
                </v-col>

                <v-col cols="12" sm="3" class="text-right">
                  <span class="text-caption text-grey">Round {{ match.round }}</span>
                </v-col>
              </v-row>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Recent Results -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-history</v-icon>
            Recent Results
          </v-card-title>

          <v-card-text v-if="recentlyCompletedMatches.length === 0" class="text-center py-8">
            <p class="text-body-2 text-grey">No completed matches yet</p>
          </v-card-text>

          <v-list v-else density="compact">
            <v-list-item
              v-for="match in recentlyCompletedMatches"
              :key="match.id"
            >
              <v-list-item-title class="text-body-2">
                <span :class="{ 'font-weight-bold': match.winnerId === match.participant1Id }">
                  {{ getParticipantName(match.participant1Id) }}
                </span>
                <span class="text-grey mx-1">vs</span>
                <span :class="{ 'font-weight-bold': match.winnerId === match.participant2Id }">
                  {{ getParticipantName(match.participant2Id) }}
                </span>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ getGamesScore(match) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>

        <!-- Court Status -->
        <v-card class="mt-4">
          <v-card-title>
            <v-icon start>mdi-grid</v-icon>
            Court Status
          </v-card-title>

          <v-card-text>
            <v-chip
              v-for="court in courts"
              :key="court.id"
              :color="court.status === 'in_use' ? 'success' : court.status === 'maintenance' ? 'warning' : 'grey'"
              class="ma-1"
              variant="tonal"
            >
              <v-icon start size="small">
                {{ court.status === 'in_use' ? 'mdi-play' : court.status === 'maintenance' ? 'mdi-wrench' : 'mdi-check' }}
              </v-icon>
              {{ court.name }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Activity Feed -->
    <v-row class="mt-4">
      <v-col cols="12">
        <ActivityFeed
          :activities="activities"
          :max-items="15"
          title="Live Updates"
        />
      </v-col>
    </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.live-match-item {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding: 16px;
}

.live-match-item:last-child {
  border-bottom: none;
}

.score-display {
  min-width: 100px;
}

.current-score {
  line-height: 1.2;
}
</style>
