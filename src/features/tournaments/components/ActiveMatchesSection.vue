<script setup lang="ts">
import { useMatchDuration } from '@/composables/useMatchDuration';

interface Match {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name?: string;
  participant2Name?: string;
  categoryName?: string;
  courtName?: string;
  startedAt?: Date | string; // Allow string date
  scores?: Array<{ score1: number; score2: number }>;
  status: string;
}

const props = defineProps<{
  matches: Match[];
}>();

const emit = defineEmits<{
  completeMatch: [matchId: string];
  enterScore: [matchId: string];
  viewDetails: [matchId: string];
  unschedule: [matchId: string];
}>();

const { getMatchDuration, getDurationColor } = useMatchDuration();

function getParticipantNames(match: Match): string {
  const p1 = match.participant1Name || 'Player 1';
  const p2 = match.participant2Name || 'Player 2';
  
  // Debug: Log what we're displaying vs the actual IDs
  console.log('[ActiveMatchesSection] Displaying match:', {
    matchId: match.id,
    p1Name: p1,
    p2Name: p2,
    p1Id: match.participant1Id,
    p2Id: match.participant2Id
  });
  
  return `${p1} vs ${p2}`;
}

function getCurrentScore(match: Match): string {
  if (!match.scores || match.scores.length === 0) {
    return '0-0';
  }

  const currentGame = match.scores[match.scores.length - 1];
  return `${currentGame.score1}-${currentGame.score2}`;
}


</script>

<template>
  <v-card class="active-matches-section" variant="flat">
    <div class="d-flex align-center px-4 py-2 border-b">
      <v-icon color="primary" size="20" start>mdi-tennis</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Active Matches ({{ matches.length }})</span>
    </div>

    <v-table density="compact" class="active-matches-table">
      <thead>
        <tr>
          <th class="text-left" style="width: 120px">Court</th>
          <th class="text-left">Match</th>
          <th class="text-center" style="width: 100px">Score</th>
          <th class="text-left" style="width: 100px">Duration</th>
          <th class="text-right" style="width: 120px">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="match in matches" :key="match.id" class="match-row">
          <!-- Court -->
          <td>
            <div class="d-flex align-center">
              <v-icon 
                :color="getDurationColor(match)" 
                size="10" 
                class="mr-2 pulse-badge"
              >mdi-circle</v-icon>
              <span class="font-weight-medium text-body-2">{{ match.courtName || 'Unassigned' }}</span>
            </div>
          </td>

          <!-- Match Info -->
          <td>
            <div class="py-1">
              <div class="font-weight-medium text-body-2">{{ getParticipantNames(match) }}</div>
              <div class="text-caption text-medium-emphasis">{{ match.categoryName }}</div>
            </div>
          </td>

          <!-- Score -->
          <td class="text-center">
            <v-chip size="x-small" variant="flat" color="surface-variant" class="font-weight-bold px-2">
              {{ getCurrentScore(match) }}
            </v-chip>
          </td>

          <!-- Duration -->
          <td>
            <span :class="{'text-warning': getMatchDuration(match).isLong, 'text-caption': true}">
              {{ getMatchDuration(match).text }}
            </span>
          </td>

          <!-- Actions -->
          <td class="text-right">
            <div class="d-flex justify-end gap-1">
              <v-btn
                icon="mdi-scoreboard-outline"
                size="small"
                variant="text"
                color="primary"
                density="comfortable"
                @click="emit('enterScore', match.id)"
                title="Enter Score"
              ></v-btn>
              <v-btn
                icon="mdi-undo-variant"
                size="small"
                variant="text"
                color="warning"
                density="comfortable"
                @click="emit('unschedule', match.id)"
                title="Unschedule / Release"
              ></v-btn>
              <v-btn
                icon="mdi-check"
                size="small"
                variant="text"
                color="success"
                density="comfortable"
                @click="emit('completeMatch', match.id)"
                title="Complete Match"
              ></v-btn>
            </div>
          </td>
        </tr>
        <tr v-if="matches.length === 0">
          <td colspan="5" class="text-center text-medium-emphasis py-4">
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
}

.active-matches-table {
  background: transparent;
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
</style>
