<template>
  <div class="breadcrumb-container pa-4">
    <v-breadcrumbs :items="breadcrumbItems" divider="/">
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
      // In a real implementation, we would fetch the tournament name
      breadcrumbs.push({
        title: 'Tournament Dashboard', // Would get actual tournament name
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
        } else if (pathArray[2] === 'courts') {
          breadcrumbs.push({
            title: 'Court Management',
            to: `/tournaments/${pathArray[1]}/courts`
          });
        } else if (pathArray[2] === 'scoring') {
          breadcrumbs.push({
            title: 'Scoring Dashboard',
            to: `/tournaments/${pathArray[1]}/scoring`
          });
        }
      }
    }
  } else if (pathArray[0] === 'profile') {
    breadcrumbs.push({
      title: 'Profile',
      to: '/profile'
    });
  } else if (pathArray[0] === 'settings') {
    breadcrumbs.push({
      title: 'Settings',
      to: '/settings'
    });
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