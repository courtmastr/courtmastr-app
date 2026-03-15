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

// URL-persisted: scope (?scope=pool|category|tournament)
const selectedPhaseScope = ref<LeaderboardPhaseScope>(
  (route.query.scope as LeaderboardPhaseScope) || 'tournament'
);

const { leaderboard, stage, error, generate, exportData } = useLeaderboard();

// Local filter state — search is URL-persisted (?q=)
const activeFilters = ref<LeaderboardOptions & { search?: string }>({
  search: (route.query.q as string) || undefined,
});

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
  // Persist search to URL
  router.replace({
    query: {
      ...route.query,
      q: filters.search || undefined,
    },
  });
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
  // Persist scope to URL
  router.replace({
    query: {
      ...route.query,
      scope,
    },
  });
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
    <!-- Hero Header Card -->
    <div class="leaderboard-hero mb-5">
      <!-- Back button (floats top-left) -->
      <v-btn
        class="back-btn"
        variant="text"
        icon="mdi-arrow-left"
        size="small"
        aria-label="Back to previous page"
        @click="router.back()"
      />

      <!-- Icon + Title -->
      <div class="hero-content">
        <div class="hero-icon-wrap">
          <v-icon
            icon="mdi-podium"
            size="32"
            color="white"
          />
        </div>

        <div class="hero-text">
          <h1 class="hero-title">
            {{ isTournamentWide ? 'Tournament Leaderboard' : 'Category Leaderboard' }}
          </h1>
          <p
            v-if="leaderboard"
            class="hero-subtitle"
          >
            <v-icon
              size="13"
              class="mr-1"
            >
              mdi-clock-outline
            </v-icon>
            Updated {{ leaderboard.generatedAt.toLocaleTimeString() }}
          </p>
          <p
            v-else
            class="hero-subtitle"
          >
            Live standings &amp; rankings
          </p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="hero-actions">
        <v-btn
          variant="text"
          icon="mdi-information-outline"
          size="small"
          class="action-icon-btn"
          aria-label="Open leaderboard explanation"
          @click="showBwfDialog = true"
        />

        <v-menu v-if="leaderboard">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              variant="outlined"
              prepend-icon="mdi-download"
              size="small"
              class="export-btn"
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

        <v-btn
          variant="flat"
          :loading="isLoading"
          prepend-icon="mdi-refresh"
          size="small"
          class="refresh-btn"
          @click="onRefresh"
        >
          Refresh
        </v-btn>
      </div>
    </div>

    <!-- Preset & Scope chips row -->
    <div class="d-flex align-center flex-wrap gap-2 mb-4">
      <!-- Pool scope toggle -->
      <template v-if="supportsPoolScope">
        <v-btn-toggle
          :model-value="selectedPhaseScope"
          density="compact"
          variant="outlined"
          color="primary"
          rounded="lg"
          mandatory
        >
          <v-btn
            value="pool"
            size="small"
            @click="switchPhaseScope('pool')"
          >
            Pool
          </v-btn>
          <v-btn
            value="category"
            size="small"
            @click="switchPhaseScope('category')"
          >
            Category
          </v-btn>
        </v-btn-toggle>
        <v-divider
          vertical
          class="mx-1"
          style="height: 20px; align-self: center;"
        />
      </template>

      <template v-if="leaderboard">
        <v-chip
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-trophy-outline"
        >
          {{ activePresetLabel }}
        </v-chip>
        <v-chip
          size="small"
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-swap-horizontal"
        >
          {{ activeProgressionLabel }}
        </v-chip>
      </template>
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
            aria-label="Close BWF tiebreaker rules dialog"
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

<style scoped>
/* ---- Hero Header ---- */
.leaderboard-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #1E40AF 100%);
  box-shadow: 0 8px 32px rgba(29, 78, 216, 0.25), 0 2px 8px rgba(29, 78, 216, 0.15);
  overflow: hidden;
  flex-wrap: wrap;
}

/* Subtle decorative glow blob in the corner */
.leaderboard-hero::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  pointer-events: none;
}

.back-btn {
  color: rgba(255, 255, 255, 0.85) !important;
  flex-shrink: 0;
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.hero-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}

.hero-text {
  min-width: 0;
}

.hero-title {
  font-size: clamp(1.2rem, 2.5vw, 1.6rem);
  font-weight: 700;
  letter-spacing: -0.3px;
  line-height: 1.15;
  color: #ffffff;
  margin: 0 0 4px;
}

.hero-subtitle {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.72);
  margin: 0;
  display: flex;
  align-items: center;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-icon-btn {
  color: rgba(255, 255, 255, 0.82) !important;
}

.export-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.18) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(8px);
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.28) !important;
}
</style>
