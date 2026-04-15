<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import FilterBar from '@/components/common/FilterBar.vue';
import ManualScoreDialog from '@/features/tournaments/dialogs/ManualScoreDialog.vue';
import ScoreCorrectionDialog from '@/features/scoring/components/ScoreCorrectionDialog.vue';
import { BADMINTON_CONFIG } from '@/types';
import type { Match } from '@/types';

const route = useRoute();
const router = useRouter();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const volunteerAccessStore = useVolunteerAccessStore();
const { getParticipantName } = useParticipantResolver();

// Search and filter state
const searchQuery = ref('');
const selectedRound = ref<number | null>(null);
const selectedCategory = ref<string>('all');
const selectedStatus = ref<string>('all');
const selectedCourt = ref<string>('all');
const selectedSort = ref<string>('round_asc');
const selectedMatch = ref<Match | null>(null);
const showManualScoreDialog = ref(false);
const showCorrectionDialog = ref(false);

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const courts = computed(() => tournamentStore.courts);
const allMatches = computed(() => matchStore.matches);
const { tournamentLogoUrl } = useTournamentBranding(tournament);
const isVolunteerScorekeeperMode = computed(() => (
  route.meta.volunteerRole === 'scorekeeper' &&
  volunteerAccessStore.hasValidSession(tournamentId.value, 'scorekeeper')
));
const totalCompletedMatches = computed(() => allMatches.value.filter((match) => (
  match.status === 'completed' || match.status === 'walkover'
)));

onMounted(async () => {
  if (!tournament.value) {
    await tournamentStore.fetchTournament(tournamentId.value);
  }
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeMatches(tournamentId.value);
  await registrationStore.fetchRegistrations(tournamentId.value);
  await registrationStore.fetchPlayers(tournamentId.value);
});

onUnmounted(() => {
  matchStore.unsubscribeAll();
  tournamentStore.unsubscribeAll();
});

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return 'Not assigned';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Unknown';
}

function getCategoryName(categoryId: string | undefined): string {
  if (!categoryId) return 'General';
  const category = tournamentStore.categories.find((c) => c.id === categoryId);
  return category?.name || categoryId.slice(0, 8);
}

function truncateId(id: string): string {
  return id.slice(0, 8) + '...';
}

function openScoreDialog(match: Match): void {
  if (!match.participant1Id || !match.participant2Id) {
    notificationStore.showToast('error', 'Cannot score this match until both participants are assigned');
    return;
  }

  selectedMatch.value = match;

  if (match.status === 'completed' || match.status === 'walkover') {
    showCorrectionDialog.value = true;
    return;
  }

  if (isVolunteerScorekeeperMode.value) {
    router.push({
      name: 'volunteer-scoring-match',
      params: {
        tournamentId: tournamentId.value,
        matchId: match.id,
      },
      query: {
        ...(match.categoryId ? { category: match.categoryId } : {}),
        ...(match.levelId ? { level: match.levelId } : {}),
      },
    });
    return;
  }

  showManualScoreDialog.value = true;
}

const roundOptions = computed(() => {
  const rounds = new Set<number>();
  matchStore.matches.forEach((m) => rounds.add(m.round));
  return [
    { title: 'All Rounds', value: null },
    ...Array.from(rounds).sort((a, b) => a - b).map((round) => ({ title: `Round ${round}`, value: round })),
  ];
});

const categoryOptions = computed(() => [
  { title: 'All Categories', value: 'all' },
  ...tournamentStore.categories.map((category) => ({ title: category.name, value: category.id })),
]);

const statusOptions = [
  { title: 'All Statuses', value: 'all' },
  { title: 'Scheduled', value: 'scheduled' },
  { title: 'Ready', value: 'ready' },
  { title: 'In Progress', value: 'in_progress' },
  { title: 'Completed', value: 'completed' },
  { title: 'Walkover', value: 'walkover' },
  { title: 'Cancelled', value: 'cancelled' },
];

