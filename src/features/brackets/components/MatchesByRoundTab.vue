<script setup lang="ts">
import { computed } from 'vue';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match } from '@/types';

const props = defineProps<{
  matches: Match[];
}>();

const { getParticipantName } = useParticipantResolver();
const { getMatchStatusColor } = useMatchDisplay();

const matchesByRound = computed(() => {
  const rounds: Record<number, Match[]> = {};
  for (const match of props.matches) {
    if (!rounds[match.round]) rounds[match.round] = [];
    rounds[match.round].push(match);
  }
  return rounds;
});

const rounds = computed(() =>
  Object.keys(matchesByRound.value).map(Number).sort((a, b) => a - b)
);

function getMatchScore(match: Match): string {
  if (match.scores.length === 0) return '-';
  return match.scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
}
</script>

<template>
  <div class="matches-by-round-tab">
    <div
      v-if="matches.length === 0"
      class="text-center py-8"
    >
      <v-icon
        size="64"
        color="grey-lighten-1"
      >
        mdi-calendar-blank
      </v-icon>
      <p class="text-body-1 text-grey mt-4">
        No matches yet
      </p>
    </div>

    <v-expansion-panels
      v-else
      variant="accordion"
    >
      <v-expansion-panel
        v-for="round in rounds"
        :key="round"
        :title="`Round ${round}`"
      >
        <template #text>
          <v-list density="compact">
            <v-list-item
              v-for="match in matchesByRound[round]"
              :key="match.id"
              class="match-item"
            >
              <template #prepend>
                <v-chip
                  :color="getMatchStatusColor(match.status)"
                  size="small"
                  class="mr-3"
                >
                  #{{ match.matchNumber }}
                </v-chip>
              </template>

              <v-list-item-title class="d-flex align-center">
                <span
                  class="participant-name"
                  :class="{ 'font-weight-bold text-success': match.winnerId === match.participant1Id }"
                >
                  {{ getParticipantName(match.participant1Id) }}
                </span>
                <span class="mx-3 text-grey">vs</span>
                <span
                  class="participant-name"
                  :class="{ 'font-weight-bold text-success': match.winnerId === match.participant2Id }"
                >
                  {{ getParticipantName(match.participant2Id) }}
                </span>
              </v-list-item-title>

              <template #append>
                <v-chip
                  v-if="match.status === 'completed'"
                  variant="tonal"
                  size="small"
                >
                  {{ getMatchScore(match) }}
                </v-chip>
                <v-chip
                  v-else
                  :color="getMatchStatusColor(match.status)"
                  variant="tonal"
                  size="small"
                >
                  {{ match.status }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<style scoped>
.match-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.participant-name {
  min-width: 150px;
}
</style>
