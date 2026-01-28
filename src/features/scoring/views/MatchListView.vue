<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';

const route = useRoute();
const router = useRouter();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const readyMatches = computed(() => matchStore.readyMatches);
const inProgressMatches = computed(() => matchStore.inProgressMatches);
const scheduledMatches = computed(() => matchStore.scheduledMatches);
const courts = computed(() => tournamentStore.courts);

onMounted(async () => {
  if (!tournament.value) {
    await tournamentStore.fetchTournament(tournamentId.value);
  }
  matchStore.subscribeMatches(tournamentId.value);
  await registrationStore.fetchPlayers(tournamentId.value);
});

onUnmounted(() => {
  matchStore.unsubscribeAll();
});

function getParticipantName(participantId: string | undefined): string {
  if (!participantId) return 'TBD';
  const player = registrationStore.getPlayerById(participantId);
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
}

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return 'Not assigned';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Unknown';
}

function goToScoring(matchId: string) {
  router.push(`/tournaments/${tournamentId.value}/matches/${matchId}/score`);
}
</script>

<template>
  <v-container>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.back()" />
      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">Matches</h1>
        <p class="text-body-2 text-grey">{{ tournament?.name }}</p>
      </div>
    </div>

    <!-- In Progress Matches -->
    <v-card class="mb-4" v-if="inProgressMatches.length > 0">
      <v-card-title>
        <v-icon start color="success">mdi-play-circle</v-icon>
        In Progress
        <v-chip size="small" color="success" class="ml-2">{{ inProgressMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in inProgressMatches"
          :key="match.id"
          @click="goToScoring(match.id)"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="success" size="40">
              <span class="text-body-2">{{ match.matchNumber }}</span>
            </v-avatar>
          </template>

          <v-list-item-title>
            {{ getParticipantName(match.participant1Id) }}
            <span class="text-grey mx-2">vs</span>
            {{ getParticipantName(match.participant2Id) }}
          </v-list-item-title>

          <v-list-item-subtitle>
            {{ getCourtName(match.courtId) }} | Round {{ match.round }}
            <span v-if="match.scores.length > 0" class="ml-2">
              Score: {{ match.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-btn color="success" variant="tonal" size="small">
              Score
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Ready Matches -->
    <v-card class="mb-4" v-if="readyMatches.length > 0">
      <v-card-title>
        <v-icon start color="warning">mdi-clock-outline</v-icon>
        Ready to Play
        <v-chip size="small" color="warning" class="ml-2">{{ readyMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in readyMatches"
          :key="match.id"
          @click="goToScoring(match.id)"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="warning" size="40">
              <span class="text-body-2">{{ match.matchNumber }}</span>
            </v-avatar>
          </template>

          <v-list-item-title>
            {{ getParticipantName(match.participant1Id) }}
            <span class="text-grey mx-2">vs</span>
            {{ getParticipantName(match.participant2Id) }}
          </v-list-item-title>

          <v-list-item-subtitle>
            {{ getCourtName(match.courtId) }} | Round {{ match.round }}
          </v-list-item-subtitle>

          <template #append>
            <v-btn color="warning" variant="tonal" size="small">
              Start
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Scheduled Matches -->
    <v-card class="mb-4" v-if="scheduledMatches.length > 0">
      <v-card-title>
        <v-icon start color="info">mdi-calendar-clock</v-icon>
        Scheduled
        <v-chip size="small" color="info" class="ml-2">{{ scheduledMatches.length }}</v-chip>
      </v-card-title>
      <v-list>
        <v-list-item
          v-for="match in scheduledMatches"
          :key="match.id"
          class="match-item"
        >
          <template #prepend>
            <v-avatar color="info" size="40">
              <span class="text-body-2">{{ match.matchNumber }}</span>
            </v-avatar>
          </template>

          <v-list-item-title>
            {{ getParticipantName(match.participant1Id) }}
            <span class="text-grey mx-2">vs</span>
            {{ getParticipantName(match.participant2Id) }}
          </v-list-item-title>

          <v-list-item-subtitle>
            Round {{ match.round }}
            <span v-if="match.scheduledTime" class="ml-2">
               | {{ new Date(match.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
            </span>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Empty State -->
    <v-card v-if="inProgressMatches.length === 0 && readyMatches.length === 0 && scheduledMatches.length === 0" class="text-center py-12">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <h3 class="text-h6 mt-4">No matches available</h3>
      <p class="text-body-2 text-grey mt-2">
        There are no matches ready to be scored at this time.
      </p>
    </v-card>
  </v-container>
</template>

<style scoped>
.match-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.match-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
