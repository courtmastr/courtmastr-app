<script setup lang="ts">
import { computed } from 'vue';
import BracketView from './BracketView.vue';
import DoubleEliminationBracket from './DoubleEliminationBracket.vue';
import type { Category } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
  category: Category;
}>();

const isDouble = computed(() => props.category.format === 'double_elimination');
</script>

<template>
  <DoubleEliminationBracket
    v-if="isDouble"
    :tournament-id="tournamentId"
    :category-id="categoryId"
  />
  <BracketView
    v-else
    :tournament-id="tournamentId"
    :category-id="categoryId"
  />
</template>
