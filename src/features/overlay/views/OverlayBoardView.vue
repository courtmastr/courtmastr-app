<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import type { Court, GameScore, Match } from '@/types';
import '../overlay.css';

interface CourtBoardCard {
  court: Court;
  liveMatch: Match | null;
  readyMatch: Match | null;
  displayMatch: Match | null;
}

const COURTS_PER_PAGE = 4;
const CAROUSEL_INTERVAL_MS = 9000;

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();
const { activeAnnouncements, subscribeAnnouncements } = useAnnouncements();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const tournamentName = computed(() =>
  tournamentStore.currentTournament?.name?.trim() || 'TOURNAMENT BOARD'
);
const { normalizedSponsors, tournamentLogoUrl } = useTournamentBranding(tournament);

const courts = computed(() => tournamentStore.courts);
const carouselPage = ref(0);
let carouselInterval: ReturnType<typeof setInterval> | null = null;

usePublicPageMetadata({
  title: 'Broadcast Overlay Board',
  description: 'CourtMastr broadcast board overlay for multi-court production feeds.',
  canonicalPath: route.path,
  noIndex: true,
});

const shouldUseCarousel = computed(() => courts.value.length > COURTS_PER_PAGE);
const totalCourtPages = computed(() =>
  Math.max(1, Math.ceil(courts.value.length / COURTS_PER_PAGE))
);
const carouselRangeLabel = computed(() => {
  if (courts.value.length === 0) return 'COURTS 0 OF 0';
  const start = carouselPage.value * COURTS_PER_PAGE + 1;
  const end = Math.min((carouselPage.value + 1) * COURTS_PER_PAGE, courts.value.length);
  return `COURTS ${start}-${end} OF ${courts.value.length}`;
});
const visibleCourts = computed(() => {
  const start = carouselPage.value * COURTS_PER_PAGE;
  return courts.value.slice(start, start + COURTS_PER_PAGE);
});

const getLiveMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'in_progress'
  ) ?? null;

const getReadyMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'ready'
  ) ?? null;

const courtCards = computed<CourtBoardCard[]>(() =>
  visibleCourts.value.map((court) => {
    const liveMatch = getLiveMatchOnCourt(court.id);
    const readyMatch = getReadyMatchOnCourt(court.id);

    return {
      court,
      liveMatch,
      readyMatch,
      displayMatch: liveMatch ?? readyMatch,
    };
  })
);

const getCategoryName = (match: Match | null): string => {
  if (!match) return '';
  return tournamentStore.categories.find((category) => category.id === match.categoryId)?.name ?? 'Match';
};

