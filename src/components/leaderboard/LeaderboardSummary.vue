<script setup lang="ts">
import type { Leaderboard } from '@/types/leaderboard';

defineProps<{
  leaderboard: Leaderboard;
}>();
</script>

<template>
  <v-row class="mb-4">
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="primary">
        <v-card-text class="text-center pa-3">
          <v-icon icon="mdi-account-group" size="28" class="mb-1" />
          <div class="text-h5 font-weight-bold">{{ leaderboard.totalParticipants }}</div>
          <div class="text-caption text-medium-emphasis">Participants</div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="success">
        <v-card-text class="text-center pa-3">
          <v-icon icon="mdi-tennis" size="28" class="mb-1" />
          <div class="text-h5 font-weight-bold">{{ leaderboard.completedMatches }}</div>
          <div class="text-caption text-medium-emphasis">Matches Played</div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="info">
        <v-card-text class="text-center pa-3">
          <v-icon icon="mdi-run" size="28" class="mb-1" />
          <div class="text-h5 font-weight-bold">{{ leaderboard.activeParticipants }}</div>
          <div class="text-caption text-medium-emphasis">Still Active</div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="warning">
        <v-card-text class="text-center pa-3">
          <v-icon icon="mdi-trophy" size="28" class="mb-1" />
          <div
            class="text-body-1 font-weight-bold text-truncate"
            :title="leaderboard.entries[0]?.participantName ?? '—'"
          >
            {{ leaderboard.entries[0]?.participantName ?? '—' }}
          </div>
          <div class="text-caption text-medium-emphasis">Current Leader</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
