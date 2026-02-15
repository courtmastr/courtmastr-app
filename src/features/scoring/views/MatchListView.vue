<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

const route = useRoute();
const router = useRouter();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

// Search and filter state
const searchQuery = ref('');
const selectedRound = ref<number | null>(null);
const selectedCategory = ref<string | null>(null);

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const readyMatches = computed(() => matchStore.readyMatches);
const inProgressMatches = computed(() => matchStore.inProgressMatches);
const scheduledMatches = computed(() => matchStore.scheduledMatches);
const completedMatches = computed(() => matchStore.completedMatches);
const courts = computed(() => tournamentStore.courts);

onMounted(async () => {
  if (!tournament.value) {
    await tournamentStore.fetchTournament(tournamentId.value);
  }
  // Subscribe to tournament data (includes categories via real-time listeners)
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

function goToScoring(matchId: string, categoryId?: string) {
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${matchId}/score`,
    query: categoryId ? { category: categoryId } : undefined
  });
}

// Get unique rounds from all matches
const availableRounds = computed(() => {
  const rounds = new Set<number>();
  matchStore.matches.forEach((m) => rounds.add(m.round));
  return Array.from(rounds).sort((a, b) => a - b);
});

// Get unique categories
const availableCategories = computed(() => {
  return tournamentStore.categories;
});

// Filter function
function matchFilter(match: any): boolean {
  // Search by match ID
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    const matchIdMatch = match.id.toLowerCase().includes(query);
    const matchNumberMatch = match.matchNumber.toString().includes(query);
    if (!matchIdMatch && !matchNumberMatch) return false;
  }

  // Filter by round
  if (selectedRound.value !== null && match.round !== selectedRound.value) {
    return false;
  }

  // Filter by category
  if (selectedCategory.value && match.categoryId !== selectedCategory.value) {
    return false;
  }

  return true;
}

// Filtered match lists
const filteredCompletedMatches = computed(() => {
  return completedMatches.value.filter(matchFilter);
});

// Clear all filters
function clearFilters() {
  searchQuery.value = '';
  selectedRound.value = null;
  selectedCategory.value = null;
}
</script>

<template>
  <v-container>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.back()" />
      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">Matches</h1>
        <p class="text-body-2 text-grey">{{ tournament?.name }}</p>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="searchQuery"
              label="Search by Match ID or Number"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="compact"
              placeholder="e.g., abc123 or 42"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedRound"
              :items="availableRounds"
              label="Filter by Round"
              clearable
              hide-details
              density="compact"
              placeholder="All Rounds"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedCategory"
              :items="availableCategories"
              item-title="name"
              item-value="id"
              label="Filter by Category"
              clearable
              hide-details
              density="compact"
              placeholder="All Categories"
            />
          </v-col>
          <v-col cols="12" md="2" class="text-right">
            <v-btn
              v-if="searchQuery || selectedRound !== null || selectedCategory"
              variant="text"
              size="small"
              @click="clearFilters"
            >
              Clear Filters
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- In Progress Matches -->
    <v-card class="mb-4" v-if="inProgressMatches.length > 0">
      <v-card-title>
        <v-icon start color="success">mdi-play-circle</v-icon>
        In Progress
        <v-chip size="small" color="success" class="ml-2">{{ inProgressMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in inProgressMatches"
          :key="match.id"
          @click="goToScoring(match.id, match.categoryId)"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="success" size="40">
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
            <span v-if="match.scores.length > 0" class="ml-2">
              Score: {{ match.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-btn color="success" variant="tonal" size="small">
              Score
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Ready Matches -->
    <v-card class="mb-4" v-if="readyMatches.length > 0">
      <v-card-title>
        <v-icon start color="warning">mdi-clock-outline</v-icon>
        Ready to Play
        <v-chip size="small" color="warning" class="ml-2">{{ readyMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in readyMatches"
          :key="match.id"
          @click="goToScoring(match.id, match.categoryId)"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="warning" size="40">
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
            <v-btn color="warning" variant="tonal" size="small">
              Start
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Scheduled Matches -->
    <v-card class="mb-4" v-if="scheduledMatches.length > 0">
      <v-card-title>
        <v-icon start color="info">mdi-calendar-clock</v-icon>
        Scheduled
        <v-chip size="small" color="info" class="ml-2">{{ scheduledMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in scheduledMatches"
          :key="match.id"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="info" size="40">
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
            <span v-if="match.scheduledTime" class="ml-2">
               | {{ new Date(match.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
            </span>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Completed Matches -->
    <v-card class="mb-4" v-if="completedMatches.length > 0">
      <v-card-title>
        <v-icon start color="grey">mdi-check-circle</v-icon>
        Completed
        <v-chip size="small" color="grey" class="ml-2">{{ filteredCompletedMatches.length }}</v-chip>
        <span v-if="filteredCompletedMatches.length !== completedMatches.length" class="text-caption text-grey ml-2">
          (filtered from {{ completedMatches.length }})
        </span>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in filteredCompletedMatches"
          :key="match.id"
          @click="goToScoring(match.id, match.categoryId)"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="grey" size="48">
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
              <v-chip size="x-small" color="primary" variant="tonal">
                ID: {{ truncateId(match.id) }}
              </v-chip>
              <v-chip size="x-small" color="info" variant="tonal">
                {{ getCategoryName(match.categoryId) }}
              </v-chip>
              <v-chip size="x-small" color="secondary" variant="tonal">
                Round {{ match.round }}
              </v-chip>
            </div>
            <div class="mt-1 d-flex align-center">
              <span class="text-success font-weight-medium">
                Winner: {{ match.winnerId === match.participant1Id ? getParticipantName(match.participant1Id) : getParticipantName(match.participant2Id) }}
              </span>
              <span v-if="match.scores.length > 0" class="ml-3 text-grey">
                Score: {{ match.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
              </span>
            </div>
          </v-list-item-subtitle>

          <template #append>
            <v-btn color="warning" variant="tonal" size="small" prepend-icon="mdi-pencil">
              Correct
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- No Filtered Results -->
    <v-card v-if="completedMatches.length > 0 && filteredCompletedMatches.length === 0" class="text-center py-8">
      <v-icon size="48" color="grey-lighten-1">mdi-filter-off</v-icon>
      <h3 class="text-h6 mt-4">No matches match your filters</h3>
      <p class="text-body-2 text-grey mt-2">
        Try adjusting your search or filters to find completed matches.
      </p>
      <v-btn color="primary" class="mt-4" @click="clearFilters">
        Clear Filters
      </v-btn>
    </v-card>

    <!-- Empty State -->
    <v-card v-if="inProgressMatches.length === 0 && readyMatches.length === 0 && scheduledMatches.length === 0 && completedMatches.length === 0" class="text-center py-12">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <h3 class="text-h6 mt-4">No matches available</h3>
      <p class="text-body-2 text-grey mt-2">
        There are no matches ready to be scored at this time.
      </p>
    </v-card>
  </v-container>
</template>

<style scoped>
.match-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.match-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
