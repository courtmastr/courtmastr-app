<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useMatchScopeLabels } from '@/composables/useMatchScopeLabels';
import { buildGlobalMatchKey } from '@/features/tournaments/utils/matchDisplayIdentity';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Court, Match, GameScore } from '@/types';

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const loading = ref(true);

const tournament = computed(() => tournamentStore.currentTournament);
const courts = computed(() => tournamentStore.courts);
const { getMatchScopeLabel } = useMatchScopeLabels(
  tournamentId,
  computed(() => matchStore.matches),
);

// Mirror CourtGrid's source-of-truth: iterate physical courts, find their in-progress match.
// This prevents showing stale/orphaned in_progress matches that have no assigned court.
const activeCourts = computed(() =>
  [...courts.value]
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .map((court) => ({
      court,
      match: matchStore.matches.find(
        (m) => m.courtId === court.id && m.status === 'in_progress',
      ),
    }))
    .filter((entry) => entry.match !== undefined) as { court: Court; match: Match }[]
);

const readyMatches = computed(() =>
  matchStore.matches.filter((m) => m.status === 'ready' && !m.courtId).slice(0, 5)
);

function getParticipant1Name(match: Match): string {
  return getParticipantName(match.participant1Id);
}

function getParticipant2Name(match: Match): string {
  return getParticipantName(match.participant2Id);
}

function getCurrentGame(match: Match): GameScore {
  if (!match.scores?.length) {
    return { score1: 0, score2: 0, gameNumber: 1, isComplete: false };
  }
  const incompleteGame = match.scores.find((s) => !s.isComplete);
  if (incompleteGame) {
    return incompleteGame;
  }
  return match.scores[match.scores.length - 1];
}

function getGamesWon(match: Match, participantId: string | undefined): number {
  if (!match.scores?.length || !participantId) return 0;
  return match.scores.filter((s) => s.isComplete && s.winnerId === participantId).length;
}

function getCategoryName(categoryId: string): string {
  const category = tournamentStore.categories.find((c) => c.id === categoryId);
  return category?.name ?? 'Match';
}

function getMatchMetaLabel(match: Match): string {
  const scopeLabel = getMatchScopeLabel(match);
  return scopeLabel ? `${getCategoryName(match.categoryId)} · ${scopeLabel}` : getCategoryName(match.categoryId);
}


onMounted(async () => {
  try {
    loading.value = true;
    await tournamentStore.fetchTournament(tournamentId.value);
    tournamentStore.subscribeTournament(tournamentId.value);
    matchStore.subscribeAllMatches(tournamentId.value);
    registrationStore.subscribeRegistrations(tournamentId.value);
    registrationStore.subscribePlayers(tournamentId.value);
  } catch (err) {
    console.error('Error loading live scoreboard:', err);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <v-container
    fluid
    class="pa-4"
  >
    <!-- Page header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold">
          {{ tournament?.name ?? 'Live Scores' }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          <v-icon
            icon="mdi-circle"
            size="10"
            color="success"
            class="mr-1"
          />
          {{ activeCourts.length }}
          {{ activeCourts.length === 1 ? 'Live Match' : 'Live Matches' }}
          <span v-if="readyMatches.length">
            &nbsp;&middot;&nbsp;{{ readyMatches.length }} Up Next
          </span>
        </p>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="d-flex justify-center align-center py-12"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="48"
      />
    </div>

    <template v-else>
      <!-- In Progress section -->
      <template v-if="activeCourts.length > 0">
        <div class="d-flex align-center mb-3">
          <v-chip
            color="success"
            size="small"
            variant="flat"
            class="mr-2"
          >
            LIVE
          </v-chip>
          <span class="text-subtitle-2 text-medium-emphasis">In Progress</span>
        </div>

        <v-row>
          <v-col
            v-for="{ court, match } in activeCourts"
            :key="`live-${court.id}`"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card
              class="bg-surface"
              rounded="lg"
              border
            >
              <v-card-text class="pa-4">
                <!-- Court & category header -->
                <div class="d-flex justify-space-between align-center mb-3">
                  <div>
                    <div class="d-flex align-center text-subtitle-2 font-weight-bold mb-1">
                      <v-icon
                        icon="mdi-badminton"
                        size="14"
                        class="mr-1 text-medium-emphasis"
                      />
                      Court {{ court.number }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ getMatchMetaLabel(match) }}
                    </div>
                  </div>
                  <v-chip
                    color="success"
                    size="x-small"
                    variant="tonal"
                  >
                    LIVE
                  </v-chip>
                </div>

                <!-- Player 1 -->
                <div class="d-flex justify-space-between align-center py-2">
                  <span class="text-body-2 font-weight-medium">
                    {{ getParticipant1Name(match) }}
                  </span>
                  <div class="d-flex align-center gap-2">
                    <span class="text-caption text-medium-emphasis mr-2">
                      {{ getGamesWon(match, match.participant1Id) }}
                    </span>
                    <span class="text-h6 font-weight-bold text-success min-w-score">
                      {{ getCurrentGame(match).score1 }}
                    </span>
                  </div>
                </div>

                <v-divider />

                <!-- Player 2 -->
                <div class="d-flex justify-space-between align-center py-2">
                  <span class="text-body-2 font-weight-medium">
                    {{ getParticipant2Name(match) }}
                  </span>
                  <div class="d-flex align-center gap-2">
                    <span class="text-caption text-medium-emphasis mr-2">
                      {{ getGamesWon(match, match.participant2Id) }}
                    </span>
                    <span class="text-h6 font-weight-bold text-success min-w-score">
                      {{ getCurrentGame(match).score2 }}
                    </span>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>

      <!-- Empty state -->
      <v-card
        v-else
        class="bg-surface text-center py-12"
        rounded="lg"
        border
      >
        <v-icon
          icon="mdi-scoreboard-outline"
          size="48"
          color="medium-emphasis"
          class="mb-4"
        />
        <p class="text-body-1 text-medium-emphasis">No live matches right now</p>
        <p class="text-body-2 text-disabled mt-1">
          Matches will appear here once they are started
        </p>
      </v-card>

      <!-- Up Next section -->
      <template v-if="readyMatches.length > 0">
        <div class="d-flex align-center mt-6 mb-3">
          <v-icon
            icon="mdi-clock-outline"
            size="16"
            class="mr-2 text-medium-emphasis"
          />
          <span class="text-subtitle-2 text-medium-emphasis">Up Next</span>
        </div>

        <v-row>
          <v-col
            v-for="match in readyMatches"
            :key="`ready-${buildGlobalMatchKey(match)}`"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card
              class="bg-surface"
              rounded="lg"
              border
              :opacity="0.7"
            >
              <v-card-text class="pa-4">
                <div class="mb-2">
                  <span class="text-caption font-weight-medium">
                    {{ getMatchMetaLabel(match) }}
                  </span>
                </div>
                <div class="text-body-2 font-weight-medium">
                  {{ getParticipant1Name(match) }}
                </div>
                <div class="text-caption text-medium-emphasis my-1">vs</div>
                <div class="text-body-2 font-weight-medium">
                  {{ getParticipant2Name(match) }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </template>
  </v-container>
</template>

<style scoped>
.min-w-score {
  min-width: 2rem;
  text-align: right;
}
</style>
