import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Court, GameScore, Match } from '@/types';
import OverlayCourtView from '@/features/overlay/views/OverlayCourtView.vue';

const runtime = {
  routeParams: {
    tournamentId: 't1',
    courtId: 'court-1',
  },
  courts: [] as Court[],
  categories: [{ id: 'cat-1', name: "Men's Singles" }],
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
    query: {},
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
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

const mountView = () => mount(OverlayCourtView);

describe('OverlayCourtView', () => {
  beforeEach(() => {
    runtime.routeParams = { tournamentId: 't1', courtId: 'court-1' };
    runtime.courts = [makeCourt('court-1', 'Court 1')];
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

  it('prioritizes live over ready state for a court tile', async () => {
    runtime.matches = [
      makeMatch('ready-match', 'ready', 'court-1'),
      makeMatch('live-match', 'in_progress', 'court-1', [makeScore(11, 8)]),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      tileState: 'live' | 'ready' | 'idle' | { value: 'live' | 'ready' | 'idle' };
      displayMatch: Match | null | { value: Match | null };
      currentGame: GameScore | { value: GameScore };
    };
    const displayMatch = unwrap(vm.displayMatch);
    const currentGame = unwrap(vm.currentGame);

    expect(unwrap(vm.tileState)).toBe('live');
    expect(displayMatch?.id).toBe('live-match');
    expect(currentGame.score1).toBe(11);
    expect(currentGame.score2).toBe(8);
    expect(mockDeps.subscribeTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeAllMatches).toHaveBeenCalledWith('t1');
  });

  it('shows idle state with default score when no live or ready match exists on court', async () => {
    runtime.matches = [makeMatch('other-court-live', 'in_progress', 'court-2', [makeScore(3, 2)])];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      tileState: 'live' | 'ready' | 'idle' | { value: 'live' | 'ready' | 'idle' };
      currentGame: GameScore | { value: GameScore };
      displayMatch: Match | null | { value: Match | null };
    };
    const currentGame = unwrap(vm.currentGame);

    expect(unwrap(vm.tileState)).toBe('idle');
    expect(unwrap(vm.displayMatch)).toBeNull();
    expect(currentGame.gameNumber).toBe(1);
    expect(currentGame.score1).toBe(0);
    expect(currentGame.score2).toBe(0);
  });
});
