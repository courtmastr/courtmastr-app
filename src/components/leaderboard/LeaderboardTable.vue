<script setup lang="ts">
import { computed } from 'vue';
import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';

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
    { key: 'participant', title: 'Participant', width: '28%' },
    ...(props.showCategory
      ? [{ key: 'category', title: 'Category', width: '120px' }]
      : []),
    { key: 'status', title: 'Status', width: '110px' },
    { key: 'matchPoints', title: 'MP', width: '70px', align: 'center' as const },
    { key: 'record', title: 'W-L', width: '80px', align: 'center' as const },
    { key: 'games', title: 'Games', width: '90px', align: 'center' as const },
    { key: 'points', title: 'Pts For/Ag', width: '110px', align: 'center' as const },
    { key: 'pointDiff', title: 'Pts +/-', width: '80px', align: 'center' as const },
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

function diffColorClass(val: number): string {
  if (val > 0) return 'text-success';
  if (val < 0) return 'text-error';
  return 'text-medium-emphasis';
}

function statusLabel(entry: LeaderboardEntry): string {
  if (entry.matchesPlayed === 0) return 'Awaiting';
  if (entry.eliminated) return 'Eliminated';
  if (entry.rank === 1) return 'Leader';
  if (entry.rank <= 3) return 'Podium';
  return 'Active';
}

function statusColor(entry: LeaderboardEntry): string {
  if (entry.matchesPlayed === 0) return 'grey';
  if (entry.eliminated) return 'error';
  if (entry.rank === 1) return 'warning';
  if (entry.rank <= 3) return 'success';
  return 'info';
}
</script>

<template>
  <v-data-table
    :items="entries"
    :headers="compactHeaders.map(h => ({ title: h.title, key: h.key, sortable: false, align: h.align || 'start' }))"
    :loading="loading"
    class="leaderboard-table rounded-lg"
    :class="{ 'dense-table': dense }"
    show-expand
    item-value="participantName"
  >
    <template #item.rank="{ item }">
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

    <template #item.participant="{ item }">
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
      </div>
    </template>

    <template
      v-if="showCategory"
      #item.category="{ item }"
    >
      <v-chip
        size="x-small"
        variant="tonal"
        color="secondary"
      >
        {{ item.categoryName }}
      </v-chip>
    </template>

    <template #item.status="{ item }">
      <v-chip
        size="small"
        :color="statusColor(item)"
        variant="tonal"
      >
        {{ statusLabel(item) }}
      </v-chip>
    </template>

    <template #item.matchPoints="{ item }">
      <span class="font-weight-bold">{{ item.matchPoints }}</span>
    </template>

    <template #item.record="{ item }">
      <span>{{ item.matchesWon }}-{{ item.matchesLost }}</span>
    </template>

    <template #item.games="{ item }">
      <span>{{ item.gamesWon }}-{{ item.gamesLost }}</span>
    </template>

    <template #item.points="{ item }">
      <span>{{ item.pointsFor }} / {{ item.pointsAgainst }}</span>
    </template>

    <template #item.pointDiff="{ item }">
      <span :class="diffColorClass(item.pointDifference)">
        {{ diffText(item.pointDifference) }}
      </span>
    </template>

    <template #expanded-row="{ columns, item }">
      <tr>
        <td :colspan="columns.length" class="pa-0">
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
                    :class="diffColorClass(item.gameDifference)"
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
        </td>
      </tr>
    </template>
  </v-data-table>
</template>

<style scoped>
.leaderboard-table :deep(tbody tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
}
.cursor-help {
  cursor: help;
}
</style>
