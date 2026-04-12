<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchSlotState } from '@/composables/useMatchSlotState';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match } from '@/types';
import html2canvas from 'html2canvas';
import { logger } from '@/utils/logger';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName: resolveParticipantName } = useParticipantResolver();
const { getSlotState, getSlotLabel } = useMatchSlotState();
const { getMatchStatusColor } = useMatchDisplay();

const loading = ref(true);
const activeTab = ref('winners');

// All matches for this category
const allMatches = computed(() =>
  matchStore.matches.filter((m) => m.categoryId === props.categoryId)
);

// Winners bracket matches
const winnersBracket = computed(() => {
  const matches = allMatches.value.filter(
    (m) => !m.isLosersBracket && m.bracketPosition?.bracket !== 'finals'
  );
  return groupByRound(matches);
});

// Losers bracket matches
const losersBracket = computed(() => {
  const matches = allMatches.value.filter((m) => m.isLosersBracket);
  return groupByRound(matches);
});

// Finals matches
const finalsMatches = computed(() => {
  return allMatches.value
    .filter((m) => m.bracketPosition?.bracket === 'finals')
    .sort((a, b) => a.matchNumber - b.matchNumber);
});

// Group matches by round
function groupByRound(matches: Match[]): Record<number, Match[]> {
  const rounds: Record<number, Match[]> = {};
  for (const match of matches) {
    const round = match.bracketPosition?.round || match.round;
    if (!rounds[round]) {
      rounds[round] = [];
    }
    rounds[round].push(match);
  }
  // Sort matches within each round by position
  for (const round in rounds) {
    rounds[round].sort(
      (a, b) => (a.bracketPosition?.position || 0) - (b.bracketPosition?.position || 0)
    );
  }
  return rounds;
}

const winnersRounds = computed(() =>
  Object.keys(winnersBracket.value).map(Number).sort((a, b) => a - b)
);

const losersRounds = computed(() =>
  Object.keys(losersBracket.value).map(Number).sort((a, b) => a - b)
);

// Stats
const bracketStats = computed(() => {
  const total = allMatches.value.length;
  const completed = allMatches.value.filter((m) => m.status === 'completed').length;
  const inProgress = allMatches.value.filter((m) => m.status === 'in_progress').length;
  const ready = allMatches.value.filter((m) => m.status === 'ready').length;
  const scheduled = allMatches.value.filter((m) => m.status === 'scheduled').length;

  return {
    total,
    completed,
    inProgress,
    ready,
    scheduled,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    winnersMatches: Object.values(winnersBracket.value).flat().length,
    losersMatches: Object.values(losersBracket.value).flat().length,
    finalsMatches: finalsMatches.value.length,
  };
});

onMounted(async () => {
  await Promise.all([
    matchStore.fetchMatches(props.tournamentId, props.categoryId),
    registrationStore.fetchRegistrations(props.tournamentId),
    registrationStore.fetchPlayers(props.tournamentId),
  ]);
  loading.value = false;
});

watch(
  () => props.categoryId,
  async () => {
    loading.value = true;
    await matchStore.fetchMatches(props.tournamentId, props.categoryId);
    loading.value = false;
  }
);

function getParticipantDisplayName(match: Match, slot: 'participant1' | 'participant2'): string {
  return getSlotLabel(match, slot, resolveParticipantName);
}

function isSlotBye(match: Match, slot: 'participant1' | 'participant2'): boolean {
  return getSlotState(match, slot) === 'bye';
}

function isSlotTbd(match: Match, slot: 'participant1' | 'participant2'): boolean {
  return getSlotState(match, slot) === 'tbd';
}



function isWinner(match: Match, participantId: string | undefined): boolean {
  return match.winnerId === participantId && !!participantId;
}

function getRoundName(round: number, bracket: 'winners' | 'losers', totalRounds: number): string {
  if (bracket === 'winners') {
    if (round === totalRounds) return 'Winners Final';
    if (round === totalRounds - 1) return 'Winners Semi';
    return `Winners R${round}`;
  } else {
    return `Losers R${round}`;
  }
}

