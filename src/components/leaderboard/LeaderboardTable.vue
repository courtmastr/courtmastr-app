<script setup lang="ts">
import { computed } from 'vue';
import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';
import CompactDataTable from '@/components/common/CompactDataTable.vue';
import TiebreakerTooltip from './TiebreakerTooltip.vue';

const props = defineProps<{
  entries: LeaderboardEntry[];
  loading: boolean;
  tiebreakerResolutions: TiebreakerResolution[];
  showCategory?: boolean;
  dense?: boolean;
}>();

const resolutionMap = computed(() => {
  const map = new Map<string, TiebreakerResolution>();
  for (const r of props.tiebreakerResolutions) {
    for (const id of r.registrationIds) {
      if (!map.has(id)) map.set(id, r);
    }
  }
  return map;
});

const compactHeaders = computed(() => {
  const cols = [
    { key: 'rank', title: '#', width: '60px', align: 'center' as const },
    { key: 'participant', title: 'Participant', width: '40%', essential: true },
    ...(props.showCategory
      ? [{ key: 'category', title: 'Category', width: '120px' }]
      : []),
    { key: 'stats', title: 'Stats', width: '150px', essential: true },
  ];
  return cols;
});

function rankColor(rank: number): string {
  if (rank === 1) return 'rgba(255,215,0,0.12)';
  if (rank === 2) return 'rgba(192,192,192,0.12)';
  if (rank === 3) return 'rgba(205,127,50,0.12)';
  return '';
}

function rankIcon(rank: number): string | null {
  if (rank === 1) return 'mdi-medal';
  if (rank === 2) return 'mdi-medal';
  if (rank === 3) return 'mdi-medal';
  return null;
}

function rankIconColor(rank: number): string {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '';
}

function diffText(val: number): string {
  if (val > 0) return `+${val}`;
  return String(val);
}

function diffColor(val: number): string {
  if (val > 0) return 'success';
  if (val < 0) return 'error';
  return '';
}
</script>

<template>
  <compact-data-table
    :items="entries"
    :columns="compactHeaders"
    :loading="loading"
    :compact="dense"
    class="leaderboard-table rounded-lg"
  >
    <template #cell-rank="{ item }">
      <div
        v-if="item.matchesPlayed === 0"
        class="text-center text-medium-emphasis"
      >
        —
      </div>
      <div
        v-else
        class="d-flex align-center justify-center"
        :style="{ background: rankColor(item.rank), borderRadius: '4px', padding: '2px 4px' }"
      >
        <v-icon
          v-if="rankIcon(item.rank)"
          :icon="rankIcon(item.rank)!"
          :color="rankIconColor(item.rank)"
          size="18"
          class="mr-1"
        />
        <span :class="item.rank <= 3 ? 'font-weight-bold' : ''">{{ item.rank }}</span>
      </div>
    </template>

    <template #cell-participant="{ item }">
      <div
        class="d-flex align-center"
        :class="{ 'text-disabled': item.eliminated }"
      >
        <span :class="item.eliminated ? '' : 'font-weight-medium'">
          {{ item.participantName }}
        </span>
        <TiebreakerTooltip
          v-if="resolutionMap.has(item.registrationId) && item.matchesPlayed > 0"
          :resolution="resolutionMap.get(item.registrationId)!"
        />
        <v-chip
          v-if="item.eliminated"
          size="x-small"
          color="error"
          variant="tonal"
          class="ml-2"
        >
          Elim. Rd {{ item.eliminationRound ?? '?' }}
        </v-chip>
      </div>
    </template>

    <template
      v-if="showCategory"
      #cell-category="{ item }"
    >
      <v-chip
        size="x-small"
        variant="tonal"
        color="secondary"
      >
        {{ item.categoryName }}
      </v-chip>
    </template>

    <template #cell-stats="{ item }">
      <div class="d-flex align-center gap-2">
        <v-chip
          size="x-small"
          color="primary"
          variant="tonal"
          title="Match Points"
        >
          {{ item.matchPoints }} pts
        </v-chip>
        <span class="text-caption">
          {{ item.matchesWon }}W / {{ item.matchesLost }}L
        </span>
      </div>
    </template>

    <template #details="{ item }">
      <div class="pa-2">
        <div class="text-subtitle-2 mb-2 font-weight-medium">
          <v-icon
            icon="mdi-history"
            size="18"
            class="mr-1"
          />
          Match Statistics for {{ item.participantName }}
        </div>
        <v-row dense>
          <v-col
            cols="6"
            sm="3"
          >
            <v-card
              variant="outlined"
              class="pa-2"
            >
              <div class="text-caption text-medium-emphasis">
                Games Won
              </div>
              <div class="text-h6 font-weight-bold text-success">
                {{ item.gamesWon }}
              </div>
            </v-card>
          </v-col>
          <v-col
            cols="6"
            sm="3"
          >
            <v-card
              variant="outlined"
              class="pa-2"
            >
              <div class="text-caption text-medium-emphasis">
                Games Lost
              </div>
              <div class="text-h6 font-weight-bold text-error">
                {{ item.gamesLost }}
              </div>
            </v-card>
          </v-col>
          <v-col
            cols="6"
            sm="3"
          >
            <v-card
              variant="outlined"
              class="pa-2"
            >
              <div class="text-caption text-medium-emphasis">
                Win Rate
              </div>
              <div class="text-h6 font-weight-bold">
                {{ item.matchesPlayed > 0 ? `${item.winRate.toFixed(1)}%` : '—' }}
              </div>
            </v-card>
          </v-col>
          <v-col
            cols="6"
            sm="3"
          >
            <v-card
              variant="outlined"
              class="pa-2"
            >
              <div class="text-caption text-medium-emphasis">
                Game Diff
              </div>
              <div
                class="text-h6 font-weight-bold"
                :class="`text-${diffColor(item.gameDifference)}`"
              >
                {{ diffText(item.gameDifference) }}
              </div>
            </v-card>
          </v-col>
        </v-row>
        <div
          v-if="item.firstMatchAt || item.lastMatchAt"
          class="mt-3 text-caption text-medium-emphasis"
        >
          <v-icon
            icon="mdi-calendar-clock"
            size="14"
            class="mr-1"
          />
          <span v-if="item.firstMatchAt">First: {{ item.firstMatchAt.toLocaleDateString() }}</span>
          <span
            v-if="item.firstMatchAt && item.lastMatchAt"
            class="mx-2"
          >•</span>
          <span v-if="item.lastMatchAt">Last: {{ item.lastMatchAt.toLocaleDateString() }}</span>
        </div>
      </div>
    </template>
  </compact-data-table>
</template>

<style scoped>
.leaderboard-table :deep(tbody tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
}
.cursor-help {
  cursor: help;
}
</style>
