import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Category,
  GameScore,
  Match,
  Player,
  Registration,
  Tournament,
} from '@/types';
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
  name: 'Mega Pool To Elimination',
  sport: 'badminton',
  format: 'pool_to_elimination',
  status: 'active',
  startDate: new Date('2026-03-10T08:00:00.000Z'),
  endDate: new Date('2026-03-12T20:00:00.000Z'),
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
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
});

const makeCategory = (
  id: string,
  name: string,
  poolStageId: number,
  eliminationStageId: number
): Category => ({
  id,
  tournamentId: 't1',
  name,
  type: 'singles',
  gender: 'open',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  poolStageId,
  eliminationStageId,
  status: 'active',
  seedingEnabled: false,
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
});

const makePlayers = (playerIds: string[]): Player[] =>
  playerIds.map((id) => {
    const number = Number(id.replace('p', ''));
    return {
      id,
      firstName: 'Player',
      lastName: String(number),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    };
  });

const makeRegistrations = (categoryId: string, playerIds: string[]): Registration[] =>
  playerIds.map((playerId, index) => ({
    id: `${categoryId}-r${index + 1}`,
    tournamentId: 't1',
    categoryId,
    participantType: 'player',
    playerId,
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-03-01T00:00:00.000Z'),
  }));

const chunk = <T,>(items: T[], size: number): T[][] => {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
};

const makeScores = (participant1Id: string, winnerId: string): GameScore[] => {
  if (winnerId === participant1Id) {
    return [
      { gameNumber: 1, score1: 21, score2: 15, winnerId, isComplete: true },
      { gameNumber: 2, score1: 21, score2: 17, winnerId, isComplete: true },
    ];
  }

  return [
    { gameNumber: 1, score1: 15, score2: 21, winnerId, isComplete: true },
    { gameNumber: 2, score1: 17, score2: 21, winnerId, isComplete: true },
  ];
};

const makeMatch = (
  id: string,
  categoryId: string,
  participant1Id: string,
  participant2Id: string,
  winnerId: string,
  stageId: string,
  round: number,
  matchNumber: number,
  levelId?: string
): Match => ({
  id,
  tournamentId: 't1',
  categoryId,
  stageId,
  levelId,
  round,
  matchNumber,
  bracketPosition: {
    bracket: 'winners',
    round,
    position: matchNumber,
  },
  participant1Id,
  participant2Id,
  winnerId,
  status: 'completed',
  scores: makeScores(participant1Id, winnerId),
  createdAt: new Date('2026-03-10T09:00:00.000Z'),
  updatedAt: new Date('2026-03-10T09:00:00.000Z'),
});

interface CategoryMatchBuild {
  matches: Match[];
  poolMatchCount: number;
  eliminationMatchCount: number;
}

const buildPoolToEliminationMatches = (
  categoryId: string,
  registrationIds: string[],
  poolSize: number,
  poolStageId: number,
  eliminationStageId: number
): CategoryMatchBuild => {
  const groups = chunk(registrationIds, poolSize);
  const matches: Match[] = [];
  const qualifiers: string[] = [];
  let matchNumber = 1;

  // Each pool has deterministic round-robin outcomes:
  // seed1 beats everyone, seed2 beats seed3/seed4, seed3 beats seed4.
  const poolPairings: Array<[number, number, number]> = [
    [0, 1, 0],
    [0, 2, 0],
    [0, 3, 0],
    [1, 2, 1],
    [1, 3, 1],
    [2, 3, 2],
  ];

  groups.forEach((group, poolIndex) => {
    poolPairings.forEach(([leftIdx, rightIdx, winnerIdx], pairIndex) => {
      const participant1Id = group[leftIdx];
      const participant2Id = group[rightIdx];
      const winnerId = group[winnerIdx];

      matches.push(
        makeMatch(
          `${categoryId}-pool-${poolIndex + 1}-${pairIndex + 1}`,
          categoryId,
          participant1Id,
          participant2Id,
          winnerId,
          String(poolStageId),
          1,
          matchNumber++
        )
      );
    });

    qualifiers.push(group[0], group[1]);
  });

  // First elimination round using top-2 qualifiers from pools, deterministic winner = participant1.
  for (let i = 0; i < qualifiers.length; i += 2) {
    const participant1Id = qualifiers[i];
    const participant2Id = qualifiers[i + 1];

    matches.push(
      makeMatch(
        `${categoryId}-elim-r1-${i / 2 + 1}`,
        categoryId,
        participant1Id,
        participant2Id,
        participant1Id,
        String(eliminationStageId),
        2,
        matchNumber++,
        'elim-r1'
      )
    );
  }

  return {
    matches,
    poolMatchCount: groups.length * poolPairings.length,
    eliminationMatchCount: qualifiers.length / 2,
  };
};

