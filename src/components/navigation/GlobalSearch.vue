<template>
  <div class="global-search pa-4">
    <v-tooltip
      text="Global search: Find tournaments and navigate to pages"
      location="bottom"
    >
      <template #activator="{ props: tooltipProps }">
        <v-autocomplete
          v-bind="tooltipProps"
          v-model="selectedItem"
          v-model:search="searchTerm"
          :items="searchResults"
          item-title="title"
          item-value="path"
          placeholder="Search tournaments, pages..."
          label="Global Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          auto-select-first
          :filter="() => true"
          :menu-props="{ maxHeight: 400 }"
          name="courtmaster-global-search"
          autocomplete="off"
          @update:model-value="navigateToItem"
          @keyup.enter="performSearch"
        >
          <template #item="{ props, item }">
            <v-list-item v-bind="props">
              <template #prepend>
                <v-icon :icon="item.raw.icon" />
              </template>
              <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
            </v-list-item>
          </template>
        </v-autocomplete>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const tournamentStore = useTournamentStore();

const selectedItem = ref<string | null>(null);
const searchTerm = ref('');

interface SearchResult {
  title: string;
  subtitle: string;
  path: string;
  icon: string;
}

const currentTournamentId = computed(() => {
  const routeTournamentId = route.params.tournamentId as string | undefined;
  return routeTournamentId || tournamentStore.currentTournament?.id || null;
});

const searchResults = computed((): SearchResult[] => {
  const query = searchTerm.value.trim().toLowerCase();
  const resultsMap = new Map<string, SearchResult>();

  const addResult = (item: SearchResult): void => {
    if (resultsMap.has(item.path)) return;

    if (!query) {
      resultsMap.set(item.path, item);
      return;
    }

    const titleMatch = item.title.toLowerCase().includes(query);
    const subtitleMatch = item.subtitle.toLowerCase().includes(query);
    if (titleMatch || subtitleMatch) {
      resultsMap.set(item.path, item);
    }
  };

  if (Array.isArray(tournamentStore.tournaments)) {
    tournamentStore.tournaments.forEach((tournament) => {
      if (!tournament?.id || !tournament.name) return;
      addResult({
        title: tournament.name,
        subtitle: `Tournament • ${tournament.status}`,
        path: `/tournaments/${tournament.id}`,
        icon: 'mdi-tournament',
      });
    });
  }

  addResult({
    title: 'All Tournaments',
    subtitle: 'View and manage tournaments',
    path: '/tournaments',
    icon: 'mdi-view-dashboard',
  });

  if (authStore.isOrganizer) {
    addResult({
      title: 'Create Tournament',
      subtitle: 'Start a new tournament',
      path: '/tournaments/create',
      icon: 'mdi-plus-circle',
    });
  }

  if (currentTournamentId.value) {
    const tournamentId = currentTournamentId.value;

    addResult({
      title: 'Tournament Leaderboard',
      subtitle: 'View standings and tiebreakers',
      path: `/tournaments/${tournamentId}/leaderboard`,
      icon: 'mdi-podium-gold',
    });

    if (authStore.isOrganizer) {
      addResult({
        title: 'Match Control',
        subtitle: 'Queue, courts, and live operations',
        path: `/tournaments/${tournamentId}/match-control`,
        icon: 'mdi-controller',
      });

      addResult({
        title: 'Manage Registrations',
        subtitle: 'Approve and manage participants',
        path: `/tournaments/${tournamentId}/registrations`,
        icon: 'mdi-account-multiple',
      });
    }

    if (authStore.isScorekeeper) {
      addResult({
        title: 'Score Matches',
        subtitle: 'Open active and ready matches',
        path: `/tournaments/${tournamentId}/matches`,
        icon: 'mdi-scoreboard',
      });
    }
  }

  return Array.from(resultsMap.values()).slice(0, 25);
});

function navigateToItem(path: string | null) {
  if (path) {
    router.push(path);
    selectedItem.value = null;
    searchTerm.value = '';
  }
}

function performSearch() {
  if (searchResults.value.length > 0) {
    navigateToItem(searchResults.value[0].path);
  }
}
</script>

<style scoped>
.global-search {
  padding: 16px;
}
</style>
