import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Match, Player, Registration, Tournament } from '@/types';
import { useLeaderboard } from '@/composables/useLeaderboard';

const runtime = {
  matches: [] as Match[],
  registrations: [] as Registration[],
  players: [] as Player[],
  categories: [] as Category[],
  currentTournament: null as Tournament | null,
};

const mockDeps = vi.hoisted(() => ({
  fetchMatches: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
  fetchTournament: vi.fn(),
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
    currentTournament: runtime.currentTournament,
    categories: runtime.categories,
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

const makeTournament = (): Tournament => ({
  id: 't1',
  name: 'Pool Championship',
  sport: 'badminton',
  format: 'pool_to_elimination',
  status: 'active',
  startDate: new Date('2026-03-01T08:00:00.000Z'),
  endDate: new Date('2026-03-02T20:00:00.000Z'),
  settings: {
    minRestTimeMinutes: 15,
    matchDurationMinutes: 30,
    allowSelfRegistration: true,
    requireApproval: true,
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
    rankingPresetDefault: 'courtmaster_default',
    progressionModeDefault: 'carry_forward',
  },
  createdBy: 'admin-1',
  organizerIds: ['admin-1'],
  createdAt: new Date('2026-02-15T00:00:00.000Z'),
  updatedAt: new Date('2026-02-15T00:00:00.000Z'),
});

const makeCategory = (): Category => ({
  id: 'cat-1',
  tournamentId: 't1',
  name: "Men's Singles",
  type: 'singles',
  gender: 'men',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  poolStageId: 10,
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

const makeMatch = (
  id: string,
  stageId: string,
  winnerId: 'reg-1' | 'reg-2',
  levelId?: string
): Match => {
  const reg1Wins = winnerId === 'reg-1';
  return {
    id,
    tournamentId: 't1',
    categoryId: 'cat-1',
    stageId,
    levelId,
    round: 1,
    matchNumber: 1,
    bracketPosition: {
      bracket: 'winners',
      round: 1,
      position: 1,
    },
    participant1Id: 'reg-1',
    participant2Id: 'reg-2',
    winnerId,
    status: 'completed',
    scores: [
      {
        gameNumber: 1,
        score1: reg1Wins ? 21 : 18,
        score2: reg1Wins ? 18 : 21,
        winnerId,
        isComplete: true,
      },
    ],
    createdAt: new Date('2026-02-27T10:00:00.000Z'),
    updatedAt: new Date('2026-02-27T10:00:00.000Z'),
  };
};

describe('leaderboard pool-history recomputation', () => {
  beforeEach(() => {
    runtime.currentTournament = makeTournament();
    runtime.categories = [makeCategory()];
    runtime.players = makePlayers();
    runtime.registrations = makeRegistrations();
    runtime.matches = [
      makeMatch('pool-match', '10', 'reg-1'),
      makeMatch('elim-match', '11', 'reg-1', 'level-1'),
    ];

    mockDeps.fetchMatches.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
  });

  it('live-recomputes pool and category standings after a pool score correction', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1', 'cat-1', { phaseScope: 'pool' });
    expect(leaderboardVm.leaderboard.value?.phaseScope).toBe('pool');
    expect(leaderboardVm.leaderboard.value?.entries[0].registrationId).toBe('reg-1');

    await leaderboardVm.generate('t1', 'cat-1', { phaseScope: 'category' });
    expect(leaderboardVm.leaderboard.value?.phaseScope).toBe('category');
    expect(leaderboardVm.leaderboard.value?.entries[0].registrationId).toBe('reg-1');

    // Pool correction: the recorded winner flips to reg-2.
    runtime.matches.splice(
      0,
      runtime.matches.length,
      makeMatch('pool-match', '10', 'reg-2'),
      makeMatch('elim-match', '11', 'reg-1', 'level-1')
    );

    await leaderboardVm.generate('t1', 'cat-1', { phaseScope: 'pool' });
    expect(leaderboardVm.leaderboard.value?.entries[0].registrationId).toBe('reg-2');

    await leaderboardVm.generate('t1', 'cat-1', { phaseScope: 'category' });
    expect(leaderboardVm.leaderboard.value?.entries[0].registrationId).toBe('reg-2');
  });
});
