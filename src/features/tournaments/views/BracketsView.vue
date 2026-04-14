<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import SmartBracketView from '@/features/brackets/components/SmartBracketView.vue';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import type { LevelDefinition } from '@/types';
import { logger } from '@/utils/logger';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const categories = computed(() => tournamentStore.categories);

const selectedCategory = ref<string | null>(null);
const categoryLevels = ref<Record<string, LevelDefinition[]>>({});
const selectedLevelId = ref<string | null>(null);

const selectedCategoryObj = computed(() =>
  categories.value.find((c) => c.id === selectedCategory.value)
);

const isPoolToElim = computed(
  () => selectedCategoryObj.value?.format === 'pool_to_elimination'
);

const isPoolPhase = computed(
  () => isPoolToElim.value && selectedCategoryObj.value?.poolPhase !== 'elimination'
);

// Default to pool-play tab during pool phase, bracket tab during elimination
const activeTab = ref<'pool-play' | 'bracket'>('pool-play');

watch(isPoolPhase, (nowPool) => {
  activeTab.value = nowPool ? 'pool-play' : 'bracket';
}, { immediate: true });

const selectedCategoryLevels = computed(() =>
  selectedCategory.value ? categoryLevels.value[selectedCategory.value] || [] : []
);

onMounted(async () => {
  try {
    if (!tournamentStore.currentTournament || tournamentStore.categories.length === 0) {
      await tournamentStore.fetchTournament(tournamentId.value);
    }
    tournamentStore.subscribeTournament(tournamentId.value);

    // Pre-select category from query param (e.g. after generating a bracket from Categories page)
    const queryCategoryId = route.query.category as string | undefined;
    if (queryCategoryId) {
      selectedCategory.value = queryCategoryId;
    }
  } catch (error) {
    logger.error('Failed to initialize brackets view:', error);
  }
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
});

watch(selectedCategory, async (categoryId) => {
  if (!categoryId) return;
  selectedLevelId.value = null;
  try {
    const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
    categoryLevels.value = { ...categoryLevels.value, [categoryId]: levels };
  } catch (error) {
    logger.error('Failed to fetch category levels:', error);
  }
});
</script>

<template>
  <v-container fluid>
    <!-- Selectors row -->
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
        />
      </v-col>
    </v-row>

    <!-- No category selected -->
    <v-card
      v-if="!selectedCategory"
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

    <!-- Pool-to-Elimination: 2 tabs -->
    <template v-else-if="isPoolToElim">
      <v-tabs
        v-model="activeTab"
        color="primary"
        class="mb-4"
      >
        <v-tab value="pool-play">
          <v-icon start>
            mdi-table-large
          </v-icon>
          Pool Play
        </v-tab>
        <v-tab value="bracket">
          <v-icon start>
            mdi-tournament
          </v-icon>
          Bracket
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <v-tabs-window-item value="pool-play">
          <SmartBracketView
            :tournament-id="tournamentId"
            :category-id="selectedCategory"
            :hide-selector="true"
          />
        </v-tabs-window-item>

        <v-tabs-window-item value="bracket">
          <BracketsManagerViewer
            :tournament-id="tournamentId"
            :category-id="selectedCategory"
            :level-id="selectedLevelId || undefined"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </template>

    <!-- Single / Double elimination or Round Robin: just the bracket viewer -->
    <BracketsManagerViewer
      v-else
      :tournament-id="tournamentId"
      :category-id="selectedCategory"
      :level-id="selectedLevelId || undefined"
    />
  </v-container>
</template>
