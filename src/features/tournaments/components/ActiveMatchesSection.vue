<script setup lang="ts">
import { computed } from 'vue';
import { useMatchDuration } from '@/composables/useMatchDuration';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Match as TournamentMatch } from '@/types';

type Match = TournamentMatch & {
  participant1Name?: string;
  participant2Name?: string;
  categoryName?: string;
  courtName?: string;
};

const props = withDefaults(defineProps<{
  matches: Match[];
  showActions?: boolean;
}>(), {
  showActions: true,
});

const shouldShowActions = computed(() => props.showActions);

const emit = defineEmits<{
  completeMatch: [matchId: string];
  enterScore: [matchId: string];
  viewDetails: [matchId: string];
  unschedule: [ref: { matchId: string; categoryId: string; levelId?: string }];
}>();

const { getMatchDuration, getDurationColor } = useMatchDuration();
const { getMatchupString } = useParticipantResolver();

function getCurrentScore(match: Match): string {
  if (!match.scores || match.scores.length === 0) {
    return '0-0';
  }

  const currentGame = match.scores[match.scores.length - 1];
  return `${currentGame.score1}-${currentGame.score2}`;
}


</script>

<template>
  <v-card
    class="active-matches-section"
    variant="flat"
  >
    <div class="active-matches-section__header d-flex align-center px-4 py-2 border-b">
      <v-icon
        color="primary"
        size="20"
        start
      >
        mdi-tennis
      </v-icon>
      <span class="text-subtitle-1 font-weight-bold">Active Matches ({{ matches.length }})</span>
    </div>

    <v-table
      density="compact"
      class="active-matches-table"
    >
      <thead>
        <tr>
          <th
            class="text-left"
            style="width: 120px"
          >
            Court
          </th>
          <th class="text-left">
            Match
          </th>
          <th
            class="text-center"
            style="width: 100px"
          >
            Score
          </th>
          <th
            class="text-left"
            style="width: 100px"
          >
            Duration
          </th>
          <th
            v-if="shouldShowActions"
            class="text-right"
            style="width: 120px"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="match in matches"
          :key="`${match.categoryId}-${match.id}`"
          class="match-row"
        >
          <!-- Court -->
          <td>
            <div class="d-flex align-center">
              <v-icon 
                :color="getDurationColor(match)" 
                size="10" 
                class="mr-2 pulse-badge"
              >
                mdi-circle
              </v-icon>
              <span class="font-weight-medium text-body-2">{{ match.courtName || 'Unassigned' }}</span>
            </div>
          </td>

          <!-- Match Info -->
          <td>
            <div class="py-1">
              <div class="font-weight-medium text-body-2">
                {{ getMatchupString(match) }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ match.categoryName }}
                <template v-if="match.round">
                  • Round {{ match.round }}
                </template>
              </div>
            </div>
          </td>

          <!-- Score -->
          <td class="text-center">
            <v-chip
              size="x-small"
              variant="flat"
              color="surface-variant"
              class="font-weight-bold px-2"
            >
              {{ getCurrentScore(match) }}
            </v-chip>
          </td>

          <!-- Duration -->
          <td>
            <span :class="{
              'text-error': getMatchDuration(match).isStale,
              'text-warning': getMatchDuration(match).isLong && !getMatchDuration(match).isStale,
              'text-caption': true
            }">
              {{ getMatchDuration(match).text }}
            </span>
          </td>

          <!-- Actions -->
          <td
            v-if="shouldShowActions"
            class="text-right"
          >
            <div class="d-flex justify-end gap-1">
              <v-btn
                icon="mdi-scoreboard-outline"
                size="small"
                variant="text"
                color="primary"
                density="comfortable"
                title="Enter Score"
                :aria-label="`Enter score for ${getMatchupString(match)}`"
                @click="emit('enterScore', match.id)"
              />
              <v-btn
                icon="mdi-undo-variant"
                size="small"
                variant="text"
                color="warning"
                density="comfortable"
                title="Unschedule / Release"
                :aria-label="`Unschedule ${getMatchupString(match)}`"
                @click="emit('unschedule', { matchId: match.id, categoryId: match.categoryId, levelId: match.levelId })"
              />
              <v-btn
                icon="mdi-check"
                size="small"
                variant="text"
                color="success"
                density="comfortable"
                title="Complete Match"
                :aria-label="`Complete ${getMatchupString(match)}`"
                @click="emit('completeMatch', match.id)"
              />
            </div>
          </td>
        </tr>
        <tr v-if="matches.length === 0">
          <td
            :colspan="shouldShowActions ? 5 : 4"
            class="text-center text-medium-emphasis py-4"
          >
            No matches currently in progress
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>

<style scoped>
.active-matches-section {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  height: 100%;
  display: flex;
  flex-direction: column;
}

.active-matches-section__header {
  flex-shrink: 0;
}

.active-matches-table {
  background: transparent;
  flex: 1;
  min-height: 0;
}

:deep(.active-matches-table .v-table__wrapper) {
  max-height: 100%;
  overflow-y: auto;
}

.match-row:hover {
  background-color: rgba(var(--v-theme-primary), 0.03);
}

/* Compact pulsing dot */
@keyframes pulse-green {
  0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
}

.pulse-badge {
  border-radius: 50%;
  animation: pulse-green 2s infinite;
}

.gap-1 {
  gap: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .pulse-badge {
    animation: none;
  }
}
</style>
