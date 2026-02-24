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

// Get player initials from name
const getInitials = (name: string): string => {
  if (!name || name === 'Unknown') return '?';
  const parts = name.split(/[\s/]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  // For doubles: take first letter of first name and first letter of second name
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const player1Initials = computed(() => getInitials(participant1Name.value));
const player2Initials = computed(() => getInitials(participant2Name.value));

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
    <!-- BROADCAST STYLE SCOREBOARD - Top Center -->
    <div
      v-if="tileState === 'live'"
      class="broadcast-scoreboard"
    >
      <!-- Top Bar with Court and Category -->
      <div class="broadcast-header">
        <span class="broadcast-court">{{ courtName }}</span>
        <span class="broadcast-category">{{ categoryName }}</span>
        <span class="broadcast-live-badge">
          <span class="live-dot" />
          LIVE
        </span>
      </div>

      <!-- Main Score Area -->
      <div class="broadcast-body">
        <!-- Player 1 Section -->
        <div class="broadcast-player-section player-left">
          <div class="broadcast-player-info">
            <div class="broadcast-avatar">
              {{ player1Initials }}
            </div>
            <div class="broadcast-player-name">
              {{ participant1Name }}
            </div>
          </div>
        </div>

        <!-- Score Section -->
        <div class="broadcast-score-section">
          <div class="broadcast-games-row">
            <span class="broadcast-game">{{ gamesWon.participant1Games }}</span>
            <span class="broadcast-divider">-</span>
            <span class="broadcast-game">{{ gamesWon.participant2Games }}</span>
          </div>
          <div class="broadcast-points-row">
            <span class="broadcast-point">{{ currentGame.score1 }}</span>
            <span class="broadcast-divider">:</span>
            <span class="broadcast-point">{{ currentGame.score2 }}</span>
          </div>
        </div>

        <!-- Player 2 Section -->
        <div class="broadcast-player-section player-right">
          <div class="broadcast-player-info">
            <div class="broadcast-player-name">
              {{ participant2Name }}
            </div>
            <div class="broadcast-avatar">
              {{ player2Initials }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar with Game Info -->
      <div class="broadcast-footer">
        <span class="broadcast-game-info">GAME {{ currentGame.gameNumber || 1 }}</span>
      </div>
    </div>

    <!-- UP NEXT STATE -->
    <div
      v-else-if="tileState === 'ready'"
      class="broadcast-scoreboard up-next"
    >
      <div class="broadcast-header">
        <span class="broadcast-court">{{ courtName }}</span>
        <span class="broadcast-category">{{ categoryName }}</span>
      </div>
      <div class="broadcast-up-next-body">
        <div class="broadcast-up-next-players">
          <span class="broadcast-up-next-name">{{ participant1Name }}</span>
          <span class="broadcast-up-next-vs">VS</span>
          <span class="broadcast-up-next-name">{{ participant2Name }}</span>
        </div>
        <div class="broadcast-up-next-badge">UP NEXT</div>
      </div>
    </div>

    <!-- IDLE STATE -->
    <div
      v-else
      class="broadcast-scoreboard idle"
    >
      <div class="broadcast-header">
        <span class="broadcast-court">{{ courtName }}</span>
      </div>
      <div class="broadcast-idle-body">
        <span class="broadcast-idle-text">IDLE</span>
        <span class="broadcast-idle-subtext">Waiting for match</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay-court-canvas {
  position: fixed;
  inset: 0;
  width: 1920px;
  height: 1080px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px 40px;
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

/* BROADCAST STYLE SCOREBOARD */
.broadcast-scoreboard {
  background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
  border-radius: 8px;
  box-shadow: 0 3px 15px rgba(0, 0, 0, 0.12), 0 1px 6px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  min-width: 480px;
  max-width: 750px;
  transform: scale(0.85);
  transform-origin: top center;
}

.broadcast-scoreboard.up-next {
  background: linear-gradient(180deg, #fff8e1 0%, #ffecb3 100%);
}

.broadcast-scoreboard.idle {
  background: linear-gradient(180deg, #eceff1 0%, #cfd8dc 100%);
  opacity: 0.9;
}

/* Header */
.broadcast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: linear-gradient(90deg, #1a237e 0%, #283593 100%);
  color: white;
}

.broadcast-court {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7ed957;
}

.broadcast-category {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.broadcast-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #4caf50;
  text-transform: uppercase;
}

.broadcast-live-badge .live-dot {
  width: 6px;
  height: 6px;
  background: #4caf50;
  border-radius: 50%;
  animation: live-pulse 1.2s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

/* Body */
.broadcast-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  gap: 25px;
}

/* Player Sections */
.broadcast-player-section {
  flex: 1;
  display: flex;
  align-items: center;
}

.broadcast-player-section.player-left {
  justify-content: flex-end;
}

.broadcast-player-section.player-right {
  justify-content: flex-start;
}

.broadcast-player-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.broadcast-avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.broadcast-player-name {
  font-size: 1rem;
  font-weight: 700;
  color: #212121;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Score Section */
.broadcast-score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%);
  padding: 10px 30px;
  border-radius: 6px;
  border: 2px solid #e0e0e0;
  flex-shrink: 0;
}

.broadcast-games-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #424242;
}

.broadcast-game {
  font-variant-numeric: tabular-nums;
  min-width: 24px;
  text-align: center;
}

.broadcast-divider {
  color: #9e9e9e;
  font-weight: 500;
}

.broadcast-points-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 2.2rem;
  font-weight: 900;
  color: #1a237e;
}

.broadcast-point {
  font-variant-numeric: tabular-nums;
  min-width: 45px;
  text-align: center;
  line-height: 1;
}

/* Footer */
.broadcast-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 16px;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
}

.broadcast-game-info {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #616161;
  text-transform: uppercase;
}

/* UP NEXT STATE */
.broadcast-up-next-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 40px;
  gap: 20px;
}

.broadcast-up-next-players {
  display: flex;
  align-items: center;
  gap: 25px;
}

.broadcast-up-next-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #212121;
  text-transform: uppercase;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.broadcast-up-next-vs {
  font-size: 1.2rem;
  font-weight: 800;
  color: #ff8f00;
  letter-spacing: 0.1em;
}

.broadcast-up-next-badge {
  background: linear-gradient(90deg, #ff8f00 0%, #ff6f00 100%);
  color: white;
  padding: 10px 30px;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(255, 143, 0, 0.3);
}

/* IDLE STATE */
.broadcast-idle-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  gap: 10px;
}

.broadcast-idle-text {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #78909c;
  text-transform: uppercase;
}

.broadcast-idle-subtext {
  font-size: 1rem;
  color: #90a4ae;
  font-weight: 600;
}
</style>
