import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Court, GameScore, Match } from '@/types';
import OverlayTickerView from '@/features/overlay/views/OverlayTickerView.vue';

const runtime = {
  routeParams: { tournamentId: 't1' },
  routeQuery: {} as Record<string, string | undefined>,
  courts: [] as Court[],
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
    courts: runtime.courts,
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

const makeCourt = (id: string, name: string): Court => ({
  id,
  tournamentId: 't1',
  name,
  number: Number(id.replace(/\D+/g, '')) || 1,
  status: 'available',
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const makeScore = (score1: number, score2: number, gameNumber = 1): GameScore => ({
  score1,
  score2,
  gameNumber,
  isComplete: false,
});

const makeMatch = (
  id: string,
  status: Match['status'],
  courtId: string,
  scores: GameScore[] = []
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

const mountView = () => mount(OverlayTickerView);

describe('OverlayTickerView', () => {
  beforeEach(() => {
    runtime.routeParams = { tournamentId: 't1' };
    runtime.routeQuery = {};
    runtime.courts = [makeCourt('court-1', 'Court 1'), makeCourt('court-2', 'Court 2')];
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

  it('duplicates ticker items and prioritizes live match on each court', async () => {
    runtime.matches = [
      makeMatch('ready-1', 'ready', 'court-1'),
      makeMatch('live-1', 'in_progress', 'court-1', [makeScore(14, 12, 2)]),
      makeMatch('ready-2', 'ready', 'court-2'),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      tickerItems: Array<{ state: 'live' | 'ready' | 'idle'; key: string }> | { value: Array<{ state: 'live' | 'ready' | 'idle'; key: string }> };
      duplicatedTickerItems: Array<unknown> | { value: Array<unknown> };
    };
    const tickerItems = unwrap(vm.tickerItems);
    const duplicatedTickerItems = unwrap(vm.duplicatedTickerItems);

    expect(tickerItems).toHaveLength(2);
    expect(tickerItems[0].state).toBe('live');
    expect(tickerItems[0].key).toContain('live-court-1-live-1');
    expect(tickerItems[1].state).toBe('ready');
    expect(duplicatedTickerItems).toHaveLength(4);
  });

  it('maps speed query to ticker duration and falls back to no-courts idle item', async () => {
    runtime.courts = [];
    runtime.matches = [];

    runtime.routeQuery = { speed: 'slow' };
    const slowWrapper = mountView();
    await flushPromises();
    const slowVm = slowWrapper.vm as unknown as {
      scrollDuration: number | { value: number };
      tickerItems: Array<{ key: string; state: 'idle' }> | { value: Array<{ key: string; state: 'idle' }> };
    };
    expect(unwrap(slowVm.scrollDuration)).toBe(90);
    expect(unwrap(slowVm.tickerItems)[0].key).toBe('no-courts');

    runtime.routeQuery = { speed: 'fast' };
    const fastWrapper = mountView();
    await flushPromises();
    const fastVm = fastWrapper.vm as unknown as { scrollDuration: number | { value: number } };
    expect(unwrap(fastVm.scrollDuration)).toBe(30);

    runtime.routeQuery = {};
    const defaultWrapper = mountView();
    await flushPromises();
    const defaultVm = defaultWrapper.vm as unknown as { scrollDuration: number | { value: number } };
    expect(unwrap(defaultVm.scrollDuration)).toBe(60);
  });
});
