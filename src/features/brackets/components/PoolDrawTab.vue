<script setup lang="ts">
import PoolDrawView from './PoolDrawView.vue';

defineProps<{
  tournamentId: string;
  categoryId: string;
}>();
</script>

<template>
  <PoolDrawView
    :tournament-id="tournamentId"
    :category-id="categoryId"
  />
</template>
