<script setup lang="ts">
import { computed } from 'vue';
import type { GameScore } from '@/types';
import { BADMINTON_CONFIG } from '@/types';

interface Props {
  modelValue: GameScore[];
  participant1Id?: string;
  participant2Id?: string;
  participant1Name: string;
  participant2Name: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: GameScore[]): void;
  (e: 'change'): void;
  (e: 'game-complete', game: GameScore): void;
}>();

const games = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function addGame() {
  const newGame: GameScore = {
    gameNumber: games.value.length + 1,
    score1: 0,
    score2: 0,
    isComplete: false,
  };
  games.value = [...games.value, newGame];
  emit('change');
}

function removeGame(index: number) {
  const newGames = [...games.value];
  newGames.splice(index, 1);
  
  // Renumber remaining games
  newGames.forEach((game, i) => {
    game.gameNumber = i + 1;
  });
  
  games.value = newGames;
  emit('change');
}

function updateScore(gameIndex: number, player: 'score1' | 'score2', value: number) {
  const newGames = [...games.value];
  const game = { ...newGames[gameIndex] };
  
  game[player] = Math.max(0, value);
  
  // Auto-detect game completion
  const maxScore = Math.max(game.score1, game.score2);
  const minScore = Math.min(game.score1, game.score2);
  const scoreDiff = maxScore - minScore;
  
  const hasWinningScore = maxScore >= BADMINTON_CONFIG.pointsToWin;
  const hasWinningMargin = scoreDiff >= BADMINTON_CONFIG.mustWinBy;
  const hasMaxPoints = maxScore >= BADMINTON_CONFIG.maxPoints;
  
  if (hasWinningScore && (hasWinningMargin || hasMaxPoints)) {
    game.isComplete = true;
    game.winnerId = game.score1 > game.score2 ? props.participant1Id : props.participant2Id;
    emit('game-complete', game);
  } else {
    game.isComplete = false;
    game.winnerId = undefined;
  }
  
  newGames[gameIndex] = game;
  games.value = newGames;
  emit('change');
}

function getWinnerName(game: GameScore): string {
  if (!game.isComplete || !game.winnerId) return '';
  return game.winnerId === props.participant1Id ? props.participant1Name : props.participant2Name;
}

function canRemoveGame(index: number): boolean {
  return games.value.length > 1 || index === games.value.length - 1;
}

function canAddGame(): boolean {
  const completedGames = games.value.filter(g => g.isComplete).length;
  return completedGames < BADMINTON_CONFIG.gamesPerMatch;
}
</script>

<template>
  <div class="game-score-editor">
    <div
      v-for="(game, index) in games"
      :key="index"
      class="game-row mb-3"
    >
      <v-row align="center" no-gutters>
        <v-col cols="2" class="text-center">
          <span class="text-subtitle-2">Game {{ game.gameNumber }}</span>
        </v-col>

        <v-col cols="3">
          <v-text-field
            :model-value="game.score1"
            type="number"
            :label="participant1Name"
            density="compact"
            hide-details
            min="0"
            @update:model-value="(val) => updateScore(index, 'score1', Number(val))"
          />
        </v-col>

        <v-col cols="1" class="text-center">
          <span class="text-h6">-</span>
        </v-col>

        <v-col cols="3">
          <v-text-field
            :model-value="game.score2"
            type="number"
            :label="participant2Name"
            density="compact"
            hide-details
            min="0"
            @update:model-value="(val) => updateScore(index, 'score2', Number(val))"
          />
        </v-col>

        <v-col cols="2" class="text-center">
          <v-chip
            v-if="game.isComplete"
            color="success"
            size="small"
            density="compact"
          >
            {{ getWinnerName(game) }} wins
          </v-chip>
          <v-chip
            v-else
            color="grey"
            size="small"
            density="compact"
            variant="outlined"
          >
            In Progress
          </v-chip>
        </v-col>

        <v-col cols="1" class="text-right">
          <v-btn
            v-if="canRemoveGame(index)"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            density="compact"
            @click="removeGame(index)"
          />
        </v-col>
      </v-row>
    </div>

    <v-btn
      v-if="canAddGame()"
      color="primary"
      variant="text"
      prepend-icon="mdi-plus"
      size="small"
      @click="addGame"
    >
      Add Game
    </v-btn>
  </div>
</template>

<style scoped>
.game-score-editor {
  max-width: 100%;
}

.game-row {
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}

.game-row:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
</style>
