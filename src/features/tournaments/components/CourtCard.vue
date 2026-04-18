<script setup lang="ts">
import { computed } from 'vue';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Court, Match } from '@/types';

interface Props {
  court: Court;
  match?: Match;
  categoryName?: string;
  matchDuration?: number; // in minutes
  readOnly?: boolean; // Hide action buttons (for public/display views)
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
});

const emit = defineEmits<{
  assign: [courtId: string];
  score: [match: Match];
  release: [courtId: string];
}>();

const { formatMatchDuration } = useMatchDisplay();
const { getParticipantName } = useParticipantResolver();

// Derived visual state from court status + match status for clearer ops communication
const visualState = computed(() => {
  if (props.court.status === 'maintenance') {
    return { label: 'BLOCKED', color: 'warning', borderClass: 'court-card--blocked' };
  }
  // Use match presence as the source of truth — court.status can lag behind
  // (orphaned match: court cleared but match.courtId still set)
  if (props.match) {
    if (props.match.status === 'in_progress') {
      return { label: 'LIVE', color: 'success', borderClass: 'court-card--live' };
    }
    return { label: 'READY', color: 'info', borderClass: 'court-card--ready' };
  }
  return { label: 'FREE', color: 'default', borderClass: 'court-card--free' };
});

// Keep these as aliases for template use
const statusColor = computed(() => visualState.value.color);
const statusLabel = computed(() => visualState.value.label);

const hasMatch = computed(() => !!props.match);

const participant1Name = computed(() => props.match ? getParticipantName(props.match.participant1Id) : 'TBD');
const participant2Name = computed(() => props.match ? getParticipantName(props.match.participant2Id) : 'TBD');

// Current live score: latest game in scores array
const currentScore = computed(() => {
  const scores = props.match?.scores;
  if (!scores || scores.length === 0) return null;
  const game = scores[scores.length - 1];
  return {
    score1: game.score1,
    score2: game.score2,
    gameNumber: game.gameNumber,
    totalGames: scores.length,
    isComplete: game.isComplete,
  };
});
</script>

