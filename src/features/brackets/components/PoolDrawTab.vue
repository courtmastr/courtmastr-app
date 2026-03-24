<script setup lang="ts">
import type { Match } from '@/types';
import PoolDrawView from './PoolDrawView.vue';

defineProps<{
  tournamentId: string;
  categoryId: string;
  matches: Match[];
  poolStageId?: string | number | null;
}>();
</script>

<template>
  <PoolDrawView
    :tournament-id="tournamentId"
    :category-id="categoryId"
    :matches="matches"
    :pool-stage-id="poolStageId"
  />
</template>
