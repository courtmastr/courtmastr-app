<script setup lang="ts">
import type { TiebreakerResolution } from '@/types/leaderboard';

const STEP_LABELS: Record<string, string> = {
  head_to_head: 'Head-to-Head (BWF Art. 16.2.2)',
  game_difference: 'Game Difference (BWF Art. 16.2.3)',
  point_difference: 'Point Difference (BWF Art. 16.2.4)',
  equal: 'Equal Standing (BWF Art. 16.2.4.2)',
  match_wins: 'Match Wins',
};

defineProps<{
  resolution: TiebreakerResolution;
}>();
</script>

<template>
  <v-tooltip max-width="320" location="top">
    <template #activator="{ props: tooltipProps }">
      <v-chip
        v-bind="tooltipProps"
        size="x-small"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-scale-balance"
        class="ml-1 cursor-pointer"
      >
        Tie
      </v-chip>
    </template>

    <div class="pa-1">
      <div class="font-weight-bold text-body-2 mb-1">Tiebreaker Applied</div>
      <div class="text-body-2 mb-1">
        <v-icon icon="mdi-gavel" size="14" class="mr-1" />
        {{ STEP_LABELS[resolution.step] ?? resolution.step }}
      </div>
      <div class="text-caption text-medium-emphasis">{{ resolution.description }}</div>
    </div>
  </v-tooltip>
</template>
