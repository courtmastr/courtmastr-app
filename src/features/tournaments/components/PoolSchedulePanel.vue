<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { usePoolLeveling } from '@/composables/usePoolLeveling';
import type { PoolLevelParticipant, PoolSummary } from '@/composables/usePoolLeveling';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
  categoryName?: string;
}>();

const emit = defineEmits<{
  (e: 'create-levels', categoryId: string): void;
}>();

const { loading, error, preview, generatePreview } = usePoolLeveling();

async function loadPreview() {
  if (!props.categoryId || !props.tournamentId) return;
  try {
    // Default level count: 3 (Advanced / Intermediate / Beginner)
    await generatePreview(props.tournamentId, props.categoryId, 3);
  } catch {
    // error is already set by the composable
  }
}

onMounted(loadPreview);
watch(() => props.categoryId, loadPreview);

// ─── Per-pool standings ────────────────────────────────────────────────────────

interface PoolGroup {
  pool: PoolSummary;
  participants: PoolLevelParticipant[];
}

const poolGroups = computed<PoolGroup[]>(() => {
  if (!preview.value) return [];
  return preview.value.pools.map((pool) => ({
    pool,
    participants: preview.value!.participants
      .filter((p) => p.poolId === pool.id)
      .sort((a, b) => a.poolRank - b.poolRank),
  }));
});

const totalMatches = computed(() => {
  if (!preview.value) return 0;
  // Total = all pool matches. pendingMatches are those not yet completed.
  return preview.value.pendingMatches;
});

const allMatchesDone = computed(() => preview.value !== null && preview.value.pendingMatches === 0);

// ─── Pagination for large pools ────────────────────────────────────────────────
const page = ref(1);
const itemsPerPage = 6;

const pagedGroups = computed(() => {
  const start = (page.value - 1) * itemsPerPage;
  return poolGroups.value.slice(start, start + itemsPerPage);
});

const pageCount = computed(() => Math.ceil(poolGroups.value.length / itemsPerPage));

// ─── medal colour per rank ─────────────────────────────────────────────────────
function rankColor(rank: number): string {
  if (rank === 1) return 'warning'; // gold-ish
  if (rank === 2) return 'blue-grey-lighten-2'; // silver
  if (rank === 3) return 'orange-darken-3'; // bronze
  return 'grey';
}
</script>

