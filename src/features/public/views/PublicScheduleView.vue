<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import { useActivityStore } from '@/stores/activities';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useDurationFormatter } from '@/composables/useDurationFormatter';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Match } from '@/types';

type PublicMatchStatus = 'on_court' | 'upcoming' | 'delayed' | 'finished' | 'cancelled';

interface ParticipantLookup {
  registrationId?: string;
  displayName: string;
  isTeam: boolean;
  teamName?: string;
  playerIds: string[];
  playerNames: string[];
  searchText: string;
}

interface PublicScheduleItem {
  match: Match;
  categoryId: string;
  categoryLabel: string;
  matchup: string;
  roundLabel: string;
  participant1: ParticipantLookup;
  participant2: ParticipantLookup;
  playerIds: string[];
  playerNames: string[];
  teamNames: string[];
  searchText: string;
}

interface CategoryPulseItem {
  categoryId: string;
  categoryLabel: string;
  liveCount: number;
  queuedCount: number;
  completedCount: number;
  totalCount: number;
  nextStartLabel: string;
  nextMatchup: string;
}

const route = useRoute();
const router = useRouter();
const activityStore = useActivityStore();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();
const { formatDuration, formatDurationAgo } = useDurationFormatter();

const tournamentId = computed(() => route.params.tournamentId as string);
const nowTimestamp = ref(Date.now());
const lastUpdatedAt = ref<Date | null>(null);
const notFound = ref(false);
let clockInterval: ReturnType<typeof setInterval> | null = null;

const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const activities = computed(() => activityStore.recentActivities);
const registrationsById = computed(() =>
  new Map(registrationStore.registrations.map((registration) => [registration.id, registration]))
);
const playersById = computed(() =>
  new Map(registrationStore.players.map((player) => [player.id, player]))
);

function getQueryValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

const selectedCategoryId = computed(() => getQueryValue(route.query.category) || 'all');
const displayMode = computed(() => getQueryValue(route.query.view) === 'display');

function replaceQuery(updates: Record<string, string | null>): void {
  const nextQuery: LocationQueryRaw = { ...route.query };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete nextQuery[key];
    } else {
      nextQuery[key] = value;
    }
  }
  void router.replace({ query: nextQuery });
}

function setDisplayMode(enabled: boolean): void {
  replaceQuery({ view: enabled ? 'display' : null });
}

function handleDisplayKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && displayMode.value) {
    setDisplayMode(false);
  }
}

function getCategoryLabel(categoryId: string): string {
  return categories.value.find((category) => category.id === categoryId)?.name || categoryId;
}

function getCourtName(courtId: string | null | undefined): string {
  if (!courtId) return 'TBD';
  return tournamentStore.courts.find((c) => c.id === courtId)?.name ?? 'TBD';
}

