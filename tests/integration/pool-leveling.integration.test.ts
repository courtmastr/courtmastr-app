import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DatasetDoc {
  id: string;
  data: Record<string, unknown>;
}

interface PreviewDataset {
  category: Record<string, unknown>;
  registrations: DatasetDoc[];
  players: DatasetDoc[];
  stages: DatasetDoc[];
  participants: DatasetDoc[];
  matches: DatasetDoc[];
  rounds: DatasetDoc[];
  groups: DatasetDoc[];
  scores: DatasetDoc[];
}

const mockDeps = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  aggregateStats: vi.fn(),
  sortWithBWFTiebreaker: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  doc: mockDeps.doc,
  getDoc: mockDeps.getDoc,
  getDocs: mockDeps.getDocs,
  collection: mockDeps.collection,
  query: mockDeps.query,
  where: mockDeps.where,
}));

vi.mock('@/composables/useLeaderboard', () => ({
  aggregateStats: mockDeps.aggregateStats,
  sortWithBWFTiebreaker: mockDeps.sortWithBWFTiebreaker,
}));

import { usePoolLeveling } from '@/composables/usePoolLeveling';

const makeQuerySnapshot = (docs: DatasetDoc[]) => ({
  empty: docs.length === 0,
  docs: docs.map((entry) => ({
    id: entry.id,
    data: () => entry.data,
  })),
});

const resolvePath = (ref: unknown): string => {
  if (typeof ref === 'object' && ref !== null && 'path' in ref) {
    const path = (ref as { path?: unknown }).path;
    if (typeof path === 'string') {
      return path;
    }
  }
  return '';
};

const configureDataset = (dataset: PreviewDataset): void => {
  mockDeps.getDoc.mockImplementation(async (ref: unknown) => {
    const path = resolvePath(ref);
    if (path === 'tournaments/t-1/categories/cat-1') {
      return {
        exists: () => true,
        id: 'cat-1',
        data: () => dataset.category,
      };
    }

    return {
      exists: () => false,
      id: '',
      data: () => ({}),
    };
  });

  mockDeps.getDocs.mockImplementation(async (ref: unknown) => {
    const path = resolvePath(ref);
    if (path === 'tournaments/t-1/registrations') return makeQuerySnapshot(dataset.registrations);
    if (path === 'tournaments/t-1/players') return makeQuerySnapshot(dataset.players);
    if (path === 'tournaments/t-1/categories/cat-1/stage') return makeQuerySnapshot(dataset.stages);
    if (path === 'tournaments/t-1/categories/cat-1/participant') return makeQuerySnapshot(dataset.participants);
    if (path === 'tournaments/t-1/categories/cat-1/match') return makeQuerySnapshot(dataset.matches);
    if (path === 'tournaments/t-1/categories/cat-1/round') return makeQuerySnapshot(dataset.rounds);
    if (path === 'tournaments/t-1/categories/cat-1/group') return makeQuerySnapshot(dataset.groups);
    if (path === 'tournaments/t-1/categories/cat-1/match_scores') return makeQuerySnapshot(dataset.scores);
    return makeQuerySnapshot([]);
  });
};

const makeRegistration = (id: string, playerId: string): DatasetDoc => ({
  id,
  data: {
    id,
    tournamentId: 't-1',
    categoryId: 'cat-1',
    participantType: 'player',
    playerId,
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-02-27T00:00:00.000Z'),
  },
});

const makePlayer = (id: string, firstName: string): DatasetDoc => ({
  id,
  data: {
    id,
    firstName,
    lastName: 'Player',
  },
});

