import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Court, Match, TournamentSponsor } from '@/types';
import OverlayBoardView from '@/features/overlay/views/OverlayBoardView.vue';

const runtime = {
  routeParams: { tournamentId: 't1' },
  courts: [] as Court[],
  categories: [{ id: 'cat-1', name: "Men's Singles" }],
  matches: [] as Match[],
  currentTournament: {
    id: 't1',
    name: 'Spring Open',
    sponsors: [] as TournamentSponsor[],
  },
  activeAnnouncements: [] as Array<{ id: string; text: string }>,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  unsubscribeRegistrations: vi.fn(),
  subscribeAnnouncements: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: runtime.routeParams,
    query: {},
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: runtime.currentTournament,
    courts: runtime.courts,
    categories: runtime.categories,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    unsubscribeAll: mockDeps.unsubscribeRegistrations,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => registrationId ?? 'TBD',
  }),
}));

vi.mock('@/composables/useAnnouncements', () => ({
  useAnnouncements: () => ({
    activeAnnouncements: runtime.activeAnnouncements,
    subscribeAnnouncements: mockDeps.subscribeAnnouncements,
  }),
}));

const makeCourt = (id: string, name: string): Court => ({
  id,
  tournamentId: 't1',
  name,
  number: Number(id.replace(/\D+/g, '')) || 1,
  status: 'available',
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const makeMatch = (
  id: string,
  status: Match['status'],
  courtId: string,
  plannedStartAt?: Date
): Match => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: `${id}-p1`,
  participant2Id: `${id}-p2`,
  status,
  courtId,
  plannedStartAt,
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const unwrap = <T>(value: T | { value: T }): T => {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: T }).value;
  }
  return value as T;
};

const mountView = () => mount(OverlayBoardView, {
  global: {
    stubs: {
      TournamentBrandMark: {
        props: ['tournamentName'],
        template: '<div data-testid="brand-mark">{{ tournamentName }}</div>',
      },
    },
  },
});

describe('OverlayBoardView', () => {
  beforeEach(() => {
    runtime.routeParams = { tournamentId: 't1' };
    runtime.currentTournament = {
      id: 't1',
      name: 'Spring Open',
      sponsors: [],
    };
    runtime.courts = [makeCourt('court-1', 'Court 1')];
    runtime.matches = [];
    runtime.activeAnnouncements = [{ id: 'a1', text: 'Welcome players' }];

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
    mockDeps.subscribeAnnouncements.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds court card state with live match precedence over ready match', async () => {
    runtime.matches = [
      makeMatch('ready-1', 'ready', 'court-1'),
      makeMatch('live-1', 'in_progress', 'court-1'),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      courtCards: Array<{
        liveMatch: Match | null;
        readyMatch: Match | null;
        displayMatch: Match | null;
      }> | { value: Array<{ liveMatch: Match | null; readyMatch: Match | null; displayMatch: Match | null }> };
    };
    const courtCards = unwrap(vm.courtCards);

    expect(courtCards).toHaveLength(1);
    expect(courtCards[0].liveMatch?.id).toBe('live-1');
    expect(courtCards[0].readyMatch?.id).toBe('ready-1');
    expect(courtCards[0].displayMatch?.id).toBe('live-1');
    expect(mockDeps.subscribeAnnouncements).toHaveBeenCalledWith('t1');
  });

  it('enables carousel paging when more than four courts exist', async () => {
    vi.useFakeTimers();
    runtime.courts = [
      makeCourt('court-1', 'Court 1'),
      makeCourt('court-2', 'Court 2'),
      makeCourt('court-3', 'Court 3'),
      makeCourt('court-4', 'Court 4'),
      makeCourt('court-5', 'Court 5'),
    ];
    runtime.matches = [
      makeMatch('m1', 'ready', 'court-1', new Date('2026-02-27T11:00:00.000Z')),
      makeMatch('m2', 'scheduled', 'court-2', new Date('2026-02-27T12:00:00.000Z')),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      shouldUseCarousel: boolean | { value: boolean };
      totalCourtPages: number | { value: number };
      carouselRangeLabel: string | { value: string };
      carouselPage: number | { value: number };
    };

    expect(unwrap(vm.shouldUseCarousel)).toBe(true);
    expect(unwrap(vm.totalCourtPages)).toBe(2);
    expect(unwrap(vm.carouselRangeLabel)).toBe('COURTS 1-4 OF 5');

    await vi.advanceTimersByTimeAsync(9000);

    expect(unwrap(vm.carouselPage)).toBe(1);
    expect(unwrap(vm.carouselRangeLabel)).toBe('COURTS 5-5 OF 5');
  });

  it('renders structured sponsor data without object-string coercion', async () => {
    runtime.currentTournament = {
      id: 't1',
      name: 'Spring Open',
      sponsors: [
        {
          id: 's1',
          name: 'Ace Sports',
          logoUrl: 'https://example.com/ace.png',
          logoPath: 'tournaments/t1/branding/sponsors/s1/ace.png',
          displayOrder: 0,
        },
        {
          id: 's2',
          name: 'Fallback Sponsor',
          logoUrl: '',
          logoPath: '',
          displayOrder: 1,
        },
      ],
    };

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Fallback Sponsor');
    expect(wrapper.text()).not.toContain('[object Object]');
  });
});
