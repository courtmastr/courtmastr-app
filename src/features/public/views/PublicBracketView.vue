<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import type { LevelDefinition } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const loading = computed(() => tournamentStore.loading);

const selectedCategory = ref<string | null>(null);
const categoryLevels = ref<Record<string, LevelDefinition[]>>({});
const selectedLevelId = ref<string | null>(null);
const notFound = ref(false);

const selectedCategoryLevels = computed(() =>
  selectedCategory.value ? categoryLevels.value[selectedCategory.value] || [] : []
);

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }
  tournamentStore.subscribeTournament(tournamentId.value);

  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }
});

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

<template>
  <v-container fluid>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div v-if="tournament" class="pa-6 rounded-lg bg-primary text-white mb-6">
          <div class="d-flex align-center gap-4">
            <v-icon size="40" color="white" class="opacity-80">mdi-tournament</v-icon>
            <div>
              <h1 class="text-h4 font-weight-bold mb-1">
                {{ tournament.name }}
              </h1>
              <p class="text-subtitle-1 text-primary-lighten-4 font-weight-medium">
                Live Tournament Bracket
              </p>
            </div>
          </div>
        </div>
        <v-skeleton-loader
          v-else-if="!notFound"
          type="heading"
        />
      </v-col>
    </v-row>

    <!-- Not Found -->
    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              Tournament not found
            </h2>
            <p class="text-body-2 text-grey mt-2">
              This tournament does not exist or has been removed.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-else>
      <!-- Category + Level Selection -->
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
            :loading="loading"
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

      <!-- Bracket -->
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
          Select a category to view the bracket
        </div>
      </v-card>
    </template>
  </v-container>
</template>
<style scoped>
.opacity-80 {
  opacity: 0.8;
}
</style>
