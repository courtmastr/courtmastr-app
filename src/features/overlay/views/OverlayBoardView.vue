<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Court, GameScore, Match } from '@/types';
import '../overlay.css';

interface CourtCardState {
  court: Court;
  liveMatch: Match | null;
  readyMatch: Match | null;
}

const COURTS_PER_PAGE = 6;
const CAROUSEL_INTERVAL_MS = 8000;

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const speed = computed(() => route.query.speed as string | undefined);

const carouselPage = ref(0);
const now = ref(new Date());

let carouselInterval: ReturnType<typeof setInterval> | null = null;
let clockInterval: ReturnType<typeof setInterval> | null = null;

const scrollDuration = computed(() => {
  if (speed.value === 'slow') return 90;
  if (speed.value === 'fast') return 30;
  return 60;
});

const shouldUseCarousel = computed(() => tournamentStore.courts.length > COURTS_PER_PAGE);
const totalCourtPages = computed(() =>
  Math.max(1, Math.ceil(tournamentStore.courts.length / COURTS_PER_PAGE))
);

const visibleCourts = computed<Court[]>(() => {
  if (!shouldUseCarousel.value) {
    return tournamentStore.courts;
  }
  const start = carouselPage.value * COURTS_PER_PAGE;
  return tournamentStore.courts.slice(start, start + COURTS_PER_PAGE);
});

const courtGridColumns = computed(() => {
  if (tournamentStore.courts.length <= 4) return 2;
  return 3;
});

const getLiveMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'in_progress'
  ) ?? null;

const getReadyMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'ready'
  ) ?? null;

const visibleCourtStates = computed<CourtCardState[]>(() =>
  visibleCourts.value.map((court) => ({
    court,
    liveMatch: getLiveMatchOnCourt(court.id),
    readyMatch: getReadyMatchOnCourt(court.id),
  }))
);

const getCategoryName = (match: Match | null): string => {
  if (!match) return '';
  return tournamentStore.categories.find((category) => category.id === match.categoryId)?.name ?? 'Match';
};

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

const getGamesWon = (
  match: Match,
  participantId: string | undefined
): number => {
  if (!participantId) return 0;
  return match.scores.reduce((count, game) => {
    if (!game.isComplete) return count;
    return game.winnerId === participantId ? count + 1 : count;
  }, 0);
};

const upNextMatches = computed<Match[]>(() =>
  matchStore.matches
    .filter((match) => match.status === 'ready' || match.status === 'scheduled')
    .sort((a, b) => {
      const aTime = a.plannedStartAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.plannedStartAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime !== bTime ? aTime - bTime : a.matchNumber - b.matchNumber;
    })
    .slice(0, 6)
);

const recentResults = computed<Match[]>(() =>
  matchStore.matches
    .filter((match) => match.status === 'completed' || match.status === 'walkover')
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 5)
);

const totalMatches = computed(() => matchStore.matches.length);
const completedMatches = computed(() =>
  matchStore.matches.filter(
    (match) => match.status === 'completed' || match.status === 'walkover'
  ).length
);
const liveMatches = computed(() =>
  matchStore.matches.filter((match) => match.status === 'in_progress').length
);
const progressPercent = computed(() => {
  if (totalMatches.value === 0) return 0;
  return Math.round((completedMatches.value / totalMatches.value) * 100);
});

function getResultString(match: Match): string {
  return match.scores
    .filter((game) => game.isComplete)
    .map((game) => `${game.score1}-${game.score2}`)
    .join(', ');
}

const getWinnerName = (match: Match): string => {
  if (match.winnerId) {
    return getParticipantName(match.winnerId);
  }
  return 'Winner TBD';
};

const getLoserName = (match: Match): string => {
  if (match.winnerId === match.participant1Id) {
    return getParticipantName(match.participant2Id);
  }
  if (match.winnerId === match.participant2Id) {
    return getParticipantName(match.participant1Id);
  }
  return 'Opponent';
};

const footerTickerItems = computed<string[]>(() => {
  const courtsWithLiveMatch = tournamentStore.courts
    .map((court) => ({
      court,
      match: getLiveMatchOnCourt(court.id),
    }))
    .filter((entry): entry is { court: Court; match: Match } => entry.match !== null);

  const liveItems = courtsWithLiveMatch.map(({ court, match }) => {
    const currentGame = getCurrentGame(match);
    const participant1Name = getParticipantName(match.participant1Id);
    const participant2Name = getParticipantName(match.participant2Id);
    return `${court.name}: ${participant1Name} ${currentGame.score1} · ${currentGame.score2} ${participant2Name}  G${currentGame.gameNumber || 1} LIVE`;
  });

  const resultItems = recentResults.value
    .slice(0, 3)
    .map((match) => `RESULT: ${getWinnerName(match)} wins · ${getResultString(match) || 'Walkover'}`);

  const items = [...liveItems, ...resultItems];
  return items.length > 0 ? items : ['Waiting for live match data'];
});

const duplicatedFooterTickerItems = computed(() => [
  ...footerTickerItems.value,
  ...footerTickerItems.value,
]);

