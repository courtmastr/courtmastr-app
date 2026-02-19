<template>
  <div class="breadcrumb-container pa-4">
    <v-breadcrumbs
      :items="breadcrumbItems"
      divider="/"
    >
      <template #item="{ item }">
        <v-breadcrumbs-item
          :to="item === breadcrumbItems[breadcrumbItems.length - 1] ? undefined : item.to"
          :disabled="item === breadcrumbItems[breadcrumbItems.length - 1]"
          exact
        >
          {{ item.title }}
        </v-breadcrumbs-item>
      </template>
    </v-breadcrumbs>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';

interface BreadcrumbItem {
  title: string;
  to?: string;
}

const route = useRoute();
const tournamentStore = useTournamentStore();

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const pathArray = route.path.split('/').filter(x => x);
  const breadcrumbs: BreadcrumbItem[] = [{
    title: 'Home',
    to: '/'
  }];

  if (pathArray[0] === 'tournaments') {
    breadcrumbs.push({
      title: 'Tournaments',
      to: '/tournaments'
    });

    // Handle /tournaments/create
    if (pathArray[1] === 'create') {
      breadcrumbs.push({
        title: 'Create Tournament',
        to: '/tournaments/create'
      });
      return breadcrumbs;
    }

    if (pathArray[1]) {
      const tournamentId = pathArray[1];
      const tournamentName = tournamentStore.currentTournament?.id === tournamentId 
        ? tournamentStore.currentTournament.name 
        : 'Tournament';
      
      breadcrumbs.push({
        title: tournamentName,
        to: `/tournaments/${tournamentId}`
      });

      if (pathArray[2]) {
        if (pathArray[2] === 'match-control') {
          breadcrumbs.push({
            title: 'Match Control',
            to: `/tournaments/${tournamentId}/match-control`
          });
        } else if (pathArray[2] === 'brackets') {
          breadcrumbs.push({
            title: 'Brackets',
            to: `/tournaments/${tournamentId}/brackets`
          });
        } else if (pathArray[2] === 'registrations') {
          breadcrumbs.push({
            title: 'Registrations',
            to: `/tournaments/${tournamentId}/registrations`
          });
        } else if (pathArray[2] === 'participants') {
          breadcrumbs.push({
            title: 'Participants',
            to: `/tournaments/${tournamentId}/participants`
          });
        } else if (pathArray[2] === 'courts') {
          breadcrumbs.push({
            title: 'Court Management',
            to: `/tournaments/${tournamentId}/courts`
          });
        } else if (pathArray[2] === 'matches') {
          breadcrumbs.push({
            title: 'Matches',
            to: `/tournaments/${tournamentId}/matches`
          });
        } else if (pathArray[2] === 'settings') {
          breadcrumbs.push({
            title: 'Settings',
            to: `/tournaments/${tournamentId}/settings`
          });
        } else if (pathArray[2] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Leaderboard',
            to: `/tournaments/${tournamentId}/leaderboard`
          });
        } else if (pathArray[2] === 'categories' && pathArray[4] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Category Leaderboard',
            to: `/tournaments/${tournamentId}/categories/${pathArray[3]}/leaderboard`
          });
        } else if (pathArray[2] === 'scoring') {
          breadcrumbs.push({
            title: 'Score Matches',
            to: `/tournaments/${tournamentId}/matches`
          });
        } else if (pathArray[2] === 'audit') {
          breadcrumbs.push({
            title: 'Audit Trail',
            to: `/tournaments/${tournamentId}/audit`
          });
        }
      }
    }
  }

  return breadcrumbs;
});
</script>

<style scoped>
.breadcrumb-container {
  padding: 16px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  margin-bottom: 16px;
}
</style>
