<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import DurationMetrics from '@/features/reports/components/DurationMetrics.vue';


const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);
const registrations = computed(() => registrationStore.registrations);

const completedStatuses = new Set(['completed', 'walkover']);
const MAX_OBSERVED_DURATION_MINUTES = 720;

interface DurationStats {
  averageMinutes: number | null;
  medianMinutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  observedCount: number;
  excludedCount: number;
}

const durationStats = computed<DurationStats>(() => {
  const observedDurations: number[] = [];
  let excludedCount = 0;

  for (const match of matches.value) {
    if (!completedStatuses.has(match.status)) continue;

    if (!match.startedAt || !match.completedAt) {
      excludedCount += 1;
      continue;
    }

    const durationMinutes = Math.round((match.completedAt.getTime() - match.startedAt.getTime()) / 60000);
    if (durationMinutes < 0 || durationMinutes > MAX_OBSERVED_DURATION_MINUTES) {
      excludedCount += 1;
      continue;
    }

    observedDurations.push(durationMinutes);
  }

  if (observedDurations.length === 0) {
    return {
      averageMinutes: null,
      medianMinutes: null,
      minMinutes: null,
      maxMinutes: null,
      observedCount: 0,
      excludedCount,
    };
  }

  const sortedDurations = [...observedDurations].sort((a, b) => a - b);
  const totalDuration = sortedDurations.reduce((total, duration) => total + duration, 0);
  const midpoint = Math.floor(sortedDurations.length / 2);
  const medianMinutes = sortedDurations.length % 2 === 0
    ? Math.round((sortedDurations[midpoint - 1] + sortedDurations[midpoint]) / 2)
    : sortedDurations[midpoint];

  return {
    averageMinutes: Math.round(totalDuration / sortedDurations.length),
    medianMinutes,
    minMinutes: sortedDurations[0],
    maxMinutes: sortedDurations[sortedDurations.length - 1],
    observedCount: sortedDurations.length,
    excludedCount,
  };
});

const summary = computed(() => {
  const totalRegistrations = registrations.value.length;
  const approvedRegistrations = registrations.value.filter((registration) => registration.status === 'approved').length;
  const checkedInCount = registrations.value.filter((registration) => registration.status === 'checked_in').length;
  const noShowCount = registrations.value.filter((registration) => registration.status === 'no_show').length;
  const eligibleForAttendance = approvedRegistrations + checkedInCount + noShowCount;
  const participationRate = eligibleForAttendance > 0
    ? Math.round((checkedInCount / eligibleForAttendance) * 100)
    : 0;

  const totalMatches = matches.value.length;
  const completedMatches = matches.value.filter((match) => completedStatuses.has(match.status)).length;
  const inProgressMatches = matches.value.filter((match) => match.status === 'in_progress').length;
  const scheduledMatches = matches.value.filter((match) => match.status === 'scheduled' || match.status === 'ready').length;
  const walkovers = matches.value.filter((match) => match.status === 'walkover').length;
  const completionRate = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  const courtsUsed = new Set(
    matches.value
      .filter((match) => completedStatuses.has(match.status) || match.status === 'in_progress')
      .map((match) => match.courtId)
      .filter((courtId): courtId is string => Boolean(courtId))
  ).size;
  const courtUtilizationRate = courts.value.length > 0
    ? Math.round((courtsUsed / courts.value.length) * 100)
    : 0;

  return {
    totalRegistrations,
    approvedRegistrations,
    checkedInCount,
    noShowCount,
    participationRate,
    totalMatches,
    completedMatches,
    inProgressMatches,
    scheduledMatches,
    walkovers,
    completionRate,
    totalCourts: courts.value.length,
    courtUtilizationRate,
    configuredMatchDurationMinutes: tournament.value?.settings.matchDurationMinutes ?? null,
    averageMatchDuration: durationStats.value.averageMinutes,
  };
});

watch(
  () => durationStats.value.excludedCount,
  (excludedCount) => {
    if (excludedCount > 0) {
      console.warn(
        `[TournamentSummaryView] Excluded ${excludedCount} completed match(es) from duration metrics due to missing/invalid timestamps`
      );
    }
  },
  { immediate: true }
);

