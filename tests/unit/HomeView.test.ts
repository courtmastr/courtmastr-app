import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { ReviewRecord } from '@/types';
import HomeView from '@/features/public/views/HomeView.vue';

const runtime = {
  isAuthenticated: false,
  hasFeaturedTournament: true,
  loading: false,
  errorMessage: '',
  metrics: null as null | {
    tournamentName: string;
    registered: number;
    completedMatches: number;
    checkInRate: number;
  },
  approvedReviews: [] as ReviewRecord[],
};

const mockDeps = vi.hoisted(() => ({
  loadMetrics: vi.fn(),
  subscribeApprovedReviews: vi.fn(),
  unsubscribeApprovedReviews: vi.fn(),
  setMetadata: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: runtime.isAuthenticated,
  }),
}));

vi.mock('@/composables/usePublicPageMetadata', () => ({
  usePublicPageMetadata: mockDeps.setMetadata,
}));

vi.mock('@/composables/useFeaturedTournamentMetrics', () => ({
  useFeaturedTournamentMetrics: () => ({
    hasFeaturedTournament: ref(runtime.hasFeaturedTournament),
    loading: ref(runtime.loading),
    errorMessage: ref(runtime.errorMessage),
    metrics: ref(runtime.metrics),
    loadMetrics: mockDeps.loadMetrics,
  }),
}));

vi.mock('@/stores/reviews', () => ({
  useReviewStore: () => ({
    approvedReviews: runtime.approvedReviews,
    subscribeApprovedReviews: mockDeps.subscribeApprovedReviews,
    unsubscribeApprovedReviews: mockDeps.unsubscribeApprovedReviews,
  }),
}));

const mountView = () => shallowMount(HomeView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'v-container',
      'v-divider',
      'v-btn',
      'v-card',
    ],
  },
});

describe('HomeView', () => {
  beforeEach(() => {
    runtime.isAuthenticated = false;
    runtime.hasFeaturedTournament = true;
    runtime.loading = false;
    runtime.errorMessage = '';
    runtime.metrics = {
      tournamentName: 'Spring Open',
      registered: 128,
      completedMatches: 96,
      checkInRate: 91,
    };
    runtime.approvedReviews = [];

    mockDeps.loadMetrics.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeApprovedReviews.mockReset();
    mockDeps.unsubscribeApprovedReviews.mockReset();
    mockDeps.setMetadata.mockReset();
  });

  it('loads featured metrics and subscribes approved reviews on mount', async () => {
    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      credibilityStats: Array<{ label: string; value: string }> | { value: Array<{ label: string; value: string }> };
      featuredMetricsFallbackMessage: string | { value: string };
    };

    const stats = Array.isArray(vm.credibilityStats)
      ? vm.credibilityStats
      : vm.credibilityStats.value;
    const helperText = typeof vm.featuredMetricsFallbackMessage === 'string'
      ? vm.featuredMetricsFallbackMessage
      : vm.featuredMetricsFallbackMessage.value;

    expect(mockDeps.loadMetrics).toHaveBeenCalledTimes(1);
    expect(mockDeps.subscribeApprovedReviews).toHaveBeenCalledWith({ featuredOnly: false, limitCount: 6 });
    expect(stats.map((item) => item.value)).toEqual(['128', '96', '91%']);
    expect(helperText).toContain('Featured metrics from Spring Open.');
  });

  it('shows safe fallback metrics message when featured tournament is missing', async () => {
    runtime.metrics = null;
    runtime.hasFeaturedTournament = false;

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      credibilityStats: Array<{ label: string; value: string }> | { value: Array<{ label: string; value: string }> };
      featuredMetricsFallbackMessage: string | { value: string };
      reviewsForDisplay: ReviewRecord[] | { value: ReviewRecord[] };
    };

    const stats = Array.isArray(vm.credibilityStats)
      ? vm.credibilityStats
      : vm.credibilityStats.value;
    const helperText = typeof vm.featuredMetricsFallbackMessage === 'string'
      ? vm.featuredMetricsFallbackMessage
      : vm.featuredMetricsFallbackMessage.value;
    const reviews = Array.isArray(vm.reviewsForDisplay)
      ? vm.reviewsForDisplay
      : vm.reviewsForDisplay.value;

    expect(helperText).toContain('Set VITE_MARKETING_FEATURED_TOURNAMENT_ID');
    expect(stats.map((item) => item.value)).toEqual(['--', '--', '--']);
    expect(reviews.length).toBeGreaterThan(0);
  });
});
