<script setup lang="ts">
import { computed } from 'vue';
import {
  getTournamentStateColor,
  getTournamentStateDescription,
  getTournamentStateLabel,
  isBracketLocked,
  isRosterLocked,
  isScoringLocked,
} from '@/guards/tournamentState';
import type { TournamentLifecycleState } from '@/types';

const props = defineProps<{
  state: TournamentLifecycleState;
  nextState: TournamentLifecycleState | null;
  isAdmin: boolean;
  transitionLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'advance'): void;
  (e: 'unlock'): void;
}>();

const stateLabel = computed(() => getTournamentStateLabel(props.state));
const stateDescription = computed(() => getTournamentStateDescription(props.state));
const stateColor = computed(() => getTournamentStateColor(props.state));
const nextStateLabel = computed(() => (
  props.nextState ? getTournamentStateLabel(props.nextState) : null
));
</script>

<template>
  <v-card
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

