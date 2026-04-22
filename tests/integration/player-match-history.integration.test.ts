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

function setPathDocs(pathDocs: Record<string, MockDocRecord[]>): void {
  mockDeps.getDocs.mockImplementation(async (ref: MockCollectionRef) =>
    makeQuerySnapshot(pathDocs[ref.path] ?? [])
  );
}

function tournamentRecord(id: string, name: string, startDateIso: string): MockDocRecord {
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

function playerRecord(id: string, firstName: string, lastName: string): MockDocRecord {
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

function registrationRecord(
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

function categoryRecord(
  id: string,
  tournamentId: string,
  name: string,
  type: 'singles' | 'doubles' | 'mixed_doubles'
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

describe('fetchPlayerMatchHistory — integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDeps.getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it('returns empty array when the player is not registered in any tournament', async () => {
    setPathDocs({
      tournaments: [tournamentRecord('t1', 'Spring Open', '2026-04-10T00:00:00.000Z')],
      'tournaments/t1/players': [],
      'tournaments/t1/registrations': [],
      'tournaments/t1/categories': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');

    await expect(fetchPlayerMatchHistory('missing-player')).resolves.toEqual([]);
  });

  it('resolves TNF-style sparse score docs from level bracket storage', async () => {
    setPathDocs({
      tournaments: [tournamentRecord('tnf', 'TNF Badminton - 2026', '2026-04-18T00:00:00.000Z')],
      'tournaments/tnf/players': [
        playerRecord('player-kishore', 'Kishore', 'Subbarao'),
        playerRecord('player-ramc', 'Ramchand', 'Venkatasamy'),
        playerRecord('player-opp-1', 'Other', 'One'),
      ],
      'tournaments/tnf/registrations': [
        registrationRecord('reg-kishore-ramc', 'tnf', 'cat-md', 'player-kishore', {
          participantType: 'team',
          partnerPlayerId: 'player-ramc',
          teamName: 'Kishore Subbarao / RamC Venkatasamy',
        }),
        registrationRecord('reg-opp', 'tnf', 'cat-md', 'player-opp-1', {
          participantType: 'team',
          partnerPlayerId: 'player-opp-2',
          teamName: 'Other One / Other Two',
        }),
      ],
      'tournaments/tnf/categories': [
        categoryRecord('cat-md', 'tnf', "Men's Doubles", 'doubles'),
      ],
      'tournaments/tnf/categories/cat-md/levels': [{ id: 'level-2', data: {} }],
      'tournaments/tnf/categories/cat-md/match_scores': [],
      'tournaments/tnf/categories/cat-md/match': [],
      'tournaments/tnf/categories/cat-md/participant': [],
      'tournaments/tnf/categories/cat-md/levels/level-2/match_scores': [
        {
          id: 'level-match-1',
          data: {
            winnerId: 'reg-kishore-ramc',
            status: 'completed',
            scores: [
              { gameNumber: 1, score1: 21, score2: 17, isComplete: true },
              { gameNumber: 2, score1: 21, score2: 14, isComplete: true },
            ],
            completedAt: makeTimestamp('2026-04-18T13:15:00.000Z'),
          },
        },
      ],
      'tournaments/tnf/categories/cat-md/levels/level-2/match': [
        {
          id: 'level-match-1',
          data: {
            id: 'level-match-1',
            opponent1: { id: 6, result: 'win' },
            opponent2: { id: 9, result: 'loss' },
          },
        },
      ],
      'tournaments/tnf/categories/cat-md/levels/level-2/participant': [
        { id: '6', data: { id: 6, name: 'reg-kishore-ramc' } },
        { id: '9', data: { id: 9, name: 'reg-opp' } },
      ],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result: TournamentHistoryEntry[] = await fetchPlayerMatchHistory('player-ramc');

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0]).toMatchObject({
      opponentName: 'Other One / Other Two',
      partnerName: 'Kishore Subbarao',
      result: 'win',
      categoryType: 'doubles',
    });
  });

  it('keeps tournament entries even when there are no completed matches yet', async () => {
    setPathDocs({
      tournaments: [tournamentRecord('live', 'Live Tournament', '2026-04-20T00:00:00.000Z')],
      'tournaments/live/players': [playerRecord('player-alice', 'Alice', 'Smith')],
      'tournaments/live/registrations': [
        registrationRecord('reg-alice', 'live', 'cat-singles', 'player-alice'),
      ],
      'tournaments/live/categories': [
        categoryRecord('cat-singles', 'live', "Women's Singles", 'singles'),
      ],
      'tournaments/live/categories/cat-singles/levels': [],
      'tournaments/live/categories/cat-singles/match_scores': [],
      'tournaments/live/categories/cat-singles/match': [],
      'tournaments/live/categories/cat-singles/participant': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-alice');

    expect(result).toHaveLength(1);
    expect(result[0].matches).toEqual([]);
  });

  it('sorts multiple tournament entries newest first', async () => {
    setPathDocs({
      tournaments: [
        tournamentRecord('old', 'Old Tournament', '2026-03-01T00:00:00.000Z'),
        tournamentRecord('new', 'New Tournament', '2026-04-21T00:00:00.000Z'),
      ],
      'tournaments/old/players': [],
      'tournaments/old/registrations': [
        registrationRecord('reg-old', 'old', 'cat-a', 'player-alice'),
      ],
      'tournaments/old/categories': [],
      'tournaments/old/categories/cat-a/levels': [],
      'tournaments/old/categories/cat-a/match_scores': [],
      'tournaments/old/categories/cat-a/match': [],
      'tournaments/old/categories/cat-a/participant': [],
      'tournaments/new/players': [],
      'tournaments/new/registrations': [
        registrationRecord('reg-new', 'new', 'cat-a', 'player-alice'),
      ],
      'tournaments/new/categories': [],
      'tournaments/new/categories/cat-a/levels': [],
      'tournaments/new/categories/cat-a/match_scores': [],
      'tournaments/new/categories/cat-a/match': [],
      'tournaments/new/categories/cat-a/participant': [],
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-alice');

    expect(result.map((entry) => entry.tournamentName)).toEqual([
      'New Tournament',
      'Old Tournament',
    ]);
  });
});
