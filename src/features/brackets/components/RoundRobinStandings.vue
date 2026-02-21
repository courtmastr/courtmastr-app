<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();
const { getMatchStatusColor, getRankBadgeColor } = useMatchDisplay();

const loading = ref(true);
const activeTab = ref('standings');

const registrations = computed(() => registrationStore.registrations);

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
    matchesWon: number;
    matchesLost: number;
    matchPoints: number; // 2 for win, 1 for loss, 0 for not played
    gamesWon: number;
    gamesLost: number;
    gameDifference: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDifference: number;
  }>();

  // Initialize standings for all registrations
  for (const reg of categoryRegs) {
    if (reg.status === 'approved' || reg.status === 'checked_in') {
      standingsMap.set(reg.id, {
        registrationId: reg.id,
        name: getParticipantName(reg.id),
        played: 0,
        matchesWon: 0,
        matchesLost: 0,
        matchPoints: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDifference: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifference: 0,
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

        // Calculate game points and games won
        let p1Points = 0;
        let p2Points = 0;
        let p1Games = 0;
        let p2Games = 0;
        for (const score of match.scores) {
          p1Points += score.score1;
          p2Points += score.score2;
          // A player wins a game/set if they scored more points in that game
          if (score.score1 > score.score2) {
            p1Games++;
          } else if (score.score2 > score.score1) {
            p2Games++;
          }
          // If scores are equal, no game is awarded (shouldn't happen in completed matches)
        }

        // Update games stats (matches LeaderboardEntry: gamesWon, gamesLost, gameDifference)
        p1.gamesWon += p1Games;
        p1.gamesLost += p2Games;
        p2.gamesWon += p2Games;
        p2.gamesLost += p1Games;
        p1.gameDifference = p1.gamesWon - p1.gamesLost;
        p2.gameDifference = p2.gamesWon - p2.gamesLost;

        // Update points stats (matches LeaderboardEntry: pointsFor, pointsAgainst, pointDifference)
        p1.pointsFor += p1Points;
        p1.pointsAgainst += p2Points;
        p2.pointsFor += p2Points;
        p2.pointsAgainst += p1Points;

        if (match.winnerId === match.participant1Id) {
          p1.matchesWon++;
          p1.matchPoints += 2;
          p2.matchesLost++;
          p2.matchPoints += 1;
        } else {
          p2.matchesWon++;
          p2.matchPoints += 2;
          p1.matchesLost++;
          p1.matchPoints += 1;
        }

        p1.pointDifference = p1.pointsFor - p1.pointsAgainst;
        p2.pointDifference = p2.pointsFor - p2.pointsAgainst;
      }
    }
  }

  // Convert to array and sort (same logic as useLeaderboard.ts)
  return Array.from(standingsMap.values()).sort((a, b) => {
    // First by match points
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    // Then by wins
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    // Then by game difference (BWF tiebreaker: game difference)
    if (b.gameDifference !== a.gameDifference) return b.gameDifference - a.gameDifference;
    // Then by points difference
    if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
    // Then by games won
    return b.gamesWon - a.gamesWon;
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

function getMatchScore(match: Match): string {
  if (match.scores.length === 0) return '-';
  return match.scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
}
</script>

<template>
  <div class="round-robin-standings">
    <!-- Loading -->
    <div
      v-if="loading"
      class="text-center py-8"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="allMatches.length === 0"
      class="text-center py-8"
    >
      <v-icon
        size="64"
        color="grey-lighten-1"
      >
        mdi-tournament
      </v-icon>
      <p class="text-body-1 text-grey mt-4">
        No matches generated yet
      </p>
    </div>

    <template v-else>
      <!-- Tournament Stats -->
      <v-card
        class="mb-4"
        variant="outlined"
      >
        <v-card-text>
          <v-row align="center">
            <v-col
              cols="12"
              md="4"
            >
              <div class="d-flex align-center">
                <div class="mr-4">
                  <div class="text-h4 font-weight-bold text-primary">
                    {{ tournamentStats.progress }}%
                  </div>
                  <div class="text-caption">
                    Complete
                  </div>
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
            <v-col
              cols="12"
              md="8"
            >
              <div class="d-flex justify-space-around text-center">
                <div>
                  <div class="text-h5 font-weight-bold">
                    {{ tournamentStats.participants }}
                  </div>
                  <div class="text-caption">
                    Participants
                  </div>
                </div>
                <div>
                  <div class="text-h5 font-weight-bold">
                    {{ tournamentStats.rounds }}
                  </div>
                  <div class="text-caption">
                    Rounds
                  </div>
                </div>
                <div>
                  <div class="text-h5 font-weight-bold">
                    {{ tournamentStats.total }}
                  </div>
                  <div class="text-caption">
                    Total Matches
                  </div>
                </div>
                <div>
                  <v-chip
                    color="success"
                    variant="tonal"
                  >
                    {{ tournamentStats.completed }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    Completed
                  </div>
                </div>
                <div>
                  <v-chip
                    color="warning"
                    variant="tonal"
                  >
                    {{ tournamentStats.ready }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    Ready
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Tabs -->
      <v-tabs
        v-model="activeTab"
        color="primary"
        class="mb-4"
      >
        <v-tab value="standings">
          <v-icon start>
            mdi-podium
          </v-icon>
          Standings
        </v-tab>
        <v-tab value="matches">
          <v-icon start>
            mdi-view-list
          </v-icon>
          Matches by Round
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Standings Tab -->
        <v-tabs-window-item value="standings">
          <v-card>
            <v-data-table
              :headers="[
                { title: '#', key: 'rank', width: '60px', align: 'center' },
                { title: 'Participant', key: 'name' },
                { title: 'Status', key: 'status', width: '110px' },
                { title: 'MP', key: 'matchPoints', width: '70px', align: 'center' },
                { title: 'W-L', key: 'record', width: '80px', align: 'center' },
                { title: 'Games', key: 'games', width: '90px', align: 'center' },
                { title: 'Pts For/Ag', key: 'points', width: '110px', align: 'center' },
                { title: 'Pts +/-', key: 'pointDiff', width: '80px', align: 'center' },
              ]"
              :items="standings.map((s, i) => ({ ...s, rank: i + 1 }))"
              :items-per-page="-1"
              density="comfortable"
              class="standings-table"
            >
              <template #item.rank="{ item }">
                <v-avatar
                  v-if="item.played > 0"
                  :color="getRankBadgeColor(item.rank)"
                  size="32"
                  class="font-weight-bold"
                >
                  {{ item.rank }}
                </v-avatar>
                <span v-else class="text-medium-emphasis">—</span>
              </template>
              <template #item.name="{ item }">
                <span class="font-weight-medium">{{ item.name }}</span>
              </template>
              <template #item.status="{ item }">
                <v-chip
                  size="small"
                  :color="item.played === 0 ? 'grey' : item.matchesWon > item.matchesLost ? 'success' : 'info'"
                  variant="tonal"
                >
                  {{ item.played === 0 ? 'Awaiting' : item.matchesWon > item.matchesLost ? 'Active' : 'Active' }}
                </v-chip>
              </template>
              <template #item.matchPoints="{ item }">
                <span class="font-weight-bold">{{ item.matchPoints }}</span>
              </template>
              <template #item.record="{ item }">
                <span>{{ item.matchesWon }}-{{ item.matchesLost }}</span>
              </template>
              <template #item.games="{ item }">
                <span>{{ item.gamesWon }}-{{ item.gamesLost }}</span>
              </template>
              <template #item.points="{ item }">
                <span>{{ item.pointsFor }} / {{ item.pointsAgainst }}</span>
              </template>
              <template #item.pointDiff="{ item }">
                <span :class="item.pointDifference >= 0 ? 'text-success' : 'text-error'">
                  {{ item.pointDifference >= 0 ? '+' : '' }}{{ item.pointDifference }}
                </span>
              </template>
              <template #bottom />
            </v-data-table>
          </v-card>

          <v-alert
            type="info"
            variant="tonal"
            class="mt-4"
          >
            <strong>Scoring:</strong> Win = 2 points, Loss = 1 point.
            Tiebreakers: Match Points > Wins > Game Difference > Point Difference > Games Won
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
