<template>
  <div class="global-search pa-4">
    <v-autocomplete
      v-model="selectedItem"
      :items="searchResults"
      item-title="title"
      item-value="path"
      placeholder="Search CourtMaster..."
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      hide-details
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
  const results: SearchResult[] = [];
  
  // Add tournament results
  tournamentStore.tournaments.forEach(tournament => {
    if (tournament.name.toLowerCase().includes(searchTerm.value.toLowerCase())) {
      results.push({
        title: tournament.name,
        subtitle: `Tournament • ${tournament.status}`,
        path: `/tournaments/${tournament.id}/dashboard`,
        icon: 'mdi-tournament',
      });
    }
  });

  // Add common navigation items
  results.push(
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
  );

  return results;
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