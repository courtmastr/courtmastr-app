<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Match, GameScore, ScoringConfig } from '@/types';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import GameScoreEditor from './GameScoreEditor.vue';
import { getGamesNeeded, validateCompletedGameScore } from '../utils/validation';

interface Props {
  modelValue: boolean;
  match: Match | null;
  tournamentId: string;
  categoryId?: string;
  scoringConfig: ScoringConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'corrected'): void;
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();

const editedScores = ref<GameScore[]>([]);
const selectedWinnerId = ref<string | undefined>(undefined);
const correctionReason = ref('');
const validationErrors = ref<string[]>([]);
const validationWarnings = ref<string[]>([]);
const isSubmitting = ref(false);

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const participant1Name = computed(() => {
  if (!props.match?.participant1Id) return 'Player 1';
  return 'Player 1';
});

const participant2Name = computed(() => {
  if (!props.match?.participant2Id) return 'Player 2';
  return 'Player 2';
});

const winnerOptions = computed(() => [
  { title: participant1Name.value, value: props.match?.participant1Id },
  { title: participant2Name.value, value: props.match?.participant2Id },
]);

const hasErrors = computed(() => validationErrors.value.length > 0);
const hasWarnings = computed(() => validationWarnings.value.length > 0);
const canSubmit = computed(() => {
  if (hasErrors.value) return false;
  if (!correctionReason.value.trim()) return false;
  if (editedScores.value.length === 0) return false;
  return true;
});

watch(() => props.match, (newMatch) => {
  if (newMatch) {
    editedScores.value = JSON.parse(JSON.stringify(newMatch.scores || []));
    selectedWinnerId.value = newMatch.winnerId;
    correctionReason.value = '';
    validateScores();
  }
}, { immediate: true });

watch(editedScores, () => {
  validateScores();
  determineWinnerFromScores();
}, { deep: true });

function determineWinnerFromScores() {
  if (!props.match) return;

  const gamesNeeded = getGamesNeeded(props.scoringConfig);
  let p1Wins = 0;
  let p2Wins = 0;

  for (const game of editedScores.value) {
    if (game.isComplete && game.winnerId) {
      if (game.winnerId === props.match.participant1Id) p1Wins++;
      else if (game.winnerId === props.match.participant2Id) p2Wins++;
    }
  }

  if (p1Wins >= gamesNeeded) {
    selectedWinnerId.value = props.match.participant1Id;
  } else if (p2Wins >= gamesNeeded) {
    selectedWinnerId.value = props.match.participant2Id;
  } else {
    selectedWinnerId.value = undefined;
  }
}

function validateScores() {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!props.match) return;

  for (const game of editedScores.value) {
    if (game.score1 < 0 || game.score2 < 0) {
      errors.push(`Game ${game.gameNumber}: Scores cannot be negative`);
      continue;
    }

    if (game.isComplete) {
      const validation = validateCompletedGameScore(game.score1, game.score2, props.scoringConfig);
      if (!validation.isValid) {
        errors.push(`Game ${game.gameNumber}: ${validation.message}`);
      }
    }
  }

  const gamesNeeded = getGamesNeeded(props.scoringConfig);
  const completedGames = editedScores.value.filter(g => g.isComplete).length;
  
  if (completedGames > 0 && completedGames < gamesNeeded) {
    warnings.push('Match does not have enough completed games for a winner');
  }

  validationErrors.value = errors;
  validationWarnings.value = warnings;
}

function handleGameComplete(game: GameScore) {
  const validation = validateCompletedGameScore(game.score1, game.score2, props.scoringConfig);
  if (validation.isValid) {
    game.isComplete = true;
    game.winnerId = game.score1 > game.score2 
      ? props.match?.participant1Id 
      : props.match?.participant2Id;
  }
}

async function submitCorrection() {
  if (!props.match || !canSubmit.value) return;

  isSubmitting.value = true;

  try {
    await matchStore.correctMatchScore(
      props.tournamentId,
      props.match.id,
      {
        originalScores: props.match.scores,
        newScores: editedScores.value,
        originalWinnerId: props.match.winnerId,
        newWinnerId: selectedWinnerId.value,
        reason: correctionReason.value,
      },
      props.categoryId,
      props.match.levelId
    );

    notificationStore.showToast('success', 'Score corrected successfully');
    emit('corrected');
    showDialog.value = false;
  } catch (err) {
    console.error('Error correcting score:', err);
    notificationStore.showToast('error', 'Failed to correct score');
  } finally {
    isSubmitting.value = false;
  }
}

function cancelCorrection() {
  showDialog.value = false;
}

function onScoreChange() {
  validateScores();
}

function onGameComplete(game: GameScore) {
  handleGameComplete(game);
  validateScores();
}
</script>

<template>
  <v-dialog
    v-model="showDialog"
    max-width="700"
    persistent
  >
    <v-card>
      <v-card-title class="text-h5">
        Correct Match Score
        <v-spacer />
        <v-btn
          icon
          variant="text"
          @click="cancelCorrection"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text v-if="match">
        <v-alert
          v-if="match.corrected"
          type="info"
          density="compact"
          class="mb-4"
        >
          This match has been corrected {{ match.correctionCount }} time(s) previously
        </v-alert>

        <div class="mb-4">
          <div class="text-subtitle-1 font-weight-bold">
            {{ participant1Name }} vs {{ participant2Name }}
          </div>
          <div class="text-caption text-grey">
            Category: {{ categoryId || 'Main' }} · Match #{{ match.matchNumber }}
          </div>
        </div>

        <v-divider class="mb-4" />

        <div class="text-subtitle-2 mb-2">
          Edit Scores
        </div>

        <game-score-editor
          v-model="editedScores"
          :participant1-id="match.participant1Id"
          :participant2-id="match.participant2Id"
          :participant1-name="participant1Name"
          :participant2-name="participant2Name"
          :scoring-config="scoringConfig"
          @change="onScoreChange"
          @game-complete="onGameComplete"
        />

        <v-divider class="my-4" />

        <v-select
          v-model="selectedWinnerId"
          :items="winnerOptions"
          label="Winner"
          :disabled="!!validationErrors.length"
          class="mb-4"
        />

        <v-textarea
          v-model="correctionReason"
          label="Reason for correction *"
          placeholder="Explain why the score needs to be corrected..."
          rows="3"
          counter="500"
          maxlength="500"
          :rules="[v => !!v || 'Reason is required']"
        />

        <v-alert
          v-if="hasErrors"
          type="error"
          density="compact"
          class="mt-4"
        >
          <div
            v-for="error in validationErrors"
            :key="error"
          >
            {{ error }}
          </div>
        </v-alert>

        <v-alert
          v-if="hasWarnings && !hasErrors"
          type="warning"
          density="compact"
          class="mt-4"
        >
          <div
            v-for="warning in validationWarnings"
            :key="warning"
          >
            {{ warning }}
          </div>
        </v-alert>

        <v-alert
          type="info"
          density="compact"
          class="mt-4"
        >
          <div class="text-caption">
            This will update the match score and may change the bracket progression.
            {{ match.winnerId !== selectedWinnerId ? 'Winner will be changed!' : '' }}
          </div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="cancelCorrection"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          @click="submitCorrection"
        >
          Confirm Correction
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