const getCourtLabel = (courtId: string | undefined): string => {
  if (!courtId) return 'COURT TBA';
  return courts.value.find((court) => court.id === courtId)?.name?.toUpperCase() ?? 'COURT TBA';
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

const getGamesWon = (match: Match, participantId: string | undefined): number => {
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
    .slice(0, 3)
);

const sponsors = computed(() => normalizedSponsors.value);
const failedSponsorIds = ref<string[]>([]);
const shouldScrollSponsors = computed(() => sponsors.value.length > 3);
const sponsorLoopItems = computed(() => (
  shouldScrollSponsors.value ? [...sponsors.value, ...sponsors.value] : sponsors.value
));

const hasFailedSponsorLogo = (sponsorId: string): boolean => failedSponsorIds.value.includes(sponsorId);

const handleSponsorLogoError = (sponsorId: string): void => {
  if (!failedSponsorIds.value.includes(sponsorId)) {
    failedSponsorIds.value = [...failedSponsorIds.value, sponsorId];
  }
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

watch([shouldUseCarousel, totalCourtPages], () => {
  if (carouselPage.value >= totalCourtPages.value) {
    carouselPage.value = 0;
  }
  startCarousel();
}, { immediate: true });

watch(
  sponsors,
  () => {
    failedSponsorIds.value = [];
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  document.documentElement.classList.add('overlay-page');
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  subscribeAnnouncements(tournamentId.value);
});

onUnmounted(() => {
  document.documentElement.classList.remove('overlay-page');
  stopCarousel();
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <div class="overlay-board-page">
    <header class="board-header">
      <div class="board-header__brand">
        <TournamentBrandMark
          :tournament-name="tournamentName"
          :logo-url="tournamentLogoUrl"
          :width="82"
          :height="82"
        />
        <h1 class="tournament-name">
          {{ tournamentName }}
        </h1>
      </div>
      <div
        v-if="shouldUseCarousel"
        class="carousel-meta"
      >
        {{ carouselRangeLabel }}
      </div>
    </header>

    <main class="board-body">
      <section class="board-courts">
        <div class="courts-grid">
          <article
            v-for="card in courtCards"
            :key="card.court.id"
            class="court-card"
            :class="{
              'court-card--live': card.liveMatch,
              'court-card--ready': !card.liveMatch && card.readyMatch,
            }"
          >
            <header class="court-card-header">
              <span class="court-name">{{ card.court.name.toUpperCase() }}</span>
              <span class="court-category">{{ getCategoryName(card.displayMatch) }}</span>
            </header>

            <div class="court-card-body">
              <template v-if="card.liveMatch">
                <div class="match-row">
                  <span class="player-name">{{ getParticipantName(card.liveMatch.participant1Id) }}</span>
                  <div class="score-group">
                    <span class="games-score">{{ getGamesWon(card.liveMatch, card.liveMatch.participant1Id) }}</span>
                    <span class="current-score">{{ getCurrentGame(card.liveMatch).score1 }}</span>
                  </div>
                </div>
                <div class="match-row">
                  <span class="player-name">{{ getParticipantName(card.liveMatch.participant2Id) }}</span>
                  <div class="score-group">
                    <span class="games-score">{{ getGamesWon(card.liveMatch, card.liveMatch.participant2Id) }}</span>
                    <span class="current-score">{{ getCurrentGame(card.liveMatch).score2 }}</span>
                  </div>
                </div>
              </template>

              <template v-else-if="card.readyMatch">
                <div class="match-row">
                  <span class="player-name">{{ getParticipantName(card.readyMatch.participant1Id) }}</span>
                  <div class="score-group">
                    <span class="games-score">0</span>
                    <span class="current-score">0</span>
                  </div>
                </div>
                <div class="match-row">
                  <span class="player-name">{{ getParticipantName(card.readyMatch.participant2Id) }}</span>
                  <div class="score-group">
                    <span class="games-score">0</span>
                    <span class="current-score">0</span>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="idle-row">
                  <span class="idle-text">Waiting for match...</span>
                </div>
              </template>
            </div>

            <footer class="court-card-footer">
              <span
                v-if="card.liveMatch"
                class="live-indicator"
              >
                <span class="live-dot" /> LIVE
              </span>
              <span
                v-else-if="card.readyMatch"
                class="ready-indicator"
              >UP NEXT</span>
              <span
                v-else
                class="idle-indicator"
              >IDLE</span>
            </footer>
          </article>
        </div>
      </section>

      <aside class="board-sidebar">
        <section class="sidebar-card">
          <h2 class="sidebar-title">
            UP NEXT
          </h2>
          <div class="up-next-list">
            <div
              v-for="match in upNextMatches"
              :key="`next-${match.id}`"
              class="up-next-item"
            >
              <div class="up-next-court-category">
                {{ getCourtLabel(match.courtId) }}: {{ getCategoryName(match) }}
              </div>
              <div class="up-next-players">
                {{ getParticipantName(match.participant1Id) }}
                <span class="up-next-vs">vs</span>
                {{ getParticipantName(match.participant2Id) }}
              </div>
            </div>
            <div
              v-if="upNextMatches.length === 0"
              class="empty-state"
            >
              No upcoming matches
            </div>
          </div>
        </section>

        <section class="sidebar-card announcements-card">
          <h2 class="sidebar-title">
            TOURNAMENT ANNOUNCEMENTS
          </h2>
          <div class="announcements-list">
            <div
              v-for="announcement in activeAnnouncements.slice(0, 3)"
              :key="announcement.id"
              class="announcement-item"
            >
              {{ announcement.text }}
            </div>
            <div
              v-if="activeAnnouncements.length === 0"
              class="empty-state"
            >
              No announcements
            </div>
          </div>
        </section>
      </aside>
    </main>

    <footer class="board-footer">
      <div
        v-if="sponsorLoopItems.length > 0"
        class="sponsors-ticker"
        :class="{ 'sponsors-ticker--scroll': shouldScrollSponsors }"
      >
        <div
          v-for="(sponsor, index) in sponsorLoopItems"
          :key="`${sponsor.id}-${index}`"
          class="sponsor-pill"
        >
          <img
            v-if="sponsor.logoUrl && !hasFailedSponsorLogo(sponsor.id)"
            :src="sponsor.logoUrl"
            :alt="`${sponsor.name} logo`"
            class="sponsor-logo"
            @error="handleSponsorLogoError(sponsor.id)"
          >
          <span
            v-else
            class="sponsor-name"
          >
            {{ sponsor.name }}
          </span>
        </div>
      </div>
      <div
        v-else
        class="sponsors-empty"
      >
        No sponsors listed
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
  color: #e8f2fb;
  font-family: 'Barlow Semi Condensed', 'Rajdhani', 'Trebuchet MS', sans-serif;
  overflow: hidden;
  transform-origin: top left;
  transform: scale(min(calc(100vw / 1920px), calc(100vh / 1080px)));
  background:
    radial-gradient(circle at 14% 9%, rgba(57, 143, 214, 0.22), transparent 42%),
    radial-gradient(circle at 84% 16%, rgba(26, 109, 176, 0.2), transparent 44%),
    radial-gradient(circle at 48% 78%, rgba(8, 53, 98, 0.55), transparent 54%),
    linear-gradient(145deg, #020b1b 0%, #05172f 48%, #041326 100%);
  isolation: isolate;
}

.overlay-board-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(120deg, rgba(125, 181, 223, 0.04) 0, rgba(125, 181, 223, 0.04) 1px, transparent 1px, transparent 26px),
    repeating-linear-gradient(0deg, rgba(125, 181, 223, 0.02) 0, rgba(125, 181, 223, 0.02) 1px, transparent 1px, transparent 20px);
  opacity: 0.28;
  pointer-events: none;
  mix-blend-mode: screen;
}

.board-header {
  position: relative;
  z-index: 1;
  height: 98px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding: 0 72px 18px;
  border-bottom: 1px solid rgba(149, 201, 236, 0.22);
  background: linear-gradient(180deg, rgba(3, 12, 29, 0.42) 0%, rgba(3, 12, 29, 0.08) 100%);
}

.board-header__brand {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

.tournament-name {
  margin: 0;
  font-size: 4.6rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.012em;
  color: rgba(235, 246, 255, 0.95);
  text-transform: uppercase;
}

.carousel-meta {
  margin-bottom: 6px;
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(156, 208, 243, 0.92);
  text-transform: uppercase;
}

.board-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 42px;
  padding: 32px 72px 18px;
  box-sizing: border-box;
}

.board-courts {
  flex: 1;
  min-width: 0;
}

.courts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 338px;
  gap: 28px 32px;
}

.court-card,
.sidebar-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 34px;
  border: 1px solid rgba(108, 168, 215, 0.3);
  background: linear-gradient(128deg, rgba(15, 61, 97, 0.72) 0%, rgba(8, 35, 66, 0.9) 52%, rgba(14, 62, 104, 0.66) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(166, 214, 248, 0.09),
    inset 0 -28px 56px rgba(3, 13, 28, 0.48),
    0 24px 42px rgba(1, 7, 17, 0.45);
  backdrop-filter: blur(8px);
}

.court-card::after,
.sidebar-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 74% 12%, rgba(96, 188, 246, 0.12), transparent 36%);
}