const clockLabel = computed(() =>
  now.value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
);

const formatPlannedTime = (match: Match): string => {
  if (!match.plannedStartAt) return '--:--';
  return match.plannedStartAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const stopCarousel = (): void => {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
};

const startCarousel = (): void => {
  stopCarousel();
  if (!shouldUseCarousel.value) {
    carouselPage.value = 0;
    return;
  }

  carouselInterval = setInterval(() => {
    carouselPage.value = (carouselPage.value + 1) % totalCourtPages.value;
  }, CAROUSEL_INTERVAL_MS);
};

const startClock = (): void => {
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  clockInterval = setInterval(() => {
    now.value = new Date();
  }, 1000);
};

const stopClock = (): void => {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
};

watch(
  () => tournamentStore.courts.length,
  () => {
    if (carouselPage.value >= totalCourtPages.value) {
      carouselPage.value = 0;
    }
    startCarousel();
  }
);

onMounted(async () => {
  document.documentElement.classList.add('overlay-page');
  startClock();
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  startCarousel();
});

onUnmounted(() => {
  document.documentElement.classList.remove('overlay-page');
  stopCarousel();
  stopClock();
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <div class="overlay-board-page">
    <header class="board-header">
      <div class="board-header-title">
        🏸 {{ tournamentStore.currentTournament?.name || 'Tournament Board' }}
      </div>
      <div class="board-header-meta">
        <span class="board-live-count">
          <span class="live-dot" />
          {{ liveMatches }} LIVE
        </span>
        <span class="board-complete-count">{{ completedMatches }}/{{ totalMatches }} complete</span>
        <div class="board-progress">
          <div
            class="board-progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <span class="board-clock">{{ clockLabel }}</span>
      </div>
    </header>

    <main class="board-body">
      <section class="board-courts">
        <div
          class="board-court-grid"
          :style="{ gridTemplateColumns: `repeat(${courtGridColumns}, minmax(0, 1fr))` }"
        >
          <article
            v-for="courtState in visibleCourtStates"
            :key="courtState.court.id"
            class="board-court-card"
            :class="{
              'board-court-card--live': courtState.liveMatch,
              'board-court-card--idle': !courtState.liveMatch && !courtState.readyMatch
            }"
          >
            <header class="board-court-card-header">
              <span class="board-court-name">{{ courtState.court.name }}</span>
              <span class="board-court-category">
                {{ getCategoryName(courtState.liveMatch ?? courtState.readyMatch) }}
              </span>
            </header>

            <template v-if="courtState.liveMatch">
              <div class="board-live-score">
                <div class="board-live-row">
                  <span class="board-player-name">
                    {{ getParticipantName(courtState.liveMatch.participant1Id) }}
                  </span>
                  <span class="board-games overlay-score">
                    {{ getGamesWon(courtState.liveMatch, courtState.liveMatch.participant1Id) }}
                  </span>
                  <span class="board-points overlay-score">
                    {{ getCurrentGame(courtState.liveMatch).score1 }}
                  </span>
                </div>
                <div class="board-live-row">
                  <span class="board-player-name">
                    {{ getParticipantName(courtState.liveMatch.participant2Id) }}
                  </span>
                  <span class="board-games overlay-score">
                    {{ getGamesWon(courtState.liveMatch, courtState.liveMatch.participant2Id) }}
                  </span>
                  <span class="board-points overlay-score">
                    {{ getCurrentGame(courtState.liveMatch).score2 }}
                  </span>
                </div>
              </div>
              <div class="board-live-footer">
                <span>G{{ getCurrentGame(courtState.liveMatch).gameNumber || 1 }}</span>
                <span class="board-live-tag">
                  <span class="live-dot" />
                  LIVE
                </span>
              </div>
            </template>

            <template v-else-if="courtState.readyMatch">
              <div class="board-ready-body">
                <div class="board-ready-name">
                  {{ getParticipantName(courtState.readyMatch.participant1Id) }}
                </div>
                <div class="board-ready-vs">
                  vs
                </div>
                <div class="board-ready-name">
                  {{ getParticipantName(courtState.readyMatch.participant2Id) }}
                </div>
                <div class="board-ready-tag">
                  UP NEXT
                </div>
              </div>
            </template>

            <template v-else>
              <div class="board-idle-body">
                IDLE
              </div>
            </template>
          </article>
        </div>

        <div
          v-if="shouldUseCarousel"
          class="board-carousel-dots"
        >
          <span
            v-for="pageNumber in totalCourtPages"
            :key="`page-dot-${pageNumber}`"
            class="board-carousel-dot"
            :class="{ 'board-carousel-dot--active': pageNumber - 1 === carouselPage }"
          />
        </div>
      </section>

      <aside class="board-side-panel">
        <section class="board-panel-card">
          <h2 class="board-panel-title">
            UP NEXT
          </h2>
          <div
            v-for="match in upNextMatches"
            :key="`next-${match.id}-${match.categoryId}`"
            class="board-up-next-row"
          >
            <span class="board-up-next-time">{{ formatPlannedTime(match) }}</span>
            <div class="board-up-next-text">
              <span>{{ getParticipantName(match.participant1Id) }} vs {{ getParticipantName(match.participant2Id) }}</span>
              <span class="board-up-next-category">{{ getCategoryName(match) }}</span>
            </div>
          </div>
          <div
            v-if="upNextMatches.length === 0"
            class="board-empty-state"
          >
            No upcoming matches
          </div>
        </section>

        <section class="board-panel-card">
          <h2 class="board-panel-title">
            RECENT RESULTS
          </h2>
          <div
            v-for="match in recentResults"
            :key="`result-${match.id}-${match.categoryId}`"
            class="board-result-row"
          >
            <div class="board-result-winner">
              ✓ {{ getWinnerName(match) }} def {{ getLoserName(match) }}
            </div>
            <div class="board-result-score">
              {{ getResultString(match) || 'Walkover' }}
            </div>
          </div>
          <div
            v-if="recentResults.length === 0"
            class="board-empty-state"
          >
            No completed matches yet
          </div>
        </section>
      </aside>
    </main>

    <footer class="board-footer">
      <div class="board-footer-track-wrap">
        <div
          class="board-footer-track"
          :style="{ '--ticker-duration': `${scrollDuration}s` }"
        >
          <span
            v-for="(item, index) in duplicatedFooterTickerItems"
            :key="`footer-item-${index}-${item}`"
            class="board-footer-item"
          >
            {{ item }}
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.overlay-board-page {
  position: fixed;
  inset: 0;
  width: 1920px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  background: radial-gradient(circle at top left, #1b2440 0%, #090c15 52%, #06080f 100%);
  overflow: hidden;
  font-family: 'Roboto', 'Arial', sans-serif;
}

.board-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(6, 8, 15, 0.86);
}

.board-header-title {
  font-size: 1.36rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-header-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 620px;
  justify-content: flex-end;
}

.board-live-count {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #4caf50;
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.board-complete-count {
  color: rgba(255, 255, 255, 0.84);
  font-size: 0.86rem;
  font-weight: 700;
}

.board-progress {
  width: 220px;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.board-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #7ed957 0%, #4caf50 100%);
}

.board-clock {
  min-width: 60px;
  text-align: right;
  font-size: 0.96rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.board-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.board-courts {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 16px 10px 20px;
  min-width: 0;
}

.board-court-grid {
  flex: 1;
  display: grid;
  gap: 14px;
  min-height: 0;
}

.board-court-card {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  min-height: 180px;
}

.board-court-card--live {
  border-color: rgba(76, 175, 80, 0.5);
  background: rgba(76, 175, 80, 0.06);
}

.board-court-card--idle {
  opacity: 0.38;
}

.board-court-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.board-court-name {
  color: #7ed957;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.board-court-category {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.76rem;
  white-space: nowrap;
}

.board-live-score {
  margin-top: 10px;
}

.board-live-row {
  display: grid;
  grid-template-columns: 1fr 38px 68px;
  gap: 6px;
  align-items: center;
  min-height: 42px;
}

.board-player-name {
  font-size: 0.96rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-games {
  text-align: center;
  font-size: 1.1rem;
}

.board-points {
  text-align: right;
  font-size: 1.65rem;
  line-height: 1;
}

.board-live-footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.board-live-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #4caf50;
}

.board-ready-body {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.board-ready-name {
  font-size: 0.94rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-ready-vs {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.board-ready-tag {
  margin-top: 10px;
  color: rgba(255, 193, 7, 0.85);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.board-idle-body {
  margin: auto 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.11em;
}

.board-carousel-dots {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.board-carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
}

.board-carousel-dot--active {
  background: #7ed957;
}

.board-side-panel {
  width: 420px;
  padding: 16px 20px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.board-panel-card {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  padding: 12px;
  min-height: 0;
}

.board-panel-title {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}

.board-up-next-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 8px;
  align-items: start;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.board-up-next-row:first-of-type {
  border-top: 0;
}

.board-up-next-time {
  color: rgba(255, 193, 7, 0.85);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: right;
  padding-top: 2px;
}

.board-up-next-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.86rem;
  font-weight: 700;
}

.board-up-next-category {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.76rem;
}

.board-result-row {
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.board-result-row:first-of-type {
  border-top: 0;
}

.board-result-winner {
  font-size: 0.86rem;
  font-weight: 700;
}

.board-result-score {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.76rem;
  font-weight: 700;
}

.board-empty-state {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.82rem;
  padding-top: 6px;
}

.board-footer {
  height: 44px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.52);
  overflow: hidden;
}

.board-footer-track-wrap {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.board-footer-track {
  width: max-content;
  min-width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  animation: board-footer-scroll var(--ticker-duration, 60s) linear infinite;
  white-space: nowrap;
}

.board-footer-item {
  display: inline-flex;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  padding-left: 16px;
}

.board-footer-item::after {
  content: " │";
  color: rgba(255, 255, 255, 0.42);
  padding-left: 16px;
}

@keyframes board-footer-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
</style>
