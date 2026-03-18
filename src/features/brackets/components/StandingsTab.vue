<script setup lang="ts">
import { ref, computed } from 'vue';
import PoolResultsSubTab from './PoolResultsSubTab.vue';
import PreElimSnapshotSubTab from './PreElimSnapshotSubTab.vue';
import type { Category, Match } from '@/types';
import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';

const props = defineProps<{
  tournamentId: string;
  category: Category;
  poolMatches: Match[];
  snapshotEntries: LeaderboardEntry[];
  snapshotTiebreakerResolutions: TiebreakerResolution[];
  snapshotLoading: boolean;
  bracketParticipantIds: Set<string>;
}>();

const isElimPhase = computed(() => props.category.poolPhase === 'elimination');
const activeSubTab = ref<'pool-results' | 'snapshot'>('pool-results');
</script>

<template>
  <div class="standings-tab">
    <!-- Sub-tab bar only shown when snapshot is available (elimination phase) -->
    <v-tabs
      v-if="isElimPhase"
      v-model="activeSubTab"
      color="primary"
      density="compact"
      class="mb-3"
    >
      <v-tab value="pool-results">
        <v-icon start>
          mdi-podium
        </v-icon>
        Pool Results
      </v-tab>
      <v-tab value="snapshot">
        <v-icon start>
          mdi-camera
        </v-icon>
        Pre-Elim Snapshot
      </v-tab>
    </v-tabs>

    <v-tabs-window
      v-if="isElimPhase"
      v-model="activeSubTab"
    >
      <v-tabs-window-item value="pool-results">
        <PoolResultsSubTab
          :tournament-id="tournamentId"
          :category-id="category.id"
          :matches="poolMatches"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="snapshot">
        <PreElimSnapshotSubTab
          :entries="snapshotEntries"
          :tiebreaker-resolutions="snapshotTiebreakerResolutions"
          :bracket-participant-ids="bracketParticipantIds"
          :loading="snapshotLoading"
        />
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Pool phase: show pool results directly (no sub-tab bar needed) -->
    <PoolResultsSubTab
      v-else
      :tournament-id="tournamentId"
      :category-id="category.id"
      :matches="poolMatches"
    />
  </div>
</template>
