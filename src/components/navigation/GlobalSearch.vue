<template>
  <div class="global-search pa-4">
    <v-autocomplete
      v-model="selectedItem"
      :items="searchResults"
      item-title="title"
      item-value="path"
      placeholder="Search CourtMaster (v2)..."
      label="Search"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      hide-details
      auto-select-first
      :filter="() => true"
      :menu-props="{ maxHeight: 400 }"
      name="courtmaster-global-search"
      autocomplete="off"
      @update:modelValue="navigateToItem"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';

const router = useRouter();
const tournamentStore = useTournamentStore();

const selectedItem = ref<string | null>(null);
const searchTerm = ref('');

interface SearchResult {
  title: string;
  subtitle: string;
  path: string;
  icon: string;
}

const searchResults = computed((): SearchResult[] => {
  // Use a map to prevent duplicates, keyed by path
  const resultsMap = new Map<string, SearchResult>();
  const titlesSeen = new Set<string>();
  
  // Add tournament results
  if (tournamentStore.tournaments && Array.isArray(tournamentStore.tournaments)) {
    tournamentStore.tournaments.forEach(tournament => {
      // Basic validation
      if (!tournament || !tournament.name) return;
      
      if (tournament.name.toLowerCase().includes(searchTerm.value.toLowerCase())) {
        const path = `/tournaments/${tournament.id}/dashboard`;
        
        // Strict deduplication: If we already have this path OR this exact title, skip?
        // Actually, distinct tournaments might have same name. Path is the source of truth.
        
        resultsMap.set(path, {
          title: tournament.name,
          subtitle: `Tournament • ${tournament.status || 'Active'}`,
          path: path,
          icon: 'mdi-tournament',
        });
        titlesSeen.add(tournament.name);
      }
    });
  }

  // Add common navigation items
  const commonItems: SearchResult[] = [
    {
      title: 'Tournament Dashboard',
      subtitle: 'Manage your tournaments',
      path: '/tournaments',
      icon: 'mdi-view-dashboard',
    },
    {
      title: 'Create New Tournament',
      subtitle: 'Start a new tournament',
      path: '/tournaments/create',
      icon: 'mdi-plus-circle',
    },
    {
      title: 'Match Control',
      subtitle: 'Live tournament operations',
      path: '/tournaments/active/match-control',
      icon: 'mdi-controller',
    },
    {
      title: 'Tournament Brackets',
      subtitle: 'View tournament brackets',
      path: '/tournaments/brackets',
      icon: 'mdi-brackets',
    },
    {
      title: 'Court Management',
      subtitle: 'Manage tournament courts',
      path: '/tournaments/courts',
      icon: 'mdi-stadium',
    },
    {
      title: 'Scoring Dashboard',
      subtitle: 'Manage match scoring',
      path: '/scoring',
      icon: 'mdi-scoreboard',
    }
  ];

  // Merge common items
  commonItems.forEach(item => {
    // Only add if it matches search
    if (
      item.title.toLowerCase().includes(searchTerm.value.toLowerCase()) || 
      item.subtitle.toLowerCase().includes(searchTerm.value.toLowerCase())
    ) {
      // Check if path already exists to avoid duplicates
      if (!resultsMap.has(item.path)) {
        resultsMap.set(item.path, item);
      }
    }
  });
  
  const finalResults = Array.from(resultsMap.values());
  console.log('GlobalSearch: Debugging Duplicates', {
    searchTerm: searchTerm.value,
    tournamentsCount: tournamentStore.tournaments.length,
    mapSze: resultsMap.size,
    finalResultsLength: finalResults.length,
    finalResults: finalResults
  });

  return finalResults;
});

function navigateToItem(path: string | null) {
  if (path) {
    router.push(path);
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