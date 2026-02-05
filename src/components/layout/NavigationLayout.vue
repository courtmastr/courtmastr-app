<template>
  <v-app>
    <!-- Responsive navigation drawer -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="rail"
      permanent
      @click="rail = false"
    >
      <AppNavigation />
    </v-navigation-drawer>

    <!-- Main content area -->
    <v-main>
      <v-container fluid>
        <!-- Breadcrumb navigation -->
        <BreadcrumbNavigation v-if="showBreadcrumbs" />
        
        <!-- Contextual navigation based on tournament status -->
        <ContextualNavigation v-if="showContextualNav" />
        
        <!-- Global search component -->
        <GlobalSearch v-if="showSearch" />
        
        <!-- Page content slot -->
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AppNavigation from '@/components/navigation/AppNavigation.vue';
import BreadcrumbNavigation from '@/components/navigation/BreadcrumbNavigation.vue';
import ContextualNavigation from '@/components/navigation/ContextualNavigation.vue';
import GlobalSearch from '@/components/navigation/GlobalSearch.vue';
import { useRoute } from 'vue-router';

const drawer = ref(true);
const rail = ref(false);

const route = useRoute();

// Determine when to show different navigation elements
const showBreadcrumbs = computed(() => {
  // Show breadcrumbs on all pages except home/dashboard
  return !['/', '/tournaments'].includes(route.path);
});

const showContextualNav = computed(() => {
  // Show contextual navigation on tournament-specific pages
  return route.path.includes('/tournaments/') && 
         !route.path.includes('/tournaments/create');
});

const showSearch = computed(() => {
  // Show search on most pages except very specific ones
  return !route.path.includes('/scoring') || !route.path.includes('/public');
});
</script>