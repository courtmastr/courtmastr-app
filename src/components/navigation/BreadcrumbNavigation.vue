<template>
  <div class="breadcrumb-container pa-4">
    <v-breadcrumbs
      :items="breadcrumbItems"
      divider="/"
    >
      <template #item="{ item }">
        <v-breadcrumbs-item
          :to="item.to"
          :disabled="!item.to"
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

interface BreadcrumbItem {
  title: string;
  to?: string;
}

const route = useRoute();

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

    if (pathArray[1]) {
      breadcrumbs.push({
        title: 'Tournament',
        to: `/tournaments/${pathArray[1]}`
      });

      if (pathArray[2]) {
        if (pathArray[2] === 'match-control') {
          breadcrumbs.push({
            title: 'Match Control',
            to: `/tournaments/${pathArray[1]}/match-control`
          });
        } else if (pathArray[2] === 'brackets') {
          breadcrumbs.push({
            title: 'Brackets',
            to: `/tournaments/${pathArray[1]}/brackets`
          });
        } else if (pathArray[2] === 'registrations') {
          breadcrumbs.push({
            title: 'Registrations',
            to: `/tournaments/${pathArray[1]}/registrations`
          });
        } else if (pathArray[2] === 'participants') {
          breadcrumbs.push({
            title: 'Participants',
            to: `/tournaments/${pathArray[1]}/participants`
          });
        } else if (pathArray[2] === 'courts') {
          breadcrumbs.push({
            title: 'Court Management',
            to: `/tournaments/${pathArray[1]}/courts`
          });
        } else if (pathArray[2] === 'matches') {
          breadcrumbs.push({
            title: 'Matches',
            to: `/tournaments/${pathArray[1]}/matches`
          });
        } else if (pathArray[2] === 'settings') {
          breadcrumbs.push({
            title: 'Settings',
            to: `/tournaments/${pathArray[1]}/settings`
          });
        } else if (pathArray[2] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Leaderboard',
            to: `/tournaments/${pathArray[1]}/leaderboard`
          });
        } else if (pathArray[2] === 'categories' && pathArray[4] === 'leaderboard') {
          breadcrumbs.push({
            title: 'Category Leaderboard',
            to: `/tournaments/${pathArray[1]}/categories/${pathArray[3]}/leaderboard`
          });
        } else if (pathArray[2] === 'scoring') {
          breadcrumbs.push({
            title: 'Score Matches',
            to: `/tournaments/${pathArray[1]}/matches`
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