<template>
  <v-card
    :class="['court-card', visualState.borderClass]"
    variant="outlined"
    density="compact"
  >
    <!-- Header: Court Name & Status badge -->
    <v-card-item class="pa-2 pb-1">
      <v-card-title
        class="text-subtitle-2 font-weight-bold px-0"
        style="font-size:13px!important;font-weight:800!important;"
      >
        {{ court.name }}
      </v-card-title>
      <template #append>
        <v-chip
          :color="statusColor"
          size="x-small"
          variant="tonal"
          label
          style="font-size:10px;font-weight:700;letter-spacing:0.5px;"
        >
          {{ statusLabel }}
        </v-chip>
      </template>
    </v-card-item>

    <!-- Match Info -->
    <v-card-text class="pa-2 pt-0">
      <div
        v-if="hasMatch"
        class="match-info"
      >
        <!-- Elapsed time -->
        <div class="d-flex align-center mb-2">
          <span
            v-if="matchDuration && matchDuration > 0 && match?.status === 'in_progress'"
            class="text-caption font-weight-medium"
            :class="matchDuration > 50 ? 'text-warning' : 'text-medium-emphasis'"
          >
            <v-icon
              size="10"
              class="mr-1"
            >mdi-timer-outline</v-icon>{{ formatMatchDuration(matchDuration) }}
          </span>
        </div>

        <!-- Players + Live Score -->
        <div class="players text-body-2">
          <div class="d-flex align-center justify-space-between">
            <div class="player-name text-truncate font-weight-medium flex-grow-1">
              {{ participant1Name }}
            </div>
            <div
              v-if="currentScore && match?.status === 'in_progress'"
              class="score-display text-h6 font-weight-bold ml-2 flex-shrink-0"
            >
              {{ currentScore.score1 }}
            </div>
          </div>
          <div class="d-flex align-center justify-space-between">
            <div class="vs text-caption text-medium-emphasis flex-grow-1 text-center">
              vs
            </div>
            <div
              v-if="currentScore && match?.status === 'in_progress'"
              class="text-caption text-medium-emphasis ml-2 flex-shrink-0 text-right"
            >
              <span v-if="(currentScore.totalGames ?? 1) > 1">G{{ currentScore.gameNumber }}</span>
            </div>
          </div>
          <div class="d-flex align-center justify-space-between">
            <div class="player-name text-truncate font-weight-medium flex-grow-1">
              {{ participant2Name }}
            </div>
            <div
              v-if="currentScore && match?.status === 'in_progress'"
              class="score-display text-h6 font-weight-bold ml-2 flex-shrink-0"
            >
              {{ currentScore.score2 }}
            </div>
          </div>
        </div>

        <!-- Category -->
        <div
          v-if="categoryName"
          class="text-caption text-medium-emphasis mt-2 text-truncate"
        >
          {{ categoryName }}
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="empty-state text-center py-4"
      >
        <v-icon
          size="32"
          color="grey-lighten-1"
          class="mb-2"
        >
          mdi-badminton
        </v-icon>
        <div class="text-caption text-medium-emphasis">
          No match assigned
        </div>
      </div>
    </v-card-text>

    <!-- Actions (hidden in read-only / public display mode) -->
    <v-card-actions
      v-if="!readOnly"
      class="pa-2 pt-0"
    >
      <template v-if="hasMatch">
        <div class="d-flex w-100 gap-2">
          <v-btn
            v-if="match?.status === 'in_progress' || match?.status === 'ready' || match?.status === 'scheduled'"
            variant="flat"
            color="primary"
            size="small"
            class="flex-grow-1"
            prepend-icon="mdi-scoreboard"
            @click="emit('score', match!)"
          >
            Score
          </v-btn>
          <v-btn
            variant="text"
            color="error"
            size="small"
            prepend-icon="mdi-link-off"
            aria-label="Release court"
            @click="emit('release', court.id)"
          >
            Release
          </v-btn>
        </div>
      </template>
      <template v-else-if="court.status === 'available' || !court.status">
        <v-btn
          variant="outlined"
          color="success"
          size="small"
          block
          prepend-icon="mdi-plus"
          @click="emit('assign', court.id)"
        >
          Assign
        </v-btn>
      </template>
      <template v-else-if="court.status === 'in_use' && !hasMatch">
        <v-btn
          variant="text"
          color="error"
          size="small"
          block
          aria-label="Release court"
          @click="emit('release', court.id)"
        >
          Release
        </v-btn>
      </template>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.court-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s ease, background 0.15s ease;
  border-left-width: 4px !important;
  border-left-style: solid !important;
}

.court-card--live {
  border-color: #bbf7d0 !important;
  border-left-color: #16a34a !important;
  background: linear-gradient(135deg, #fff 65%, #f0fdf4) !important;
}

.court-card--ready {
  border-color: #bfdbfe !important;
  border-left-color: #1d4ed8 !important;
  background: linear-gradient(135deg, #fff 65%, #eff6ff) !important;
}

.court-card--free {
  border-color: #e2e8f0 !important;
  border-left-color: #e2e8f0 !important;
  background: #fafafa !important;
}

.court-card--blocked {
  border-color: #fed7aa !important;
  border-left-color: #f97316 !important;
  background: #fff7ed !important;
  opacity: 0.85;
}

.match-info {
  min-height: 80px;
}

.players {
  line-height: 1.4;
}

.player-name {
  max-width: 100%;
  font-weight: 600;
}

.vs {
  text-align: center;
  font-size: 10px;
  color: #94a3b8;
  padding: 1px 0;
}

.empty-state {
  opacity: 0.6;
}

.gap-2 {
  gap: 8px;
}

.score-display {
  min-width: 24px;
  text-align: right;
  color: #16a34a;
  line-height: 1.2;
  font-size: 17px !important;
  font-weight: 800 !important;
  font-variant-numeric: tabular-nums;
}
</style>
