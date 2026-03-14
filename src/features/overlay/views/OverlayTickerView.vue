<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import type { GameScore, Match } from '@/types';
import '../overlay.css';

interface TickerItem {
  key: string;
  courtName: string;
  state: 'live' | 'ready' | 'idle';
  participant1Name?: string;
  participant2Name?: string;
  score1?: number;
  score2?: number;
  gameNumber?: number;
}

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const speed = computed(() => route.query.speed as string | undefined);
const tournament = computed(() => tournamentStore.currentTournament);
const tournamentName = computed(() => tournament.value?.name?.trim() || 'Tournament');
const tournamentInitials = computed(() => (
  tournamentName.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() || '')
    .join('') || 'TM'
));
const { tournamentLogoUrl } = useTournamentBranding(tournament);

const scrollDuration = computed(() => {
  if (speed.value === 'slow') return 90;
  if (speed.value === 'fast') return 30;
  return 60;
});

const getCurrentGame = (match: Match): GameScore => {
  if (match.scores.length === 0) {
    return {
      gameNumber: 1,
      score1: 0,
      score2: 0,
      isComplete: false,
    };
  }
  return match.scores[match.scores.length - 1];
};

const tickerItems = computed<TickerItem[]>(() => {
  if (tournamentStore.courts.length === 0) {
    return [
      {
        key: 'no-courts',
        courtName: 'No Courts Configured',
        state: 'idle',
      },
    ];
  }

  return tournamentStore.courts.map((court) => {
    const liveMatch = matchStore.matches.find(
      (match) => match.courtId === court.id && match.status === 'in_progress'
    );

    if (liveMatch) {
      const currentGame = getCurrentGame(liveMatch);
      return {
        key: `live-${court.id}-${liveMatch.id}`,
        courtName: court.name,
        state: 'live',
        participant1Name: getParticipantName(liveMatch.participant1Id),
        participant2Name: getParticipantName(liveMatch.participant2Id),
        score1: currentGame.score1,
        score2: currentGame.score2,
        gameNumber: currentGame.gameNumber || 1,
      };
    }

    const readyMatch = matchStore.matches.find(
      (match) => match.courtId === court.id && match.status === 'ready'
    );

    if (readyMatch) {
      return {
        key: `ready-${court.id}-${readyMatch.id}`,
        courtName: court.name,
        state: 'ready',
        participant1Name: getParticipantName(readyMatch.participant1Id),
        participant2Name: getParticipantName(readyMatch.participant2Id),
      };
    }

    return {
      key: `idle-${court.id}`,
      courtName: court.name,
      state: 'idle',
    };
  });
});

const duplicatedTickerItems = computed(() => [...tickerItems.value, ...tickerItems.value]);

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
  <div class="overlay-ticker-canvas">
    <div class="overlay-ticker-bar">
      <div class="overlay-ticker-badge">
        <div class="overlay-ticker-badge__mark">
          <img
            v-if="tournamentLogoUrl"
            :src="tournamentLogoUrl"
            :alt="`${tournamentName} logo`"
            class="overlay-ticker-badge__logo"
          >
          <span
            v-else
            class="overlay-ticker-badge__fallback"
          >
            {{ tournamentInitials }}
          </span>
        </div>
        <div class="overlay-ticker-badge__copy">
          <span class="overlay-ticker-badge__event">{{ tournamentName }}</span>
          <span class="overlay-ticker-badge__state">Live Feed</span>
        </div>
      </div>
      <div class="overlay-ticker-track-wrap">
        <div
          class="overlay-ticker-track"
          :style="{ '--ticker-duration': `${scrollDuration}s` }"
        >
          <div
            v-for="(item, index) in duplicatedTickerItems"
            :key="`${item.key}-${index}`"
            class="overlay-ticker-item"
            :class="{ 'overlay-idle': item.state === 'idle' }"
          >
            <template v-if="item.state === 'live'">
              <span class="live-dot" />
              <span class="overlay-ticker-court">{{ item.courtName }}</span>
              <span class="overlay-ticker-player">{{ item.participant1Name }}</span>
              <span class="overlay-ticker-score overlay-score">
                {{ item.score1 }} <span class="overlay-ticker-dot">·</span> {{ item.score2 }}
              </span>
              <span class="overlay-ticker-player">{{ item.participant2Name }}</span>
              <span class="overlay-ticker-game">G{{ item.gameNumber }}</span>
              <span class="overlay-ticker-live-badge">LIVE</span>
            </template>

            <template v-else-if="item.state === 'ready'">
              <span class="overlay-ticker-court">{{ item.courtName }}</span>
              <span class="overlay-ticker-player">{{ item.participant1Name }}</span>
              <span class="overlay-ticker-vs">vs</span>
              <span class="overlay-ticker-player">{{ item.participant2Name }}</span>
              <span class="overlay-ticker-ready-badge">UP NEXT</span>
            </template>

            <template v-else>
              <span class="overlay-ticker-court">{{ item.courtName }}</span>
              <span class="overlay-ticker-idle-text">IDLE</span>
            </template>

            <span class="overlay-ticker-separator">│</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay-ticker-canvas {
  position: fixed;
  inset: 0;
  width: 1920px;
  height: 1080px;
  pointer-events: none;
  /* Scale down for browser preview - OBS ignores this */
  transform-origin: top left;
  transform: scale(calc(100vw / 1920));
}

@media screen and (max-width: 1920px) {
  .overlay-ticker-canvas {
    transform: scale(calc(100vw / 1920));
  }
}

.overlay-ticker-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 1920px;
  height: 72px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.88);
  border-top: 3px solid rgba(126, 217, 87, 0.7);
  overflow: hidden;
}

.overlay-ticker-badge {
  flex: 0 0 auto;
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-right: 1px solid rgba(255, 255, 255, 0.22);
  min-width: 296px;
}

.overlay-ticker-badge__mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.overlay-ticker-badge__logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.98);
}

.overlay-ticker-badge__fallback {
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ffffff;
  text-transform: uppercase;
}

.overlay-ticker-badge__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.overlay-ticker-badge__event {
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.overlay-ticker-badge__state {
  color: #7ed957;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.overlay-ticker-track-wrap {
  flex: 1;
  overflow: hidden;
}

.overlay-ticker-track {
  width: max-content;
  min-width: 100%;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  animation: overlay-ticker-scroll var(--ticker-duration, 60s) linear infinite;
}

.overlay-ticker-item {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 0 20px;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.overlay-ticker-court {
  color: #7ed957;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 800;
  font-size: 1.05rem;
}

.overlay-ticker-player {
  color: #ffffff;
  font-weight: 700;
}

.overlay-ticker-score {
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 900;
}

.overlay-ticker-dot {
  opacity: 0.7;
}

.overlay-ticker-game {
  color: rgba(255, 255, 255, 0.76);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.overlay-ticker-live-badge {
  color: #4caf50;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  font-size: 0.75rem;
}

.overlay-ticker-ready-badge {
  color: rgba(255, 193, 7, 0.92);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

.overlay-ticker-vs {
  color: rgba(255, 255, 255, 0.65);
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.07em;
}

.overlay-ticker-idle-text {
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.overlay-ticker-separator {
  color: rgba(255, 255, 255, 0.44);
}

@keyframes overlay-ticker-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
</style>
