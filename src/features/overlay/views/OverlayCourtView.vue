<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { GameScore, Match } from '@/types';
import '../overlay.css';

type TileState = 'live' | 'ready' | 'idle';

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const courtId = computed(() => route.params.courtId as string);

const court = computed(() =>
  tournamentStore.courts.find((item) => item.id === courtId.value) ?? null
);

const courtName = computed(() => court.value?.name ?? 'Court');

const liveMatch = computed<Match | null>(() =>
  matchStore.matches.find(
    (match) => match.courtId === courtId.value && match.status === 'in_progress'
  ) ?? null
);

const readyMatch = computed<Match | null>(() =>
  matchStore.matches.find(
    (match) => match.courtId === courtId.value && match.status === 'ready'
  ) ?? null
);

const tileState = computed<TileState>(() => {
  if (liveMatch.value) return 'live';
  if (readyMatch.value) return 'ready';
  return 'idle';
});

const displayMatch = computed<Match | null>(() => liveMatch.value ?? readyMatch.value);

const categoryName = computed(() => {
  const match = displayMatch.value;
  if (!match) return '';
  return tournamentStore.categories.find((category) => category.id === match.categoryId)?.name ?? 'Match';
});

const participant1Name = computed(() =>
  getParticipantName(displayMatch.value?.participant1Id)
);

const participant2Name = computed(() =>
  getParticipantName(displayMatch.value?.participant2Id)
);

const currentGame = computed<GameScore>(() => {
  const match = liveMatch.value;
  if (!match || match.scores.length === 0) {
    return {
      gameNumber: 1,
      score1: 0,
      score2: 0,
      isComplete: false,
    };
  }
  return match.scores[match.scores.length - 1];
});

const gamesWon = computed(() => {
  const match = liveMatch.value;
  if (!match) {
    return { participant1Games: 0, participant2Games: 0 };
  }

  let participant1Games = 0;
  let participant2Games = 0;

  for (const game of match.scores) {
    if (!game.isComplete) continue;
    if (game.winnerId === match.participant1Id) {
      participant1Games++;
    } else if (game.winnerId === match.participant2Id) {
      participant2Games++;
    }
  }

  return { participant1Games, participant2Games };
});

onMounted(async () => {
  document.documentElement.classList.add('overlay-page');
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

onUnmounted(() => {
  document.documentElement.classList.remove('overlay-page');
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <div class="overlay-court-canvas">
    <section
      class="overlay-tile overlay-court-tile"
      :class="{ 'overlay-idle': tileState === 'idle' }"
    >
      <header class="overlay-court-header">
        <span class="overlay-court-name">{{ courtName }}</span>
        <span class="overlay-court-category">{{ categoryName }}</span>
      </header>

      <template v-if="tileState === 'live'">
        <div class="overlay-score-grid">
          <div class="overlay-score-row">
            <span class="overlay-player-name">{{ participant1Name }}</span>
            <span class="overlay-games-won overlay-score">{{ gamesWon.participant1Games }}</span>
            <span class="overlay-live-points overlay-score">{{ currentGame.score1 }}</span>
          </div>
          <div class="overlay-score-row">
            <span class="overlay-player-name">{{ participant2Name }}</span>
            <span class="overlay-games-won overlay-score">{{ gamesWon.participant2Games }}</span>
            <span class="overlay-live-points overlay-score">{{ currentGame.score2 }}</span>
          </div>
        </div>
        <footer class="overlay-court-footer">
          <span>GAME {{ currentGame.gameNumber || 1 }}</span>
          <span class="overlay-live-indicator">
            <span class="live-dot" />
            LIVE
          </span>
        </footer>
      </template>

      <template v-else-if="tileState === 'ready'">
        <div class="overlay-up-next">
          <div class="overlay-up-next-player">
            {{ participant1Name }}
          </div>
          <div class="overlay-up-next-vs">
            vs
          </div>
          <div class="overlay-up-next-player">
            {{ participant2Name }}
          </div>
        </div>
        <footer class="overlay-court-footer">
          <span>UP NEXT</span>
          <span class="overlay-ready-badge">READY</span>
        </footer>
      </template>

      <template v-else>
        <div class="overlay-idle-body">
          IDLE
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.overlay-court-canvas {
  position: fixed;
  inset: 0;
  width: 1920px;
  height: 1080px;
  display: flex;
  align-items: flex-end;
  padding: 32px;
  box-sizing: border-box;
  pointer-events: none;
  /* Scale down for browser preview - OBS ignores this */
  transform-origin: top left;
  transform: scale(calc(100vw / 1920));
}

@media screen and (max-width: 1920px) {
  .overlay-court-canvas {
    transform: scale(calc(100vw / 1920));
  }
}

.overlay-court-tile {
  width: 380px;
  min-height: 212px;
  display: flex;
  flex-direction: column;
}

.overlay-court-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.overlay-court-name {
  color: #7ed957;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.95rem;
  font-weight: 800;
}

.overlay-court-category {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.8rem;
  white-space: nowrap;
}

.overlay-score-grid {
  padding: 10px 16px 6px;
}

.overlay-score-row {
  display: grid;
  grid-template-columns: 1fr 52px 82px;
  align-items: center;
  min-height: 52px;
}

.overlay-player-name {
  font-size: 1.02rem;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overlay-games-won {
  text-align: center;
  font-size: 1.35rem;
}

.overlay-live-points {
  text-align: right;
  font-size: 2rem;
  line-height: 1;
}

.overlay-court-footer {
  margin-top: auto;
  padding: 10px 16px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.overlay-live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #4caf50;
}

.overlay-up-next {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 16px 14px;
}

.overlay-up-next-player {
  font-size: 1.02rem;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overlay-up-next-vs {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.overlay-ready-badge {
  color: rgba(255, 193, 7, 0.9);
}

.overlay-idle-body {
  margin-top: 16px;
  padding: 24px 16px;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.6);
}
</style>
