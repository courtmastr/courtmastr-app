<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import TournamentSponsorStrip from '@/components/common/TournamentSponsorStrip.vue';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import type { LevelDefinition } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const loading = computed(() => tournamentStore.loading);
const { normalizedSponsors, tournamentLogoUrl } = useTournamentBranding(tournament);

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
        <div
          v-if="tournament"
          class="public-bracket-header pa-6 rounded-lg bg-primary text-white mb-6"
        >
          <div class="d-flex align-center gap-4">
            <TournamentBrandMark
              :tournament-name="tournament.name"
              :logo-url="tournamentLogoUrl"
              :fallback-icon="'mdi-tournament'"
              :width="88"
              :height="88"
            />
            <div class="public-bracket-header__copy">
              <h1 class="text-h4 font-weight-bold mb-1">
                {{ tournament.name }}
              </h1>
              <p class="text-subtitle-1 text-primary-lighten-4 font-weight-medium">
                Live Tournament Bracket
              </p>
            </div>
          </div>
          <TournamentSponsorStrip
            v-if="normalizedSponsors.length > 0"
            :sponsors="normalizedSponsors"
            class="mt-4"
            dense
          />
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
      <div class="bracket-filters mb-4">
        <div class="bracket-filters__label">
          Category
        </div>
        <div class="bracket-filters__controls">
          <v-select
            v-model="selectedCategory"
            :items="categories"
            item-title="name"
            item-value="id"
            label="Select Category"
            :loading="loading"
            variant="outlined"
            density="comfortable"
            hide-details
            style="max-width: 280px"
          />
          <v-select
            v-if="selectedCategoryLevels.length > 0"
            v-model="selectedLevelId"
            :items="selectedCategoryLevels"
            item-title="name"
            item-value="id"
            label="Level Bracket"
            placeholder="All levels"
            clearable
            variant="outlined"
            density="comfortable"
            hide-details
            style="max-width: 280px"
          />
        </div>
      </div>

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

.public-bracket-header__copy {
  min-width: 0;
}

/* Category filter bar */
.bracket-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.bracket-filters__label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--v-theme-on-surface), 0.45);
  white-space: nowrap;
}

.bracket-filters__controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Bracket viewer typography overrides */
:deep(.brackets-viewer) {
  font-family: inherit;
}

/* Participant names */
:deep(.brackets-viewer .participant) {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.92);
  letter-spacing: 0.01em;
}

/* Scores */
:deep(.brackets-viewer .score) {
  font-size: 1rem;
  font-weight: 800;
  color: rgb(var(--v-theme-on-surface));
}

/* Winner highlight */
:deep(.brackets-viewer .participant.win .name) {
  color: rgb(var(--v-theme-success));
  font-weight: 700;
}

/* Round labels */
:deep(.brackets-viewer .round-name),
:deep(.brackets-viewer .round-label) {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

/* Match containers */
:deep(.brackets-viewer .match) {
  border-radius: 6px;
}
</style>
