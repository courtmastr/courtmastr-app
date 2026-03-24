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
          <v-icon
            v-if="getBreadcrumbIcon(item)"
            size="16"
            class="mr-1"
          >
            {{ getBreadcrumbIcon(item) }}
          </v-icon>
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
import { NAVIGATION_ICONS } from '@/constants/navigationIcons';

interface BreadcrumbItem {
  title: string;
  to?: string;
  icon?: string;
}

const route = useRoute();
const tournamentStore = useTournamentStore();

const getBreadcrumbIcon = (item: unknown): string | undefined => {
  const breadcrumb = item as { icon?: string; raw?: BreadcrumbItem };
  return breadcrumb.raw?.icon ?? breadcrumb.icon;
};

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const pathArray = route.path.split('/').filter(x => x);
  const breadcrumbs: BreadcrumbItem[] = [{
    title: 'Home',
    to: '/',
    icon: 'mdi-home-outline',
  }];

  if (pathArray[0] === 'tournaments') {
    breadcrumbs.push({
      title: 'Tournaments',
      to: '/tournaments',
      icon: NAVIGATION_ICONS.tournaments,
    });

    // Handle /tournaments/create
    if (pathArray[1] === 'create') {
      breadcrumbs.push({
        title: 'Create Tournament',
        to: '/tournaments/create',
        icon: NAVIGATION_ICONS.createTournament,
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
        to: `/tournaments/${tournamentId}`,
        icon: NAVIGATION_ICONS.dashboard,
      });

      if (pathArray[2]) {
        if (pathArray[2] === 'match-control') {
          breadcrumbs.push({
            title: 'Match Control',
            to: `/tournaments/${tournamentId}/match-control`,
            icon: NAVIGATION_ICONS.matchControl,
          });
        } else if (pathArray[2] === 'checkin') {
          breadcrumbs.push({
            title: 'Check-in',
            to: `/tournaments/${tournamentId}/checkin`,
            icon: NAVIGATION_ICONS.checkIn,
          });
        } else if (pathArray[2] === 'live-view') {
          breadcrumbs.push({
            title: 'Live View',
            to: `/tournaments/${tournamentId}/live-view`,
            icon: NAVIGATION_ICONS.liveView,
          });
        } else if (pathArray[2] === 'brackets') {
          breadcrumbs.push({
            title: 'Brackets',
            to: `/tournaments/${tournamentId}/brackets`,
            icon: NAVIGATION_ICONS.brackets,
          });
        } else if (pathArray[2] === 'registrations') {
          breadcrumbs.push({
            title: 'Registrations',
            to: `/tournaments/${tournamentId}/registrations`,
            icon: NAVIGATION_ICONS.registrations,
          });
        } else if (pathArray[2] === 'participants') {
          breadcrumbs.push({
            title: 'Participants',
            to: `/tournaments/${tournamentId}/participants`,
            icon: NAVIGATION_ICONS.registrations,
          });
        } else if (pathArray[2] === 'courts') {
          breadcrumbs.push({
            title: 'Courts',
            to: `/tournaments/${tournamentId}/courts`,
            icon: NAVIGATION_ICONS.courts,
          });
        } else if (pathArray[2] === 'matches') {
          breadcrumbs.push({
            title: 'Matches',
            to: `/tournaments/${tournamentId}/matches`,
            icon: NAVIGATION_ICONS.scoreEntry,
          });
        } else if (pathArray[2] === 'settings') {
          breadcrumbs.push({
            title: 'Settings',
            to: `/tournaments/${tournamentId}/settings`,
            icon: NAVIGATION_ICONS.settings,
          });
        } else if (pathArray[2] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Leaderboard',
            to: `/tournaments/${tournamentId}/leaderboard`,
            icon: NAVIGATION_ICONS.leaderboard,
          });
        } else if (pathArray[2] === 'categories' && pathArray[4] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Category Leaderboard',
            to: `/tournaments/${tournamentId}/categories/${pathArray[3]}/leaderboard`,
            icon: NAVIGATION_ICONS.leaderboard,
          });
        } else if (pathArray[2] === 'categories' && pathArray[4] === 'smart-bracket') {
          const smartBracketCategoryId = pathArray[3];
          const smartBracketCategory = tournamentStore.categories.find((c) => c.id === smartBracketCategoryId);
          const isPoolPhase = smartBracketCategory?.format === 'pool_to_elimination'
            && smartBracketCategory?.poolPhase !== 'elimination';
          breadcrumbs.push({
            title: isPoolPhase ? 'Pool Play' : 'Bracket',
            to: `/tournaments/${tournamentId}/categories/${pathArray[3]}/smart-bracket`,
            icon: NAVIGATION_ICONS.smartBracket,
          });
        } else if (pathArray[2] === 'categories') {
          breadcrumbs.push({
            title: 'Categories',
            to: `/tournaments/${tournamentId}/categories`,
            icon: NAVIGATION_ICONS.categories,
          });
        } else if (pathArray[2] === 'scoring') {
          breadcrumbs.push({
            title: 'Score Matches',
            to: `/tournaments/${tournamentId}/matches`,
            icon: NAVIGATION_ICONS.scoreEntry,
          });
        } else if (pathArray[2] === 'overlays') {
          breadcrumbs.push({
            title: 'Overlay Links',
            to: `/tournaments/${tournamentId}/overlays`,
            icon: NAVIGATION_ICONS.overlayLinks,
          });
        } else if (pathArray[2] === 'audit') {
          breadcrumbs.push({
            title: 'Audit Trail',
            to: `/tournaments/${tournamentId}/audit`,
            icon: 'mdi-clipboard-text-search-outline',
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
