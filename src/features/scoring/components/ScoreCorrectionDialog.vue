<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { GameScore, ScoringConfig } from '@/types';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import GameScoreEditor from './GameScoreEditor.vue';
import { getGamesNeeded, validateCompletedGameScore } from '../utils/validation';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

interface Props {
  modelValue: boolean;
  match: any; // Using any temporarily as it's a mix of Match and extra UI fields
  tournamentId: string;
  categoryId?: string;
  scoringConfig: ScoringConfig;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue', 'corrected']);

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();

const editedScores = ref<GameScore[]>([]);
const selectedWinnerId = ref<string | undefined>(undefined);
const correctionReason = ref('');
const correctionType = ref<'manual' | 'correction'>('correction');
const validationErrors = ref<string[]>([]);
const validationWarnings = ref<string[]>([]);
const isSubmitting = ref(false);

const quickReasons = [
  'Live Entry Error',
  'Not Scored in App',
  'Score Flip (P1/P2)',
  'Disputed Result',
  'Technical Issue',
  'Refusal to Play',
];

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const participant1Name = computed(() => {
  if (!props.match?.participant1Id) return 'Player 1';
  return getParticipantName(props.match.participant1Id);
});

const participant2Name = computed(() => {
  if (!props.match?.participant2Id) return 'Player 2';
  return getParticipantName(props.match.participant2Id);
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
    // Default to correction if status was already completed
    correctionType.value = (newMatch.status === 'completed' || newMatch.status === 'walkover') 
      ? 'correction' 
      : 'manual';
    validateScores();
  }
}, { immediate: true });

watch(editedScores, () => {
  validateScores();
  determineWinnerFromScores();
}, { deep: true });

