<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import type { Match } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();

const loading = ref(true);
const activeTab = ref('standings');

const registrations = computed(() => registrationStore.registrations);
const players = computed(() => registrationStore.players);

// All matches for this category
const allMatches = computed(() =>
  matchStore.matches.filter((m) => m.categoryId === props.categoryId)
);

// Calculate standings
const standings = computed(() => {
  const categoryRegs = registrations.value.filter((r) => r.categoryId === props.categoryId);

  const standingsMap = new Map<string, {
    registrationId: string;
    name: string;
    played: number;
    won: number;
    lost: number;
    pointsFor: number;
    pointsAgainst: number;
    pointsDiff: number;
    matchPoints: number; // 2 for win, 1 for loss, 0 for not played
  }>();

  // Initialize standings for all registrations
  for (const reg of categoryRegs) {
    if (reg.status === 'approved' || reg.status === 'checked_in') {
      standingsMap.set(reg.id, {
        registrationId: reg.id,
        name: getParticipantName(reg.id),
        played: 0,
        won: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        matchPoints: 0,
      });
    }
  }

  // Process completed matches
  for (const match of allMatches.value) {
    if (match.status === 'completed' && match.winnerId) {
      const p1 = standingsMap.get(match.participant1Id || '');
      const p2 = standingsMap.get(match.participant2Id || '');

      if (p1 && p2) {
        p1.played++;
        p2.played++;

        // Calculate game points
        let p1Points = 0;
        let p2Points = 0;
        for (const score of match.scores) {
          p1Points += score.score1;
          p2Points += score.score2;
        }

        p1.pointsFor += p1Points;
        p1.pointsAgainst += p2Points;
        p2.pointsFor += p2Points;
        p2.pointsAgainst += p1Points;

        if (match.winnerId === match.participant1Id) {
          p1.won++;
          p1.matchPoints += 2;
          p2.lost++;
          p2.matchPoints += 1;
        } else {
          p2.won++;
          p2.matchPoints += 2;
          p1.lost++;
          p1.matchPoints += 1;
        }

        p1.pointsDiff = p1.pointsFor - p1.pointsAgainst;
        p2.pointsDiff = p2.pointsFor - p2.pointsAgainst;
      }
    }
  }

  // Convert to array and sort
  return Array.from(standingsMap.values()).sort((a, b) => {
    // First by match points
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    // Then by wins
    if (b.won !== a.won) return b.won - a.won;
    // Then by point difference
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    // Then by points for
    return b.pointsFor - a.pointsFor;
  });
});

// Group matches by round
const matchesByRound = computed(() => {
  const rounds: Record<number, Match[]> = {};
  for (const match of allMatches.value) {
    if (!rounds[match.round]) {
      rounds[match.round] = [];
    }
    rounds[match.round].push(match);
  }
  return rounds;
});

const rounds = computed(() =>
  Object.keys(matchesByRound.value).map(Number).sort((a, b) => a - b)
);

// Stats
const tournamentStats = computed(() => {
  const total = allMatches.value.length;
  const completed = allMatches.value.filter((m) => m.status === 'completed').length;
  const inProgress = allMatches.value.filter((m) => m.status === 'in_progress').length;
  const ready = allMatches.value.filter((m) => m.status === 'ready').length;

  return {
    total,
    completed,
    inProgress,
    ready,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    participants: standings.value.length,
    rounds: rounds.value.length,
  };
});

onMounted(async () => {
  await Promise.all([
    matchStore.fetchMatches(props.tournamentId, props.categoryId),
    registrationStore.fetchRegistrations(props.tournamentId),
    registrationStore.fetchPlayers(props.tournamentId),
  ]);
  loading.value = false;
});

watch(
  () => props.categoryId,
  async () => {
    loading.value = true;
    await matchStore.fetchMatches(props.tournamentId, props.categoryId);
    loading.value = false;
  }
);

function getParticipantName(registrationId: string | undefined): string {
  if (!registrationId) return 'TBD';

  const registration = registrations.value.find((r) => r.id === registrationId);
  if (!registration) return 'Unknown';

  if (registration.teamName) {
    return registration.teamName;
  }

  const player = players.value.find((p) => p.id === registration.playerId);
  if (player) {
    return `${player.firstName} ${player.lastName}`;
  }

  return 'Unknown';
}

function getMatchStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'success',
    in_progress: 'info',
    ready: 'warning',
    scheduled: 'grey',
  };
  return colors[status] || 'grey';
}

function getMatchScore(match: Match): string {
  if (match.scores.length === 0) return '-';
  return match.scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
}

function getRankBadgeColor(rank: number): string {
  if (rank === 1) return 'warning'; // Gold
  if (rank === 2) return 'grey-lighten-1'; // Silver
  if (rank === 3) return 'brown'; // Bronze
  return 'grey';
}
</script>

