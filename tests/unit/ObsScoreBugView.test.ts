import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Match } from '@/types';
import ObsScoreBugView from '@/features/obs/views/ObsScoreBugView.vue';

const runtime = {
  routeParams: { tournamentId: 't1', matchId: 'm1' },
  routeQuery: {} as Record<string, string | undefined>,
  currentMatch: null as Match | null,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  fetchMatch: vi.fn(),
  subscribeMatch: vi.fn(),
  clearCurrentMatch: vi.fn(),
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
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    currentMatch: runtime.currentMatch,
    fetchMatch: mockDeps.fetchMatch,
    subscribeMatch: mockDeps.subscribeMatch,
    clearCurrentMatch: mockDeps.clearCurrentMatch,
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
  status: Match['status'],
  scores: Match['scores'] = []
): Match => ({
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status,
  categoryName: "Men's Singles",
  courtName: 'Court 1',
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

const mountView = () => mount(ObsScoreBugView);

describe('ObsScoreBugView', () => {
  beforeEach(() => {
    runtime.routeParams = { tournamentId: 't1', matchId: 'm1' };
    runtime.routeQuery = {};
    runtime.currentMatch = makeMatch('in_progress', [
      {
        gameNumber: 1,
        score1: 21,
        score2: 16,
        winnerId: 'reg-1',
        isComplete: true,
      },
      {
        gameNumber: 2,
        score1: 19,
        score2: 21,
        winnerId: 'reg-2',
        isComplete: true,
      },
      {
        gameNumber: 3,
        score1: 8,
        score2: 7,
        isComplete: false,
      },
    ]);

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.fetchMatch.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeMatch.mockReset();
    mockDeps.clearCurrentMatch.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps position query and calculates games won from completed games', async () => {
    runtime.routeQuery = {
      position: 'top-right',
      theme: 'light',
      category: 'cat-1',
    };

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      position: string | { value: string };
      gamesWon1: number | { value: number };
      gamesWon2: number | { value: number };
      currentGame: { score1: number; score2: number } | { value: { score1: number; score2: number } };
      loading: boolean | { value: boolean };
    };
    const currentGame = unwrap(vm.currentGame);

    expect(unwrap(vm.position)).toBe('position-top-right');
    expect(unwrap(vm.gamesWon1)).toBe(1);
    expect(unwrap(vm.gamesWon2)).toBe(1);
    expect(currentGame.score1).toBe(8);
    expect(currentGame.score2).toBe(7);
    expect(unwrap(vm.loading)).toBe(false);
    expect(mockDeps.subscribeMatch).toHaveBeenCalledWith('t1', 'm1', 'cat-1');
  });

  it('sets error state and skips match subscription when fetchMatch fails', async () => {
    runtime.routeQuery = { category: 'cat-1' };
    mockDeps.fetchMatch.mockRejectedValueOnce(new Error('missing'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      error: string | null | { value: string | null };
      loading: boolean | { value: boolean };
    };

    expect(unwrap(vm.error)).toBe('Failed to load match');
    expect(unwrap(vm.loading)).toBe(false);
    expect(mockDeps.subscribeMatch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
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
