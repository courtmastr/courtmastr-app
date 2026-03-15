<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { usePwaInstallPrompt } from '@/composables/usePwaInstallPrompt';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';
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
const { canInstall, installApp, dismiss } = usePwaInstallPrompt();
const showInstallPrompt = computed(() => canInstall.value);

const selectedCategoryLevels = computed(() =>
  selectedCategory.value ? categoryLevels.value[selectedCategory.value] || [] : []
);

const handleInstallApp = async (): Promise<void> => {
  try {
    await installApp();
  } catch (error) {
    console.error('Failed to trigger app install prompt:', error);
  }
};

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
  <TournamentPublicShell
    :tournament="tournament"
    eyebrow="Bracket View"
    page-title="Live Tournament Bracket"
    page-subtitle="Scrollable, branded bracket viewing with category and level switching."
    fallback-icon="mdi-tournament"
  >
    <v-skeleton-loader
      v-if="!tournament && !notFound"
      type="heading"
    />

    <v-row v-else-if="notFound">
      <v-col cols="12">
        <v-card class="bracket-surface-card">
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
      <v-card
        v-if="showInstallPrompt"
        class="bracket-surface-card bracket-install-card mb-4"
        elevation="0"
      >
        <v-card-text class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div>
            <p class="bracket-install-card__eyebrow mb-1">
              Install CourtMastr
            </p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Save the public bracket to the home screen for faster re-entry between rounds.
            </p>
          </div>
          <div class="d-flex align-center ga-2">
            <v-btn
              size="small"
              color="primary"
              prepend-icon="mdi-cellphone-arrow-down"
              @click="handleInstallApp"
            >
              Install
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              @click="dismiss"
            >
              Later
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        class="bracket-surface-card mb-4"
        elevation="0"
      >
        <v-card-text class="pa-4 pa-sm-5">
          <div class="bracket-filters">
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
        </v-card-text>
      </v-card>

      <BracketsManagerViewer
        v-if="selectedCategory"
        :tournament-id="tournamentId"
        :category-id="selectedCategory"
        :level-id="selectedLevelId || undefined"
      />
      <v-card
        v-else
        class="bracket-surface-card text-center pa-12"
        elevation="0"
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
  </TournamentPublicShell>
</template>
<style scoped>
.opacity-80 {
  opacity: 0.8;
}

.bracket-surface-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 24px;
  background: rgba(var(--v-theme-surface), 0.92);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.06);
}

.bracket-install-card__eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-primary), 0.88);
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
