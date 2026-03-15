<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useReviewStore } from '@/stores/reviews';
import BrandLogo from '@/components/common/BrandLogo.vue';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import TournamentSponsorStrip from '@/components/common/TournamentSponsorStrip.vue';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import {
  BRAND_COMPANY_NAME,
  BRAND_NAME,
  BRAND_POWERED_BY,
} from '@/constants/branding';
import ReviewList from '@/features/reviews/components/ReviewList.vue';
import ReviewFloatingCta from '@/features/reviews/components/ReviewFloatingCta.vue';
import ReviewSubmissionDialog from '@/features/reviews/components/ReviewSubmissionDialog.vue';
import type { Tournament } from '@/types';

interface TournamentPublicShellProps {
  tournament?: Tournament | null;
  eyebrow?: string;
  pageTitle: string;
  pageSubtitle?: string;
  fallbackIcon?: string;
  maxWidth?: number;
  showSponsors?: boolean;
  showReviews?: boolean;
}

const props = withDefaults(defineProps<TournamentPublicShellProps>(), {
  tournament: null,
  eyebrow: 'Tournament Experience',
  pageSubtitle: '',
  fallbackIcon: 'mdi-trophy',
  maxWidth: 1280,
  showSponsors: true,
  showReviews: true,
});

const route = useRoute();
const reviewStore = useReviewStore();
const showReviewDialog = ref(false);
const showReviews = computed(() => props.showReviews);
const tournamentRef = computed(() => props.tournament);
const tournamentName = computed(() => props.tournament?.name?.trim() || 'Tournament');
const tournamentIdForReviews = computed(() => {
  if (props.tournament?.id) return props.tournament.id;
  const routeId = route.params.tournamentId;
  return typeof routeId === 'string' ? routeId : '';
});
const containerStyle = computed(() => ({
  maxWidth: `${props.maxWidth}px`,
}));
const { normalizedSponsors, tournamentLogoUrl } = useTournamentBranding(tournamentRef);

const toIsoDate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const normalizedDate = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(normalizedDate.getTime())) return undefined;
  return normalizedDate.toISOString();
};

const structuredDataJson = computed(() => {
  const organization = {
    '@type': 'Organization',
    name: BRAND_COMPANY_NAME,
    brand: BRAND_NAME,
    url: `${window.location.origin}/`,
  };

  const event: Record<string, string | Record<string, string>> = {
    '@type': 'SportsEvent',
    name: tournamentName.value,
    organizer: {
      '@type': 'Organization',
      name: BRAND_COMPANY_NAME,
    },
    url: `${window.location.origin}${route.fullPath}`,
  };

  const startDate = toIsoDate(props.tournament?.startDate);
  const endDate = toIsoDate(props.tournament?.endDate);
  if (startDate) event.startDate = startDate;
  if (endDate) event.endDate = endDate;
  if (props.tournament?.location) {
    event.location = {
      '@type': 'Place',
      name: props.tournament.location,
    };
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [organization, event],
  });
});

const structuredDataScriptId = 'cm-public-shell-jsonld';

const upsertStructuredDataScript = (): void => {
  let scriptElement = document.getElementById(structuredDataScriptId) as HTMLScriptElement | null;
  if (!scriptElement) {
    scriptElement = document.createElement('script');
    scriptElement.id = structuredDataScriptId;
    scriptElement.type = 'application/ld+json';
    document.head.appendChild(scriptElement);
  }

  scriptElement.textContent = structuredDataJson.value;
};

onMounted(() => {
  upsertStructuredDataScript();

  if (showReviews.value && tournamentIdForReviews.value) {
    reviewStore.subscribeApprovedReviews({
      tournamentId: tournamentIdForReviews.value,
      limitCount: 3,
    });
  }
});

watch(structuredDataJson, () => {
  upsertStructuredDataScript();
});