.court-card--live {
  border-color: rgba(89, 199, 126, 0.46);
  box-shadow:
    inset 0 0 0 1px rgba(145, 230, 169, 0.16),
    inset 0 -28px 56px rgba(3, 13, 28, 0.5),
    0 20px 36px rgba(1, 7, 17, 0.45),
    0 0 46px rgba(52, 164, 91, 0.2);
}

.court-card--ready {
  border-color: rgba(131, 178, 220, 0.42);
}

.court-card-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 18px;
  padding: 24px 30px 18px;
  border-bottom: 1px solid rgba(149, 201, 236, 0.23);
}

.court-name {
  font-size: 3.2rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  color: #57bdea;
  text-transform: uppercase;
}

.court-category {
  font-size: 2.05rem;
  line-height: 1.08;
  font-weight: 500;
  color: rgba(234, 244, 252, 0.7);
}

.court-card-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.match-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  min-height: 90px;
  padding: 0 30px;
  border-bottom: 1px solid rgba(149, 201, 236, 0.18);
}

.match-row:last-child {
  border-bottom: none;
}

.player-name {
  font-size: 2.1rem;
  font-weight: 500;
  color: #f3f9ff;
  line-height: 1.14;
  letter-spacing: 0.004em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.score-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 28px;
  min-width: 136px;
}

