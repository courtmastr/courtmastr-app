<script setup lang="ts">
import { computed } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import BracketView from './BracketView.vue';
import DoubleEliminationBracket from './DoubleEliminationBracket.vue';
import RoundRobinStandings from './RoundRobinStandings.vue';
import { FORMAT_LABELS } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const tournamentStore = useTournamentStore();

const category = computed(() =>
  tournamentStore.categories.find((c) => c.id === props.categoryId)
);

const format = computed(() => category.value?.format || 'single_elimination');
</script>

<template>
  <div class="smart-bracket-view">
    <!-- Category Info Header -->
    <v-card v-if="category" class="mb-4" variant="flat" color="surface-variant">
      <v-card-text class="d-flex align-center py-2">
        <v-icon class="mr-2">mdi-tournament</v-icon>
        <span class="text-h6">{{ category.name }}</span>
        <v-chip size="small" variant="tonal" color="primary" class="ml-3">
          {{ FORMAT_LABELS[category.format] || category.format }}
        </v-chip>
        <v-chip
          v-if="category.minGamesGuaranteed"
          size="small"
          variant="tonal"
          color="info"
          class="ml-2"
        >
          Min {{ category.minGamesGuaranteed }} games guaranteed
        </v-chip>
      </v-card-text>
    </v-card>

    <!-- Round Robin View -->
    <RoundRobinStandings
      v-if="format === 'round_robin'"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />

    <!-- Double Elimination View -->
    <DoubleEliminationBracket
      v-else-if="format === 'double_elimination'"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />

    <!-- Single Elimination View (default) -->
    <BracketView
      v-else
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />
  </div>
</template>