function formatTime(date?: Date): string {
  if (!date) return 'TBD';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getRoundLabel(match: Match): string {
  if (match.groupId) {
    return `Pool ${match.groupId} · Round ${match.round}`;
  }
  if (match.round > 0) {
    return `Round ${match.round}`;
  }
  return 'Match';
}

function getPlayerName(playerId: string | undefined): string {
  if (!playerId) return 'Unknown player';
  const player = playersById.value.get(playerId);
  if (!player) return 'Unknown player';
  return `${player.firstName} ${player.lastName}`;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function isMatchPublished(match: Match): boolean {
  return match.scheduleStatus === 'published' || Boolean(match.publishedAt);
}

function buildParticipantLookup(registrationId: string | undefined): ParticipantLookup {
  if (!registrationId) {
    return {
      displayName: 'TBD',
      isTeam: false,
      playerIds: [],
      playerNames: [],
      searchText: 'tbd',
    };
  }

  const registration = registrationsById.value.get(registrationId);
  if (!registration) {
    const name = getParticipantName(registrationId) || 'TBD';
    return {
      registrationId,
      displayName: name,
      isTeam: false,
      playerIds: [],
      playerNames: [],
      searchText: name.toLowerCase(),
    };
  }

  const playerIds = uniqueValues([registration.playerId || '', registration.partnerPlayerId || '']);
  const playerNames = playerIds.map(getPlayerName);
  const teamName = registration.teamName?.trim();
  const displayName =
    teamName || (playerNames.length > 0 ? playerNames.join(' / ') : getParticipantName(registrationId) || 'TBD');
  const isTeam = Boolean(teamName || registration.partnerPlayerId);
  const searchTerms = uniqueValues([displayName, teamName || '', ...playerNames]);

  return {
    registrationId,
    displayName,
    isTeam,
    teamName: isTeam ? displayName : undefined,
    playerIds,
    playerNames,
    searchText: searchTerms.join(' ').toLowerCase(),
  };
}

function createScheduleItem(match: Match): PublicScheduleItem {
  const categoryLabel = getCategoryLabel(match.categoryId);
  const participant1 = buildParticipantLookup(match.participant1Id);
  const participant2 = buildParticipantLookup(match.participant2Id);
  const matchup = `${participant1.displayName} vs ${participant2.displayName}`;
  const roundLabel = getRoundLabel(match);
  const playerIds = uniqueValues([...participant1.playerIds, ...participant2.playerIds]);
  const playerNames = uniqueValues([...participant1.playerNames, ...participant2.playerNames]);
  const teamNames = uniqueValues([
    participant1.isTeam ? participant1.displayName : '',
    participant2.isTeam ? participant2.displayName : '',
  ]);
  const searchText = [
    categoryLabel,
    matchup,
    roundLabel,
    participant1.searchText,
    participant2.searchText,
    ...teamNames,
    ...playerNames,
  ]
    .join(' ')
    .toLowerCase();

  return {
    match,
    categoryId: match.categoryId,
    categoryLabel,
    matchup,
    roundLabel,
    participant1,
    participant2,
    playerIds,
    playerNames,
    teamNames,
    searchText,
  };
}

function updateCategoryFilter(value: string | null): void {
  replaceQuery({ category: !value || value === 'all' ? null : value });
}

const publishedMatches = computed(() =>
  [...matchStore.matches]
    .filter((match) => Boolean(match.plannedStartAt) && isMatchPublished(match))
    .sort((a, b) => (a.plannedStartAt?.getTime() || 0) - (b.plannedStartAt?.getTime() || 0))
);

const hasPublishedSchedule = computed(() => publishedMatches.value.length > 0);

const categoryScopedItems = computed<PublicScheduleItem[]>(() =>
  publishedMatches.value
    .filter((match) => selectedCategoryId.value === 'all' || match.categoryId === selectedCategoryId.value)
    .map(createScheduleItem)
);

const filteredScheduleItems = computed<PublicScheduleItem[]>(() => categoryScopedItems.value);

function getPublicStatus(match: Match): PublicMatchStatus {
  if (match.status === 'in_progress') return 'on_court';
  if (match.status === 'completed' || match.status === 'walkover') return 'finished';
  if (match.status === 'cancelled') return 'cancelled';

  const plannedMs = match.plannedStartAt?.getTime();
  return plannedMs && plannedMs < nowTimestamp.value ? 'delayed' : 'upcoming';
}

const STATUS_META: Record<PublicMatchStatus, { color: string; label: string }> = {
  on_court: { color: 'success', label: 'Live' },
  upcoming: { color: 'primary', label: 'Upcoming' },
  delayed: { color: 'warning', label: 'Delayed' },
  cancelled: { color: 'error', label: 'Cancelled' },
  finished: { color: 'info', label: 'Finished' },
};

function getStatusColor(status: PublicMatchStatus): string {
  return STATUS_META[status].color;
}

function getStatusLabel(status: PublicMatchStatus): string {
  return STATUS_META[status].label;
}

function getStartHint(match: Match): string {
  const status = getPublicStatus(match);

  if (status === 'on_court') {
    const startedAtMs = match.startedAt?.getTime();
    if (startedAtMs) {
      const elapsed = Math.max(1, Math.floor((nowTimestamp.value - startedAtMs) / 60_000));
      return `Started ${formatDurationAgo(elapsed)}`;
    }
    return 'In progress';
  }

  if (status === 'finished') {
    return match.completedAt ? `Finished at ${formatTime(match.completedAt)}` : 'Finished';
  }

  if (status === 'cancelled') {
    return 'Removed from schedule';
  }

  const plannedStartMs = match.plannedStartAt?.getTime();
  if (!plannedStartMs) return 'Start time TBD';

  const deltaMinutes = Math.round((plannedStartMs - nowTimestamp.value) / 60_000);
  if (status === 'delayed') {
    return `Delayed ${formatDuration(Math.abs(deltaMinutes))}`;
  }
  if (Math.abs(deltaMinutes) <= 1) return 'Starting now';
  if (deltaMinutes > 0) return `Starts in ${formatDuration(deltaMinutes)}`;
  return `Scheduled ${formatTime(match.plannedStartAt)}`;
}

function getCurrentScore(match: Match): string {
  if (!Array.isArray(match.scores) || match.scores.length === 0) {
    return '0 - 0';
  }

  const currentGame = match.scores[match.scores.length - 1];
  return `${currentGame.score1} - ${currentGame.score2}`;
}

function getGamesScore(match: Match): string {
  let participant1Games = 0;
  let participant2Games = 0;

  for (const game of match.scores || []) {
    if (!game.isComplete) continue;
    if (game.winnerId === match.participant1Id) participant1Games += 1;
    if (game.winnerId === match.participant2Id) participant2Games += 1;
  }

  return `${participant1Games} - ${participant2Games}`;
}

function byPlannedTime(a: PublicScheduleItem, b: PublicScheduleItem): number {
  return (a.match.plannedStartAt?.getTime() || 0) - (b.match.plannedStartAt?.getTime() || 0);
}

const nowPlayingItems = computed<PublicScheduleItem[]>(() =>
  matchStore.inProgressMatches
    .filter((match) => selectedCategoryId.value === 'all' || match.categoryId === selectedCategoryId.value)
    .map(createScheduleItem)
    .sort((a, b) => {
      const aTime = a.match.startedAt?.getTime() || a.match.plannedStartAt?.getTime() || 0;
      const bTime = b.match.startedAt?.getTime() || b.match.plannedStartAt?.getTime() || 0;
      return aTime - bTime;
    })
    .slice(0, 8)
);

const upNextItems = computed<PublicScheduleItem[]>(() =>
  filteredScheduleItems.value
    .filter((item) => {
      const status = getPublicStatus(item.match);
      return status === 'upcoming' || status === 'delayed';
    })
    .sort(byPlannedTime)
    .slice(0, 8)
);

const fallbackQueueItems = computed<PublicScheduleItem[]>(() =>
  [...matchStore.matches]
    .filter((match) => selectedCategoryId.value === 'all' || match.categoryId === selectedCategoryId.value)
    .filter((match) => match.status === 'ready' || match.status === 'scheduled')
    .map(createScheduleItem)
    .sort((a, b) => {
      const aTime = a.match.plannedStartAt?.getTime() || Number.MAX_SAFE_INTEGER;
      const bTime = b.match.plannedStartAt?.getTime() || Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      if (a.match.round !== b.match.round) return a.match.round - b.match.round;
      return a.match.matchNumber - b.match.matchNumber;
    })
    .slice(0, 8)
);

const displayQueueItems = computed<PublicScheduleItem[]>(() =>
  upNextItems.value.length > 0 ? upNextItems.value : fallbackQueueItems.value
);

const categoryPulseItems = computed<CategoryPulseItem[]>(() => {
  const items: CategoryPulseItem[] = [];

  for (const category of categories.value) {
    const categoryMatches = matchStore.matches.filter((match) => match.categoryId === category.id);
    if (categoryMatches.length === 0) continue;

    const liveCount = categoryMatches.filter((match) => match.status === 'in_progress').length;
    const queuedMatches = categoryMatches.filter((match) => match.status === 'ready' || match.status === 'scheduled');
    const completedCount = categoryMatches.filter(
      (match) => match.status === 'completed' || match.status === 'walkover'
    ).length;

    const nextMatch = [...queuedMatches].sort((a, b) => {
      const aTime = a.plannedStartAt?.getTime() || Number.MAX_SAFE_INTEGER;
      const bTime = b.plannedStartAt?.getTime() || Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      if (a.round !== b.round) return a.round - b.round;
      return a.matchNumber - b.matchNumber;
    })[0];

    const nextScheduleItem = nextMatch ? createScheduleItem(nextMatch) : null;

    items.push({
      categoryId: category.id,
      categoryLabel: category.name,
      liveCount,
      queuedCount: queuedMatches.length,
      completedCount,
      totalCount: categoryMatches.length,
      nextStartLabel: nextMatch?.plannedStartAt ? formatTime(nextMatch.plannedStartAt) : 'TBD',
      nextMatchup: nextScheduleItem?.matchup || 'No upcoming matches',
    });
  }

  return items.sort((a, b) => {
    if (a.liveCount !== b.liveCount) return b.liveCount - a.liveCount;
    if (a.queuedCount !== b.queuedCount) return b.queuedCount - a.queuedCount;
    return a.categoryLabel.localeCompare(b.categoryLabel);
  });
});

const tournamentProgress = computed(() => {
  const totalCount = matchStore.matches.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percent: 0 };
  }

  const completedCount = matchStore.matches.filter(
    (match) => match.status === 'completed' || match.status === 'walkover'
  ).length;

  return {
    completedCount,
    totalCount,
    percent: Math.round((completedCount / totalCount) * 100),
  };
});

