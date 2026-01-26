<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import type { Match } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();

const loading = ref(true);

// Group matches by round
const matchesByRound = computed(() => {
  const matches = matchStore.matches.filter((m) => m.categoryId === props.categoryId);
  const rounds: Record<number, Match[]> = {};

  for (const match of matches) {
    if (!match.isLosersBracket) {
      if (!rounds[match.round]) {
        rounds[match.round] = [];
      }
      rounds[match.round].push(match);
    }
  }

  return rounds;
});

const rounds = computed(() => {
  return Object.keys(matchesByRound.value)
    .map(Number)
    .sort((a, b) => a - b);
});

const maxRound = computed(() => Math.max(...rounds.value, 0));

const roundNames = computed(() => {
  const names: Record<number, string> = {};
  const totalRounds = maxRound.value;

  for (const round of rounds.value) {
    if (round === totalRounds) {
      names[round] = 'Finals';
    } else if (round === totalRounds - 1) {
      names[round] = 'Semi-Finals';
    } else if (round === totalRounds - 2) {
      names[round] = 'Quarter-Finals';
    } else {
      names[round] = `Round ${round}`;
    }
  }

  return names;
});

const registrations = computed(() => registrationStore.registrations);
const players = computed(() => registrationStore.players);

onMounted(async () => {
  await matchStore.fetchMatches(props.tournamentId, props.categoryId);
  await registrationStore.fetchRegistrations(props.tournamentId);
  await registrationStore.fetchPlayers(props.tournamentId);
  loading.value = false;
});

watch(() => props.categoryId, async () => {
  loading.value = true;
  await matchStore.fetchMatches(props.tournamentId, props.categoryId);
  loading.value = false;
});

function getParticipantName(registrationId: string | undefined, match?: Match): string {
  if (!registrationId) {
    // Check if this is a bye (other participant exists and match is completed with a winner)
    if (match) {
      const otherParticipant = registrationId === match.participant1Id
        ? match.participant2Id
        : match.participant1Id;
      // If other participant exists and match is completed/has a winner, it's a bye
      if (otherParticipant && (match.status === 'completed' || match.winnerId)) {
        return 'BYE';
      }
    }
    return 'TBD';
  }

  // Look up the registration first
  const registration = registrations.value.find((r) => r.id === registrationId);
  if (!registration) return 'Unknown';

  // For teams (doubles), show team name
  if (registration.teamName) {
    return registration.teamName;
  }

  // For singles, show player name
  const player = players.value.find((p) => p.id === registration.playerId);
  if (player) {
    return `${player.firstName} ${player.lastName}`;
  }

  return 'Unknown';
}

// Check if a slot is a bye
function isBye(match: Match, participantId: string | undefined): boolean {
  if (participantId) return false;
  // It's a bye if the other participant exists and the match is completed
  const otherParticipant = participantId === match.participant1Id
    ? match.participant2Id
    : match.participant1Id;
  return !!(otherParticipant && (match.status === 'completed' || match.winnerId));
}

function getMatchColor(match: Match): string {
  switch (match.status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'ready':
      return 'warning';
    default:
      return 'grey';
  }
}

function isWinner(match: Match, participantId: string | undefined): boolean {
  return match.winnerId === participantId && !!participantId;
}

function getScoreDisplay(match: Match): string {
  if (match.scores.length === 0) return '';
  return match.scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
}
</script>

<template>
  <div class="bracket-container">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="rounds.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <p class="text-body-1 text-grey mt-4">No bracket generated yet</p>
    </div>

    <!-- Bracket -->
    <div v-else class="bracket">
      <div
        v-for="round in rounds"
        :key="round"
        class="bracket-round"
        :style="{ '--round': round }"
      >
        <div class="round-header">
          <span class="text-overline">{{ roundNames[round] }}</span>
        </div>

        <div class="round-matches">
          <div
            v-for="match in matchesByRound[round]"
            :key="match.id"
            class="bracket-match"
          >
            <v-card
              :color="getMatchColor(match)"
              variant="outlined"
              class="match-card"
            >
              <!-- Match Number -->
              <div class="match-number text-caption text-grey">
                #{{ match.matchNumber }}
              </div>

              <!-- Participant 1 -->
              <div
                class="participant"
                :class="{
                  'winner': isWinner(match, match.participant1Id),
                  'tbd': !match.participant1Id && !isBye(match, match.participant1Id),
                  'bye': isBye(match, match.participant1Id)
                }"
              >
                <span class="participant-name">
                  {{ getParticipantName(match.participant1Id, match) }}
                </span>
                <span v-if="match.scores.length > 0" class="participant-score">
                  {{ match.scores.reduce((sum, s) => sum + s.score1, 0) }}
                </span>
              </div>

              <v-divider />

              <!-- Participant 2 -->
              <div
                class="participant"
                :class="{
                  'winner': isWinner(match, match.participant2Id),
                  'tbd': !match.participant2Id && !isBye(match, match.participant2Id),
                  'bye': isBye(match, match.participant2Id)
                }"
              >
                <span class="participant-name">
                  {{ getParticipantName(match.participant2Id, match) }}
                </span>
                <span v-if="match.scores.length > 0" class="participant-score">
                  {{ match.scores.reduce((sum, s) => sum + s.score2, 0) }}
                </span>
              </div>

              <!-- Score Details -->
              <div v-if="getScoreDisplay(match)" class="match-score text-caption text-grey">
                {{ getScoreDisplay(match) }}
              </div>
            </v-card>

            <!-- Connector Lines -->
            <div v-if="round < maxRound" class="connector">
              <div class="connector-line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bracket-container {
  overflow-x: auto;
  padding: 16px;
}

.bracket {
  display: flex;
  gap: 40px;
  min-width: max-content;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}

.round-header {
  text-align: center;
  padding: 8px;
  margin-bottom: 16px;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 4px;
}

.round-matches {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex: 1;
  gap: 16px;
}

.bracket-match {
  position: relative;
  display: flex;
  align-items: center;
}

.match-card {
  width: 100%;
  padding: 8px;
}

.match-number {
  text-align: right;
  margin-bottom: 4px;
}

.participant {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.participant.winner {
  background-color: rgba(var(--v-theme-success), 0.15);
  font-weight: bold;
}

.participant.tbd {
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-style: italic;
}

.participant.bye {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-style: italic;
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.participant-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.participant-score {
  font-weight: bold;
  min-width: 24px;
  text-align: right;
}

.match-score {
  text-align: center;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
}

.connector {
  position: absolute;
  right: -40px;
  width: 40px;
  height: 100%;
  display: flex;
  align-items: center;
}

.connector-line {
  width: 20px;
  height: 2px;
  background-color: rgba(var(--v-theme-on-surface), 0.3);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .bracket {
    gap: 24px;
  }

  .bracket-round {
    min-width: 160px;
  }

  .connector {
    right: -24px;
    width: 24px;
  }

  .connector-line {
    width: 12px;
  }
}
</style>
