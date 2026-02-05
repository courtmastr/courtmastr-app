<template>
  <v-list nav>
    <!-- Common items for all users -->
    <v-list-item
      to="/tournaments"
      prepend-icon="mdi-tournament"
      title="Tournaments"
    />

    <!-- Admin-only items -->
    <template v-if="isAdmin">
      <v-list-item
        to="/tournaments/create"
        prepend-icon="mdi-plus-circle"
        title="Create Tournament"
      />
      
      <v-list-item
        to="/admin/settings"
        prepend-icon="mdi-cog"
        title="System Settings"
      />
    </template>

    <!-- Organizer items -->
    <template v-if="isAdmin || isOrganizer">
      <v-list-item
        to="/tournaments/manage"
        prepend-icon="mdi-view-dashboard"
        title="Tournament Management"
      />
    </template>

    <!-- Scorekeeper items -->
    <template v-if="isAdmin || isOrganizer || isScorekeeper">
      <v-list-item
        to="/scoring"
        prepend-icon="mdi-scoreboard"
        title="Scoring Dashboard"
      />
    </template>

    <!-- Player-specific items -->
    <template v-if="isPlayer">
      <v-list-item
        to="/my-registrations"
        prepend-icon="mdi-account-card-details"
        title="My Registrations"
      />
    </template>
  </v-list>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const isAdmin = computed(() => authStore.userRole === 'admin');
const isOrganizer = computed(() => authStore.userRole === 'organizer');
const isScorekeeper = computed(() => authStore.userRole === 'scorekeeper');
const isPlayer = computed(() => authStore.userRole === 'player');
</script>