watch(tournamentIdForReviews, (nextTournamentId) => {
  if (!showReviews.value) return;

  if (!nextTournamentId) {
    reviewStore.unsubscribeApprovedReviews();
    return;
  }

  reviewStore.subscribeApprovedReviews({
    tournamentId: nextTournamentId,
    limitCount: 3,
  });
});

onUnmounted(() => {
  const scriptElement = document.getElementById(structuredDataScriptId);
  if (scriptElement?.parentNode) {
    scriptElement.parentNode.removeChild(scriptElement);
  }

  if (showReviews.value) {
    reviewStore.unsubscribeApprovedReviews();
  }
});
</script>

<template>
  <section class="tournament-public-shell">
    <div
      class="tournament-public-shell__ambient"
      aria-hidden="true"
    />
    <div
      class="tournament-public-shell__mesh"
      aria-hidden="true"
    />

    <v-container
      fluid
      class="tournament-public-shell__container px-3 px-sm-6 py-5 py-sm-6"
      :style="containerStyle"
    >
      <div class="tournament-public-shell__stack">
        <v-card
          class="tournament-public-shell__hero"
          elevation="0"
        >
          <v-card-text class="pa-5 pa-sm-6">
            <div class="text-overline tournament-public-shell__eyebrow mb-2">
              {{ eyebrow }}
            </div>

            <div class="tournament-public-shell__hero-main">
              <div class="tournament-public-shell__brand">
                <TournamentBrandMark
                  :tournament-name="tournamentName"
                  :logo-url="tournamentLogoUrl"
                  :fallback-icon="fallbackIcon"
                  :width="82"
                  :height="82"
                  class="tournament-public-shell__brand-mark"
                />

                <div class="tournament-public-shell__copy">
                  <div class="tournament-public-shell__tournament-name">
                    {{ tournamentName }}
                  </div>
                  <h1 class="tournament-public-shell__page-title">
                    {{ pageTitle }}
                  </h1>
                  <p
                    v-if="pageSubtitle"
                    class="tournament-public-shell__page-subtitle"
                  >
                    {{ pageSubtitle }}
                  </p>
                </div>
              </div>

              <div
                v-if="$slots.actions"
                class="tournament-public-shell__actions"
              >
                <slot name="actions" />
              </div>
            </div>

            <div
              v-if="$slots.metrics"
              class="tournament-public-shell__metrics"
            >
              <slot name="metrics" />
            </div>

            <TournamentSponsorStrip
              v-if="showSponsors && normalizedSponsors.length > 0"
              :sponsors="normalizedSponsors"
              dense
              class="mt-4"
            />
          </v-card-text>
        </v-card>

        <div class="tournament-public-shell__content">
          <slot />
        </div>

        <section
          v-if="showReviews"
          class="tournament-public-shell__reviews"
        >
          <ReviewList
            :reviews="reviewStore.approvedReviews"
            title="What Players and Organizers Say"
            empty-message="No approved reviews for this tournament yet."
            :max-items="3"
            compact
          />

          <v-card
            class="tournament-public-shell__review-prompt mt-3"
            elevation="0"
          >
            <v-card-text class="d-flex align-center justify-space-between flex-wrap ga-3">
              <p class="text-body-2 text-medium-emphasis mb-0">
                Attended this tournament? Share a quick review to help other clubs.
              </p>
              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-star-outline"
                @click="showReviewDialog = true"
              >
                Leave a Review
              </v-btn>
            </v-card-text>
          </v-card>
        </section>
      </div>

      <footer class="tournament-public-shell__powered-by">
        <a
          href="/"
          class="tournament-public-shell__powered-by-link"
          :title="`Tournament software by ${BRAND_NAME}`"
        >
          <BrandLogo
            variant="mark"
            :width="20"
            :height="20"
            :alt="BRAND_NAME"
            class-name="tournament-public-shell__powered-by-logo"
          />
          <span class="tournament-public-shell__powered-by-text">
            {{ BRAND_POWERED_BY }}
          </span>
        </a>
      </footer>
    </v-container>

    <ReviewFloatingCta
      v-if="showReviews"
      @click="showReviewDialog = true"
    />

    <ReviewSubmissionDialog
      v-if="showReviews"
      v-model="showReviewDialog"
      :tournament-id="tournamentIdForReviews"
      :tournament-name="tournamentName"
      @submitted="showReviewDialog = false"
    />
  </section>
