import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Match } from '@/types';
import ObsScoreboardView from '@/features/obs/views/ObsScoreboardView.vue';

const runtime = {
  routeParams: { tournamentId: 't1' },
  routeQuery: {} as Record<string, string | undefined>,
  matches: [] as Match[],
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
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: runtime.routeParams,
    query: runtime.routeQuery,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: { id: 't1', name: 'Spring Open' },
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

const makeMatch = (
  id: string,
  status: Match['status'],
  categoryId: string,
  scores: Match['scores'] = []
): Match => ({
  id,
  tournamentId: 't1',
  categoryId,
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
  scores,
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const unwrap = <T>(value: T | { value: T }): T => {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: T }).value;
  }
  return value as T;
};

const mountView = () => mount(ObsScoreboardView);

describe('ObsScoreboardView', () => {
  beforeEach(() => {
    runtime.routeParams = { tournamentId: 't1' };
    runtime.routeQuery = {};
    runtime.matches = [];

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
  });

  it('filters by category and caps ready matches to top three', async () => {
    runtime.routeQuery = { category: 'cat-1' };
    runtime.matches = [
      makeMatch('live-cat-1', 'in_progress', 'cat-1'),
      makeMatch('live-cat-2', 'in_progress', 'cat-2'),
      makeMatch('ready-1', 'ready', 'cat-1'),
      makeMatch('ready-2', 'ready', 'cat-1'),
      makeMatch('ready-3', 'ready', 'cat-1'),
      makeMatch('ready-4', 'ready', 'cat-1'),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      inProgressMatches: Match[] | { value: Match[] };
      readyMatches: Match[] | { value: Match[] };
      allMatches: Match[] | { value: Match[] };
    };
    const inProgressMatches = unwrap(vm.inProgressMatches);
    const readyMatches = unwrap(vm.readyMatches);
    const allMatches = unwrap(vm.allMatches);

    expect(inProgressMatches).toHaveLength(1);
    expect(inProgressMatches[0].id).toBe('live-cat-1');
    expect(readyMatches).toHaveLength(3);
    expect(readyMatches.map((match) => match.id)).toEqual(['ready-1', 'ready-2', 'ready-3']);
    expect(allMatches).toHaveLength(4);
  });

  it('uses ticker/light query mode and prefers incomplete game for current score', async () => {
    runtime.routeQuery = {
      mode: 'ticker',
      theme: 'light',
    };
    const match = makeMatch('live-score', 'in_progress', 'cat-1', [
      {
        gameNumber: 1,
        score1: 21,
        score2: 17,
        winnerId: 'live-score-p1',
        isComplete: true,
      },
      {
        gameNumber: 2,
        score1: 8,
        score2: 10,
        isComplete: false,
      },
    ]);
    runtime.matches = [match];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      theme: 'light' | 'dark' | { value: 'light' | 'dark' };
      viewMode: 'ticker' | 'full' | { value: 'ticker' | 'full' };
      getCurrentGame: (input: Match) => { score1: number; score2: number; gameNumber: number };
    };
    const currentGame = vm.getCurrentGame(match);

    expect(unwrap(vm.theme)).toBe('light');
    expect(unwrap(vm.viewMode)).toBe('ticker');
    expect(currentGame.gameNumber).toBe(2);
    expect(currentGame.score1).toBe(8);
    expect(currentGame.score2).toBe(10);
  });

  it('renders the CourtMastr watermark overlay', async () => {
    const wrapper = mountView();
    await flushPromises();

    const watermark = wrapper.find('.obs-courtmaster-watermark');
    expect(watermark.exists()).toBe(true);
    expect(wrapper.text()).toContain('CourtMastr');
    const logoSrc = wrapper.find('.obs-courtmaster-watermark__logo').attributes('src');
    expect(logoSrc).toContain('data:image/svg+xml');
    expect(logoSrc).toContain('%23FFFFFF');
  });
});
