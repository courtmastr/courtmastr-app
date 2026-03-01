<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useLeaderboard } from '@/composables/useLeaderboard';
import type { LeaderboardOptions, LeaderboardPhaseScope } from '@/types/leaderboard';
import { RANKING_PRESETS } from '@/features/leaderboard/rankingPresets';
import LeaderboardSummary from '@/components/leaderboard/LeaderboardSummary.vue';
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters.vue';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable.vue';
import LeaderboardExplainer from '@/components/leaderboard/LeaderboardExplainer.vue';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const categoryId = computed(() => route.params.categoryId as string | undefined);

const isTournamentWide = computed(() => !categoryId.value);
const showBwfDialog = ref(false);
const selectedPhaseScope = ref<LeaderboardPhaseScope>('tournament');

const { leaderboard, stage, error, generate, exportData } = useLeaderboard();

// Local filter state (applied client-side after generation)
const activeFilters = ref<LeaderboardOptions & { search?: string }>({});

const filteredEntries = computed(() => {
  if (!leaderboard.value) return [];
  let entries = leaderboard.value.entries;

  const { search, includeEliminated, minimumMatches, categoryIds } = activeFilters.value;

  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter((e) => e.participantName.toLowerCase().includes(q));
  }
  if (includeEliminated === false) {
    entries = entries.filter((e) => !e.eliminated);
  }
  if (minimumMatches) {
    entries = entries.filter((e) => e.matchesPlayed >= minimumMatches);
  }
  if (categoryIds?.length) {
    entries = entries.filter((e) => categoryIds.includes(e.categoryId));
  }

  return entries;
});

const categoryOptions = computed(() =>
  leaderboard.value?.categories?.map((c) => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
  })) ?? []
);

const activeCategory = computed(() => {
  if (!categoryId.value) return null;
  return tournamentStore.categories.find((category) => category.id === categoryId.value) ?? null;
});

const supportsPoolScope = computed(() =>
  !isTournamentWide.value && activeCategory.value?.format === 'pool_to_elimination'
);

const isLoading = computed(() =>
  stage.value === 'fetching' || stage.value === 'calculating' || stage.value === 'sorting'
);

const activePresetLabel = computed(() => {
  if (!leaderboard.value) return null;
  return RANKING_PRESETS[leaderboard.value.rankingPreset]?.label ?? leaderboard.value.rankingPreset;
});

const activeProgressionLabel = computed(() => {
  if (!leaderboard.value) return null;
  return leaderboard.value.progressionMode === 'phase_reset'
    ? 'Phase Reset'
    : 'Carry Forward';
});

function onFiltersUpdate(filters: LeaderboardOptions & { search?: string }) {
  activeFilters.value = filters;
}

async function onRefresh() {
  await runGeneration();
}

async function onExport(format: 'csv' | 'json') {
  await exportData(format);
}

async function runGeneration(): Promise<void> {
  if (isTournamentWide.value) {
    await generate(tournamentId.value, undefined, { phaseScope: 'tournament' });
    return;
  }

  await generate(tournamentId.value, categoryId.value ?? undefined, {
    phaseScope: selectedPhaseScope.value,
  });
}

async function switchPhaseScope(scope: 'pool' | 'category'): Promise<void> {
  if (!supportsPoolScope.value || selectedPhaseScope.value === scope) return;
  selectedPhaseScope.value = scope;
  await runGeneration();
}

watch(
  [isTournamentWide, supportsPoolScope],
  ([tournamentWide, poolSupported]) => {
    if (tournamentWide) {
      selectedPhaseScope.value = 'tournament';
      return;
    }

    if (poolSupported) {
      selectedPhaseScope.value = selectedPhaseScope.value === 'tournament'
        ? 'pool'
        : selectedPhaseScope.value;
      return;
    }

    selectedPhaseScope.value = 'category';
  },
  { immediate: true }
);

onMounted(() => {
  runGeneration();
});
</script>

