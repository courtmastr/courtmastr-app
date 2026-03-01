import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Match, Player, Registration } from '@/types';
import { useLeaderboard } from '@/composables/useLeaderboard';

const runtime = {
  matches: [] as Match[],
  registrations: [] as Registration[],
  players: [] as Player[],
  categories: [] as Category[],
};

const mockDeps = vi.hoisted(() => ({
  fetchMatches: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
  fetchTournament: vi.fn(),
  exportLeaderboard: vi.fn(),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    fetchMatches: mockDeps.fetchMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    players: runtime.players,
    fetchRegistrations: mockDeps.fetchRegistrations,
    fetchPlayers: mockDeps.fetchPlayers,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    categories: runtime.categories,
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

vi.mock('@/services/leaderboardExport', () => ({
  exportLeaderboard: mockDeps.exportLeaderboard,
}));

const makeCategory = (): Category => ({
  id: 'cat-1',
  tournamentId: 't1',
  name: "Men's Singles",
  type: 'singles',
  gender: 'men',
  ageGroup: 'open',
  format: 'single_elimination',
  status: 'active',
  seedingEnabled: false,
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const makePlayers = (): Player[] => ([
  {
    id: 'p1',
    firstName: 'Alice',
    lastName: 'A',
    createdAt: new Date('2026-02-27T09:00:00.000Z'),
    updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  },
  {
    id: 'p2',
    firstName: 'Bob',
    lastName: 'B',
    createdAt: new Date('2026-02-27T09:00:00.000Z'),
    updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  },
]);

const makeRegistrations = (): Registration[] => ([
  {
    id: 'reg-1',
    tournamentId: 't1',
    categoryId: 'cat-1',
    participantType: 'player',
    playerId: 'p1',
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-02-27T09:00:00.000Z'),
  },
  {
    id: 'reg-2',
    tournamentId: 't1',
    categoryId: 'cat-1',
    participantType: 'player',
    playerId: 'p2',
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-02-27T09:00:00.000Z'),
  },
]);

const makeCompletedMatch = (): Match => ({
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
  winnerId: 'reg-1',
  status: 'completed',
  scores: [
    {
      gameNumber: 1,
      score1: 21,
      score2: 16,
      winnerId: 'reg-1',
      isComplete: true,
    },
  ],
  createdAt: new Date('2026-02-27T10:00:00.000Z'),
  updatedAt: new Date('2026-02-27T10:00:00.000Z'),
});

const makeCompletedMatchWithStage = (id: string, stageId: string): Match => ({
  ...makeCompletedMatch(),
  id,
  stageId,
});

describe('leaderboard integration', () => {
  beforeEach(() => {
    runtime.categories = [makeCategory()];
    runtime.players = makePlayers();
    runtime.registrations = makeRegistrations();
    runtime.matches = [makeCompletedMatch()];

    mockDeps.fetchMatches.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.exportLeaderboard.mockReset().mockResolvedValue(undefined);
  });

  it('generates category leaderboard using store-preloaded data and records fetch lifecycle', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1', 'cat-1');

    expect(mockDeps.fetchMatches).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchRegistrations).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchPlayers).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchTournament).not.toHaveBeenCalled();
    expect(leaderboardVm.stage.value).toBe('done');
    expect(leaderboardVm.error.value).toBeNull();
    expect(leaderboardVm.leaderboard.value?.scope).toBe('category');
    expect(leaderboardVm.leaderboard.value?.entries).toHaveLength(2);
  });

  it('applies includeEliminated filter to expose only active participants', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1', 'cat-1');
    leaderboardVm.applyFilters({ includeEliminated: false });

    expect(leaderboardVm.filteredEntries.value).toHaveLength(1);
    expect(leaderboardVm.filteredEntries.value[0].registrationId).toBe('reg-1');
  });

  it('supports pool phase scope selection for category generation', async () => {
    runtime.categories = [{ ...makeCategory(), format: 'pool_to_elimination', poolStageId: 10 }];
    runtime.matches = [
      makeCompletedMatchWithStage('pool-match', '10'),
      makeCompletedMatchWithStage('elim-match', '11'),
    ];

    const leaderboardVm = useLeaderboard();
    await leaderboardVm.generate('t1', 'cat-1', { phaseScope: 'pool' });

    expect(leaderboardVm.leaderboard.value?.totalMatches).toBe(1);
    expect(leaderboardVm.leaderboard.value?.phaseScope).toBe('pool');
  });
});
