<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import PublicFeatureGrid from '@/features/public/components/PublicFeatureGrid.vue';
import PublicHeroSection from '@/features/public/components/PublicHeroSection.vue';
import PublicMetricsStrip from '@/features/public/components/PublicMetricsStrip.vue';
import PublicTrustReviewsSection from '@/features/public/components/PublicTrustReviewsSection.vue';
import ReviewSubmissionDialog from '@/features/reviews/components/ReviewSubmissionDialog.vue';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useFeaturedTournamentMetrics } from '@/composables/useFeaturedTournamentMetrics';
import { useAuthStore } from '@/stores/auth';
import { useReviewStore } from '@/stores/reviews';
import type { ReviewRecord } from '@/types';

usePublicPageMetadata({
  title: 'CourtMastr',
  description: 'CourtMastr helps badminton organizers run check-in, scheduling, and live scoring with confidence.',
  canonicalPath: '/',
});

const authStore = useAuthStore();
const reviewStore = useReviewStore();
const showReviewDialog = ref(false);

const isAuthenticated = computed(() => authStore.isAuthenticated);

const {
  hasFeaturedTournament,
  loading: featuredMetricsLoading,
  errorMessage: featuredMetricsError,
  metrics: featuredMetrics,
  loadMetrics,
} = useFeaturedTournamentMetrics();

const features = [
  {
    icon: 'mdi-calendar-clock',
    title: 'Schedule Control',
    description: 'Publish reliable match timelines, reduce desk confusion, and keep courts moving.',
  },
  {
    icon: 'mdi-scoreboard',
    title: 'Live Scoring',
    description: 'Scorekeepers update matches from mobile while spectators see immediate public updates.',
  },
  {
    icon: 'mdi-account-check',
    title: 'Check-In Operations',
    description: 'Run both self check-in and front-desk workflows without duplicate data entry.',
  },
  {
    icon: 'mdi-cast',
    title: 'Broadcast Overlays',
    description: 'Use OBS-ready score bug and scoreboard overlays for streams and venue displays.',
  },
];

const fallbackReviews: ReviewRecord[] = [
  {
    id: 'fallback-mcia',
    status: 'approved',
    rating: 5,
    quote: 'CourtMastr helped MCIA run a full tournament day on schedule with fewer manual updates and better player communication.',
    displayName: 'MCIA Operations Team',
    organization: 'MCIA - McLean County Indian Association',
    source: 'public',
    createdAt: new Date('2026-03-14T00:00:00.000Z'),
    updatedAt: new Date('2026-03-14T00:00:00.000Z'),
  },
  {
    id: 'fallback-tnf',
    status: 'approved',
    rating: 5,
    quote: 'From check-in to finals, CourtMastr gave our TNF volunteers a clear workflow and real-time visibility on every court.',
    displayName: 'Tournament Volunteers',
    organization: 'Tamilnadu Foundation (TNF)',
    source: 'public',
    createdAt: new Date('2026-03-14T00:00:00.000Z'),
    updatedAt: new Date('2026-03-14T00:00:00.000Z'),
  },
  {
    id: 'fallback-og',
    status: 'approved',
    rating: 5,
    quote: 'Our OG Badminton Club events now feel professionally managed, and players always know where they need to be next.',
    displayName: 'Event Coordination Team',
    organization: 'OG Badminton Club',
    source: 'public',
    createdAt: new Date('2026-03-14T00:00:00.000Z'),
    updatedAt: new Date('2026-03-14T00:00:00.000Z'),
  },
];

const credibilityStats = computed(() => {
  if (!featuredMetrics.value) {
    return [
      { label: 'Registered', value: '--' },
      { label: 'Completed Matches', value: '--' },
      { label: 'Check-In Rate', value: '--' },
    ];
  }

  return [
    { label: 'Registered', value: String(featuredMetrics.value.registered) },
    { label: 'Completed Matches', value: String(featuredMetrics.value.completedMatches) },
    { label: 'Check-In Rate', value: `${featuredMetrics.value.checkInRate}%` },
  ];
});

const featuredMetricsFallbackMessage = computed(() => {
  if (featuredMetricsLoading.value) {
    return 'Loading real tournament metrics...';
  }

  if (featuredMetrics.value) {
    return `Featured metrics from ${featuredMetrics.value.tournamentName}.`;
  }

  if (!hasFeaturedTournament.value) {
    return 'Set VITE_MARKETING_FEATURED_TOURNAMENT_ID to show live tournament metrics.';
  }

  return featuredMetricsError.value || 'Featured tournament metrics are temporarily unavailable.';
});

const reviewsForDisplay = computed(() => (
  reviewStore.approvedReviews.length > 0
    ? reviewStore.approvedReviews
    : fallbackReviews
));

const reviewFallbackMarker = computed(() => (
  reviewStore.approvedReviews.length > 0
    ? ''
    : 'Community launch partners include MCIA, TNF, and OG Badminton Club.'
));

onMounted(() => {
  void loadMetrics();
  reviewStore.subscribeApprovedReviews({ featuredOnly: false, limitCount: 6 });
});

onUnmounted(() => {
  reviewStore.unsubscribeApprovedReviews();
});
</script>

<template>
  <div class="home-view">
    <v-container class="py-8 py-md-12 home-view__container">
      <PublicHeroSection :is-authenticated="isAuthenticated" />

      <v-divider class="my-8" />

      <PublicMetricsStrip
        :metrics="credibilityStats"
        :helper-text="featuredMetricsFallbackMessage"
      />

      <v-divider class="my-8" />

      <PublicTrustReviewsSection
        :reviews="reviewsForDisplay"
        :fallback-marker="reviewFallbackMarker"
        @leave-review="showReviewDialog = true"
      />

      <v-divider class="my-8" />

      <PublicFeatureGrid :features="features" />

      <v-card
        class="home-view__cta pa-6 pa-md-8 mt-8"
        elevation="0"
      >
        <h2 class="home-view__cta-title mb-3">
          Ready for your next tournament day?
        </h2>
        <p class="text-body-1 text-medium-emphasis mb-5">
          Start with Free Beta and run your event on a platform designed specifically for badminton operations.
        </p>
        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="!isAuthenticated"
            color="primary"
            to="/register"
          >
            Create Free Account
          </v-btn>
          <v-btn
            v-if="!isAuthenticated"
            variant="outlined"
            to="/pricing"
          >
            View Pricing
          </v-btn>
          <v-btn
            v-else
            color="primary"
            to="/tournaments/create"
          >
            Create Tournament
          </v-btn>
        </div>
      </v-card>
    </v-container>

    <ReviewSubmissionDialog
      v-model="showReviewDialog"
      @submitted="showReviewDialog = false"
    />
  </div>
</template>

<style scoped>
.home-view {
  background: #f8fafc;
  min-height: 100vh;
}

.home-view__container {
  max-width: 1120px;
}

.home-view__cta {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 20px;
}

.home-view__cta-title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 0.95;
  text-wrap: balance;
}
</style>
