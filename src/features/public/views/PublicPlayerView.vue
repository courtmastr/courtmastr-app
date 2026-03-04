<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { usePlayerSchedule } from '@/composables/usePlayerSchedule';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import type { Match } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const notFound = ref(false);

// ─── Search ────────────────────────────────────────────────────────────────

const searchQuery = ref('');
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

interface PlayerResult {
  registrationId: string;
  displayName: string;
  categoryName: string;
}

const searchResults = computed<PlayerResult[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: PlayerResult[] = [];
  for (const reg of registrationStore.registrations) {
    const name = getParticipantName(reg.id).toLowerCase();
    if (name.includes(q) && name !== 'tbd' && name !== 'unknown') {
      const category = tournamentStore.categories.find((c) => c.id === reg.categoryId);
      results.push({
        registrationId: reg.id,
        displayName: getParticipantName(reg.id),
        categoryName: category?.name ?? reg.categoryId,
      });
    }
  }
  return results;
});

// Persist search to URL (debounced)
watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    router.replace({
      query: { ...route.query, q: val || undefined, reg: selectedRegistrationId.value || undefined },
    });
  }, 300);
});

// ─── Player selection ───────────────────────────────────────────────────────

const selectedRegistrationId = ref<string | null>(null);

const selectedRegistration = computed(
  () => registrationStore.registrations.find((r) => r.id === selectedRegistrationId.value) ?? null
);

const selectedPlayerName = computed(() =>
  selectedRegistrationId.value ? getParticipantName(selectedRegistrationId.value) : null
);

const selectedCategoryName = computed(() => {
  if (!selectedRegistration.value) return null;
  return (
    tournamentStore.categories.find((c) => c.id === selectedRegistration.value!.categoryId)?.name ?? null
  );
});

// Auto-select if exactly one result
watch(searchResults, (results) => {
  if (results.length === 1) {
    selectedRegistrationId.value = results[0].registrationId;
  } else if (results.length !== 1) {
    // Only clear if no longer single-match (don't clear on manually selected reg)
    if (!results.some((r) => r.registrationId === selectedRegistrationId.value)) {
      selectedRegistrationId.value = null;
    }
  }
});

function selectPlayer(registrationId: string) {
  selectedRegistrationId.value = registrationId;
  router.replace({ query: { ...route.query, reg: registrationId } });
}

function clearPlayer() {
  selectedRegistrationId.value = null;
  searchQuery.value = '';
  router.replace({ query: {} });
}

// ─── Match data (via composable) ────────────────────────────────────────────