<template>
  <div class="pool-schedule-panel">
    <!-- Header -->
    <div class="d-flex align-center mb-4 gap-3">
      <v-icon
        color="primary"
        size="22"
      >
        mdi-table-tennis
      </v-icon>
      <span class="text-subtitle-1 font-weight-semibold">Pool Play — {{ categoryName }}</span>
      <v-spacer />
      <v-chip
        v-if="preview"
        :color="allMatchesDone ? 'success' : 'warning'"
        size="small"
        variant="tonal"
        :prepend-icon="allMatchesDone ? 'mdi-check-all' : 'mdi-clock-outline'"
      >
        {{ allMatchesDone ? 'All matches done' : `${totalMatches} match${totalMatches === 1 ? '' : 'es'} remaining` }}
      </v-chip>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="d-flex justify-center align-center py-10"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="36"
      />
    </div>

    <!-- Error -->
    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
      <template #append>
        <v-btn
          size="small"
          variant="text"
          @click="loadPreview"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <!-- Pool groups grid -->
    <template v-else-if="preview">
      <v-row dense>
        <v-col
          v-for="{ pool, participants } in pagedGroups"
          :key="pool.id"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            variant="outlined"
            class="pool-card"
          >
            <v-card-title class="pool-card-title text-body-1 font-weight-bold">
              <v-icon
                size="16"
                class="mr-1"
              >
                mdi-account-group
              </v-icon>
              {{ pool.label }}
              <v-chip
                class="ml-2"
                size="x-small"
                color="primary"
                variant="tonal"
              >
                {{ pool.participantCount }} teams
              </v-chip>
            </v-card-title>

            <v-divider />

            <v-table
              density="compact"
              class="pool-table"
            >
              <thead>
                <tr>
                  <th class="text-left rank-col">
                    #
                  </th>
                  <th class="text-left">
                    Team
                  </th>
                  <th class="text-right narrow-col">
                    W
                  </th>
                  <th class="text-right narrow-col">
                    Pts
                  </th>
                  <th class="text-right narrow-col">
                    +/-
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in participants"
                  :key="p.registrationId"
                  :class="{ 'qualifier-row': p.poolRank <= 2 }"
                >
                  <td class="rank-col">
                    <v-icon
                      :color="rankColor(p.poolRank)"
                      size="14"
                    >
                      {{ p.poolRank <= 3 ? 'mdi-medal' : 'mdi-circle-small' }}
                    </v-icon>
                  </td>
                  <td class="team-name-cell">
                    <span
                      class="text-truncate d-block"
                      style="max-width: 130px;"
                    >{{ p.participantName }}</span>
                  </td>
                  <td class="text-right narrow-col">
                    <span class="text-caption">{{ p.matchesWon }}</span>
                  </td>
                  <td class="text-right narrow-col">
                    <strong>{{ p.matchPoints }}</strong>
                  </td>
                  <td class="text-right narrow-col">
                    <span
                      :class="{
                        'text-success': p.pointDifference > 0,
                        'text-error': p.pointDifference < 0,
                        'text-grey': p.pointDifference === 0,
                      }"
                      class="text-caption"
                    >
                      {{ p.pointDifference >= 0 ? '+' : '' }}{{ p.pointDifference }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <!-- Pagination for large tournaments -->
      <div
        v-if="pageCount > 1"
        class="d-flex justify-center mt-4"
      >
        <v-pagination
          v-model="page"
          :length="pageCount"
          density="compact"
          size="small"
          total-visible="5"
        />
      </div>

      <!-- Finalize CTA -->
      <v-card
        class="mt-4 finalize-cta"
        :class="allMatchesDone ? 'finalize-cta--ready' : 'finalize-cta--pending'"
        variant="outlined"
      >
        <v-card-text class="d-flex align-center gap-3 py-3">
          <v-icon
            :color="allMatchesDone ? 'success' : 'warning'"
            size="24"
          >
            {{ allMatchesDone ? 'mdi-flag-checkered' : 'mdi-timer-sand' }}
          </v-icon>
          <div class="flex-1-1">
            <div class="text-body-2 font-weight-medium">
              {{ allMatchesDone ? 'Pool play is complete!' : 'Pool play in progress' }}
            </div>
            <div class="text-caption text-grey">
              {{ allMatchesDone
                ? 'All groups have finished. You can now create elimination levels.'
                : `${totalMatches} match${totalMatches === 1 ? '' : 'es'} still need to be played before you can advance.`
              }}
            </div>
          </div>
          <v-btn
            :color="allMatchesDone ? 'success' : 'warning'"
            :variant="allMatchesDone ? 'flat' : 'tonal'"
            :disabled="!allMatchesDone"
            prepend-icon="mdi-layers-triple"
            size="small"
            @click="emit('create-levels', props.categoryId)"
          >
            Create Levels
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Pool summary counts -->
      <div class="d-flex gap-4 mt-3 flex-wrap">
        <div class="text-caption text-grey">
          <strong>{{ preview.pools.length }}</strong> pools ·
          <strong>{{ preview.participants.length }}</strong> teams ·
          <strong class="text-success">{{ preview.participants.filter(p => p.matchesWon > 0).length }}</strong> with wins
        </div>
      </div>
    </template>

    <!-- Empty — no pool schedule yet -->
    <div
      v-else
      class="d-flex flex-column align-center py-8 text-grey"
    >
      <v-icon
        size="48"
        class="mb-2"
      >
        mdi-table-tennis
      </v-icon>
      <div class="text-body-2">
        No pool schedule yet.
      </div>
      <div class="text-caption mt-1">
        Generate a pool schedule from the category card to get started.
      </div>
    </div>
  </div>
</template>

<style scoped>
.pool-schedule-panel {
  padding: 4px 0;
}

.pool-card {
  border-radius: 10px;
  overflow: hidden;
}

.pool-card-title {
  padding: 10px 12px;
  font-size: 13px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  display: flex;
  align-items: center;
}

.pool-table {
  font-size: 12px;
}

.rank-col {
  width: 28px;
  padding-left: 10px !important;
}

.narrow-col {
  width: 36px;
  padding-right: 8px !important;
}

.team-name-cell {
  max-width: 140px;
  overflow: hidden;
}

.qualifier-row td {
  background: rgba(var(--v-theme-success), 0.06);
}

.finalize-cta {
  border-radius: 10px;
  transition: border-color 0.3s;
}

.finalize-cta--ready {
  border-color: rgb(var(--v-theme-success)) !important;
}

.finalize-cta--pending {
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}
</style>
