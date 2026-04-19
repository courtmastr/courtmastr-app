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

const makeRegistration = (
  id: string,
  playerId: string,
  registeredAt = '2026-04-18T00:00:00.000Z',
): DatasetDoc => ({
  id,
  data: {
    id,
    tournamentId: 't-1',
    categoryId: 'cat-1',
    participantType: 'player',
    playerId,
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date(registeredAt),
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

const makeParticipant = (id: number, registrationId: string): DatasetDoc => ({
  id: String(id),
  data: {
    id,
    name: registrationId,
  },
});

const createCompletedMatch = (
  matchId: string,
  groupId: number,
  p1Id: number,
  p2Id: number,
  winnerId: number,
  scores: Array<[number, number]>,
): { match: DatasetDoc; score: DatasetDoc } => {
  const participant1Won = winnerId === p1Id;
  const winnerRegistrationId = `reg-${String(winnerId).padStart(2, '0')}`;

  return {
    match: {
      id: matchId,
      data: {
        id: matchId,
        stage_id: 1,
        group_id: groupId,
        status: 4,
        opponent1: { id: p1Id, result: participant1Won ? 'win' : 'loss' },
        opponent2: { id: p2Id, result: participant1Won ? 'loss' : 'win' },
      },
    },
    score: {
      id: matchId,
      data: {
        status: 'completed',
        winnerId: winnerRegistrationId,
        scores: scores.map(([score1, score2], index) => ({
          gameNumber: index + 1,
          score1,
          score2,
          winnerId: score1 > score2 ? `reg-${String(p1Id).padStart(2, '0')}` : `reg-${String(p2Id).padStart(2, '0')}`,
          isComplete: true,
        })),
      },
    },
  };
};

describe('pool leveling global rank integration', () => {
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
    mockDeps.getDoc.mockReset();
    mockDeps.getDocs.mockReset();
  });

  it('uses the smart-bracket standings order for category-wide globalRank', async () => {
    const pool1Matches = [
      createCompletedMatch('p1-m1', 11, 1, 2, 1, [[21, 18], [21, 16]]),
      createCompletedMatch('p1-m2', 11, 1, 3, 1, [[21, 16], [21, 16]]),
      createCompletedMatch('p1-m3', 11, 1, 4, 1, [[21, 16], [21, 13]]),
      createCompletedMatch('p1-m4', 11, 2, 3, 2, [[21, 18], [21, 19]]),
      createCompletedMatch('p1-m5', 11, 2, 4, 2, [[21, 18], [21, 19]]),
      createCompletedMatch('p1-m6', 11, 3, 4, 3, [[21, 19], [21, 19]]),
    ];

    const pool2Matches = [
      createCompletedMatch('p2-m1', 12, 5, 6, 5, [[21, 0], [21, 0]]),
      createCompletedMatch('p2-m2', 12, 5, 7, 5, [[21, 0], [21, 0]]),
      createCompletedMatch('p2-m3', 12, 5, 8, 5, [[0, 21], [21, 0], [21, 0]]),
      createCompletedMatch('p2-m4', 12, 6, 7, 6, [[21, 18], [21, 19]]),
      createCompletedMatch('p2-m5', 12, 6, 8, 6, [[21, 18], [21, 19]]),
      createCompletedMatch('p2-m6', 12, 7, 8, 7, [[21, 19], [21, 19]]),
    ];

    configureDataset({
      category: {
        format: 'pool_to_elimination',
        poolStageId: 1,
      },
      registrations: [
        makeRegistration('reg-01', 'p1'),
        makeRegistration('reg-02', 'p2'),
        makeRegistration('reg-03', 'p3'),
        makeRegistration('reg-04', 'p4'),
        makeRegistration('reg-05', 'p5'),
        makeRegistration('reg-06', 'p6'),
        makeRegistration('reg-07', 'p7'),
        makeRegistration('reg-08', 'p8'),
      ],
      players: [
        makePlayer('p1', 'Alpha'),
        makePlayer('p2', 'Bravo'),
        makePlayer('p3', 'Charlie'),
        makePlayer('p4', 'Delta'),
        makePlayer('p5', 'Echo'),
        makePlayer('p6', 'Foxtrot'),
        makePlayer('p7', 'Golf'),
        makePlayer('p8', 'Hotel'),
      ],
      stages: [{ id: '1', data: { id: 1, type: 'round_robin' } }],
      participants: [
        makeParticipant(1, 'reg-01'),
        makeParticipant(2, 'reg-02'),
        makeParticipant(3, 'reg-03'),
        makeParticipant(4, 'reg-04'),
        makeParticipant(5, 'reg-05'),
        makeParticipant(6, 'reg-06'),
        makeParticipant(7, 'reg-07'),
        makeParticipant(8, 'reg-08'),
      ],
      matches: [...pool1Matches.map((item) => item.match), ...pool2Matches.map((item) => item.match)],
      rounds: [],
      groups: [
        { id: '11', data: { id: 11, stage_id: 1, number: 1 } },
        { id: '12', data: { id: 12, stage_id: 1, number: 2 } },
      ],
      scores: [...pool1Matches.map((item) => item.score), ...pool2Matches.map((item) => item.score)],
    });

    const leveling = usePoolLeveling();
    const preview = await leveling.generatePreview('t-1', 'cat-1', 3);

    expect(preview.participants.map((participant) => participant.registrationId).slice(0, 4)).toEqual([
      'reg-01',
      'reg-05',
      'reg-02',
      'reg-06',
    ]);
  });

  it('breaks exact global ties with the same registeredAt-desc fallback used by smart-bracket standings', async () => {
    const pool1Matches = [
      createCompletedMatch('p1-m1', 11, 1, 2, 1, [[21, 18], [21, 18]]),
      createCompletedMatch('p1-m2', 11, 1, 3, 1, [[21, 18], [21, 18]]),
      createCompletedMatch('p1-m3', 11, 1, 4, 1, [[21, 18], [21, 18]]),
      createCompletedMatch('p1-m4', 11, 2, 3, 2, [[21, 18], [21, 18]]),
      createCompletedMatch('p1-m5', 11, 2, 4, 2, [[21, 18], [21, 18]]),
      createCompletedMatch('p1-m6', 11, 3, 4, 3, [[21, 18], [21, 18]]),
    ];

    const pool2Matches = [
      createCompletedMatch('p2-m1', 12, 5, 6, 5, [[21, 18], [21, 18]]),
      createCompletedMatch('p2-m2', 12, 5, 7, 5, [[21, 18], [21, 18]]),
      createCompletedMatch('p2-m3', 12, 5, 8, 5, [[21, 18], [21, 18]]),
      createCompletedMatch('p2-m4', 12, 6, 7, 6, [[21, 18], [21, 18]]),
      createCompletedMatch('p2-m5', 12, 6, 8, 6, [[21, 18], [21, 18]]),
      createCompletedMatch('p2-m6', 12, 7, 8, 7, [[21, 18], [21, 18]]),
    ];

    configureDataset({
      category: {
        format: 'pool_to_elimination',
        poolStageId: 1,
      },
      registrations: [
        makeRegistration('reg-01', 'p1', '2026-04-18T10:00:00.000Z'),
        makeRegistration('reg-02', 'p2'),
        makeRegistration('reg-03', 'p3'),
        makeRegistration('reg-04', 'p4'),
        makeRegistration('reg-05', 'p5', '2026-04-18T10:05:00.000Z'),
        makeRegistration('reg-06', 'p6'),
        makeRegistration('reg-07', 'p7'),
        makeRegistration('reg-08', 'p8'),
      ],
      players: [
        makePlayer('p1', 'Alpha'),
        makePlayer('p2', 'Bravo'),
        makePlayer('p3', 'Charlie'),
        makePlayer('p4', 'Delta'),
        makePlayer('p5', 'Echo'),
        makePlayer('p6', 'Foxtrot'),
        makePlayer('p7', 'Golf'),
        makePlayer('p8', 'Hotel'),
      ],
      stages: [{ id: '1', data: { id: 1, type: 'round_robin' } }],
      participants: [
        makeParticipant(1, 'reg-01'),
        makeParticipant(2, 'reg-02'),
        makeParticipant(3, 'reg-03'),
        makeParticipant(4, 'reg-04'),
        makeParticipant(5, 'reg-05'),
        makeParticipant(6, 'reg-06'),
        makeParticipant(7, 'reg-07'),
        makeParticipant(8, 'reg-08'),
      ],
      matches: [...pool1Matches.map((item) => item.match), ...pool2Matches.map((item) => item.match)],
      rounds: [],
      groups: [
        { id: '11', data: { id: 11, stage_id: 1, number: 1 } },
        { id: '12', data: { id: 12, stage_id: 1, number: 2 } },
      ],
      scores: [...pool1Matches.map((item) => item.score), ...pool2Matches.map((item) => item.score)],
    });

    const leveling = usePoolLeveling();
    const preview = await leveling.generatePreview('t-1', 'cat-1', 3);

    expect(preview.participants.map((participant) => participant.registrationId).slice(0, 2)).toEqual([
      'reg-05',
      'reg-01',
    ]);
  });
});
