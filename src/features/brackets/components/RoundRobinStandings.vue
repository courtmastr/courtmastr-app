<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match } from '@/types';
import { buildPoolStandingsEntries, toPoolStandingsParticipants } from '@/utils/poolStandings';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
  matches?: Match[];  // optional — provided by SmartBracketView for pool_to_elimination context
}>();

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();
const { getRankBadgeColor } = useMatchDisplay();

const loading = ref(true);

const registrations = computed(() => registrationStore.registrations);

// All matches for this category — use prop if provided, otherwise read from store
const allMatches = computed(() =>
  props.matches ?? matchStore.matches.filter((m) => m.categoryId === props.categoryId)
);

// Real matches only — excludes BYE walkover matches (one participant absent)
const realMatches = computed(() =>
  allMatches.value.filter((m) => m.participant1Id && m.participant2Id)
);

// Calculate standings
const standings = computed(() => {
  const categoryParticipants = toPoolStandingsParticipants(
    registrations.value.filter(
      (registration) =>
        registration.categoryId === props.categoryId &&
        (registration.status === 'approved' || registration.status === 'checked_in')
    ),
    (registration) => getParticipantName(registration.id),
  );

  return buildPoolStandingsEntries(categoryParticipants, allMatches.value).map((entry) => ({
    ...entry,
    name: entry.participantName,
  }));
});

const tournamentStats = computed(() => {
  const total = realMatches.value.length;
  const completed = realMatches.value.filter((m) => m.status === 'completed').length;
  const inProgress = realMatches.value.filter((m) => m.status === 'in_progress').length;
  const ready = realMatches.value.filter((m) => m.status === 'ready').length;

  return {
    total,
    completed,
    inProgress,
    ready,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    participants: standings.value.length,
    rounds: new Set(allMatches.value.map((m) => m.round)).size,
  };
});

// Self-fetch only in standalone mode (round_robin). When matches prop is provided,
// parent has already fetched.
onMounted(async () => {
  if (!props.matches) {
    await Promise.all([
      matchStore.fetchMatches(props.tournamentId, props.categoryId),
      registrationStore.fetchRegistrations(props.tournamentId),
      registrationStore.fetchPlayers(props.tournamentId),
    ]);
  }
  loading.value = false;
});