async function downloadBracket() {
  const element = document.querySelector('.bracket-container') as HTMLElement;
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Better resolution
      logging: false,
      useCORS: true
    });

    const link = document.createElement('a');
    link.download = `bracket-${props.tournamentId}-${props.categoryId}-${activeTab.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    logger.error('Failed to download bracket:', error);
  }
}
</script>

<template>
  <div class="double-elimination-bracket">
    <!-- Loading -->
    <div
      v-if="loading"
      class="text-center py-8"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="allMatches.length === 0"
      class="text-center py-8"
    >
      <v-icon
        size="64"
        color="grey-lighten-1"
      >
        mdi-tournament
      </v-icon>
      <p class="text-body-1 text-grey mt-4">
        No bracket generated yet
      </p>
    </div>

    <template v-else>
      <!-- Controls -->
      <div class="d-flex justify-end mb-4">
        <v-btn
          prepend-icon="mdi-download"
          variant="tonal"
          color="primary"
          @click="downloadBracket"
        >
          Export Diagram
        </v-btn>
      </div>

      <!-- Bracket Stats -->
      <v-card
        class="mb-4"
        variant="outlined"
      >
        <v-card-text>
          <v-row align="center">
            <v-col
              cols="12"
              md="6"
            >
              <div class="d-flex align-center">
                <div class="mr-6">
                  <div class="text-h4 font-weight-bold text-primary">
                    {{ bracketStats.progress }}%
                  </div>
                  <div class="text-caption">
                    Complete
                  </div>
                </div>
                <v-progress-linear
                  :model-value="bracketStats.progress"
                  color="primary"
                  height="12"
                  rounded
                  class="flex-grow-1"
                />
              </div>
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <div class="d-flex justify-space-around text-center">
                <div>
                  <v-chip
                    color="success"
                    size="small"
                    variant="tonal"
                  >
                    {{ bracketStats.completed }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    Completed
                  </div>
                </div>
                <div>
                  <v-chip
                    color="info"
                    size="small"
                    variant="tonal"
                  >
                    {{ bracketStats.inProgress }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    In Progress
                  </div>
                </div>
                <div>
                  <v-chip
                    color="warning"
                    size="small"
                    variant="tonal"
                  >
                    {{ bracketStats.ready }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    Ready
                  </div>
                </div>
                <div>
                  <v-chip
                    color="grey"
                    size="small"
                    variant="tonal"
                  >
                    {{ bracketStats.scheduled }}
                  </v-chip>
                  <div class="text-caption mt-1">
                    Waiting
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Bracket Tabs -->
      <v-tabs
        v-model="activeTab"
        color="primary"
        class="mb-4"
      >
        <v-tab value="winners">
          <v-icon start>
            mdi-trophy
          </v-icon>
          Winners Bracket
          <v-chip
            size="x-small"
            class="ml-2"
            variant="tonal"
          >
            {{ bracketStats.winnersMatches }}
          </v-chip>
        </v-tab>
        <v-tab value="losers">
          <v-icon start>
            mdi-trophy-broken
          </v-icon>
          Losers Bracket
          <v-chip
            size="x-small"
            class="ml-2"
            variant="tonal"
          >
            {{ bracketStats.losersMatches }}
          </v-chip>
        </v-tab>
        <v-tab value="finals">
          <v-icon start>
            mdi-trophy-award
          </v-icon>
          Grand Finals
          <v-chip
            size="x-small"
            class="ml-2"
            variant="tonal"
          >
            {{ bracketStats.finalsMatches }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Winners Bracket -->
        <v-tabs-window-item value="winners">
          <div class="bracket-container">
            <div class="bracket">
              <div
                v-for="round in winnersRounds"
                :key="`winners-${round}`"
                class="bracket-round"
              >
                <div class="round-header bg-success-darken-2">
                  <span class="text-overline text-white">
                    {{ getRoundName(round, 'winners', winnersRounds.length) }}
                  </span>
                </div>
                <div class="round-matches">
                  <div
                    v-for="match in winnersBracket[round]"
                    :key="match.id"
                    class="bracket-match"
                  >
                    <v-card
                      :color="getMatchStatusColor(match.status)"
                      variant="outlined"
                      class="match-card"
                    >
                      <div class="match-number text-caption">
                        #{{ match.matchNumber }}
                        <v-chip
                          :color="getMatchStatusColor(match.status)"
                          size="x-small"
                          class="ml-1"
                        >
                          {{ match.status }}
                        </v-chip>
                      </div>
                      <div
                        class="participant"
                        :class="{
                          winner: isWinner(match, match.participant1Id),
                          tbd: isSlotTbd(match, 'participant1'),
                          bye: isSlotBye(match, 'participant1'),
                        }"
                      >
                        <span class="participant-name">
                          {{ getParticipantDisplayName(match, 'participant1') }}
                        </span>
                      </div>
                      <v-divider />
                      <div
                        class="participant"
                        :class="{
                          winner: isWinner(match, match.participant2Id),
                          tbd: isSlotTbd(match, 'participant2'),
                          bye: isSlotBye(match, 'participant2'),
                        }"
                      >
                        <span class="participant-name">
                          {{ getParticipantDisplayName(match, 'participant2') }}
                        </span>
                      </div>
                    </v-card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </v-tabs-window-item>

        <!-- Losers Bracket -->
        <v-tabs-window-item value="losers">
          <div class="bracket-container">
            <div
              v-if="losersRounds.length === 0"
              class="text-center py-8 text-grey"
            >
              No losers bracket matches yet
            </div>
            <div
              v-else
              class="bracket"
            >
              <div
                v-for="round in losersRounds"
                :key="`losers-${round}`"
                class="bracket-round"
              >
                <div class="round-header bg-error-darken-2">
                  <span class="text-overline text-white">
                    {{ getRoundName(round, 'losers', losersRounds.length) }}
                  </span>
                </div>
                <div class="round-matches">
                  <div
                    v-for="match in losersBracket[round]"
                    :key="match.id"
                    class="bracket-match"
                  >
                    <v-card
                      :color="getMatchStatusColor(match.status)"
                      variant="outlined"
                      class="match-card"
                    >
                      <div class="match-number text-caption">
                        #{{ match.matchNumber }}
                        <v-chip
                          :color="getMatchStatusColor(match.status)"
                          size="x-small"
                          class="ml-1"
                        >
                          {{ match.status }}
                        </v-chip>
                      </div>
                      <div
                        class="participant"
                        :class="{
                          winner: isWinner(match, match.participant1Id),
                          tbd: isSlotTbd(match, 'participant1'),
                          bye: isSlotBye(match, 'participant1'),
                        }"
                      >
                        <span class="participant-name">
                          {{ getParticipantDisplayName(match, 'participant1') }}
                        </span>
                      </div>
                      <v-divider />
                      <div
                        class="participant"
                        :class="{
                          winner: isWinner(match, match.participant2Id),
                          tbd: isSlotTbd(match, 'participant2'),
                          bye: isSlotBye(match, 'participant2'),
                        }"
                      >
                        <span class="participant-name">
                          {{ getParticipantDisplayName(match, 'participant2') }}
                        </span>
                      </div>
                    </v-card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </v-tabs-window-item>

        <!-- Grand Finals -->
        <v-tabs-window-item value="finals">
          <div class="finals-container pa-4">
            <v-row justify="center">
              <v-col
                v-for="match in finalsMatches"
                :key="match.id"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card
                  :color="getMatchStatusColor(match.status)"
                  variant="outlined"
                  class="finals-match"
                >
                  <v-card-title class="text-center">
                    <v-icon start>
                      mdi-trophy-award
                    </v-icon>
                    {{ match.bracketPosition?.round === 1 ? 'Grand Finals' : 'Grand Finals Reset' }}
                  </v-card-title>
                  <v-card-text>
                    <div class="text-caption text-grey text-center mb-2">
                      Match #{{ match.matchNumber }}
                      <v-chip
                        :color="getMatchStatusColor(match.status)"
                        size="x-small"
                        class="ml-1"
                      >
                        {{ match.status }}
                      </v-chip>
                    </div>
                    <div
                      class="participant finals-participant"
                      :class="{
                        winner: isWinner(match, match.participant1Id),
                        tbd: isSlotTbd(match, 'participant1'),
                        bye: isSlotBye(match, 'participant1'),
                      }"
                    >
                      <v-icon
                        v-if="isWinner(match, match.participant1Id)"
                        color="warning"
                        start
                      >
                        mdi-crown
                      </v-icon>
                      <span>{{ getParticipantDisplayName(match, 'participant1') }}</span>
                      <v-chip
                        size="x-small"
                        variant="tonal"
                        color="success"
                        class="ml-2"
                      >
                        Winners
                      </v-chip>
                    </div>
                    <div class="text-center my-2 text-grey">
                      VS
                    </div>
                    <div
                      class="participant finals-participant"
                      :class="{
                        winner: isWinner(match, match.participant2Id),
                        tbd: isSlotTbd(match, 'participant2'),
                        bye: isSlotBye(match, 'participant2'),
                      }"
                    >
                      <v-icon
                        v-if="isWinner(match, match.participant2Id)"
                        color="warning"
                        start
                      >
                        mdi-crown
                      </v-icon>
                      <span>{{ getParticipantDisplayName(match, 'participant2') }}</span>
                      <v-chip
                        size="x-small"
                        variant="tonal"
                        color="error"
                        class="ml-2"
                      >
                        Losers
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
  </div>
</template>

<style scoped>
.bracket-container {
  overflow-x: auto;
  padding: 16px;
}

.bracket {
  display: flex;
  gap: 32px;
  min-width: max-content;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  min-width: 220px;
}

.round-header {
  text-align: center;
  padding: 8px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.round-matches {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex: 1;
  gap: 12px;
}

.bracket-match {
  position: relative;
}

.match-card {
  padding: 8px;
}

.match-number {
  text-align: right;
  margin-bottom: 4px;
}

.participant {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
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
}

.finals-match {
  max-width: 400px;
  margin: 0 auto;
}

.finals-participant {
  padding: 12px;
  text-align: center;
  justify-content: center;
}
</style>