<template>
  <v-container>
    <!-- Header -->
    <div class="d-flex align-center mb-4 flex-wrap gap-2">
      <v-btn
        variant="text"
        icon="mdi-arrow-left"
        size="small"
        @click="router.back()"
      />
      <div>
        <h1 class="text-h5 font-weight-bold">
          {{ isTournamentWide ? 'Tournament Leaderboard' : 'Category Leaderboard' }}
        </h1>
        <div
          v-if="leaderboard"
          class="text-caption text-medium-emphasis"
        >
          Generated {{ leaderboard.generatedAt.toLocaleTimeString() }}
        </div>
      </div>

      <v-spacer />

      <!-- BWF Info button -->
      <v-btn
        variant="text"
        icon="mdi-information-outline"
        size="small"
        @click="showBwfDialog = true"
      />

      <!-- Export menu -->
      <v-menu v-if="leaderboard">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="outlined"
            prepend-icon="mdi-download"
            size="small"
            :disabled="isLoading"
          >
            Export
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            prepend-icon="mdi-file-delimited"
            title="CSV"
            @click="onExport('csv')"
          />
          <v-list-item
            prepend-icon="mdi-code-json"
            title="JSON"
            @click="onExport('json')"
          />
        </v-list>
      </v-menu>

      <!-- Refresh button -->
      <v-btn
        variant="tonal"
        :loading="isLoading"
        prepend-icon="mdi-refresh"
        size="small"
        @click="onRefresh"
      >
        Refresh
      </v-btn>
    </div>

    <div
      v-if="supportsPoolScope"
      class="d-flex align-center mb-3"
    >
      <span class="text-caption text-medium-emphasis mr-2">Scope:</span>
      <v-btn
        size="small"
        :variant="selectedPhaseScope === 'pool' ? 'elevated' : 'text'"
        @click="switchPhaseScope('pool')"
      >
        Pool
      </v-btn>
      <v-btn
        size="small"
        :variant="selectedPhaseScope === 'category' ? 'elevated' : 'text'"
        @click="switchPhaseScope('category')"
      >
        Category
      </v-btn>
    </div>

    <div
      v-if="leaderboard"
      class="d-flex align-center mb-3 flex-wrap"
    >
      <v-chip
        size="small"
        color="primary"
        variant="tonal"
        class="mr-2 mb-1"
      >
        Preset: {{ activePresetLabel }}
      </v-chip>
      <v-chip
        size="small"
        color="secondary"
        variant="tonal"
        class="mb-1"
      >
        Progression: {{ activeProgressionLabel }}
      </v-chip>
    </div>

    <!-- Summary cards -->
    <LeaderboardSummary
      v-if="leaderboard && stage === 'done'"
      :leaderboard="leaderboard"
    />

    <!-- Filters -->
    <LeaderboardFilters
      :categories="categoryOptions"
      :tournament-wide="isTournamentWide"
      @update:filters="onFiltersUpdate"
    />

    <!-- Loading skeleton -->
    <v-skeleton-loader
      v-if="isLoading"
      type="table-row@8"
      class="rounded-lg"
    />

    <!-- Error -->
    <v-alert
      v-else-if="stage === 'error'"
      type="error"
      variant="tonal"
      :text="error ?? 'Failed to generate leaderboard'"
      class="mb-4"
    />

    <!-- Table -->
    <template v-else-if="stage === 'done'">
      <LeaderboardExplainer />
      <LeaderboardTable
        :entries="filteredEntries"
        :loading="false"
        :tiebreaker-resolutions="leaderboard?.tiebreakerResolutions ?? []"
        :show-category="isTournamentWide"
      />

      <!-- Empty state after filters -->
      <v-alert
        v-if="filteredEntries.length === 0 && leaderboard?.entries.length"
        type="info"
        variant="tonal"
        text="No participants match the current filters."
        class="mt-4"
      />

      <!-- Truly empty (no matches completed) -->
      <v-alert
        v-else-if="filteredEntries.length === 0"
        type="info"
        variant="tonal"
        class="mt-4"
      >
        <template #text>
          No completed matches yet. The leaderboard will populate as matches are played.
        </template>
      </v-alert>
    </template>

    <!-- Tiebreaker legend -->
    <v-expand-transition>
      <div
        v-if="stage === 'done' && leaderboard?.tiebreakerResolutions.length"
        class="mt-4"
      >
        <v-expansion-panels
          variant="accordion"
          elevation="0"
        >
          <v-expansion-panel>
            <v-expansion-panel-title class="text-caption">
              <v-icon
                icon="mdi-scale-balance"
                size="16"
                class="mr-2"
              />
              Tiebreaker resolutions ({{ leaderboard!.tiebreakerResolutions.length }})
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Method</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in leaderboard!.tiebreakerResolutions"
                    :key="r.tiedRank + r.step"
                  >
                    <td>#{{ r.tiedRank }}</td>
                    <td>{{ r.step.replace(/_/g, ' ') }}</td>
                    <td class="text-caption">
                      {{ r.description }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </v-expand-transition>

    <!-- BWF Tiebreaker Info Dialog -->
    <v-dialog
      v-model="showBwfDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title class="text-h6 pa-4 d-flex align-center">
          <v-icon
            icon="mdi-scale-balance"
            class="mr-2"
          />
          BWF Tiebreaker Rules
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="showBwfDialog = false"
          />
        </v-card-title>
        <v-card-text class="pa-4">
          <p class="text-body-2 mb-4">
            Rankings are determined using <strong>BWF Article 16.2</strong> tiebreaker procedures:
          </p>
          
          <v-list
            density="compact"
            class="bg-surface-light rounded mb-4"
          >
            <v-list-item>
              <template #prepend>
                <v-avatar
                  size="24"
                  color="primary"
                  class="text-caption"
                >
                  1
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                Match Points
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                2 points for a win, 1 point for a loss
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item>
              <template #prepend>
                <v-avatar
                  size="24"
                  color="primary"
                  class="text-caption"
                >
                  2
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                Head-to-Head
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                For 2-way ties: winner of direct match ranks higher
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item>
              <template #prepend>
                <v-avatar
                  size="24"
                  color="primary"
                  class="text-caption"
                >
                  3
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                Game Difference
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                For 3+ way ties: games won minus games lost
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item>
              <template #prepend>
                <v-avatar
                  size="24"
                  color="primary"
                  class="text-caption"
                >
                  4
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                Point Difference
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                If still tied: total points scored minus points against
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item>
              <template #prepend>
                <v-avatar
                  size="24"
                  color="primary"
                  class="text-caption"
                >
                  5
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                Equal Standing
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                If all tiebreakers exhausted: players share the same rank
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="text-caption"
          >
            <v-icon
              icon="mdi-information"
              size="16"
              class="mr-1"
            />
            Hover over column headers in the table to see what each statistic means.
          </v-alert>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>