function applyQuickReason(reason: string) {
  correctionReason.value = reason;
}

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
        correctionType: correctionType.value,
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
    <v-card class="correction-dialog-card">
      <v-toolbar
        color="warning"
        flat
        class="correction-dialog-toolbar"
      >
        <v-toolbar-title class="text-h6 font-weight-bold d-flex align-center">
          <v-icon
            start
            class="mr-2"
          >
            mdi-clipboard-edit-outline
          </v-icon>
          Score Correction & Audit
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          aria-label="Close correction dialog"
          @click="cancelCorrection"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text
        v-if="match"
        class="pa-6"
      >
        <v-alert
          v-if="match.corrected"
          type="warning"
          variant="tonal"
          density="compact"
          border="start"
          class="mb-6 rounded-lg"
          icon="mdi-history"
        >
          This match has been corrected <strong>{{ match.correctionCount }}</strong> time(s) previously.
        </v-alert>

        <!-- Match Header -->
        <div class="match-context-header mb-6 pa-4 rounded-xl d-flex align-center">
          <div class="match-info">
            <div class="text-overline text-primary font-weight-bold mb-1">
              {{ categoryId || 'General' }} · Match #{{ match.matchNumber }}
            </div>
            <div class="text-h5 font-weight-black d-flex align-center flex-wrap ga-3">
              <span>{{ participant1Name }}</span>
              <v-chip
                size="x-small"
                variant="outlined"
                class="px-2"
              >
                VS
              </v-chip>
              <span>{{ participant2Name }}</span>
            </div>
          </div>
          <v-spacer />
          <div class="text-right d-none d-sm-block">
            <div class="text-caption text-medium-emphasis">
              Original Entry
            </div>
            <div class="text-body-2 font-weight-bold">
              {{ match.completedAt ? new Date(match.completedAt).toLocaleTimeString() : 'Not completed' }}
            </div>
          </div>
        </div>

        <v-divider class="mb-6" />

        <!-- Correction Type -->
        <div class="mb-6">
          <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center">
            <v-icon
              start
              size="18"
              color="primary"
            >
              mdi-tag-outline
            </v-icon>
            Correction Type
          </div>
          <v-btn-toggle
            v-model="correctionType"
            mandatory
            color="primary"
            variant="outlined"
            density="compact"
            class="correction-type-toggle"
          >
            <v-btn
              value="manual"
              prepend-icon="mdi-account-edit"
              class="flex-grow-1"
            >
              Manual Entry
              <v-tooltip
                activator="parent"
                location="top"
              >
                Not scored in app / Post-match entry
              </v-tooltip>
            </v-btn>
            <v-btn
              value="correction"
              prepend-icon="mdi-auto-fix"
              class="flex-grow-1"
            >
              Live Correction
              <v-tooltip
                activator="parent"
                location="top"
              >
                Fixing error in live scorekeeping
              </v-tooltip>
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- Score Editor Section -->
        <div class="mb-6">
          <div class="text-subtitle-2 font-weight-bold mb-4 d-flex align-center">
            <v-icon
              start
              size="18"
              color="primary"
            >
              mdi-numeric-0-box-multiple-outline
            </v-icon>
            Adjust Game Scores
          </div>
          <div class="glass-container pa-4 rounded-xl">
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
          </div>
        </div>

        <v-row>
          <v-col
            cols="12"
            md="6"
          >
            <div class="text-subtitle-2 font-weight-bold mb-2">
              Winner Override
            </div>
            <v-select
              v-model="selectedWinnerId"
              :items="winnerOptions"
              label="Final Winner"
              :disabled="!!validationErrors.length"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-trophy"
              hide-details
              rounded="lg"
            />
          </v-col>
          <v-col
            cols="12"
            md="6"
          >
            <v-alert
              v-if="match.winnerId !== selectedWinnerId"
              color="error"
              variant="tonal"
              density="compact"
              icon="mdi-alert-circle"
              class="h-100 d-flex align-center rounded-lg"
            >
              <div class="text-caption font-weight-bold">
                Warning: This will change the match winner and may affect bracket progression!
              </div>
            </v-alert>
          </v-col>
        </v-row>

        <v-divider class="my-6" />

        <!-- Reason & Polish -->
        <div class="mb-6">
          <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center">
            <v-icon
              start
              size="18"
              color="primary"
            >
              mdi-message-text-outline
            </v-icon>
            Reason for Change *
          </div>
          
          <div class="quick-reasons mb-3">
            <v-chip
              v-for="reason in quickReasons"
              :key="reason"
              size="small"
              variant="tonal"
              color="primary"
              class="mr-2 mb-2 quick-reason-chip"
              @click="applyQuickReason(reason)"
            >
              {{ reason }}
            </v-chip>
          </div>

          <v-textarea
            v-model="correctionReason"
            label="Audit Notes"
            placeholder="Provide a brief explanation for this record change..."
            rows="3"
            counter="500"
            maxlength="500"
            variant="outlined"
            rounded="lg"
            :rules="[(v: string) => !!v || 'Reason is required']"
          />
        </div>

        <v-expand-transition>
          <div v-if="hasErrors || hasWarnings">
            <v-alert
              v-if="hasErrors"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4 rounded-lg"
            >
              <div
                v-for="error in validationErrors"
                :key="error"
                class="text-caption"
              >
                {{ error }}
              </div>
            </v-alert>

            <v-alert
              v-if="hasWarnings && !hasErrors"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4 rounded-lg"
            >
              <div
                v-for="warning in validationWarnings"
                :key="warning"
                class="text-caption"
              >
                {{ warning }}
              </div>
            </v-alert>
          </div>
        </v-expand-transition>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-6">
        <v-spacer />
        <v-btn
          variant="text"
          class="px-6 rounded-lg text-none"
          @click="cancelCorrection"
        >
          Discard
        </v-btn>
        <v-btn
          color="warning"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          variant="elevated"
          elevation="3"
          class="px-8 rounded-lg text-none font-weight-bold"
          append-icon="mdi-check-all"
          @click="submitCorrection"
        >
          Confirm & Log Changes
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.correction-dialog-card {
  border-radius: 24px;
  overflow: hidden;
  background:
    linear-gradient(165deg, rgba(var(--v-theme-surface), 0.98) 0%, rgba(var(--v-theme-surface), 0.92) 100%);
}

.correction-dialog-toolbar {
  background: linear-gradient(90deg, rgb(var(--v-theme-warning)) 0%, rgba(var(--v-theme-warning), 0.85) 100%) !important;
}

.match-context-header {
  background: rgba(var(--v-theme-primary), 0.05);
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.glass-container {
  background: rgba(var(--v-theme-surface), 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.correction-type-toggle {
  width: 100%;
  border-radius: 12px;
}

.quick-reason-chip {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
}

.quick-reason-chip:hover {
  transform: translateY(-1px);
  background: rgba(var(--v-theme-primary), 0.15) !important;
}

.text-h5 {
  font-family: 'Barlow Condensed', sans-serif;
  letter-spacing: -0.01em;
}

:deep(.v-btn--active) {
  font-weight: 800 !important;
}

:deep(.v-field--variant-outlined) {
  border-radius: 12px;
}
</style>
