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
const displayMode = ref(false);

const allMatches = computed(() => matchStore.matches);
const tvCompletion = computed(() => {
  const total = allMatches.value.length;
  if (!total) return { completed: 0, total: 0, percent: 0 };
  const completed = allMatches.value.filter(m => m.status === 'completed' || m.status === 'walkover').length;
  return { completed, total, percent: Math.round((completed / total) * 100) };
});
const nextUpMatches = computed(() =>
  allMatches.value
    .filter(m => (m.status === 'ready' || m.status === 'scheduled') && !m.courtId)
    .sort((a: any, b: any) => a.round - b.round || a.matchNumber - b.matchNumber)
    .slice(0, 6)
);

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
  <!-- TV / Display Mode -->
  <div
    v-if="displayMode"
    class="tv-mode"
  >
    <!-- Header: name + progress + exit -->
    <div class="tv-mode__header">
      <div class="tv-mode__title">{{ tournament?.name }}</div>
      <div class="tv-mode__progress">
        <span class="tv-mode__progress-label">
          {{ tvCompletion.completed }}/{{ tvCompletion.total }} complete
        </span>
        <div class="tv-mode__progress-bar">
          <div
            class="tv-mode__progress-fill"
            :style="{ width: tvCompletion.percent + '%' }"
          />
        </div>
        <span class="tv-mode__progress-pct">{{ tvCompletion.percent }}%</span>
      </div>
      <v-btn
        icon="mdi-fullscreen-exit"
        variant="text"
        color="white"
        size="small"
        @click="displayMode = false"
      />
    </div>

    <!-- Court status chips -->
    <div class="tv-mode__courts">
      <v-chip
        v-for="court in courts"
        :key="court.id"
        :color="court.status === 'in_use' ? 'success' : court.status === 'maintenance' ? 'warning' : 'default'"
        variant="tonal"
        size="small"
        class="ma-1"
      >
        <v-icon
          start
          size="small"
        >
          {{ court.status === 'in_use' ? 'mdi-play' : court.status === 'maintenance' ? 'mdi-wrench' : 'mdi-check' }}
        </v-icon>
        {{ court.name }}
      </v-chip>
    </div>

    <!-- Main: Live matches (left) + Next Up (right) -->
    <div class="tv-mode__body">
      <!-- Live match scores -->
      <div class="tv-mode__live">
        <div
          v-if="inProgressMatches.length === 0"
          class="tv-mode__empty"
        >
          <v-icon
            size="64"
            color="grey"
          >
            mdi-badminton
          </v-icon>
          <div class="tv-mode__empty-text">
            No matches in progress
          </div>
        </div>
        <div
          v-else
          class="tv-mode__matches"
        >
          <div
            v-for="match in inProgressMatches"
            :key="match.id"
            class="tv-match-card"
          >
            <div class="tv-match-card__court">
              {{ getCourtName(match.courtId) }}
            </div>
            <div class="tv-match-card__players">
              <div class="tv-match-card__player">{{ getParticipantName(match.participant1Id) }}</div>
              <div class="tv-match-card__score">{{ getCurrentScore(match) }}</div>
              <div class="tv-match-card__player tv-match-card__player--right">{{ getParticipantName(match.participant2Id) }}</div>
            </div>
            <div class="tv-match-card__games">
              Games: {{ getGamesScore(match) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Next Up sidebar -->
      <div
        v-if="nextUpMatches.length > 0"
        class="tv-mode__queue"
      >
        <div class="tv-mode__queue-title">Next Up</div>
        <div
          v-for="(match, i) in nextUpMatches"
          :key="match.id"
          class="tv-queue-item"
        >
          <div class="tv-queue-item__num">{{ i + 1 }}</div>
          <div class="tv-queue-item__names">
            <div class="tv-queue-item__player">{{ getParticipantName(match.participant1Id) }}</div>
            <div class="tv-queue-item__vs">vs</div>
            <div class="tv-queue-item__player">{{ getParticipantName(match.participant2Id) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Normal View -->
  <v-container
    v-else
    fluid
  >
    <!-- Not Found -->
    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              Tournament not found
            </h2>
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
          <div
            v-if="tournament"
            class="d-flex align-center justify-space-between"
          >
            <div>
              <h1 class="text-h4 font-weight-bold">
                {{ tournament.name }}
              </h1>
              <p class="text-body-2 text-grey">
                Live Scores
              </p>
            </div>
            <v-btn
              variant="outlined"
              size="small"
              prepend-icon="mdi-monitor"
              @click="displayMode = true"
            >
              Display Mode
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- Live Matches -->
        <v-col
          cols="12"
          md="8"
        >
          <v-card>
            <v-card-title>
              <v-icon
                start
                color="success"
              >
                mdi-broadcast
              </v-icon>
              Live Matches
              <v-chip
                v-if="inProgressMatches.length > 0"
                color="success"
                size="small"
                class="ml-2"
              >
                {{ inProgressMatches.length }} active
              </v-chip>
            </v-card-title>

            <v-card-text
              v-if="inProgressMatches.length === 0"
              class="text-center py-8"
            >
              <v-icon
                size="64"
                color="grey-lighten-1"
              >
                mdi-badminton
              </v-icon>
              <p class="text-body-1 text-grey mt-4">
                No matches in progress
              </p>
            </v-card-text>

            <v-list v-else>
              <v-list-item
                v-for="match in inProgressMatches"
                :key="match.id"
                class="live-match-item"
              >
                <v-row
                  align="center"
                  no-gutters
                >
                  <v-col
                    cols="12"
                    sm="3"
                  >
                    <v-chip
                      color="success"
                      size="small"
                      variant="tonal"
                    >
                      <v-icon
                        start
                        size="small"
                      >
                        mdi-record
                      </v-icon>
                      {{ getCourtName(match.courtId) }}
                    </v-chip>
                  </v-col>

                  <v-col
                    cols="12"
                    sm="6"
                    class="text-center my-2 my-sm-0"
                  >
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

                  <v-col
                    cols="12"
                    sm="3"
                    class="text-right"
                  >
                    <span class="text-caption text-grey">Round {{ match.round }}</span>
                  </v-col>
                </v-row>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>

        <!-- Recent Results -->
        <v-col
          cols="12"
          md="4"
        >
          <v-card>
            <v-card-title>
              <v-icon start>
                mdi-history
              </v-icon>
              Recent Results
            </v-card-title>

            <v-card-text
              v-if="recentlyCompletedMatches.length === 0"
              class="text-center py-8"
            >
              <p class="text-body-2 text-grey">
                No completed matches yet
              </p>
            </v-card-text>

            <v-list
              v-else
              density="compact"
            >
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
              <v-icon start>
                mdi-grid
              </v-icon>
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
                <v-icon
                  start
                  size="small"
                >
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
/* TV / Display Mode */
.tv-mode {
  position: fixed;
  inset: 0;
  background: #0a0a0a;
  color: #fff;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px 16px;
}

.tv-mode__header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 12px;
}

.tv-mode__title {
  font-size: 1.6rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 340px;
}

.tv-mode__progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tv-mode__progress-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}

.tv-mode__progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.tv-mode__progress-fill {
  height: 100%;
  background: #4caf50;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.tv-mode__progress-pct {
  font-size: 0.8rem;
  font-weight: 700;
  color: #4caf50;
  min-width: 36px;
  text-align: right;
}

.tv-mode__courts {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tv-mode__body {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}

.tv-mode__live {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}

.tv-mode__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tv-mode__empty-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 16px;
}

.tv-mode__matches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.tv-match-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 4px solid #4caf50;
  border-radius: 8px;
  padding: 16px 20px;
}

.tv-match-card__court {
  font-size: 0.7rem;
  color: #4caf50;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  margin-bottom: 10px;
}

.tv-match-card__players {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tv-match-card__player {
  flex: 1;
  font-size: 1.05rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tv-match-card__player--right {
  text-align: right;
}

.tv-match-card__score {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  text-align: center;
  min-width: 80px;
}

.tv-match-card__games {
  margin-top: 6px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
}

/* Next Up sidebar */
.tv-mode__queue {
  width: 260px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}

.tv-mode__queue-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.tv-queue-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tv-queue-item:last-child {
  border-bottom: none;
}

.tv-queue-item__num {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.25);
  min-width: 18px;
  padding-top: 2px;
}

.tv-queue-item__names {
  flex: 1;
  min-width: 0;
}

.tv-queue-item__player {
  font-size: 0.85rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.85);
}

.tv-queue-item__vs {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 2px 0;
}

/* Normal View */
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