const categoryBreakdown = computed(() =>
  categories.value.map((category) => {
    const categoryRegistrations = registrations.value.filter((registration) => registration.categoryId === category.id);
    const categoryMatches = matches.value.filter((match) => match.categoryId === category.id);

    return {
      categoryId: category.id,
      categoryName: category.name,
      registrationCount: categoryRegistrations.length,
      checkedInCount: categoryRegistrations.filter((registration) => registration.status === 'checked_in').length,
      matchCount: categoryMatches.length,
      completedMatches: categoryMatches.filter((match) => completedStatuses.has(match.status)).length,
    };
  })
);

const categoryHeaders = [
  { title: 'Category', key: 'categoryName' },
  { title: 'Registrations', key: 'registrationCount' },
  { title: 'Checked In', key: 'checkedInCount' },
  { title: 'Matches', key: 'matchCount' },
  { title: 'Completed', key: 'completedMatches' },
];

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
});

onUnmounted(() => {
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});

function exportSummaryCsv(): void {
  const lines = [
    'Metric,Value',
    `Total Registrations,${summary.value.totalRegistrations}`,
    `Approved Registrations,${summary.value.approvedRegistrations}`,
    `Checked In,${summary.value.checkedInCount}`,
    `No Show,${summary.value.noShowCount}`,
    `Participation Rate (%),${summary.value.participationRate}`,
    `Total Matches,${summary.value.totalMatches}`,
    `Completed Matches,${summary.value.completedMatches}`,
    `In Progress Matches,${summary.value.inProgressMatches}`,
    `Scheduled Matches,${summary.value.scheduledMatches}`,
    `Walkovers,${summary.value.walkovers}`,
    `Completion Rate (%),${summary.value.completionRate}`,
    `Total Courts,${summary.value.totalCourts}`,
    `Court Utilization (%),${summary.value.courtUtilizationRate}`,
    `Configured Match Duration (min),${summary.value.configuredMatchDurationMinutes ?? ''}`,
    `Average Match Duration (min),${summary.value.averageMatchDuration ?? ''}`,
    `Median Match Duration (min),${durationStats.value.medianMinutes ?? ''}`,
    `Min Match Duration (min),${durationStats.value.minMinutes ?? ''}`,
    `Max Match Duration (min),${durationStats.value.maxMinutes ?? ''}`,
    `Observed Duration Count,${durationStats.value.observedCount}`,
    `Excluded Duration Count,${durationStats.value.excludedCount}`,
    '',
    'Category,Registrations,Checked In,Matches,Completed Matches',
    ...categoryBreakdown.value.map((row) =>
      `${row.categoryName},${row.registrationCount},${row.checkedInCount},${row.matchCount},${row.completedMatches}`
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `tournament-summary-${tournamentId.value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  notificationStore.showToast('success', 'Summary report exported');
}
</script>

<template>
  <v-container fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <div class="text-caption text-grey-darken-1">
          {{ tournament?.name }}
        </div>
        <h1 class="text-h4 font-weight-bold">
          Tournament Reports
        </h1>
      </div>
      <div class="d-flex ga-2">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-file-delimited"
          @click="exportSummaryCsv"
        >
          Export CSV
        </v-btn>
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          @click="router.push(`/tournaments/${tournamentId}`)"
        >
          Back to Tournament
        </v-btn>
      </div>
    </div>

    <v-row class="mb-2">
      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey d-flex align-center">
              Registrations
              <v-tooltip
                text="Total number of players/teams registered for this tournament"
                location="top"
              >
                <template #activator="{ props }">
                  <v-icon
                    size="14"
                    color="medium-emphasis"
                    class="ml-1"
                    v-bind="props"
                  >
                    mdi-information-outline
                  </v-icon>
                </template>
              </v-tooltip>
            </div>
            <div class="text-h5 font-weight-bold">
              {{ summary.totalRegistrations }}
            </div>
            <div class="text-caption text-grey mt-1">
              Checked In: {{ summary.checkedInCount }} · No Show: {{ summary.noShowCount }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey d-flex align-center">
              Participation Rate
              <v-tooltip
                text="Percentage of approved registrants who checked in to the tournament"
                location="top"
              >
                <template #activator="{ props }">
                  <v-icon
                    size="14"
                    color="medium-emphasis"
                    class="ml-1"
                    v-bind="props"
                  >
                    mdi-information-outline
                  </v-icon>
                </template>
              </v-tooltip>
            </div>
            <div class="text-h5 font-weight-bold">
              {{ summary.participationRate }}%
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey d-flex align-center">
              Match Completion
              <v-tooltip
                text="Percentage of all matches that have been completed or won by walkover"
                location="top"
              >
                <template #activator="{ props }">
                  <v-icon
                    size="14"
                    color="medium-emphasis"
                    class="ml-1"
                    v-bind="props"
                  >
                    mdi-information-outline
                  </v-icon>
                </template>
              </v-tooltip>
            </div>
            <div class="text-h5 font-weight-bold">
              {{ summary.completionRate }}%
            </div>
            <div class="text-caption text-grey mt-1">
              {{ summary.completedMatches }}/{{ summary.totalMatches }} completed
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey d-flex align-center">
              Court Utilization
              <v-tooltip
                text="Percentage of available courts that have been used for at least one match"
                location="top"
              >
                <template #activator="{ props }">
                  <v-icon
                    size="14"
                    color="medium-emphasis"
                    class="ml-1"
                    v-bind="props"
                  >
                    mdi-information-outline
                  </v-icon>
                </template>
              </v-tooltip>
            </div>
            <div class="text-h5 font-weight-bold">
              {{ summary.courtUtilizationRate }}%
            </div>
            <div class="text-caption text-grey mt-1">
              Avg match: {{ summary.averageMatchDuration === null ? 'Not enough data yet' : `${summary.averageMatchDuration} min` }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mb-4">
      <v-col
        cols="12"
        md="4"
      >
        <v-card>
          <v-card-title class="text-subtitle-1">
            Match Status
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between py-1">
              <span>Completed</span>
              <strong>{{ summary.completedMatches }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>In Progress</span>
              <strong>{{ summary.inProgressMatches }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>Scheduled/Ready</span>
              <strong>{{ summary.scheduledMatches }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>Walkovers</span>
              <strong>{{ summary.walkovers }}</strong>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-card>
          <v-card-title class="text-subtitle-1">
            Registration Status
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between py-1">
              <span>Approved</span>
              <strong>{{ summary.approvedRegistrations }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>Checked In</span>
              <strong>{{ summary.checkedInCount }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>No Show</span>
              <strong>{{ summary.noShowCount }}</strong>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <duration-metrics
          :average-minutes="durationStats.averageMinutes"
          :median-minutes="durationStats.medianMinutes"
          :min-minutes="durationStats.minMinutes"
          :max-minutes="durationStats.maxMinutes"
          :configured-minutes="summary.configuredMatchDurationMinutes"
          :observed-match-count="durationStats.observedCount"
          :excluded-match-count="durationStats.excludedCount"
        />
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-card>
          <v-card-title class="text-subtitle-1">
            Courts
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between py-1">
              <span>Total Courts</span>
              <strong>{{ summary.totalCourts }}</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>Utilization</span>
              <strong>{{ summary.courtUtilizationRate }}%</strong>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span>Avg Duration</span>
              <strong>{{ summary.averageMatchDuration === null ? 'Not enough data yet' : `${summary.averageMatchDuration} min` }}</strong>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card>
      <v-card-title class="text-subtitle-1">
        Category Breakdown
      </v-card-title>
      <v-data-table
        :items="categoryBreakdown"
        :headers="[
          { title: 'Category', key: 'category', sortable: true },
          { title: 'Registrations', key: 'registrations', sortable: true },
          { title: 'Matches', key: 'matches', sortable: true },
        ]"
        class="elevation-1"
        show-expand
        item-value="categoryName"
      >
        <template #item.category="{ item }">
          <span class="font-weight-medium">{{ item.categoryName }}</span>
        </template>
        <template #item.registrations="{ item }">
          <div class="d-flex flex-column">
            <span>{{ item.registrationCount }} total</span>
            <span class="text-caption text-success">{{ item.checkedInCount }} checked in</span>
          </div>
        </template>
        <template #item.matches="{ item }">
          <div class="d-flex flex-column">
            <span>{{ item.matchCount }} total</span>
            <span class="text-caption text-success">{{ item.completedMatches }} completed</span>
          </div>
        </template>
        <template #expanded-row="{ columns, item }">
          <tr>
            <td :colspan="columns.length" class="bg-grey-lighten-5 pa-4">
              <div class="d-flex flex-wrap gap-4 text-body-2">
                <div><strong>Category:</strong> {{ item.categoryName }}</div>
                <div><strong>Registrations:</strong> {{ item.registrationCount }}</div>
                <div><strong>Checked In:</strong> {{ item.checkedInCount }}</div>
                <div><strong>Matches:</strong> {{ item.matchCount }}</div>
                <div><strong>Completed:</strong> {{ item.completedMatches }}</div>
              </div>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