.games-score,
.current-score {
  min-width: 36px;
  text-align: right;
  font-size: 3.2rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.games-score {
  font-weight: 500;
  color: rgba(226, 239, 251, 0.64);
}

.current-score {
  font-weight: 650;
  color: #ffffff;
}

.idle-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.idle-text {
  font-size: 2rem;
  letter-spacing: 0.03em;
  color: rgba(223, 236, 247, 0.5);
}

.court-card-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 58px;
  padding: 0 30px;
  border-top: 1px solid rgba(149, 201, 236, 0.2);
  background: linear-gradient(180deg, rgba(5, 19, 38, 0.18) 0%, rgba(5, 19, 38, 0.48) 100%);
}

.live-indicator,
.ready-indicator,
.idle-indicator {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 1.7rem;
  font-weight: 600;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #4fda7d;
}

.live-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #4fda7d;
  box-shadow: 0 0 12px rgba(79, 218, 125, 0.55);
  animation: board-live-pulse 1.4s ease-in-out infinite;
}

@keyframes board-live-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.78);
  }
}

.ready-indicator {
  color: rgba(115, 185, 244, 0.9);
}

.idle-indicator {
  color: rgba(223, 236, 247, 0.45);
}

.board-sidebar {
  width: 390px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.sidebar-card {
  min-height: 312px;
  padding: 22px 26px;
}

.sidebar-title {
  position: relative;
  z-index: 1;
  margin: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(149, 201, 236, 0.22);
  font-size: 2.15rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #57bdea;
}

.up-next-list,
.announcements-list {
  position: relative;
  z-index: 1;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
}

.up-next-item,
.announcement-item {
  padding: 16px 0;
  border-bottom: 1px solid rgba(149, 201, 236, 0.18);
}

.up-next-item:last-child,
.announcement-item:last-child {
  border-bottom: none;
}

.up-next-court-category {
  font-size: 1.36rem;
  line-height: 1.24;
  color: rgba(243, 250, 255, 0.9);
}

.up-next-players {
  margin-top: 8px;
  font-size: 1.62rem;
  line-height: 1.22;
  color: #f7fbff;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.up-next-vs {
  margin: 0 6px;
  font-size: 1.45rem;
  color: rgba(219, 234, 247, 0.75);
}

.announcement-item {
  font-size: 1.6rem;
  line-height: 1.24;
  color: #f5fbff;
}

.empty-state {
  padding: 22px 0;
  font-size: 1.38rem;
  color: rgba(224, 238, 248, 0.52);
}

.board-footer {
  position: relative;
  z-index: 1;
  height: 72px;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-top: 1px solid rgba(138, 191, 230, 0.35);
  background: linear-gradient(180deg, rgba(7, 25, 46, 0.88) 0%, rgba(4, 16, 34, 0.96) 100%);
}

.sponsors-ticker {
  display: flex;
  align-items: center;
  white-space: nowrap;
  gap: 22px;
}

.sponsors-ticker--scroll {
  animation: sponsors-marquee 42s linear infinite;
}

.sponsors-ticker:not(.sponsors-ticker--scroll) {
  width: 100%;
  justify-content: center;
}

.sponsor-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  height: 48px;
  padding: 0 24px;
  border-radius: 999px;
  border: 1px solid rgba(138, 191, 230, 0.26);
  background: rgba(8, 32, 58, 0.64);
  box-shadow: inset 0 0 0 1px rgba(166, 214, 248, 0.08);
}

.sponsor-logo {
  max-width: 140px;
  max-height: 28px;
  object-fit: contain;
}

.sponsor-name {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(241, 248, 255, 0.94);
}

.sponsors-empty {
  padding: 0 32px;
  font-size: 1.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(241, 248, 255, 0.58);
}

@keyframes sponsors-marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>