const { upcomingMatches, playedMatches, nextMatch } = usePlayerSchedule(
  () => tournamentId.value,
  () => selectedRegistration.value
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getOpponentName(match: Match, myRegistrationId: string): string {
  const opponentId =
    match.participant1Id === myRegistrationId ? match.participant2Id : match.participant1Id;
  return getParticipantName(opponentId);
}

function formatMatchTime(match: Match): string {
  const time = match.plannedStartAt;
  if (!time) return 'Time TBD';
  const formatted = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return match.scheduleStatus === 'draft' ? `${formatted} (Tentative)` : formatted;
}

function getMatchScore(match: Match, myRegistrationId: string): string {
  if (!match.scores?.length) return '';
  const iP1 = match.participant1Id === myRegistrationId;
  return match.scores
    .map((g) => {
      const mine = iP1 ? g.score1 : g.score2;
      const theirs = iP1 ? g.score2 : g.score1;
      return `${mine}-${theirs}`;
    })
    .join(', ');
}

function isWinner(match: Match, myRegistrationId: string): boolean {
  return match.winnerId === myRegistrationId;
}

function getCourtName(courtId: string | null | undefined): string {
  if (!courtId) return 'Court TBD';
  return tournamentStore.courts.find((c) => c.id === courtId)?.name ?? 'Court TBD';
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }
  tournamentStore.subscribeTournament(tournamentId.value);
  await registrationStore.fetchRegistrations(tournamentId.value);

  // Restore from URL params
  const qParam = route.query.q as string | undefined;
  if (qParam) searchQuery.value = qParam;

  const regParam = route.query.reg as string | undefined;
  if (regParam) selectedRegistrationId.value = regParam;
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <v-container fluid>
    <!-- Tournament Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div v-if="tournament" class="pa-6 rounded-lg bg-primary text-white mb-2">
          <div class="d-flex align-center gap-4">
            <v-icon size="40" color="white" class="opacity-80">mdi-account-clock</v-icon>
            <div>
              <h1 class="text-h4 font-weight-bold mb-1">{{ tournament.name }}</h1>
              <p class="text-subtitle-1 opacity-80">Player Schedule</p>
            </div>
          </div>
        </div>
        <v-skeleton-loader v-else-if="!notFound" type="heading" />
      </v-col>
    </v-row>

    <!-- Not found -->
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

    <template v-else-if="tournament">
      <!-- Search box -->
      <v-card class="mb-4 pa-4">
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          label="Search your name"
          placeholder="Type at least 2 characters…"
          variant="outlined"
          density="comfortable"
          clearable
          autofocus
          hide-details
        />
        <p v-if="searchQuery.length > 0 && searchQuery.length < 2" class="text-caption text-grey mt-2 pl-1">
          Type at least 2 characters to search
        </p>
      </v-card>

      <!-- No results -->
      <v-alert
        v-if="searchQuery.length >= 2 && searchResults.length === 0 && !selectedRegistrationId"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        No players found matching "{{ searchQuery }}". Check spelling or try a partial name.
      </v-alert>

      <!-- Disambiguation list -->
      <v-card
        v-else-if="searchResults.length > 1 && !selectedRegistrationId"
        class="mb-4"
      >
        <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
          Multiple players found — select yourself:
        </v-card-title>
        <v-list lines="two">
          <v-list-item
            v-for="result in searchResults"
            :key="result.registrationId"
            :title="result.displayName"
            :subtitle="result.categoryName"
            prepend-icon="mdi-account"
            @click="selectPlayer(result.registrationId)"
          >
            <template #append>
              <v-icon color="primary">mdi-chevron-right</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <!-- Player view -->
      <template v-if="selectedRegistrationId">
        <!-- Player header -->
        <div class="d-flex align-center flex-wrap gap-2 mb-4">
          <v-icon color="primary">mdi-account</v-icon>
          <span class="text-h6 font-weight-bold">{{ selectedPlayerName }}</span>
          <v-chip v-if="selectedCategoryName" size="small" variant="tonal" color="primary">
            {{ selectedCategoryName }}
          </v-chip>
          <v-spacer />
          <v-btn variant="text" size="small" prepend-icon="mdi-close" @click="clearPlayer">
            Change
          </v-btn>
        </div>

        <!-- Next match card -->
        <v-card
          v-if="nextMatch"
          class="mb-6"
          :color="nextMatch.status === 'in_progress' ? 'success' : undefined"
          :variant="nextMatch.status === 'in_progress' ? 'tonal' : 'elevated'"
          elevation="2"
        >
          <v-card-title class="d-flex align-center gap-2 pa-4 pb-2">
            <v-icon :color="nextMatch.status === 'in_progress' ? 'success' : 'primary'">
              {{ nextMatch.status === 'in_progress' ? 'mdi-play-circle' : 'mdi-arrow-right-circle' }}
            </v-icon>
            <span class="text-overline font-weight-bold">
              {{ nextMatch.status === 'in_progress' ? 'Now Playing' : 'Next Match' }}
            </span>
          </v-card-title>
          <v-card-text class="pa-4 pt-0">
            <div class="text-h5 font-weight-bold mb-3">
              vs. {{ getOpponentName(nextMatch, selectedRegistrationId!) }}
            </div>
            <div class="d-flex flex-wrap gap-4 text-body-2">
              <span class="d-flex align-center gap-1">
                <v-icon size="16">mdi-clock-outline</v-icon>
                {{ formatMatchTime(nextMatch) }}
              </span>
              <span class="d-flex align-center gap-1">
                <v-icon size="16">mdi-map-marker</v-icon>
                {{ getCourtName(nextMatch.courtId ?? nextMatch.plannedCourtId) }}
              </span>
              <span v-if="nextMatch.categoryName" class="d-flex align-center gap-1">
                <v-icon size="16">mdi-tag</v-icon>
                {{ nextMatch.categoryName }}
              </span>
            </div>
          </v-card-text>
        </v-card>

        <v-alert v-else-if="playedMatches.length > 0" type="success" variant="tonal" class="mb-6">
          All your matches are complete. Thanks for playing!
        </v-alert>

        <v-alert v-else type="info" variant="tonal" class="mb-6">
          No matches scheduled yet. Check back soon.
        </v-alert>

        <!-- Schedule list -->
        <v-card class="mb-6">
          <v-card-title class="pa-4 pb-2 text-overline font-weight-bold text-grey">
            Your Schedule
          </v-card-title>
          <v-divider />

          <!-- Upcoming matches -->
          <v-list v-if="upcomingMatches.length" lines="two">
            <v-list-item
              v-for="match in upcomingMatches"
              :key="match.id"
              :class="match.id === nextMatch?.id ? 'bg-primary-lighten-5' : ''"
            >
              <template #prepend>
                <v-icon :color="match.status === 'in_progress' ? 'success' : 'grey-lighten-1'">
                  {{ match.status === 'in_progress' ? 'mdi-play-circle' : 'mdi-circle-outline' }}
                </v-icon>
              </template>
              <v-list-item-title>vs. {{ getOpponentName(match, selectedRegistrationId!) }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatMatchTime(match) }}
                <template v-if="match.courtId || match.plannedCourtId">
                  &nbsp;·&nbsp;{{ getCourtName(match.courtId ?? match.plannedCourtId) }}
                </template>
              </v-list-item-subtitle>
              <template #append>
                <v-chip v-if="match.status === 'in_progress'" color="success" size="x-small" variant="tonal">
                  LIVE
                </v-chip>
                <v-chip v-else-if="match.status === 'ready'" color="warning" size="x-small" variant="tonal">
                  Ready
                </v-chip>
              </template>
            </v-list-item>
          </v-list>

          <v-divider v-if="upcomingMatches.length && playedMatches.length" />

          <!-- Played matches -->
          <v-list v-if="playedMatches.length" lines="two">
            <v-list-item
              v-for="match in [...playedMatches].reverse()"
              :key="match.id"
            >
              <template #prepend>
                <v-icon :color="isWinner(match, selectedRegistrationId!) ? 'success' : 'error'">
                  {{ isWinner(match, selectedRegistrationId!) ? 'mdi-check-circle' : 'mdi-close-circle' }}
                </v-icon>
              </template>
              <v-list-item-title>
                {{ isWinner(match, selectedRegistrationId!) ? 'Won' : 'Lost' }}
                vs. {{ getOpponentName(match, selectedRegistrationId!) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <template v-if="getMatchScore(match, selectedRegistrationId!)">
                  {{ getMatchScore(match, selectedRegistrationId!) }}&nbsp;·&nbsp;
                </template>
                {{ formatMatchTime(match) }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-card-text
            v-if="!upcomingMatches.length && !playedMatches.length"
            class="text-center text-grey py-6"
          >
            No matches scheduled yet.
          </v-card-text>
        </v-card>

        <!-- Bracket section -->
        <v-card v-if="selectedRegistration" class="mb-6">
          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title class="text-overline font-weight-bold text-grey">
                <v-icon class="mr-2" size="18">mdi-tournament</v-icon>
                Bracket — {{ selectedCategoryName }}
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pa-0">
                <BracketsManagerViewer
                  :tournament-id="tournamentId"
                  :category-id="selectedRegistration.categoryId"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card>

        <!-- Footer nav -->
        <v-divider class="mb-6" />
        <div class="d-flex justify-center mb-4">
          <v-btn
            :to="`/tournaments/${tournamentId}/schedule`"
            variant="outlined"
            prepend-icon="mdi-calendar-clock"
          >
            View Full Tournament Schedule
          </v-btn>
        </div>
      </template>

      <!-- Empty state (no search yet) -->
      <v-card v-if="!searchQuery && !selectedRegistrationId" flat class="text-center pa-12">
        <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-account-search</v-icon>
        <div class="text-h6 text-grey">Enter your name to see your schedule</div>
        <div class="text-body-2 text-grey mt-2">
          Type your first or last name in the search box above
        </div>
        <v-btn
          :to="`/tournaments/${tournamentId}/schedule`"
          variant="text"
          class="mt-4"
          prepend-icon="mdi-calendar-clock"
          color="grey"
        >
          View full tournament schedule instead
        </v-btn>
      </v-card>
    </template>
  </v-container>
</template>

<style scoped>
.opacity-80 {
  opacity: 0.8;
}
</style>
