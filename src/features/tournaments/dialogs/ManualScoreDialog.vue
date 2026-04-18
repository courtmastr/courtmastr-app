<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import BaseDialog from '@/components/common/BaseDialog.vue';
import {
  getGamesNeeded,
  resolveMatchScoringConfig,
  validateCompletedGameScore,
} from '@/features/scoring/utils/validation';
import type { Match, Tournament, Category, ScoringConfig } from '@/types';
import { logger } from '@/utils/logger';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
  tournamentId: string;
  tournament: Tournament;
  categories: Category[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'saved': [];
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const { getMatchDisplayName } = useMatchDisplay();
const { getParticipantName } = useParticipantResolver();

const loading = ref(false);
const manualScores = ref<Array<{ score1: number; score2: number }>>([]);

// Per-game inline validation — only validates games where at least one score > 0
const gameValidations = computed(() => {
  const config = scoringConfig.value;
  return manualScores.value.map((g) => {
    if (g.score1 === 0 && g.score2 === 0) return { isValid: true, message: undefined, winner: null };
    const result = validateCompletedGameScore(g.score1, g.score2, config);
    const winner = result.isValid
      ? (g.score1 > g.score2 ? 'p1' : 'p2')
      : null;
    return { ...result, winner };
  });
});

const hasInvalidScores = computed(() =>
  gameValidations.value.some((v) => !v.isValid)
);

const scoringConfig = computed<ScoringConfig>(() => {
  const category = props.categories.find(c => c.id === props.match?.categoryId);
  return resolveMatchScoringConfig(props.tournament.settings, category, props.match?.stageId);
});

function createScoreRows(count: number) {
  return Array.from({ length: count }, () => ({ score1: 0, score2: 0 }));
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.match) {
    const config = scoringConfig.value;
    const rows = createScoreRows(config.gamesPerMatch);
    
    // Pre-fill existing scores
    if (props.match.scores?.length) {
      props.match.scores.slice(0, config.gamesPerMatch).forEach((game, index) => {
        rows[index] = {
          score1: game.score1 || 0,
          score2: game.score2 || 0
        };
      });
    }
    
    manualScores.value = rows;
  }
});

async function submitScores() {
  if (!props.match) return;

  loading.value = true;
  try {
    const match = props.match;
    const config = scoringConfig.value;

    const games = manualScores.value
      .filter(g => g.score1 > 0 || g.score2 > 0)
      .map((g, index) => {
        const validation = validateCompletedGameScore(g.score1, g.score2, config);
        if (!validation.isValid) {
          throw new Error(`Game ${index + 1}: ${validation.message}`);
        }

        return {
          gameNumber: index + 1,
          score1: g.score1,
          score2: g.score2,
          isComplete: true,
          winnerId: g.score1 > g.score2 ? match.participant1Id : match.participant2Id
        };
      });

    await matchStore.submitManualScores(
      props.tournamentId,
      match.id,
      games,
      match.categoryId,
      match.levelId
    );

    // Log activity if match completed
    const p1Wins = games.filter(g => g.winnerId === match.participant1Id).length;
    const p2Wins = games.filter(g => g.winnerId === match.participant2Id).length;
    const gamesNeeded = getGamesNeeded(config);
    
    if (p1Wins >= gamesNeeded || p2Wins >= gamesNeeded) {
      const winnerName = p1Wins >= gamesNeeded
        ? getParticipantName(match.participant1Id)
        : getParticipantName(match.participant2Id);
        
      activityStore.logMatchCompleted(
        props.tournamentId,
        match.id,
        getParticipantName(match.participant1Id),
        getParticipantName(match.participant2Id),
        winnerName,
        games.map(g => `${g.score1}-${g.score2}`).join(', '),
        'Manual Entry', // Court name not available in this context easily
        props.categories.find(c => c.id === match.categoryId)?.name || 'Unknown'
      ).catch(logger.warn);
    }

    notificationStore.showToast('success', 'Scores saved');
    emit('saved');
    emit('update:modelValue', false);
  } catch (error: any) {
    notificationStore.showToast('error', error.message || 'Failed to save scores');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Enter Match Scores"
    max-width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div
      v-if="match"
      class="mb-4"
    >
      <div class="text-subtitle-1 font-weight-bold mb-1">
        {{ getMatchDisplayName(match) }}
      </div>
      <div class="d-flex justify-space-between text-caption text-grey mt-2 px-4">
        <span>{{ getParticipantName(match.participant1Id) }}</span>
        <span>{{ getParticipantName(match.participant2Id) }}</span>
      </div>
    </div>

    <v-form @submit.prevent="submitScores">
      <div
        v-for="(game, index) in manualScores"
        :key="index"
        class="mb-3"
      >
        <div class="d-flex align-center gap-4">
          <span
            class="text-caption text-medium-emphasis"
            style="width: 60px; flex-shrink: 0"
          >Game {{ index + 1 }}</span>
          <v-text-field
            v-model.number="game.score1"
            type="number"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            :aria-label="`Game ${index + 1} score for ${match ? getParticipantName(match.participant1Id) : 'Player 1'}`"
            class="centered-input"
          />
          <span class="text-h6 text-medium-emphasis">–</span>
          <v-text-field
            v-model.number="game.score2"
            type="number"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            :aria-label="`Game ${index + 1} score for ${match ? getParticipantName(match.participant2Id) : 'Player 2'}`"
            class="centered-input"
          />
        </div>
        <!-- Validation feedback row -->
        <div
          v-if="game.score1 > 0 || game.score2 > 0"
          class="d-flex align-center mt-1 ml-16 gap-2"
        >
          <v-chip
            v-if="gameValidations[index]?.isValid && gameValidations[index]?.winner"
            size="x-small"
            :color="gameValidations[index].winner === 'p1' ? 'primary' : 'secondary'"
            variant="tonal"
            prepend-icon="mdi-trophy-outline"
          >
            {{ gameValidations[index].winner === 'p1'
              ? (match ? getParticipantName(match.participant1Id) : 'Player 1')
              : (match ? getParticipantName(match.participant2Id) : 'Player 2') }} wins
          </v-chip>
          <span
            v-else-if="!gameValidations[index]?.isValid"
            class="text-caption text-error"
          >
            <v-icon
              size="14"
              class="mr-1"
            >mdi-alert-circle-outline</v-icon>{{ gameValidations[index]?.message }}
          </span>
        </div>
      </div>
    </v-form>

    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="loading"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        :disabled="loading || hasInvalidScores"
        @click="submitScores"
      >
        Save Scores
      </v-btn>
    </template>
  </BaseDialog>
</template>

<style scoped>
.centered-input :deep(input) {
  text-align: center;
}
</style>
