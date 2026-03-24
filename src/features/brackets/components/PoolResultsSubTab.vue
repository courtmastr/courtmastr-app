<script setup lang="ts">
import RoundRobinStandings from './RoundRobinStandings.vue';
import type { Match } from '@/types';

defineProps<{
  tournamentId: string;
  categoryId: string;
  matches: Match[];
}>();
</script>

<template>
  <RoundRobinStandings
    :tournament-id="tournamentId"
    :category-id="categoryId"
    :matches="matches"
  />
</template>