<template>
  <div class="round-robin-standings">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="allMatches.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <p class="text-body-1 text-grey mt-4">No matches generated yet</p>
    </div>

    <template v-else>
      <!-- Tournament Stats -->
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-row align="center">
            <v-col cols="12" md="4">
              <div class="d-flex align-center">
                <div class="mr-4">
                  <div class="text-h4 font-weight-bold text-primary">{{ tournamentStats.progress }}%</div>
                  <div class="text-caption">Complete</div>
                </div>
                <v-progress-linear
                  :model-value="tournamentStats.progress"
                  color="primary"
                  height="12"
                  rounded
                  class="flex-grow-1"
                />
              </div>
            </v-col>
            <v-col cols="12" md="8">
              <div class="d-flex justify-space-around text-center">
                <div>
                  <div class="text-h5 font-weight-bold">{{ tournamentStats.participants }}</div>
                  <div class="text-caption">Participants</div>
                </div>
                <div>
                  <div class="text-h5 font-weight-bold">{{ tournamentStats.rounds }}</div>
                  <div class="text-caption">Rounds</div>
                </div>
                <div>
                  <div class="text-h5 font-weight-bold">{{ tournamentStats.total }}</div>
                  <div class="text-caption">Total Matches</div>
                </div>
                <div>
                  <v-chip color="success" variant="tonal">{{ tournamentStats.completed }}</v-chip>
                  <div class="text-caption mt-1">Completed</div>
                </div>
                <div>
                  <v-chip color="warning" variant="tonal">{{ tournamentStats.ready }}</v-chip>
                  <div class="text-caption mt-1">Ready</div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Tabs -->
      <v-tabs v-model="activeTab" color="primary" class="mb-4">
        <v-tab value="standings">
          <v-icon start>mdi-podium</v-icon>
          Standings
        </v-tab>
        <v-tab value="matches">
          <v-icon start>mdi-view-list</v-icon>
          Matches by Round
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Standings Tab -->
        <v-tabs-window-item value="standings">
          <v-card>
            <v-data-table
              :headers="[
                { title: 'Rank', key: 'rank', width: '80px' },
                { title: 'Participant', key: 'name' },
                { title: 'Played', key: 'played', align: 'center' },
                { title: 'Won', key: 'won', align: 'center' },
                { title: 'Lost', key: 'lost', align: 'center' },
                { title: 'PF', key: 'pointsFor', align: 'center' },
                { title: 'PA', key: 'pointsAgainst', align: 'center' },
                { title: '+/-', key: 'pointsDiff', align: 'center' },
                { title: 'Pts', key: 'matchPoints', align: 'center' },
              ]"
              :items="standings.map((s, i) => ({ ...s, rank: i + 1 }))"
              :items-per-page="-1"
              density="comfortable"
              class="standings-table"
            >
              <template #item.rank="{ item }">
                <v-avatar
                  :color="getRankBadgeColor(item.rank)"
                  size="32"
                  class="font-weight-bold"
                >
                  {{ item.rank }}
                </v-avatar>
              </template>
              <template #item.name="{ item }">
                <span class="font-weight-medium">{{ item.name }}</span>
              </template>
              <template #item.won="{ item }">
                <span class="text-success font-weight-bold">{{ item.won }}</span>
              </template>
              <template #item.lost="{ item }">
                <span class="text-error">{{ item.lost }}</span>
              </template>
              <template #item.pointsDiff="{ item }">
                <span :class="item.pointsDiff >= 0 ? 'text-success' : 'text-error'">
                  {{ item.pointsDiff >= 0 ? '+' : '' }}{{ item.pointsDiff }}
                </span>
              </template>
              <template #item.matchPoints="{ item }">
                <v-chip color="primary" size="small" variant="tonal">
                  {{ item.matchPoints }}
                </v-chip>
              </template>
              <template #bottom></template>
            </v-data-table>
          </v-card>

          <v-alert type="info" variant="tonal" class="mt-4">
            <strong>Scoring:</strong> Win = 2 points, Loss = 1 point.
            Tiebreakers: Match Points > Wins > Point Difference > Points For
          </v-alert>
        </v-tabs-window-item>

        <!-- Matches by Round Tab -->
        <v-tabs-window-item value="matches">
          <v-expansion-panels variant="accordion">
            <v-expansion-panel
              v-for="round in rounds"
              :key="round"
              :title="`Round ${round}`"
            >
              <template #text>
                <v-list density="compact">
                  <v-list-item
                    v-for="match in matchesByRound[round]"
                    :key="match.id"
                    class="match-item"
                  >
                    <template #prepend>
                      <v-chip
                        :color="getMatchStatusColor(match.status)"
                        size="small"
                        class="mr-3"
                      >
                        #{{ match.matchNumber }}
                      </v-chip>
                    </template>

                    <v-list-item-title class="d-flex align-center">
                      <span
                        class="participant-name"
                        :class="{ 'font-weight-bold text-success': match.winnerId === match.participant1Id }"
                      >
                        {{ getParticipantName(match.participant1Id) }}
                      </span>
                      <span class="mx-3 text-grey">vs</span>
                      <span
                        class="participant-name"
                        :class="{ 'font-weight-bold text-success': match.winnerId === match.participant2Id }"
                      >
                        {{ getParticipantName(match.participant2Id) }}
                      </span>
                    </v-list-item-title>

                    <template #append>
                      <v-chip
                        v-if="match.status === 'completed'"
                        variant="tonal"
                        size="small"
                      >
                        {{ getMatchScore(match) }}
                      </v-chip>
                      <v-chip
                        v-else
                        :color="getMatchStatusColor(match.status)"
                        variant="tonal"
                        size="small"
                      >
                        {{ match.status }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </template>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
  </div>
</template>

<style scoped>
.standings-table :deep(tr:nth-child(1)) {
  background: rgba(var(--v-theme-warning), 0.1);
}

.standings-table :deep(tr:nth-child(2)) {
  background: rgba(128, 128, 128, 0.1);
}

.standings-table :deep(tr:nth-child(3)) {
  background: rgba(139, 69, 19, 0.1);
}

.match-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.participant-name {
  min-width: 150px;
}
</style>