describe('leaderboard - pool_to_elimination large tournament scenarios', () => {
  beforeEach(() => {
    runtime.currentTournament = makeTournament();

    const categoryA = makeCategory('cat-a', 'Category A Singles', 10, 11);
    const categoryB = makeCategory('cat-b', 'Category B Singles', 20, 21);
    runtime.categories = [categoryA, categoryB];

    const categoryAPlayerIds = Array.from({ length: 40 }, (_, idx) => `p${idx + 1}`);
    const categoryBPlayerIds = ['p1', 'p2', 'p3', 'p4', 'p41', 'p42', 'p43', 'p44'];

    const uniquePlayerIds = Array.from(new Set([...categoryAPlayerIds, ...categoryBPlayerIds]));
    runtime.players = makePlayers(uniquePlayerIds);

    const categoryARegistrations = makeRegistrations('cat-a', categoryAPlayerIds);
    const categoryBRegistrations = makeRegistrations('cat-b', categoryBPlayerIds);
    runtime.registrations = [...categoryARegistrations, ...categoryBRegistrations];

    const categoryAMatches = buildPoolToEliminationMatches(
      'cat-a',
      categoryARegistrations.map((registration) => registration.id),
      4,
      10,
      11
    );

    const categoryBMatches = buildPoolToEliminationMatches(
      'cat-b',
      categoryBRegistrations.map((registration) => registration.id),
      4,
      20,
      21
    );

    runtime.matches = [...categoryAMatches.matches, ...categoryBMatches.matches];

    mockDeps.fetchMatches.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
  });

  it('shows pool-level leaderboard for 10 pools x 4 members in a category', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1', 'cat-a', { phaseScope: 'pool' });

    const leaderboard = leaderboardVm.leaderboard.value;
    expect(leaderboard).not.toBeNull();
    expect(leaderboard?.phaseScope).toBe('pool');
    expect(leaderboard?.totalParticipants).toBe(40);
    expect(leaderboard?.totalMatches).toBe(60); // 10 pools x 6 round-robin matches
    expect(leaderboard?.entries.every((entry) => entry.matchesPlayed === 3)).toBe(true);
    expect(Math.max(...(leaderboard?.entries.map((entry) => entry.matchPoints) ?? [0]))).toBe(6);
  });

  it('shows full category leaderboard with carry-forward pool + elimination results', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1', 'cat-a', { phaseScope: 'category' });

    const leaderboard = leaderboardVm.leaderboard.value;
    expect(leaderboard).not.toBeNull();
    expect(leaderboard?.phaseScope).toBe('category');
    expect(leaderboard?.totalParticipants).toBe(40);
    expect(leaderboard?.totalMatches).toBe(70); // 60 pool + 10 elimination r1

    const highestMatchPoints = Math.max(...(leaderboard?.entries.map((entry) => entry.matchPoints) ?? [0]));
    expect(highestMatchPoints).toBe(8);
    expect(leaderboard?.entries.filter((entry) => entry.matchPoints === 8).length).toBe(10);
  });

  it('supports tournament-wide standings across multiple categories with overlapping players', async () => {
    const leaderboardVm = useLeaderboard();

    await leaderboardVm.generate('t1');

    const leaderboard = leaderboardVm.leaderboard.value;
    expect(leaderboard).not.toBeNull();
    expect(leaderboard?.scope).toBe('tournament');
    expect(leaderboard?.totalParticipants).toBe(48); // cat-a 40 + cat-b 8
    expect(leaderboard?.totalMatches).toBe(84); // cat-a 70 + cat-b 14
    expect(leaderboard?.categories).toHaveLength(2);

    // Player 1 appears in both categories using separate registrations.
    const playerOneRows = leaderboard?.entries.filter((entry) => entry.participantName === 'Player 1') ?? [];
    expect(playerOneRows).toHaveLength(2);
    expect(new Set(playerOneRows.map((entry) => entry.categoryId))).toEqual(new Set(['cat-a', 'cat-b']));
  });
});