describe('pool leveling integration', () => {
  beforeEach(() => {
    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    mockDeps.collection.mockReset().mockImplementation((_db, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    mockDeps.where.mockReset().mockReturnValue({ type: 'where' });
    mockDeps.query.mockReset().mockImplementation((base: { path: string }) => ({
      path: base.path,
    }));
    mockDeps.aggregateStats.mockReset().mockImplementation((poolRegistrations: Array<{ id: string }>) => {
      const stats = new Map<
        string,
        {
          registrationId: string;
          participantName: string;
          matchesWon: number;
          matchPoints: number;
          winRate: number;
          pointDifference: number;
          pointsFor: number;
        }
      >();

      poolRegistrations.forEach((registration, index) => {
        const score = poolRegistrations.length - index;
        stats.set(registration.id, {
          registrationId: registration.id,
          participantName: registration.id,
          matchesWon: score,
          matchPoints: score,
          winRate: score,
          pointDifference: score,
          pointsFor: score * 10,
        });
      });

      return stats;
    });
    mockDeps.sortWithBWFTiebreaker.mockReset().mockImplementation((entries: unknown[]) => ({
      sorted: entries as Array<Record<string, unknown>>,
    }));
    mockDeps.getDoc.mockReset();
    mockDeps.getDocs.mockReset();
  });

  it('marks previews as pending when pool matches are unfinished and recommends global bands for uneven pools', async () => {
    configureDataset({
      category: {
        format: 'pool_to_elimination',
        poolStageId: 1,
      },
      registrations: [
        makeRegistration('reg-1', 'p1'),
        makeRegistration('reg-2', 'p2'),
        makeRegistration('reg-3', 'p3'),
        makeRegistration('reg-4', 'p4'),
      ],
      players: [
        makePlayer('p1', 'A'),
        makePlayer('p2', 'B'),
        makePlayer('p3', 'C'),
        makePlayer('p4', 'D'),
      ],
      stages: [
        { id: '1', data: { id: 1, type: 'round_robin' } },
      ],
      participants: [
        { id: '1', data: { id: 1, name: 'reg-1' } },
        { id: '2', data: { id: 2, name: 'reg-2' } },
        { id: '3', data: { id: 3, name: 'reg-3' } },
        { id: '4', data: { id: 4, name: 'reg-4' } },
      ],
      matches: [
        {
          id: 'm1',
          data: {
            id: 'm1',
            stage_id: 1,
            group_id: 11,
            status: 4,
            opponent1: { id: 1, result: 'win' },
            opponent2: { id: 2, result: 'loss' },
          },
        },
        {
          id: 'm2',
          data: {
            id: 'm2',
            stage_id: 1,
            group_id: 11,
            status: 2,
            opponent1: { id: 1 },
            opponent2: { id: 3 },
          },
        },
        {
          id: 'm3',
          data: {
            id: 'm3',
            stage_id: 1,
            group_id: 12,
            status: 4,
            opponent1: { id: 4, result: 'win' },
            opponent2: { id: null },
          },
        },
      ],
      rounds: [],
      groups: [
        { id: '11', data: { id: 11, stage_id: 1, number: 1 } },
        { id: '12', data: { id: 12, stage_id: 1, number: 2 } },
      ],
      scores: [
        {
          id: 'm1',
          data: {
            status: 'completed',
            winnerId: 'reg-1',
            scores: [{ score1: 21, score2: 17 }],
          },
        },
        {
          id: 'm2',
          data: {
            status: 'ready',
          },
        },
        {
          id: 'm3',
          data: {
            status: 'walkover',
            winnerId: 'reg-4',
          },
        },
      ],
    });

    const leveling = usePoolLeveling();
    const preview = await leveling.generatePreview('t-1', 'cat-1', 3);

    expect(preview.pendingMatches).toBe(1);
    expect(leveling.hasPendingPoolMatches.value).toBe(true);
    expect(preview.recommendedMode).toBe('global_bands');
    expect(preview.defaultPoolMappings).toHaveLength(2);
    expect(preview.suggestedGlobalBands).toEqual([2, 1, 1]);
  });

  it('recommends pool-position mapping when pool sizes are balanced and complete', async () => {
    configureDataset({
      category: {
        format: 'pool_to_elimination',
        poolStageId: 1,
      },
      registrations: [
        makeRegistration('reg-1', 'p1'),
        makeRegistration('reg-2', 'p2'),
        makeRegistration('reg-3', 'p3'),
        makeRegistration('reg-4', 'p4'),
      ],
      players: [
        makePlayer('p1', 'A'),
        makePlayer('p2', 'B'),
        makePlayer('p3', 'C'),
        makePlayer('p4', 'D'),
      ],
      stages: [
        { id: '1', data: { id: 1, type: 'round_robin' } },
      ],
      participants: [
        { id: '1', data: { id: 1, name: 'reg-1' } },
        { id: '2', data: { id: 2, name: 'reg-2' } },
        { id: '3', data: { id: 3, name: 'reg-3' } },
        { id: '4', data: { id: 4, name: 'reg-4' } },
      ],
      matches: [
        {
          id: 'm1',
          data: {
            id: 'm1',
            stage_id: 1,
            group_id: 11,
            status: 4,
            opponent1: { id: 1, result: 'win' },
            opponent2: { id: 2, result: 'loss' },
          },
        },
        {
          id: 'm2',
          data: {
            id: 'm2',
            stage_id: 1,
            group_id: 12,
            status: 4,
            opponent1: { id: 3, result: 'win' },
            opponent2: { id: 4, result: 'loss' },
          },
        },
      ],
      rounds: [],
      groups: [
        { id: '11', data: { id: 11, stage_id: 1, number: 1 } },
        { id: '12', data: { id: 12, stage_id: 1, number: 2 } },
      ],
      scores: [
        {
          id: 'm1',
          data: {
            status: 'completed',
            winnerId: 'reg-1',
            scores: [{ score1: 21, score2: 19 }],
          },
        },
        {
          id: 'm2',
          data: {
            status: 'completed',
            winnerId: 'reg-3',
            scores: [{ score1: 21, score2: 18 }],
          },
        },
      ],
    });

    const leveling = usePoolLeveling();
    const preview = await leveling.generatePreview('t-1', 'cat-1', 3);

    expect(preview.pendingMatches).toBe(0);
    expect(leveling.hasPendingPoolMatches.value).toBe(false);
    expect(preview.recommendedMode).toBe('pool_position');
    expect(preview.participants).toHaveLength(4);
  });
});