</template>

<style scoped>
.tournament-public-shell {
  position: relative;
  min-height: 100vh;
  background:
    linear-gradient(150deg, #f8fbff 0%, #eef4ff 26%, #fdfcf9 58%, #ecf8f2 100%);
  isolation: isolate;
}

.tournament-public-shell__ambient,
.tournament-public-shell__mesh {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tournament-public-shell__ambient {
  background:
    radial-gradient(circle at 10% 12%, rgba(var(--v-theme-primary), 0.22), transparent 34%),
    radial-gradient(circle at 88% 9%, rgba(var(--v-theme-secondary), 0.18), transparent 30%),
    radial-gradient(circle at 78% 68%, rgba(var(--v-theme-success), 0.14), transparent 32%),
    radial-gradient(circle at 20% 100%, rgba(var(--v-theme-info), 0.13), transparent 36%);
  z-index: -2;
}

.tournament-public-shell__mesh {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.24) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.34) 0%, rgba(0, 0, 0, 0.08) 42%, transparent 100%);
  opacity: 0.5;
  z-index: -1;
}

.tournament-public-shell__container {
  position: relative;
  z-index: 1;
  margin: 0 auto;
}

.tournament-public-shell__stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tournament-public-shell__hero {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 30px;
  background:
    linear-gradient(136deg, rgba(255, 255, 255, 0.92) 0%, rgba(249, 252, 255, 0.95) 48%, rgba(244, 250, 247, 0.92) 100%);
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.tournament-public-shell__hero::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 84% 18%, rgba(var(--v-theme-primary), 0.12), transparent 24%),
    linear-gradient(120deg, rgba(var(--v-theme-primary), 0.04) 0%, transparent 35%, rgba(var(--v-theme-success), 0.05) 100%);
}

.tournament-public-shell__eyebrow {
  letter-spacing: 0.16em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.tournament-public-shell__hero-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.tournament-public-shell__brand {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.tournament-public-shell__brand-mark {
  flex-shrink: 0;
}

.tournament-public-shell__copy {
  min-width: 0;
}

.tournament-public-shell__tournament-name {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.58);
}

.tournament-public-shell__page-title {
  margin: 4px 0 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: 0.01em;
}

.tournament-public-shell__page-subtitle {
  margin: 10px 0 0;
  max-width: 720px;
  font-size: 1rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.tournament-public-shell__actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.tournament-public-shell__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.tournament-public-shell__content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tournament-public-shell__reviews {
  margin-top: 6px;
}

.tournament-public-shell__review-prompt {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
}

.tournament-public-shell__powered-by {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.tournament-public-shell__powered-by:hover {
  opacity: 1;
}

.tournament-public-shell__powered-by-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
}

.tournament-public-shell__powered-by-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.tournament-public-shell__powered-by-text {
  font-size: 12px;
  letter-spacing: 0.01em;
}

@media (max-width: 960px) {
  .tournament-public-shell__hero-main {
    flex-direction: column;
  }

  .tournament-public-shell__actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 599px) {
  .tournament-public-shell__hero {
    border-radius: 24px;
  }

  .tournament-public-shell__brand {
    align-items: flex-start;
  }

  .tournament-public-shell__brand-mark {
    width: 64px;
    height: 64px;
  }

  .tournament-public-shell__page-title {
    font-size: 2.1rem;
  }

  .tournament-public-shell__page-subtitle {
    font-size: 0.92rem;
  }

  .tournament-public-shell__metrics {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tournament-public-shell__powered-by {
    transition: none;
  }
}
</style>
