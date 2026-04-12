<template>
  <v-container fluid>
    <CourtManagement :tournament-id="tournamentId" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
import CourtManagement from '../components/CourtManagement.vue';
import { logger } from '@/utils/logger';

const route = useRoute();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const tournamentId = computed(() => route.params.tournamentId as string);

const loadCourtsContext = async (): Promise<void> => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch (error) {
    logger.error('Failed to load courts context:', error);
    notificationStore.showToast('error', 'Failed to load courts');
  }
};

onMounted(() => {
  void loadCourtsContext();
});

watch(
  tournamentId,
  (newTournamentId, oldTournamentId) => {
    if (newTournamentId === oldTournamentId) return;
    void loadCourtsContext();
  }
);
</script>