const courtOptions = computed(() => [
  { title: 'All Courts', value: 'all' },
  ...courts.value.map((court) => ({ title: court.name, value: court.id })),
]);

const sortOptions = [
  { title: 'Round (Asc)', value: 'round_asc' },
  { title: 'Round (Desc)', value: 'round_desc' },
  { title: 'Match Number (Asc)', value: 'match_number_asc' },
  { title: 'Match Number (Desc)', value: 'match_number_desc' },
  { title: 'Category (A-Z)', value: 'category_asc' },
  { title: 'Court (A-Z)', value: 'court_asc' },
  { title: 'Status (A-Z)', value: 'status_asc' },
];

const hasActiveFilters = computed(() => (
  Boolean(searchQuery.value.trim()) ||
  selectedRound.value !== null ||
  selectedCategory.value !== 'all' ||
  selectedStatus.value !== 'all' ||
  selectedCourt.value !== 'all' ||
  selectedSort.value !== 'round_asc'
));

function compareMatches(a: Match, b: Match): number {
  switch (selectedSort.value) {
    case 'round_desc':
      return b.round - a.round || b.matchNumber - a.matchNumber;
    case 'match_number_asc':
      return a.matchNumber - b.matchNumber || a.round - b.round;
    case 'match_number_desc':
      return b.matchNumber - a.matchNumber || b.round - a.round;
    case 'category_asc':
      return getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
    case 'court_asc':
      return getCourtName(a.courtId).localeCompare(getCourtName(b.courtId));
    case 'status_asc':
      return a.status.localeCompare(b.status);
    case 'round_asc':
    default:
      return a.round - b.round || a.matchNumber - b.matchNumber;
  }
}

const filteredMatches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const filtered = allMatches.value.filter((match) => {
    if (query) {
      const matchIdMatch = match.id.toLowerCase().includes(query);
      const matchNumberMatch = match.matchNumber.toString().includes(query);
      const participant1Match = getParticipantName(match.participant1Id).toLowerCase().includes(query);
      const participant2Match = getParticipantName(match.participant2Id).toLowerCase().includes(query);
      if (!matchIdMatch && !matchNumberMatch && !participant1Match && !participant2Match) {
        return false;
      }
    }

    if (selectedRound.value !== null && match.round !== selectedRound.value) {
      return false;
    }

    if (selectedCategory.value !== 'all' && match.categoryId !== selectedCategory.value) {
      return false;
    }

    if (selectedStatus.value !== 'all' && match.status !== selectedStatus.value) {
      return false;
    }

    if (selectedCourt.value !== 'all' && match.courtId !== selectedCourt.value) {
      return false;
    }

    return true;
  });

  return filtered.sort(compareMatches);
});

const filteredInProgressMatches = computed(() =>
  filteredMatches.value.filter((match) => match.status === 'in_progress')
);

const filteredReadyMatches = computed(() =>
  filteredMatches.value.filter((match) => match.status === 'ready')
);

const filteredScheduledMatches = computed(() =>
  filteredMatches.value.filter((match) => match.status === 'scheduled')
);

const filteredCompletedMatches = computed(() =>
  filteredMatches.value.filter((match) => match.status === 'completed' || match.status === 'walkover')
);

const hasFilteredResults = computed(() => (
  filteredInProgressMatches.value.length > 0 ||
  filteredReadyMatches.value.length > 0 ||
  filteredScheduledMatches.value.length > 0 ||
  filteredCompletedMatches.value.length > 0
));

function clearFilters() {
  searchQuery.value = '';
  selectedRound.value = null;
  selectedCategory.value = 'all';
  selectedStatus.value = 'all';
  selectedCourt.value = 'all';
  selectedSort.value = 'round_asc';
}
</script>

