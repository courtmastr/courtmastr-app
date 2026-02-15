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

const headers = computed(() => {
  const cols = [
    { title: '#', key: 'rank', sortable: false, width: '52px', align: 'center' as const },
    { title: 'Participant', key: 'participantName', sortable: true, minWidth: '140px' },
    ...(props.showCategory
      ? [{ title: 'Category', key: 'categoryName', sortable: true, width: '130px' }]
      : []),
    { title: 'Played', key: 'matchesPlayed', sortable: true, align: 'end' as const, width: '72px' },
    { title: 'Won', key: 'matchesWon', sortable: true, align: 'end' as const, width: '64px' },
    { title: 'Lost', key: 'matchesLost', sortable: true, align: 'end' as const, width: '64px' },
    { title: 'Win%', key: 'winRate', sortable: true, align: 'end' as const, width: '72px' },
    { title: 'Pts', key: 'matchPoints', sortable: true, align: 'end' as const, width: '64px' },
    { title: 'G+/-', key: 'gameDifference', sortable: true, align: 'end' as const, width: '72px' },
    { title: 'P+/-', key: 'pointDifference', sortable: true, align: 'end' as const, width: '72px' },
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
  <v-data-table
    :headers="headers"
    :items="entries"
    :loading="loading"
    :density="dense ? 'compact' : 'comfortable'"
    item-value="registrationId"
    :sort-by="[{ key: 'rank', order: 'asc' }]"
    hover
    class="leaderboard-table rounded-lg"
    expand-on-click
    show-expand
  >
    <!-- Rank header tooltip -->
    <template #header.rank="{ column }">
      <v-tooltip location="top" text="Rank determined by BWF Article 16.2 tiebreaker rules">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- Played header tooltip -->
    <template #header.matchesPlayed="{ column }">
      <v-tooltip location="top" text="Total matches played">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- Win% header tooltip -->
    <template #header.winRate="{ column }">
      <v-tooltip location="top" text="Win Rate: (Matches Won / Matches Played) × 100">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- Pts header tooltip -->
    <template #header.matchPoints="{ column }">
      <v-tooltip location="top" text="Match Points: 2 points for win, 1 point for loss (BWF standard)">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- G+/- header tooltip -->
    <template #header.gameDifference="{ column }">
      <v-tooltip location="top" text="Game Difference (Games Won minus Games Lost)">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- P+/- header tooltip -->
    <template #header.pointDifference="{ column }">
      <v-tooltip location="top" text="Point Difference (Points For minus Points Against)">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps" class="cursor-help">{{ column.title }}</span>
        </template>
      </v-tooltip>
    </template>

    <!-- Expanded row content -->
    <template #expanded-row="{ columns, item }">
      <tr>
        <td :colspan="columns.length" class="pa-4 bg-surface-light">
          <div class="text-subtitle-2 mb-2 font-weight-medium">
            <v-icon icon="mdi-history" size="18" class="mr-1" />
            Match Statistics for {{ item.participantName }}
          </div>
          <v-row dense>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="outlined" class="pa-2">
                <div class="text-caption text-medium-emphasis">Games Won</div>
                <div class="text-h6 font-weight-bold text-success">{{ item.gamesWon }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="outlined" class="pa-2">
                <div class="text-caption text-medium-emphasis">Games Lost</div>
                <div class="text-h6 font-weight-bold text-error">{{ item.gamesLost }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="outlined" class="pa-2">
                <div class="text-caption text-medium-emphasis">Points Scored</div>
                <div class="text-h6 font-weight-bold">{{ item.pointsFor }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="outlined" class="pa-2">
                <div class="text-caption text-medium-emphasis">Points Against</div>
                <div class="text-h6 font-weight-bold">{{ item.pointsAgainst }}</div>
              </v-card>
            </v-col>
          </v-row>
          <div v-if="item.firstMatchAt || item.lastMatchAt" class="mt-3 text-caption text-medium-emphasis">
            <v-icon icon="mdi-calendar-clock" size="14" class="mr-1" />
            <span v-if="item.firstMatchAt">First match: {{ item.firstMatchAt.toLocaleDateString() }}</span>
            <span v-if="item.firstMatchAt && item.lastMatchAt" class="mx-2">•</span>
            <span v-if="item.lastMatchAt">Last match: {{ item.lastMatchAt.toLocaleDateString() }}</span>
          </div>
        </td>
      </tr>
    </template>

    <template #item.rank="{ item }">
      <div v-if="item.matchesPlayed === 0" class="text-center text-medium-emphasis">—</div>
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

    <template #item.participantName="{ item }">
      <div class="d-flex align-center" :class="{ 'text-disabled': item.eliminated }">
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

    <template #item.categoryName="{ item }">
      <v-chip size="x-small" variant="tonal" color="secondary">
        {{ item.categoryName }}
      </v-chip>
    </template>

    <template #item.matchesWon="{ item }">
      <span :class="item.matchesWon > 0 ? 'text-success font-weight-medium' : ''">
        {{ item.matchesWon }}
      </span>
    </template>

    <template #item.matchesLost="{ item }">
      <span :class="item.matchesLost > 0 ? 'text-error' : ''">
        {{ item.matchesLost }}
      </span>
    </template>

    <template #item.winRate="{ item }">
      {{ item.matchesPlayed > 0 ? `${item.winRate.toFixed(1)}%` : '—' }}
    </template>

    <template #item.matchPoints="{ item }">
      <v-chip size="small" color="primary" variant="tonal">
        {{ item.matchPoints }}
      </v-chip>
    </template>

    <template #item.gameDifference="{ item }">
      <span :class="diffColor(item.gameDifference) ? `text-${diffColor(item.gameDifference)} font-weight-medium` : ''">
        {{ diffText(item.gameDifference) }}
      </span>
    </template>

    <template #item.pointDifference="{ item }">
      <span :class="diffColor(item.pointDifference) ? `text-${diffColor(item.pointDifference)}` : ''">
        {{ diffText(item.pointDifference) }}
      </span>
    </template>

    <template #no-data>
      <div class="text-center py-8 text-medium-emphasis">
        <v-icon icon="mdi-trophy-outline" size="48" class="mb-2 d-block mx-auto" />
        No participants yet
      </div>
    </template>

    <template #loading>
      <v-skeleton-loader type="table-row@6" />
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
