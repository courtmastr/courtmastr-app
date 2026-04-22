import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TournamentHistoryEntry } from '@/types';

interface MockDocRecord {
  id: string;
  data: Record<string, unknown>;
}

interface MockCollectionRef {
  path: string;
}

const mockDeps = vi.hoisted(() => ({
  getDocs: vi.fn(),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  db: {},
}));

class MockTimestamp {
  constructor(private readonly date: Date = new Date()) {}

  toDate(): Date {
    return this.date;
  }
}

vi.mock('@/services/firebase', () => ({
  db: mockDeps.db,
  collection: mockDeps.collection,
  getDocs: mockDeps.getDocs,
  Timestamp: MockTimestamp,
}));

function makeQuerySnapshot(docs: MockDocRecord[]) {
  return {
    docs: docs.map((docRecord) => ({
      id: docRecord.id,
      data: () => docRecord.data,
    })),
    empty: docs.length === 0,
  };
}

function makeTimestamp(iso: string): { toDate: () => Date } {
  const date = new Date(iso);
  return { toDate: () => date };
}

function makeTournament(
  id: string,
  name: string,
  startDateIso: string
): MockDocRecord {
  return {
    id,
    data: {
      name,
      sport: 'badminton',
      status: 'completed',
      format: 'single_elimination',
      settings: {},
      createdBy: 'admin',
      startDate: makeTimestamp(startDateIso),
      endDate: makeTimestamp(startDateIso),
      createdAt: makeTimestamp(startDateIso),
      updatedAt: makeTimestamp(startDateIso),
    },
  };
}

