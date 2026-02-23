<script setup lang="ts">
import type { TiebreakerResolution } from '@/types/leaderboard';

const STEP_LABELS: Record<string, string> = {
  head_to_head: 'Head-to-Head (BWF Art. 16.2.2)',
  game_difference: 'Game Difference per match (BWF Art. 16.2.3)',
  point_difference: 'Point Difference per match (BWF Art. 16.2.4)',
  equal: 'Equal Standing (BWF Art. 16.2.4.2)',
  match_wins: 'Match Wins',
};

defineProps<{ resolution: TiebreakerResolution }>();

// "Larry Harris / Eric Irving" → "L.Harris / E.Irving"
function shortName(name: string): string {
  return name.split(' / ').map(part => {
    const w = part.trim().split(' ');
    return w.length > 1 ? `${w[0][0]}.${w[w.length - 1]}` : part;
  }).join(' / ');
}

function fmt(val: number): string {
  return val > 0 ? `+${val}` : String(val);
}
</script>

<template>
  <v-tooltip
    max-width="420"
    location="top"
  >
    <template #activator="{ props: tp }">
      <v-chip
        v-bind="tp"
        size="x-small"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-scale-balance"
        class="ml-1 cursor-pointer"
      >
        Tie
      </v-chip>
    </template>

    <div class="pa-2">
      <!-- RECEIPT MODE — 2-way tie with full metric values -->
      <template v-if="resolution.resolvedValues?.length === 2">
        <div class="text-body-2 font-weight-bold mb-2">
          Why
          <span class="text-warning">
            {{ shortName(resolution.resolvedValues[0].participantName) }}
          </span>
          ranked higher
        </div>

        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th
                class="text-left text-caption pb-1"
                style="width:38%"
              />
              <th
                class="text-center text-caption pb-1"
                style="width:31%"
              >
                {{ shortName(resolution.resolvedValues[0].participantName) }}
              </th>
              <th
                class="text-center text-caption pb-1"
                style="width:31%"
              >
                {{ shortName(resolution.resolvedValues[1].participantName) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(metric, i) in resolution.resolvedValues[0].metrics"
              :key="i"
              :style="
                metric.decided
                  ? 'background: rgba(76,175,80,0.15); font-weight:600'
                  : metric.tied
                    ? 'opacity: 0.45'
                    : ''
              "
            >
              <td class="text-caption py-1 px-1">
                <v-icon
                  v-if="metric.decided"
                  size="12"
                  color="success"
                  class="mr-1"
                >
                  mdi-check-circle
                </v-icon>
                <span>{{ metric.label }}</span>
              </td>
              <td class="text-center text-caption py-1">
                {{ fmt(resolution.resolvedValues[0].metrics[i].value) }}
              </td>
              <td class="text-center text-caption py-1">
                {{ fmt(resolution.resolvedValues[1].metrics[i].value) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="text-caption text-medium-emphasis mt-2 d-flex align-center">
          <v-icon
            size="12"
            class="mr-1"
          >
            mdi-information-outline
          </v-icon>
          {{ STEP_LABELS[resolution.step] ?? resolution.step }}
        </div>
      </template>

      <!-- FALLBACK — 3-way+ tie, no receipt available -->
      <template v-else>
        <div class="text-body-2 font-weight-bold mb-1">
          Tiebreaker Applied
        </div>
        <div class="text-body-2 mb-1">
          <v-icon
            icon="mdi-gavel"
            size="14"
            class="mr-1"
          />
          {{ STEP_LABELS[resolution.step] ?? resolution.step }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ resolution.description }}
        </div>
      </template>
    </div>
  </v-tooltip>
</template>
