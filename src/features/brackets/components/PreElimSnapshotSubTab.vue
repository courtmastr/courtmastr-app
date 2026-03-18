<script setup lang="ts">
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable.vue';
import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';

defineProps<{
  entries: LeaderboardEntry[];
  tiebreakerResolutions: TiebreakerResolution[];
  bracketParticipantIds: Set<string>;
  loading: boolean;
}>();
</script>

<template>
  <div class="pre-elim-snapshot-tab">
    <div class="d-flex align-center mb-3 pa-1">
      <v-icon
        color="primary"
        class="mr-2"
      >
        mdi-camera
      </v-icon>
      <span class="text-body-2 text-medium-emphasis">
        Standings at the moment pools closed — computed from pool matches only, never changes.
      </span>
    </div>

    <LeaderboardTable
      :entries="entries"
      :loading="loading"
      :tiebreaker-resolutions="tiebreakerResolutions"
      :show-category="false"
      :bracket-participant-ids="bracketParticipantIds"
    />
  </div>
</template>