<template>
  <v-container
    fluid
    class="scorer-match-list pa-0"
  >
    <div
      class="scorer-match-list__ambient"
      aria-hidden="true"
    />

    <div class="scorer-match-list__content px-3 px-sm-6 py-5">
      <v-card
        class="scorer-match-list__hero mb-5"
        elevation="0"
      >
        <v-card-text class="pa-5 pa-sm-6">
          <div class="d-flex align-start flex-wrap ga-4">
            <div class="scorer-match-list__hero-brand">
              <v-btn
                icon="mdi-arrow-left"
                variant="text"
                class="scorer-match-list__back-btn"
                aria-label="Back to previous page"
                @click="router.back()"
              />
              <TournamentBrandMark
                :tournament-name="tournament?.name || 'Tournament'"
                :logo-url="tournamentLogoUrl"
                fallback-icon="mdi-scoreboard"
                :width="82"
                :height="82"
                class="scorer-match-list__hero-mark"
              />
              <div>
                <div class="text-overline scorer-match-list__eyebrow mb-1">
                  Scorer Console
                </div>
                <div class="scorer-match-list__hero-tournament mb-1">
                  {{ tournament?.name }}
                </div>
                <h1 class="text-h4 scorer-match-list__title mb-1">
                  Match Scoring Queue
                </h1>
                <p class="text-body-2 scorer-match-list__subtitle">
                  Phone-first scoring with tablet-friendly oversight for live courts.
                </p>
              </div>
            </div>

            <div class="flex-grow-1" />

            <div class="d-flex align-center ga-2 flex-wrap scorer-match-list__live-pills">
              <v-chip
                size="small"
                color="success"
                variant="tonal"
              >
                {{ filteredInProgressMatches.length }} Live
              </v-chip>
              <v-chip
                size="small"
                color="warning"
                variant="tonal"
              >
                {{ filteredReadyMatches.length }} Ready
              </v-chip>
              <v-chip
                size="small"
                color="info"
                variant="tonal"
              >
                {{ filteredScheduledMatches.length }} Scheduled
              </v-chip>
            </div>
          </div>

          <div class="scorer-match-list__kpis mt-5">
            <div class="scorer-match-list__kpi scorer-match-list__kpi--in-progress px-4 py-3">
              <span class="text-caption text-medium-emphasis">In Progress</span>
              <strong class="text-h5">{{ filteredInProgressMatches.length }}</strong>
            </div>
            <div class="scorer-match-list__kpi scorer-match-list__kpi--ready px-4 py-3">
              <span class="text-caption text-medium-emphasis">Ready to Play</span>
              <strong class="text-h5">{{ filteredReadyMatches.length }}</strong>
            </div>
            <div class="scorer-match-list__kpi scorer-match-list__kpi--scheduled px-4 py-3">
              <span class="text-caption text-medium-emphasis">Scheduled</span>
              <strong class="text-h5">{{ filteredScheduledMatches.length }}</strong>
            </div>
            <div class="scorer-match-list__kpi scorer-match-list__kpi--completed px-4 py-3">
              <span class="text-caption text-medium-emphasis">Completed</span>
              <strong class="text-h5">{{ filteredCompletedMatches.length }}</strong>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        class="scorer-match-list__filters mb-4"
        elevation="0"
      >
        <v-card-text class="pa-3 pa-sm-4">
          <filter-bar
            :search="searchQuery"
            :category="selectedCategory"
            :status="selectedStatus"
            :court="selectedCourt"
            :sort="selectedSort"
            :enable-category="true"
            :enable-status="true"
            :enable-court="true"
            :category-options="categoryOptions"
            :status-options="statusOptions"
            :court-options="courtOptions"
            :sort-options="sortOptions"
            search-label="Search"
            search-placeholder="Search by match ID, number, or participant"
            :has-active-filters="hasActiveFilters"
            @update:search="searchQuery = $event"
            @update:category="selectedCategory = $event || 'all'"
            @update:status="selectedStatus = $event || 'all'"
            @update:court="selectedCourt = $event || 'all'"
            @update:sort="selectedSort = $event || 'round_asc'"
            @clear="clearFilters"
          >
            <template #extra>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <v-select
                  v-model="selectedRound"
                  :items="roundOptions"
                  item-title="title"
                  item-value="value"
                  label="Round"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
            </template>
          </filter-bar>
        </v-card-text>
      </v-card>

      <!-- In Progress Matches -->
      <v-card
        v-if="filteredInProgressMatches.length > 0"
        class="mb-4 scorer-section scorer-section--in-progress"
        elevation="0"
      >
        <v-card-title>
          <v-icon
            start
            color="success"
          >
            mdi-play-circle
          </v-icon>
          In Progress
          <v-chip
            size="small"
            color="success"
            class="ml-2"
          >
            {{ filteredInProgressMatches.length }}
          </v-chip>
        </v-card-title>
        <v-list class="scorer-section__list">
          <v-list-item
            v-for="match in filteredInProgressMatches"
            :key="match.id"
            class="match-item"
            @click="openScoreDialog(match)"
          >
            <template #prepend>
              <v-avatar
                color="success"
                size="40"
              >
                <span class="text-body-2">{{ match.matchNumber }}</span>
              </v-avatar>
            </template>

            <v-list-item-title>
              {{ getParticipantName(match.participant1Id) }}
              <span class="text-grey mx-2">vs</span>
              {{ getParticipantName(match.participant2Id) }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ getCourtName(match.courtId) }} | Round {{ match.round }}
              <span
                v-if="match.scores.length > 0"
                class="ml-2"
              >
                Score: {{ match.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
              </span>
            </v-list-item-subtitle>

            <template #append>
              <v-btn
                color="success"
                variant="tonal"
                size="small"
                @click.stop="openScoreDialog(match)"
              >
                Score
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- Ready Matches -->
      <v-card
        v-if="filteredReadyMatches.length > 0"
        class="mb-4 scorer-section scorer-section--ready"
        elevation="0"
      >
        <v-card-title>
          <v-icon
            start
            color="warning"
          >
            mdi-clock-outline
          </v-icon>
          Ready to Play
          <v-chip
            size="small"
            color="warning"
            class="ml-2"
          >
            {{ filteredReadyMatches.length }}
          </v-chip>
        </v-card-title>
        <v-list class="scorer-section__list">
          <v-list-item
            v-for="match in filteredReadyMatches"
            :key="match.id"
            class="match-item"
            @click="openScoreDialog(match)"
          >
            <template #prepend>
              <v-avatar
                color="warning"
                size="40"
              >
                <span class="text-body-2">{{ match.matchNumber }}</span>
              </v-avatar>
            </template>

            <v-list-item-title>
              {{ getParticipantName(match.participant1Id) }}
              <span class="text-grey mx-2">vs</span>
              {{ getParticipantName(match.participant2Id) }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ getCourtName(match.courtId) }} | Round {{ match.round }}
            </v-list-item-subtitle>

            <template #append>
              <v-btn
                color="warning"
                variant="tonal"
                size="small"
                @click.stop="openScoreDialog(match)"
              >
                Score
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- Scheduled Matches -->
      <v-card
        v-if="filteredScheduledMatches.length > 0"
        class="mb-4 scorer-section scorer-section--scheduled"
        elevation="0"
      >
        <v-card-title>
          <v-icon
            start
            color="info"
          >
            mdi-calendar-clock
          </v-icon>
          Scheduled
          <v-chip
            size="small"
            color="info"
            class="ml-2"
          >
            {{ filteredScheduledMatches.length }}
          </v-chip>
        </v-card-title>
        <v-list class="scorer-section__list">
          <v-list-item
            v-for="match in filteredScheduledMatches"
            :key="match.id"
            class="match-item"
          >
            <template #prepend>
              <v-avatar
                color="info"
                size="40"
              >
                <span class="text-body-2">{{ match.matchNumber }}</span>
              </v-avatar>
            </template>

            <v-list-item-title>
              {{ getParticipantName(match.participant1Id) }}
              <span class="text-grey mx-2">vs</span>
              {{ getParticipantName(match.participant2Id) }}
            </v-list-item-title>

            <v-list-item-subtitle>
              Round {{ match.round }}
              <span
                v-if="match.scheduledTime"
                class="ml-2"
              >
                | {{ new Date(match.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
              </span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- Completed Matches -->
      <v-card
        v-if="filteredCompletedMatches.length > 0"
        class="mb-4 scorer-section scorer-section--completed"
        elevation="0"
      >
        <v-card-title>
          <v-icon
            start
            color="grey"
          >
            mdi-check-circle
          </v-icon>
          Completed
          <v-chip
            size="small"
            color="grey"
            class="ml-2"
          >
            {{ filteredCompletedMatches.length }}
          </v-chip>
          <span
            v-if="filteredCompletedMatches.length !== totalCompletedMatches.length"
            class="text-caption text-grey ml-2"
          >
            (filtered from {{ totalCompletedMatches.length }})
          </span>
        </v-card-title>
        <v-list class="scorer-section__list">
          <v-list-item
            v-for="match in filteredCompletedMatches"
            :key="match.id"
            class="match-item"
            @click="openScoreDialog(match)"
          >
            <template #prepend>
              <v-avatar
                color="grey"
                size="48"
              >
                <span class="text-caption font-weight-bold">#{{ match.matchNumber }}</span>
              </v-avatar>
            </template>

            <v-list-item-title class="d-flex align-center flex-wrap gap-2">
              <span>{{ getParticipantName(match.participant1Id) }}</span>
              <span class="text-grey">vs</span>
              <span>{{ getParticipantName(match.participant2Id) }}</span>
            </v-list-item-title>

            <v-list-item-subtitle class="mt-1">
              <div class="d-flex align-center flex-wrap gap-2">
                <v-chip
                  size="x-small"
                  color="primary"
                  variant="tonal"
                >
                  ID: {{ truncateId(match.id) }}
                </v-chip>
                <v-chip
                  size="x-small"
                  color="info"
                  variant="tonal"
                >
                  {{ getCategoryName(match.categoryId) }}
                </v-chip>
                <v-chip
                  size="x-small"
                  color="secondary"
                  variant="tonal"
                >
                  Round {{ match.round }}
                </v-chip>
              </div>
              <div class="mt-1 d-flex align-center">
                <span class="text-success font-weight-medium">
                  Winner: {{ match.winnerId === match.participant1Id ? getParticipantName(match.participant1Id) : getParticipantName(match.participant2Id) }}
                </span>
                <span
                  v-if="match.scores.length > 0"
                  class="ml-3 text-grey"
                >
                  Score: {{ match.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
                </span>
              </div>
            </v-list-item-subtitle>

            <template #append>
              <v-btn
                color="warning"
                variant="tonal"
                size="small"
                prepend-icon="mdi-pencil"
                @click.stop="openScoreDialog(match)"
              >
                Correct
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- No Filtered Results -->
      <v-card
        v-if="allMatches.length > 0 && !hasFilteredResults"
        class="text-center py-8 scorer-match-list__empty"
        elevation="0"
      >
        <v-icon
          size="48"
          color="grey-lighten-1"
        >
          mdi-filter-off
        </v-icon>
        <h3 class="text-h6 mt-4">
          No matches match your filters
        </h3>
        <p class="text-body-2 text-grey mt-2">
          Try adjusting your search or filters.
        </p>
        <v-btn
          color="primary"
          class="mt-4"
          @click="clearFilters"
        >
          Clear Filters
        </v-btn>
      </v-card>

      <!-- Empty State -->
      <v-card
        v-if="allMatches.length === 0"
        class="text-center py-12 scorer-match-list__empty"
        elevation="0"
      >
        <v-icon
          size="64"
          color="grey-lighten-1"
        >
          mdi-tournament
        </v-icon>
        <h3 class="text-h6 mt-4">
          No matches available
        </h3>
        <p class="text-body-2 text-grey mt-2">
          There are no matches ready to be scored at this time.
        </p>
      </v-card>

      <ManualScoreDialog
        v-if="tournament"
        v-model="showManualScoreDialog"
        :match="selectedMatch"
        :tournament-id="tournamentId"
        :tournament="tournament"
        :categories="tournamentStore.categories"
        @saved="showManualScoreDialog = false"
      />

      <ScoreCorrectionDialog
        v-model="showCorrectionDialog"
        :match="selectedMatch"
        :tournament-id="tournamentId"
        :category-id="selectedMatch?.categoryId"
        :scoring-config="selectedMatch?.scoringConfig || BADMINTON_CONFIG"
        @corrected="showCorrectionDialog = false"
      />
    </div>
  </v-container>
</template>

<style scoped>
.scorer-match-list {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(164deg, rgba(var(--v-theme-primary), 0.07) 0%, rgba(var(--v-theme-surface), 0.95) 44%, rgba(var(--v-theme-info), 0.06) 100%);
}

.scorer-match-list__ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 8% 11%, rgba(var(--v-theme-primary), 0.2), transparent 38%),
    radial-gradient(circle at 88% 20%, rgba(var(--v-theme-secondary), 0.16), transparent 34%),
    radial-gradient(circle at 52% 96%, rgba(var(--v-theme-info), 0.11), transparent 44%);
}

.scorer-match-list__content {
  position: relative;
  z-index: 1;
  max-width: 1460px;
  margin: 0 auto;
}

.scorer-match-list__hero {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  border-radius: 24px;
  background: linear-gradient(148deg, rgba(var(--v-theme-surface), 0.97) 0%, rgba(var(--v-theme-surface), 0.9) 100%);
  box-shadow: 0 22px 36px rgba(15, 23, 42, 0.08);
}

.scorer-match-list__back-btn {
  background: rgba(var(--v-theme-primary), 0.08);
}

.scorer-match-list__hero-brand {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.scorer-match-list__hero-mark {
  flex-shrink: 0;
}

.scorer-match-list__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.88);
}

.scorer-match-list__hero-tournament {
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.scorer-match-list__title {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  font-weight: 700;
  line-height: 1;
}

.scorer-match-list__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.scorer-match-list__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.scorer-match-list__kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.93);
  border-radius: 16px;
}

.scorer-match-list__kpi strong {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  line-height: 1;
}

.scorer-match-list__kpi--in-progress {
  border-color: rgba(var(--v-theme-success), 0.3);
}

.scorer-match-list__kpi--ready {
  border-color: rgba(var(--v-theme-warning), 0.32);
}

.scorer-match-list__kpi--scheduled {
  border-color: rgba(var(--v-theme-info), 0.3);
}

.scorer-match-list__kpi--completed {
  border-color: rgba(var(--v-theme-on-surface), 0.18);
}

.scorer-match-list__filters {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.92);
}

.scorer-section {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.94);
  overflow: hidden;
}

