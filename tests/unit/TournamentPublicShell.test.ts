import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';

const mockDeps = vi.hoisted(() => ({
  subscribeApprovedReviews: vi.fn(),
  unsubscribeApprovedReviews: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    fullPath: '/tournaments/t1/schedule',
    params: { tournamentId: 't1' },
  }),
}));

vi.mock('@/stores/reviews', () => ({
  useReviewStore: () => ({
    approvedReviews: [],
    subscribeApprovedReviews: mockDeps.subscribeApprovedReviews,
    unsubscribeApprovedReviews: mockDeps.unsubscribeApprovedReviews,
  }),
}));

afterEach(() => {
  const structuredDataNode = document.getElementById('cm-public-shell-jsonld');
  if (structuredDataNode?.parentNode) {
    structuredDataNode.parentNode.removeChild(structuredDataNode);
  }
});

describe('TournamentPublicShell', () => {
  it('renders JSON-LD structured data with SportsEvent and Organization entries', () => {
    mockDeps.subscribeApprovedReviews.mockReset();
    mockDeps.unsubscribeApprovedReviews.mockReset();

    const wrapper = mount(TournamentPublicShell, {
      props: {
        tournament: {
          id: 't1',
          name: 'Spring Open',
          sport: 'badminton',
          format: 'single_elimination',
          status: 'active',
          startDate: new Date('2026-03-15T00:00:00.000Z'),
          endDate: new Date('2026-03-16T00:00:00.000Z'),
          location: 'Dallas, TX',
          settings: {
            minRestTimeMinutes: 15,
            matchDurationMinutes: 30,
            allowSelfRegistration: true,
            requireApproval: true,
            gamesPerMatch: 3,
            pointsToWin: 21,
            mustWinBy: 2,
            maxPoints: null,
          },
          createdBy: 'admin-1',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        pageTitle: 'Live Schedule',
      },
      global: {
        stubs: [
          'v-container',
          'v-card',
          'v-card-text',
          'v-btn',
          'TournamentBrandMark',
          'TournamentSponsorStrip',
          'ReviewList',
          'ReviewFloatingCta',
          'ReviewSubmissionDialog',
        ],
      },
    });

    const structuredDataNode = document.getElementById('cm-public-shell-jsonld');
    expect(structuredDataNode).not.toBeNull();

    const structuredData = JSON.parse(structuredDataNode?.textContent || '{}');
    expect(structuredData['@context']).toBe('https://schema.org');
    expect(Array.isArray(structuredData['@graph'])).toBe(true);

    const eventNode = structuredData['@graph'].find(
      (entry: Record<string, string>) => entry['@type'] === 'SportsEvent'
    );
    const organizationNode = structuredData['@graph'].find(
      (entry: Record<string, string>) => entry['@type'] === 'Organization'
    );

    expect(eventNode.name).toBe('Spring Open');
    expect(eventNode.location.name).toBe('Dallas, TX');
    expect(organizationNode.name).toBe('Marvy Technologies');
    expect(mockDeps.subscribeApprovedReviews).toHaveBeenCalledWith({
      tournamentId: 't1',
      limitCount: 3,
    });
    expect(wrapper.find('review-floating-cta-stub').exists()).toBe(true);

    wrapper.unmount();
  });
});
