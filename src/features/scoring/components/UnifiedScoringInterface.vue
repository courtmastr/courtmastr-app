<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useAuthStore } from '@/stores/auth';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import { useNotificationStore } from '@/stores/notifications';
import { useDialogManager } from '@/composables/useDialogManager';
import ManualScoreDialog from '@/features/tournaments/dialogs/ManualScoreDialog.vue';
import type { Match, Tournament, Category } from '@/types';

const props = defineProps<{
  match: Match;
  tournament: Tournament;
  categories: Category[];
  readonly?: boolean;
}>();

const emit = defineEmits<{
  'score-updated': [];
  'match-completed': [];
}>();

const matchStore = useMatchStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();
const { getMatchDisplayName } = useMatchDisplay();
const { open: openDialog, close: closeDialog, isOpen: isDialogOpen } = useDialogManager(['manualScore']);

const isScorekeeper = computed(() => 
  authStore.isAdmin || 
  authStore.userRole === 'scorekeeper' || 
  authStore.userRole === 'organizer'
);

const canEdit = computed(() => !props.readonly && isScorekeeper.value);

const currentScore = computed(() => {
  if (!props.match.scores || props.match.scores.length === 0) return '0 - 0';
  const lastGame = props.match.scores[props.match.scores.length - 1];
  return `${lastGame.score1} - ${lastGame.score2}`;
});

const setsWon = computed(() => {
  let p1 = 0;
  let p2 = 0;
  if (props.match.scores) {
    props.match.scores.forEach(game => {
      if (game.isComplete) {
        if (game.winnerId === props.match.participant1Id) p1++;
        else if (game.winnerId === props.match.participant2Id) p2++;
      }
    });
  }
  return { p1, p2 };
});

const currentGameNumber = computed(() => {
  if (!props.match.scores) return 1;
  const activeGame = props.match.scores.find(g => !g.isComplete);
  return activeGame ? activeGame.gameNumber : props.match.scores.length + 1;
});

function openScoreEntry() {
  openDialog('manualScore');
}

function onScoreSaved() {
  closeDialog('manualScore');
  emit('score-updated');
  if (props.match.status === 'completed') {
    emit('match-completed');
  }
}
</script>

<template>
  <div class="unified-scoring-interface">
    <!-- Header: Match Info -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <div class="text-h6 font-weight-bold">
          {{ getMatchDisplayName(match) }}
        </div>
        <div class="text-caption text-grey">
          {{ categories.find(c => c.id === match.categoryId)?.name }} • Round {{ match.round }}
        </div>
      </div>
      <div v-if="canEdit">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-pencil"
          @click="openScoreEntry"
        >
          Enter Score
        </v-btn>
      </div>
    </div>

    <!-- Score Display -->
    <v-card
      variant="outlined"
      class="mb-4"
    >
      <v-card-text>
        <div class="d-flex justify-space-around align-center text-center">
          <!-- Player 1 -->
          <div>
            <div class="text-h4 font-weight-bold mb-1">
              {{ setsWon.p1 }}
            </div>
            <div class="text-caption text-uppercase">
              Sets
            </div>
          </div>

          <!-- VS / Divider -->
          <div class="px-4">
            <div class="text-h2 font-weight-bold text-primary mb-1">
              {{ currentScore }}
            </div>
            <div class="text-subtitle-2 text-grey">
              Game {{ currentGameNumber }}
            </div>
          </div>

          <!-- Player 2 -->
          <div>
            <div class="text-h4 font-weight-bold mb-1">
              {{ setsWon.p2 }}
            </div>
            <div class="text-caption text-uppercase">
              Sets
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Game History -->
    <div v-if="match.scores && match.scores.length > 0">
      <div class="text-subtitle-2 mb-2 font-weight-bold text-grey-darken-1">
        Game History
      </div>
      <div class="d-flex gap-2 overflow-x-auto pb-2">
        <v-chip
          v-for="game in match.scores"
          :key="game.gameNumber"
          :color="game.isComplete ? 'default' : 'primary'"
          variant="outlined"
          class="px-3"
        >
          Game {{ game.gameNumber }}: {{ game.score1 }} - {{ game.score2 }}
        </v-chip>
      </div>
    </div>

    <!-- Dialogs -->
    <ManualScoreDialog
      v-if="canEdit"
      :model-value="isDialogOpen('manualScore')"
      :match="match"
      :tournament-id="tournament.id"
      :tournament="tournament"
      :categories="categories"
      @update:model-value="(val) => !val && closeDialog('manualScore')"
      @saved="onScoreSaved"
    />
  </div>
</template>

<style scoped>
.unified-scoring-interface {
  max-width: 800px;
  margin: 0 auto;
}
</style>