watch(
  () => props.categoryId,
  async () => {
    if (!props.matches) {
      loading.value = true;
      await matchStore.fetchMatches(props.tournamentId, props.categoryId);
      loading.value = false;
    }
  }
);
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

      <!-- Standings table (no inner tabs — Matches by Round is a separate outer tab) -->
      <v-card>
        <v-data-table
          :headers="[
            { title: '#', key: 'rank', width: '60px', align: 'center' },
            { title: 'Participant', key: 'name' },
            { title: 'MP', key: 'matchPoints', width: '70px', align: 'center' },
            { title: 'W', key: 'matchesWon', width: '60px', align: 'center' },
            { title: 'L', key: 'matchesLost', width: '60px', align: 'center' },
            { title: 'GD', key: 'gameDifference', width: '70px', align: 'center' },
            { title: 'PD', key: 'pointDifference', width: '70px', align: 'center' },
            { title: 'PF', key: 'pointsFor', width: '70px', align: 'center' },
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
            <span
              v-else
              class="text-medium-emphasis"
            >—</span>
          </template>
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name }}</span>
          </template>
          <template #header.matchPoints="{ column }">
            <v-tooltip
              location="top"
              text="Match Points: Win = 2 pts, Loss = 1 pt, Walkover Win = 2 pts (BWF Art. 16.1)"
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #header.matchesWon="{ column }">
            <v-tooltip
              location="top"
              text="Matches Won (including walkovers)"
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #header.matchesLost="{ column }">
            <v-tooltip
              location="top"
              text="Matches Lost"
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #header.gameDifference="{ column }">
            <v-tooltip
              location="top"
              text="Game Difference: Games Won minus Games Lost. BWF Tiebreaker #2 (Art. 16.2.3)"
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #header.pointDifference="{ column }">
            <v-tooltip
              location="top"
              text="Point Difference: Points For minus Points Against. BWF Tiebreaker #3. Walkovers count as 0-0."
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #header.pointsFor="{ column }">
            <v-tooltip
              location="top"
              text="Points For: Total rally points scored (excludes walkovers)"
            >
              <template #activator="{ props: tp }">
                <span
                  v-bind="tp"
                  class="cursor-help"
                >{{ column.title }} <v-icon size="12">mdi-information-outline</v-icon></span>
              </template>
            </v-tooltip>
          </template>
          <template #item.matchPoints="{ item }">
            <span class="font-weight-bold">{{ item.matchPoints }}</span>
          </template>
          <template #item.matchesWon="{ item }">
            <span>{{ item.matchesWon }}</span>
          </template>
          <template #item.matchesLost="{ item }">
            <span>{{ item.matchesLost }}</span>
          </template>
          <template #item.gameDifference="{ item }">
            <span :class="item.gameDifference >= 0 ? 'text-success' : 'text-error'">
              {{ item.gameDifference >= 0 ? '+' : '' }}{{ item.gameDifference }}
            </span>
          </template>
          <template #item.pointDifference="{ item }">
            <span :class="item.pointDifference >= 0 ? 'text-success' : 'text-error'">
              {{ item.pointDifference >= 0 ? '+' : '' }}{{ item.pointDifference }}
            </span>
          </template>
          <template #item.pointsFor="{ item }">
            <span>{{ item.pointsFor }}</span>
          </template>
          <template #bottom />
        </v-data-table>
      </v-card>

      <v-expansion-panels
        variant="accordion"
        class="mt-4"
      >
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon
              start
              color="primary"
            >
              mdi-information-outline
            </v-icon>
            BWF Scoring &amp; Tiebreaker Rules
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col
                cols="12"
                md="4"
              >
                <p class="text-subtitle-2 font-weight-bold mb-2">
                  Match Points (BWF Art. 16.1)
                </p>
                <v-list
                  density="compact"
                  class="pa-0"
                >
                  <v-list-item
                    prepend-icon="mdi-trophy"
                    title="Win"
                    subtitle="2 match points"
                  />
                  <v-list-item
                    prepend-icon="mdi-minus-circle-outline"
                    title="Loss"
                    subtitle="1 match point"
                  />
                  <v-list-item
                    prepend-icon="mdi-fast-forward"
                    title="Walkover Win (W/O)"
                    subtitle="2 match points · scored as 0-0"
                  />
                </v-list>
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <p class="text-subtitle-2 font-weight-bold mb-2">
                  Tiebreaker Order (BWF Art. 16.2)
                </p>
                <v-timeline
                  density="compact"
                  side="end"
                >
                  <v-timeline-item
                    dot-color="primary"
                    size="x-small"
                  >
                    <span class="text-body-2"><strong>1.</strong> Match Points (MP)</span>
                  </v-timeline-item>
                  <v-timeline-item
                    dot-color="primary"
                    size="x-small"
                  >
                    <span class="text-body-2"><strong>2.</strong> Game Difference (GD)</span>
                  </v-timeline-item>
                  <v-timeline-item
                    dot-color="primary"
                    size="x-small"
                  >
                    <span class="text-body-2"><strong>3.</strong> Point Difference (PD)</span>
                  </v-timeline-item>
                  <v-timeline-item
                    dot-color="grey"
                    size="x-small"
                  >
                    <span class="text-body-2"><strong>4.</strong> Equal standing awarded</span>
                  </v-timeline-item>
                </v-timeline>
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <v-alert
                  type="info"
                  variant="tonal"
                  density="compact"
                >
                  <p class="text-subtitle-2 font-weight-bold">
                    Uneven Pool (Bye)
                  </p>
                  <p class="text-body-2">
                    When players don't divide evenly into pools, one pool receives a
                    <strong>BYE slot</strong>. Both players get a walkover win (W/O) against
                    the BYE, ensuring equal match counts and maximum match points across all
                    pools — consistent with BWF tournament practice.
                  </p>
                </v-alert>
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
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
</style>
