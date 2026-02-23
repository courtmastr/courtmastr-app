<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getTournamentStateColor,
  getTournamentStateDescription,
  getTournamentStateLabel,
  isBracketLocked,
  isRosterLocked,
  isScoringLocked,
} from '@/guards/tournamentState';
import type { TournamentLifecycleState } from '@/types';

const props = withDefaults(defineProps<{
  state: TournamentLifecycleState;
  nextState: TournamentLifecycleState | null;
  isAdmin: boolean;
  transitionLoading?: boolean;
  /** Optional live stats — when provided, LIVE state renders as a compact strip */
  liveStats?: {
    inProgress: number;
    remaining: number;
    courtsFree: number;
    completed: number;
    total: number;
  };
}>(), {
  transitionLoading: false,
  liveStats: undefined,
});

const emit = defineEmits<{
  (e: 'advance'): void;
  (e: 'unlock'): void;
  (e: 'revert'): void;
}>();

const stateLabel = computed(() => getTournamentStateLabel(props.state));
const stateDescription = computed(() => getTournamentStateDescription(props.state));
const stateColor = computed(() => getTournamentStateColor(props.state));
const nextStateLabel = computed(() => (
  props.nextState ? getTournamentStateLabel(props.nextState) : null
));

/** Compact mode: LIVE state + stats available */
const isCompact = computed(() => props.state === 'LIVE' && !!props.liveStats);

/** Expand details panel in compact mode */
const showDetails = ref(false);

const completionPercent = computed(() => {
  if (!props.liveStats || props.liveStats.total === 0) return 0;
  return Math.round((props.liveStats.completed / props.liveStats.total) * 100);
});
</script>

<template>
  <!-- Compact strip for LIVE state (when stats are provided) -->
  <v-sheet
    v-if="isCompact && liveStats"
    color="success"
    class="state-strip"
  >
    <div class="state-strip__content">
      <div class="d-flex align-center flex-wrap ga-3">
        <v-chip
          size="small"
          color="white"
          variant="elevated"
          class="font-weight-bold"
          label
        >
          <v-icon
            start
            size="14"
          >
            mdi-circle
          </v-icon>
          LIVE
        </v-chip>

        <span class="state-strip__stat">
          <v-icon
            size="14"
            class="mr-1"
          >mdi-play-circle</v-icon>
          {{ liveStats.inProgress }} in progress
        </span>
        <span class="state-strip__stat">
          <v-icon
            size="14"
            class="mr-1"
          >mdi-clock-outline</v-icon>
          {{ liveStats.remaining }} remaining
        </span>
        <span class="state-strip__stat">
          <v-icon
            size="14"
            class="mr-1"
          >mdi-map-marker</v-icon>
          {{ liveStats.courtsFree }} courts free
        </span>
        <span class="state-strip__stat">
          <v-icon
            size="14"
            class="mr-1"
          >mdi-check-circle</v-icon>
          {{ completionPercent }}% done
        </span>
      </div>

      <v-btn
        size="x-small"
        variant="text"
        color="white"
        :icon="showDetails ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        @click="showDetails = !showDetails"
      />
    </div>

    <!-- Expandable details -->
    <v-expand-transition>
      <div
        v-if="showDetails"
        class="state-strip__details"
      >
        <div class="d-flex flex-wrap gap-2 align-center">
          <v-chip
            size="x-small"
            :color="isRosterLocked(state) ? 'warning' : 'success'"
            variant="elevated"
          >
            Roster {{ isRosterLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
          <v-chip
            size="x-small"
            :color="isBracketLocked(state) ? 'warning' : 'success'"
            variant="elevated"
          >
            Bracket {{ isBracketLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
          <v-chip
            size="x-small"
            :color="isScoringLocked(state) ? 'warning' : 'success'"
            variant="elevated"
          >
            Scoring Format {{ isScoringLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="isAdmin && nextStateLabel"
            size="x-small"
            color="white"
            variant="outlined"
            prepend-icon="mdi-flag-checkered"
            :loading="transitionLoading"
            @click="emit('advance')"
          >
            {{ nextStateLabel }}
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </v-sheet>

  <!-- Full card for non-LIVE states (or LIVE without stats) -->
  <v-card
    v-else
    class="mb-4"
    variant="tonal"
    :color="stateColor"
  >
    <v-card-text class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3">
      <div>
        <div class="d-flex align-center mb-1">
          <v-icon
            class="mr-2"
            size="20"
          >
            mdi-flag-checkered
          </v-icon>
          <span class="text-subtitle-1 font-weight-bold">State: {{ stateLabel }}</span>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ stateDescription }}
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <v-chip
            size="x-small"
            :color="isRosterLocked(state) ? 'warning' : 'success'"
            variant="tonal"
          >
            Roster {{ isRosterLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
          <v-chip
            size="x-small"
            :color="isBracketLocked(state) ? 'warning' : 'success'"
            variant="tonal"
          >
            Bracket {{ isBracketLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
          <v-chip
            size="x-small"
            :color="isScoringLocked(state) ? 'warning' : 'success'"
            variant="tonal"
          >
            Scoring Format {{ isScoringLocked(state) ? 'Locked' : 'Editable' }}
          </v-chip>
        </div>
      </div>

      <div
        v-if="isAdmin"
        class="d-flex gap-2"
      >
        <v-btn
          v-if="nextStateLabel"
          color="primary"
          variant="flat"
          :loading="transitionLoading"
          @click="emit('advance')"
        >
          Move to {{ nextStateLabel }}
        </v-btn>
        <v-btn
          v-if="state === 'BRACKET_LOCKED'"
          color="error"
          variant="outlined"
          :loading="transitionLoading"
          @click="emit('unlock')"
        >
          Emergency Unlock
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.state-strip {
  color: white;
  border-radius: 0;
}

.state-strip__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.state-strip__stat {
  display: inline-flex;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 500;
  opacity: 0.95;
  white-space: nowrap;
}

.state-strip__details {
  padding: 8px 16px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