const tickerItems = computed<string[]>(() => {
  const categorySummaries = categoryPulseItems.value.map((item) =>
    `${item.categoryLabel}: ${item.liveCount} live · ${item.queuedCount} up next · ${item.completedCount}/${item.totalCount} complete`
  );

  const activitySummaries = activities.value.slice(0, 10).map((activity) => activity.message.trim());

  const entries = uniqueValues([
    ...categorySummaries,
    ...activitySummaries,
    `Bracket: /tournaments/${tournamentId.value}/bracket`,
  ]);

  return entries.slice(0, 20);
});

const tickerLoopItems = computed<string[]>(() => {
  if (tickerItems.value.length === 0) {
    return ['Awaiting live updates', 'Awaiting live updates'];
  }

  return [...tickerItems.value, ...tickerItems.value];
});

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return 'Last updated --';
  return `Last updated ${lastUpdatedAt.value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
});

function openPublicBracket(): void {
  void router.push(`/tournaments/${tournamentId.value}/bracket`);
}

watch(
  () => matchStore.matches,
  () => {
    lastUpdatedAt.value = new Date();
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  window.addEventListener('keydown', handleDisplayKeydown);

  clockInterval = setInterval(() => {
    nowTimestamp.value = Date.now();
  }, 30_000);

  try {
    await tournamentStore.fetchTournament(tournamentId.value);
    await Promise.all([
      registrationStore.fetchRegistrations(tournamentId.value),
      registrationStore.fetchPlayers(tournamentId.value),
    ]);

    tournamentStore.subscribeTournament(tournamentId.value);
    matchStore.subscribeAllMatches(tournamentId.value);
    activityStore.subscribeActivities(tournamentId.value, 40);
  } catch (error) {
    console.error('Failed to load public schedule:', error);
    notFound.value = true;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleDisplayKeydown);

  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  activityStore.unsubscribe();
  matchStore.unsubscribeAll();
  tournamentStore.unsubscribeAll();
});
</script>

<template>
  <div
    v-if="displayMode"
    class="display-mode"
  >
    <header class="display-mode__header">
      <div class="display-mode__title-block">
        <h1 class="display-mode__title">
          {{ tournament?.name || 'Tournament' }}
        </h1>
        <p class="display-mode__subtitle">
          Public Schedule Display
        </p>
      </div>

      <div class="display-mode__progress">
        <span class="display-mode__progress-label">
          {{ tournamentProgress.completedCount }}/{{ tournamentProgress.totalCount }} complete
        </span>
        <div class="display-mode__progress-bar">
          <div
            class="display-mode__progress-fill"
            :style="{ width: `${tournamentProgress.percent}%` }"
          />
        </div>
        <span class="display-mode__progress-percent">
          {{ tournamentProgress.percent }}%
        </span>
      </div>

      <div class="display-mode__header-actions">
        <v-chip
          size="small"
          color="primary"
          variant="tonal"
        >
          {{ lastUpdatedLabel }}
        </v-chip>
        <v-btn
          size="small"
          variant="outlined"
          color="white"
          prepend-icon="mdi-fullscreen-exit"
          @click="setDisplayMode(false)"
        >
          Exit Display
        </v-btn>
      </div>
    </header>

    <div class="display-mode__body">
      <section class="display-mode__panel display-mode__panel--live">
        <div class="display-mode__panel-header">
          <span>Now Playing</span>
          <v-chip
            size="small"
            color="success"
            variant="tonal"
          >
            {{ nowPlayingItems.length }}
          </v-chip>
        </div>

        <div
          v-if="nowPlayingItems.length === 0"
          class="display-mode__empty"
        >
          <v-icon
            size="64"
            color="grey"
          >
            mdi-badminton
          </v-icon>
          <p class="display-mode__empty-text">
            No matches in progress
          </p>
        </div>

        <div
          v-else
          class="display-live-grid"
        >
          <article
            v-for="item in nowPlayingItems"
            :key="`display-live-${item.categoryId}-${item.match.id}`"
            class="display-live-card"
          >
            <div class="display-live-card__meta">
              {{ item.categoryLabel }} · {{ item.roundLabel }}
            </div>
            <h2 class="display-live-card__matchup">
              {{ item.matchup }}
            </h2>
            <div class="display-live-card__score">
              {{ getCurrentScore(item.match) }}
            </div>
            <div class="display-live-card__games">
              Games {{ getGamesScore(item.match) }}
            </div>
          </article>
        </div>
      </section>

      <aside class="display-mode__side">
        <v-card
          variant="outlined"
          class="display-side-card"
        >
          <v-card-title class="display-side-card__title">
            Up Next
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="item in displayQueueItems"
              :key="`display-next-${item.categoryId}-${item.match.id}`"
            >
              <v-list-item-title class="text-body-2">
                {{ item.matchup }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ formatTime(item.match.plannedStartAt) }} · {{ item.categoryLabel }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip
                  size="x-small"
                  :color="getStatusColor(getPublicStatus(item.match))"
                  variant="tonal"
                >
                  {{ getStartHint(item.match) }}
                </v-chip>
              </template>
            </v-list-item>
            <v-list-item v-if="displayQueueItems.length === 0">
              <v-list-item-title class="text-body-2 text-medium-emphasis">
                No upcoming matches yet.
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card
          variant="outlined"
          class="display-side-card mt-3"
        >
          <v-card-title class="display-side-card__title">
            Category Pulse
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="item in categoryPulseItems.slice(0, 8)"
              :key="`display-pulse-${item.categoryId}`"
            >
              <v-list-item-title class="text-body-2">
                {{ item.categoryLabel }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ item.liveCount }} live · {{ item.queuedCount }} up next · {{ item.completedCount }}/{{ item.totalCount }} complete
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text-caption text-medium-emphasis text-truncate">
                {{ item.nextStartLabel }} · {{ item.nextMatchup }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="categoryPulseItems.length === 0">
              <v-list-item-title class="text-body-2 text-medium-emphasis">
                Category activity will appear here.
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <v-card-actions>
            <v-btn
              size="small"
              variant="outlined"
              prepend-icon="mdi-tournament"
              @click="openPublicBracket()"
            >
              Open Public Bracket
            </v-btn>
          </v-card-actions>
        </v-card>
      </aside>
    </div>

    <footer class="display-mode__ticker">
      <div class="display-mode__ticker-track">
        <span
          v-for="(item, index) in tickerLoopItems"
          :key="`ticker-${index}`"
          class="display-mode__ticker-item"
        >
          {{ item }}
        </span>
      </div>
    </footer>
  </div>

  <v-container
    v-else
    max-width="1180"
    class="pb-8"
  >
    <v-alert
      v-if="notFound"
      type="error"
      class="mt-8"
    >
      Tournament not found.
    </v-alert>

    <template v-else>
      <!-- ─── Header ──────────────────────────────────────────────── -->
      <div class="schedule-header mt-6 mb-3">
        <div>
          <h1 class="text-h5 font-weight-bold">
            {{ tournament?.name || 'Tournament' }}
          </h1>
          <div class="text-caption text-medium-emphasis">
            Live Schedule · Auto-refreshing every 30s · Times in your local timezone
          </div>
        </div>
        <div class="schedule-header__actions">
          <v-btn
            size="small"
            variant="outlined"
            prepend-icon="mdi-monitor"
            @click="setDisplayMode(true)"
          >
            Display Mode
          </v-btn>
          <v-btn
            :to="`/tournaments/${tournamentId}/player`"
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-account-clock"
          >
            My Schedule
          </v-btn>
          <v-btn
            :to="`/tournaments/${tournamentId}/bracket`"
            size="small"
            variant="outlined"
            prepend-icon="mdi-tournament"
          >
            Brackets
          </v-btn>
        </div>
      </div>

      <!-- ─── Category filter chips ────────────────────────────────── -->
      <v-chip-group
        v-if="categories.length > 1"
        :model-value="selectedCategoryId"
        mandatory
        class="mb-5"
        @update:model-value="updateCategoryFilter"
      >
        <v-chip
          value="all"
          variant="outlined"
          size="small"
        >
          All
        </v-chip>
        <v-chip
          v-for="cat in categories"
          :key="cat.id"
          :value="cat.id"
          variant="outlined"
          size="small"
        >
          {{ cat.name }}
        </v-chip>
      </v-chip-group>

      <!-- ─── Zone 1: Now Playing ──────────────────────────────────── -->
      <section
        v-if="nowPlayingItems.length > 0"
        class="mb-7"
      >
        <div class="section-label mb-3">
          <v-icon
            color="success"
            size="10"
            class="mr-2"
          >
            mdi-circle
          </v-icon>
          <span class="text-overline font-weight-bold">Now Playing</span>
          <v-chip
            size="x-small"
            color="success"
            variant="tonal"
            class="ml-2"
          >
            {{ nowPlayingItems.length }}
          </v-chip>
        </div>

        <div class="now-playing-grid">
          <v-card
            v-for="item in nowPlayingItems"
            :key="`live-${item.match.id}`"
            variant="tonal"
            color="success"
            class="court-card"
          >
            <v-card-text class="pa-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-caption font-weight-bold text-uppercase text-success">
                  {{ getCourtName(item.match.courtId) }}
                </span>
                <v-chip
                  size="x-small"
                  color="success"
                  variant="flat"
                >
                  LIVE
                </v-chip>
              </div>
              <div class="court-card__player font-weight-bold text-body-2">
                {{ item.participant1.displayName }}
              </div>
              <div class="court-card__vs text-caption text-medium-emphasis text-center my-1">
                vs
              </div>
              <div class="court-card__player font-weight-bold text-body-2">
                {{ item.participant2.displayName }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                {{ item.categoryLabel }}
              </div>
            </v-card-text>
          </v-card>
        </div>
      </section>

      <!-- ─── Zone 2: Up Next ──────────────────────────────────────── -->
      <section class="mb-7">
        <div class="section-label mb-3">
          <v-icon
            size="14"
            class="mr-2"
          >
            mdi-clock-outline
          </v-icon>
          <span class="text-overline font-weight-bold">Up Next</span>
          <span
            v-if="displayQueueItems.length > 0"
            class="text-caption text-medium-emphasis ml-2"
          >
            {{ displayQueueItems.length }} matches
          </span>
        </div>

        <v-card variant="outlined">
          <v-list
            v-if="displayQueueItems.length > 0"
            density="compact"
          >
            <v-list-item
              v-for="item in displayQueueItems"
              :key="`next-${item.match.id}`"
              class="py-2"
            >
              <v-list-item-title class="text-body-2">
                {{ item.matchup }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ formatTime(item.match.plannedStartAt) }}
                · {{ getCourtName(item.match.courtId ?? item.match.plannedCourtId) }}
                · {{ item.categoryLabel }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip
                  size="x-small"
                  :color="getStatusColor(getPublicStatus(item.match))"
                  variant="tonal"
                >
                  {{ getStartHint(item.match) }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text
            v-else
            class="text-center text-grey py-5"
          >
            No upcoming matches at this time.
          </v-card-text>
        </v-card>
      </section>

      <!-- ─── Zone 3: Full Schedule ────────────────────────────────── -->
      <section class="mb-6">
        <div class="section-label mb-3">
          <v-icon
            size="14"
            class="mr-2"
          >
            mdi-calendar-clock
          </v-icon>
          <span class="text-overline font-weight-bold">Full Schedule</span>
          <span
            v-if="filteredScheduleItems.length > 0"
            class="text-caption text-medium-emphasis ml-2"
          >
            {{ filteredScheduleItems.length }} matches
          </span>
        </div>

        <!-- No schedule published yet -->
        <v-card
          v-if="!hasPublishedSchedule"
          variant="outlined"
        >
          <v-card-text class="text-center text-grey py-10">
            <v-icon
              size="48"
              class="mb-3 d-block"
            >
              mdi-calendar-blank
            </v-icon>
            Schedule not yet published.
            <div class="text-caption mt-1">
              Check back soon.
            </div>
          </v-card-text>
        </v-card>

        <!-- Match list -->
        <v-card
          v-else
          variant="outlined"
        >
          <v-list density="compact">
            <template
              v-for="(item, index) in filteredScheduleItems"
              :key="`sched-${item.match.id}`"
            >
              <v-divider v-if="index > 0" />
              <v-list-item
                :class="getPublicStatus(item.match) === 'finished' ? 'schedule-row--finished' : ''"
                class="py-2"
              >
                <template #prepend>
                  <div class="schedule-time mr-3">
                    <div class="text-body-2 font-weight-medium">
                      {{ formatTime(item.match.plannedStartAt) }}
                    </div>
                  </div>
                </template>
                <v-list-item-title class="text-body-2">
                  {{ item.matchup }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ getCourtName(item.match.courtId ?? item.match.plannedCourtId) }}
                  · {{ item.categoryLabel }}
                  · {{ item.roundLabel }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    size="x-small"
                    :color="getStatusColor(getPublicStatus(item.match))"
                    variant="tonal"
                  >
                    {{ getStatusLabel(getPublicStatus(item.match)) }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </section>
    </template>
  </v-container>
</template>

<style scoped>
.schedule-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.schedule-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time-block {
  min-width: 96px;
  text-align: left;
}

.public-summary-card {
  height: 100%;
}

.public-summary-card--live {
  background: linear-gradient(
    140deg,
    rgba(var(--v-theme-success), 0.08) 0%,
    rgba(var(--v-theme-surface), 1) 65%
  );
}

.public-summary-card--next {
  background: linear-gradient(
    140deg,
    rgba(var(--v-theme-primary), 0.08) 0%,
    rgba(var(--v-theme-surface), 1) 65%
  );
}

.schedule-row--next {
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-inline-start: 3px solid rgb(var(--v-theme-primary));
}

.match-meta {
  min-width: 170px;
  text-align: right;
}

.display-mode {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: radial-gradient(circle at top left, #1b2440 0%, #090c15 52%, #06080f 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px 0;
}

.display-mode__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.display-mode__title-block {
  min-width: 220px;
  max-width: 340px;
}

.display-mode__title {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.display-mode__subtitle {
  margin: 4px 0 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.56);
}

.display-mode__progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 280px;
}

.display-mode__progress-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.display-mode__progress-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.display-mode__progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4caf50 0%, #7ed957 100%);
  transition: width 0.35s ease;
}

.display-mode__progress-percent {
  min-width: 36px;
  text-align: right;
  font-size: 0.82rem;
  font-weight: 700;
  color: #7ed957;
}

.display-mode__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.display-mode__body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  overflow: hidden;
  padding-bottom: 12px;
}

.display-mode__panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(4px);
}

.display-mode__panel--live {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.display-mode__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.92rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.76);
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.display-mode__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.display-mode__empty-text {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1rem;
}

.display-live-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.display-live-card {
  border-radius: 10px;
  border: 1px solid rgba(126, 217, 87, 0.4);
  background: linear-gradient(160deg, rgba(33, 62, 32, 0.6) 0%, rgba(8, 12, 20, 0.92) 65%);
  padding: 14px;
}

.display-live-card__meta {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(126, 217, 87, 0.9);
  margin-bottom: 8px;
}

.display-live-card__matchup {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.9);
}

.display-live-card__score {
  margin-top: 10px;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.display-live-card__games {
  margin-top: 4px;
  font-size: 0.74rem;
  color: rgba(255, 255, 255, 0.58);
}

.display-mode__side {
  width: 400px;
  max-width: 40%;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.display-side-card {
  background: rgba(12, 16, 28, 0.9);
  border-color: rgba(255, 255, 255, 0.16);
}

.display-side-card__title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.64);
}

.display-mode__ticker {
  overflow: hidden;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.32);
  padding: 10px 0;
}

.display-mode__ticker-track {
  display: inline-flex;
  min-width: 200%;
  animation: ticker-scroll 54s linear infinite;
}

.display-mode__ticker-item {
  white-space: nowrap;
  font-size: 0.86rem;
  color: rgba(255, 255, 255, 0.84);
  padding-right: 48px;
}

@keyframes ticker-scroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 1264px) {
  .display-mode {
    padding: 14px 14px 0;
  }

  .display-mode__header {
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .display-mode__progress {
    order: 3;
    width: 100%;
  }

  .display-mode__body {
    flex-direction: column;
  }

  .display-mode__side {
    width: 100%;
    max-width: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    overflow: visible;
  }

  .display-side-card {
    margin-top: 0 !important;
  }
}

@media (max-width: 960px) {
  .match-meta {
    min-width: 128px;
  }

  .display-mode__side {
    grid-template-columns: 1fr;
  }

  .display-live-grid {
    grid-template-columns: 1fr;
  }

  .display-mode__ticker-item {
    font-size: 0.8rem;
    padding-right: 32px;
  }
}
</style>
