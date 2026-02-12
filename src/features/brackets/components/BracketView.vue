<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
const windowWidth = ref(window.innerWidth);

// Handle window resize to detect mobile view
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// Whether to show vertical bracket layout (mobile view)
const isVerticalLayout = computed(() => windowWidth.value < 768);

// For mobile round navigation
const selectedRound = ref<number | null>(null);

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

      <!-- Round Navigator for Mobile -->
      <div v-if="isVerticalLayout" class="round-navigator mb-4">
        <v-chip-group
          v-model="selectedRound"
          selected-class="bg-primary"
          mandatory
        >
          <v-chip
            v-for="round in rounds"
            :key="`nav-${round}`"
            :value="round"
            filter
            variant="outlined"
          >
            {{ roundNames[round] }}
          </v-chip>
        </v-chip-group>
      </div>

      <!-- Bracket -->
      <div v-else :class="['bracket', { 'vertical-layout': isVerticalLayout }]">
        <div
          v-for="round in rounds"
          :key="round"
          class="bracket-round"
          :style="{ '--round': round }"
          :id="`round-${round}`"
          :class="{ 'selected-round': selectedRound === round }"
        >
          <div class="round-header">
            <span class="text-overline">{{ roundNames[round] }}</span>
          </div>

          <div class="round-matches" :class="{ 'vertical-matches': isVerticalLayout }">
            <div
              v-for="match in matchesByRound[round]"
              :key="match.id"
              class="bracket-match"
              :class="{ 'vertical-match': isVerticalLayout }"
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

                <v-divider v-if="!isVerticalLayout" />

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
              <div v-if="round < maxRound" class="connector" :class="{ 'vertical-connector': isVerticalLayout }">
                <div class="connector-line" :class="{ 'vertical-line': isVerticalLayout }" />
              </div>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<style scoped>
/* Modern Bracket Polish */
.bracket-container {
  overflow-x: auto;
  padding: 24px;
  scrollbar-width: thin;
}

.round-navigator {
  position: sticky;
  top: 0;
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(10px);
  z-index: 10;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-border), 0.5);
}

.bracket {
  display: flex;
  gap: 48px;
  min-width: max-content;
  padding-bottom: 24px;
}

.bracket.vertical-layout {
  flex-direction: column;
  gap: 32px;
}

.selected-round {
  background-color: rgba(var(--v-theme-primary), 0.05);
  border: 1px dashed rgba(var(--v-theme-primary), 0.3);
  border-radius: 16px;
  padding: 8px;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  min-width: 240px;
}

.vertical-layout .bracket-round {
  min-width: auto;
  align-items: center;
}

.round-header {
  text-align: center;
  padding: 12px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.1), rgba(var(--v-theme-primary), 0.05));
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.round-header .text-overline {
  font-weight: 700 !important;
  font-size: 0.8rem !important;
  letter-spacing: 1.5px !important;
  color: rgb(var(--v-theme-primary));
}

.vertical-layout .round-header {
  margin-bottom: 16px;
  width: 100%;
}

.round-matches {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex: 1;
  gap: 24px;
}

.round-matches.vertical-matches {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.bracket-match {
  position: relative;
  display: flex;
  align-items: center;
}

.bracket-match.vertical-match {
  align-self: stretch;
  flex-direction: column;
  min-height: 140px;
}

.match-card {
  width: 100%;
  padding: 0;
  border-radius: 12px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
}

.match-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.match-number {
  text-align: right;
  padding: 4px 12px;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: rgba(var(--v-theme-on-surface), 0.5);
  letter-spacing: 0.5px;
}

.participant {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin: 4px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  min-height: 40px;
}

.participant.winner {
  background: linear-gradient(90deg, rgba(var(--v-theme-success), 0.1), rgba(var(--v-theme-success), 0.05));
  border-left: 3px solid rgb(var(--v-theme-success));
}

.participant.winner .participant-name {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.participant.winner .participant-score {
  color: rgb(var(--v-theme-success));
  font-weight: 800;
  font-size: 1.1em;
}

.participant.tbd {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-style: italic;
  font-size: 0.9em;
}

.participant.bye {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-style: italic;
  background-color: transparent;
}

.participant-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
  font-size: 0.9rem;
}

.participant-score {
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  font-feature-settings: "tnum";
}

.match-score {
  text-align: center;
  padding: 6px;
  background: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  font-family: monospace;
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.connector {
  position: absolute;
  right: -48px;
  width: 48px;
  height: 100%;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.connector.vertical-connector {
  position: static;
  width: 100%;
  height: auto;
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.connector-line {
  width: 24px;
  height: 2px;
  background-color: rgba(var(--v-theme-border), 1);
  position: relative;
}

.connector-line::after {
  content: '';
  position: absolute;
  right: -2px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-border), 1);
}

.connector-line.vertical-line {
  width: 2px;
  height: 24px;
}

.connector-line.vertical-line::after {
  top: auto;
  bottom: -2px;
  right: -3px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .bracket {
    gap: 32px;
  }

  .bracket-round {
    min-width: 200px;
  }

  .connector {
    right: -32px;
    width: 32px;
  }

  .connector-line {
    width: 16px;
  }
}
</style>
