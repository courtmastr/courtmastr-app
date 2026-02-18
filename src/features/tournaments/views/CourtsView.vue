<template>
  <v-container fluid>
    <CourtManagement :tournament-id="tournamentId" />
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import CourtManagement from '../components/CourtManagement.vue';

const route = useRoute();
const tournamentId = computed(() => route.params.tournamentId as string);
</script>