.scorer-section--in-progress {
  border-color: rgba(var(--v-theme-success), 0.22);
}

.scorer-section--ready {
  border-color: rgba(var(--v-theme-warning), 0.24);
}

.scorer-section--scheduled {
  border-color: rgba(var(--v-theme-info), 0.24);
}

.scorer-section__list {
  background: transparent;
}

.match-item {
  margin: 4px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 180ms ease, transform 180ms ease;
}

.match-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.06);
  transform: translateX(2px);
}

.scorer-match-list__empty {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.93);
}

@media (max-width: 960px) {
  .scorer-match-list__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .match-item {
    margin: 4px 6px;
  }
}

@media (max-width: 599px) {
  .scorer-match-list__hero {
    border-radius: 18px;
  }

  .scorer-match-list__hero-brand {
    gap: 10px;
  }

  .scorer-match-list__hero-mark {
    width: 64px;
    height: 64px;
  }

  .scorer-match-list__title {
    font-size: 2rem !important;
  }

  .scorer-match-list__live-pills {
    width: 100%;
  }

  .scorer-match-list__kpis {
    grid-template-columns: 1fr;
  }

  .scorer-match-list__filters,
  .scorer-section,
  .scorer-match-list__empty {
    border-radius: 14px;
  }

  .match-item {
    margin: 4px;
  }
}
</style>