function makePlayer(
  id: string,
  firstName: string,
  lastName: string
): MockDocRecord {
  return {
    id,
    data: {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}@test.com`,
      createdAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
      updatedAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
    },
  };
}

function makeRegistration(
  id: string,
  tournamentId: string,
  categoryId: string,
  playerId: string,
  options: {
    participantType?: 'player' | 'team';
    partnerPlayerId?: string;
    teamName?: string;
  } = {}
): MockDocRecord {
  return {
    id,
    data: {
      tournamentId,
      categoryId,
      participantType: options.participantType ?? 'player',
      playerId,
      partnerPlayerId: options.partnerPlayerId,
      teamName: options.teamName,
      status: 'approved',
      registeredBy: 'admin',
      registeredAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
      createdAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
      updatedAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
    },
  };
}

function makeCategory(
  id: string,
  tournamentId: string,
  name: string,
  type: 'singles' | 'doubles' | 'mixed_doubles' = 'singles'
): MockDocRecord {
  return {
    id,
    data: {
      tournamentId,
      name,
      type,
      gender: type === 'mixed_doubles' ? 'mixed' : 'men',
      ageGroup: 'open',
      format: 'single_elimination',
      seedingEnabled: false,
      status: 'completed',
      createdAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
      updatedAt: makeTimestamp('2026-04-01T12:00:00.000Z'),
    },
  };
}

function makeScoreDoc(
  id: string,
  options: {
    participant1Id?: string;
    participant2Id?: string;
    winnerId?: string;
    status?: 'completed' | 'walkover' | 'pending';
    scores?: Array<{
      gameNumber: number;
      score1: number;
      score2: number;
      isComplete: boolean;
    }>;
    completedAt?: string;
  }
): MockDocRecord {
  return {
    id,
    data: {
      participant1Id: options.participant1Id,
      participant2Id: options.participant2Id,
      winnerId: options.winnerId,
      status: options.status ?? 'completed',
      scores: options.scores ?? [],
      completedAt: options.completedAt
        ? makeTimestamp(options.completedAt)
        : undefined,
    },
  };
}

function makeBracketMatch(
  id: string,
  options: {
    opponent1Id: string | number;
    opponent1Result: 'win' | 'loss';
    opponent2Id: string | number;
    opponent2Result: 'win' | 'loss';
  }
): MockDocRecord {
  return {
    id,
    data: {
      id,
      opponent1: {
        id: options.opponent1Id,
        result: options.opponent1Result,
      },
      opponent2: {
        id: options.opponent2Id,
        result: options.opponent2Result,
      },
    },
  };
}

function makeParticipant(
  id: string | number,
  registrationId: string
): MockDocRecord {
  return {
    id: String(id),
    data: {
      id,
      name: registrationId,
    },
  };
}

function setPathDocs(pathDocs: Record<string, MockDocRecord[]>): void {
  mockDeps.getDocs.mockImplementation(async (ref: MockCollectionRef) =>
    makeQuerySnapshot(pathDocs[ref.path] ?? [])
  );
}

describe('fetchPlayerMatchHistory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDeps.getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it('returns empty array when there are no tournaments', async () => {
    setPathDocs({
      tournaments: [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');

    await expect(fetchPlayerMatchHistory('player-xyz')).resolves.toEqual([]);
  });

  it('returns history for a singles player from category-scoped match scores', async () => {
    const tournament = makeTournament('t1', 'Spring Open 2026', '2026-04-10T00:00:00.000Z');
    const player = makePlayer('player-alice', 'Alice', 'Smith');
    const opponent = makePlayer('player-bob', 'Bob', 'Jones');
    const playerRegistration = makeRegistration('reg-alice', 't1', 'cat-singles', 'player-alice');
    const opponentRegistration = makeRegistration('reg-bob', 't1', 'cat-singles', 'player-bob');
    const category = makeCategory('cat-singles', 't1', "Men's Singles");
    const matchScore = makeScoreDoc('match-1', {
      participant1Id: 'reg-alice',
      participant2Id: 'reg-bob',
      winnerId: 'reg-alice',
      scores: [
        { gameNumber: 1, score1: 21, score2: 15, isComplete: true },
        { gameNumber: 2, score1: 21, score2: 18, isComplete: true },
      ],
      completedAt: '2026-04-10T10:30:00.000Z',
    });

    setPathDocs({
      tournaments: [tournament],
      'tournaments/t1/players': [player, opponent],
      'tournaments/t1/registrations': [playerRegistration, opponentRegistration],
      'tournaments/t1/categories': [category],
      'tournaments/t1/categories/cat-singles/levels': [],
      'tournaments/t1/categories/cat-singles/match_scores': [matchScore],
      'tournaments/t1/categories/cat-singles/match': [],
      'tournaments/t1/categories/cat-singles/participant': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result: TournamentHistoryEntry[] = await fetchPlayerMatchHistory('player-alice');

    expect(result).toHaveLength(1);
    expect(result[0].tournamentName).toBe('Spring Open 2026');
    expect(result[0].categoryType).toBe('singles');
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0]).toMatchObject({
      matchId: 'match-1',
      opponentName: 'Bob Jones',
      partnerName: undefined,
      result: 'win',
      categoryType: 'singles',
    });
  });

  it('resolves sparse level-scoped doubles history through bracket participants', async () => {
    const tournament = makeTournament('tnf', 'TNF Badminton - 2026', '2026-04-18T00:00:00.000Z');
    const primaryPlayer = makePlayer('player-alice', 'Alice', 'Smith');
    const partnerPlayer = makePlayer('player-bob', 'Bob', 'Jones');
    const opponentPrimary = makePlayer('player-charlie', 'Charlie', 'Davis');
    const teamRegistration = makeRegistration('reg-team-ab', 'tnf', 'cat-doubles', 'player-alice', {
      participantType: 'team',
      partnerPlayerId: 'player-bob',
      teamName: 'Smith / Jones',
    });
    const opponentRegistration = makeRegistration('reg-team-cd', 'tnf', 'cat-doubles', 'player-charlie', {
      participantType: 'team',
      partnerPlayerId: 'player-dan',
      teamName: 'Davis / Evans',
    });
    const category = makeCategory('cat-doubles', 'tnf', "Men's Doubles", 'doubles');
    const sparseScore = makeScoreDoc('match-final', {
      winnerId: 'reg-team-ab',
      status: 'completed',
      scores: [{ gameNumber: 1, score1: 21, score2: 19, isComplete: true }],
      completedAt: '2026-04-18T15:00:00.000Z',
    });
    const bracketMatch = makeBracketMatch('match-final', {
      opponent1Id: 6,
      opponent1Result: 'win',
      opponent2Id: 9,
      opponent2Result: 'loss',
    });

    setPathDocs({
      tournaments: [tournament],
      'tournaments/tnf/players': [primaryPlayer, partnerPlayer, opponentPrimary],
      'tournaments/tnf/registrations': [teamRegistration, opponentRegistration],
      'tournaments/tnf/categories': [category],
      'tournaments/tnf/categories/cat-doubles/levels': [{ id: 'level-2', data: {} }],
      'tournaments/tnf/categories/cat-doubles/match_scores': [],
      'tournaments/tnf/categories/cat-doubles/match': [],
      'tournaments/tnf/categories/cat-doubles/participant': [],
      'tournaments/tnf/categories/cat-doubles/levels/level-2/match_scores': [sparseScore],
      'tournaments/tnf/categories/cat-doubles/levels/level-2/match': [bracketMatch],
      'tournaments/tnf/categories/cat-doubles/levels/level-2/participant': [
        makeParticipant(6, 'reg-team-ab'),
        makeParticipant(9, 'reg-team-cd'),
      ],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-bob');

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0]).toMatchObject({
      opponentName: 'Davis / Evans',
      partnerName: 'Alice Smith',
      result: 'win',
      categoryType: 'doubles',
    });
  });

  it('marks walkovers without losing the completed tournament entry', async () => {
    const tournament = makeTournament('t1', 'Walkover Cup', '2026-04-12T00:00:00.000Z');
    const player = makePlayer('player-alice', 'Alice', 'Smith');
    const opponent = makePlayer('player-bob', 'Bob', 'Jones');
    const playerRegistration = makeRegistration('reg-alice', 't1', 'cat-singles', 'player-alice');
    const opponentRegistration = makeRegistration('reg-bob', 't1', 'cat-singles', 'player-bob');
    const category = makeCategory('cat-singles', 't1', "Women's Singles");
    const matchScore = makeScoreDoc('match-wo', {
      participant1Id: 'reg-alice',
      participant2Id: 'reg-bob',
      winnerId: 'reg-alice',
      status: 'walkover',
      completedAt: '2026-04-12T11:00:00.000Z',
    });

    setPathDocs({
      tournaments: [tournament],
      'tournaments/t1/players': [player, opponent],
      'tournaments/t1/registrations': [playerRegistration, opponentRegistration],
      'tournaments/t1/categories': [category],
      'tournaments/t1/categories/cat-singles/levels': [],
      'tournaments/t1/categories/cat-singles/match_scores': [matchScore],
      'tournaments/t1/categories/cat-singles/match': [],
      'tournaments/t1/categories/cat-singles/participant': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-alice');

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0].result).toBe('walkover');
  });

  it('sorts tournament entries by start date descending', async () => {
    const oldTournament = makeTournament('t-old', 'Old Tournament', '2026-03-01T00:00:00.000Z');
    const newTournament = makeTournament('t-new', 'New Tournament', '2026-04-20T00:00:00.000Z');
    const registrationOld = makeRegistration('reg-old', 't-old', 'cat-1', 'player-alice');
    const registrationNew = makeRegistration('reg-new', 't-new', 'cat-1', 'player-alice');

    setPathDocs({
      tournaments: [oldTournament, newTournament],
      'tournaments/t-old/players': [],
      'tournaments/t-old/registrations': [registrationOld],
      'tournaments/t-old/categories': [],
      'tournaments/t-old/categories/cat-1/levels': [],
      'tournaments/t-old/categories/cat-1/match_scores': [],
      'tournaments/t-old/categories/cat-1/match': [],
      'tournaments/t-old/categories/cat-1/participant': [],
      'tournaments/t-new/players': [],
      'tournaments/t-new/registrations': [registrationNew],
      'tournaments/t-new/categories': [],
      'tournaments/t-new/categories/cat-1/levels': [],
      'tournaments/t-new/categories/cat-1/match_scores': [],
      'tournaments/t-new/categories/cat-1/match': [],
      'tournaments/t-new/categories/cat-1/participant': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-alice');

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.tournamentName)).toEqual([
      'New Tournament',
      'Old Tournament',
    ]);
  });
});
