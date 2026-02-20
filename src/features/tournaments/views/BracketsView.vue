<template>
  <v-container fluid>
    <v-row class="mb-2">
      <v-col
        cols="12"
        sm="4"
      >
        <v-select
          v-model="selectedCategory"
          :items="categories"
          item-title="name"
          item-value="id"
          label="Select Category"
          hide-details
        />
      </v-col>
      <v-col
        v-if="selectedCategoryLevels.length > 0"
        cols="12"
        sm="4"
      >
        <v-select
          v-model="selectedLevelId"
          :items="selectedCategoryLevels"
          item-title="name"
          item-value="id"
          label="Select Level Bracket (Optional)"
          placeholder="Category bracket (default)"
          clearable
          hide-details
          hint="Choose a level bracket or clear to view the category-level bracket"
          persistent-hint
        />
      </v-col>
    </v-row>

    <BracketsManagerViewer
      v-if="selectedCategory"
      :tournament-id="tournamentId"
      :category-id="selectedCategory"
      :level-id="selectedLevelId || undefined"
    />

    <v-card
      v-else
      flat
      class="text-center pa-12"
    >
      <v-icon
        size="64"
        color="grey-lighten-2"
        class="mb-4"
      >
        mdi-tournament
      </v-icon>
      <div class="text-h6 text-grey">
        Select a category to view its bracket
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import type { LevelDefinition } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const categories = computed(() => tournamentStore.categories);

const selectedCategory = ref<string | null>(null);
const categoryLevels = ref<Record<string, LevelDefinition[]>>({});
const selectedLevelId = ref<string | null>(null);

const selectedCategoryLevels = computed(() =>
  selectedCategory.value ? categoryLevels.value[selectedCategory.value] || [] : []
);

watch(selectedCategory, async (categoryId) => {
  if (!categoryId) return;
  selectedLevelId.value = null;
  try {
    const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
    categoryLevels.value = { ...categoryLevels.value, [categoryId]: levels };
  } catch (error) {
    console.error('Failed to fetch category levels:', error);
  }
});
</script>
