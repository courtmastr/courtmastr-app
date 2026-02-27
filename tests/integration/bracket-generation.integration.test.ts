import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectArg = number | string | Record<string, unknown> | undefined;

interface SnapshotDoc {
  id: string;
  data: () => Record<string, unknown>;
}

const mockDeps = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  storageSelect: vi.fn(),
  managerCreateStage: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  doc: mockDeps.doc,
  getDoc: mockDeps.getDoc,
  getDocs: mockDeps.getDocs,
  setDoc: mockDeps.setDoc,
  collection: mockDeps.collection,
  query: mockDeps.query,
  where: mockDeps.where,
  writeBatch: mockDeps.writeBatch,
  serverTimestamp: mockDeps.serverTimestamp,
}));

vi.mock('@/services/brackets-storage', () => ({
  ClientFirestoreStorage: class {
    constructor(_db: unknown, _rootPath: string) {}

    select = mockDeps.storageSelect;
    delete = vi.fn();
    insert = vi.fn();
    update = vi.fn();
  },
}));

vi.mock('brackets-manager', () => ({
  BracketsManager: class {
    constructor(_storage: unknown) {}

    create = {
      stage: mockDeps.managerCreateStage,
    };
  },
}));

import { useBracketGenerator } from '@/composables/useBracketGenerator';

const makeCategorySnapshot = (
  data: Record<string, unknown>
): { exists: () => boolean; id: string; data: () => Record<string, unknown> } => ({
  exists: () => true,
  id: 'cat-1',
  data: () => data,
});

const makeQuerySnapshot = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  empty: docs.length === 0,
  docs: docs.map<SnapshotDoc>((entry) => ({
    id: entry.id,
    data: () => entry.data,
  })),
});

const getStageIdArg = (arg: SelectArg): number | null => {
  if (!arg || typeof arg === 'number' || typeof arg === 'string') return null;
  const stageId = arg.stage_id;
  return typeof stageId === 'number' ? stageId : null;
};

describe('bracket generation integration', () => {
  beforeEach(() => {
    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => `doc:${segments.join('/')}`);
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => `collection:${path}`);
    mockDeps.query.mockReset().mockImplementation((base: unknown) => base);
    mockDeps.where.mockReset().mockReturnValue('where-clause');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.writeBatch.mockReset().mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
    mockDeps.getDoc.mockReset().mockResolvedValue(
      makeCategorySnapshot({
        name: 'Integration Pool',
        format: 'pool_to_elimination',
        poolStageId: 10,
      })
    );
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.managerCreateStage.mockReset().mockResolvedValue({ id: 77 });
    mockDeps.storageSelect.mockReset();
    mockDeps.getDocs.mockReset();
  });

  it('moves from blocked pending pool stage to successful elimination generation', async () => {
    const state = {
      matchScoreStatus: 'ready',
    };

    mockDeps.getDocs.mockImplementation(async () =>
      makeQuerySnapshot([
        {
          id: '101',
          data: {
            status: state.matchScoreStatus,
            winnerId: 'reg-1',
            scores: [{ score1: 21, score2: 19 }],
          },
        },
      ])
    );
    mockDeps.storageSelect.mockImplementation(async (table: string, arg?: SelectArg) => {
      const stageId = getStageIdArg(arg);
      if (table === 'stage') return [{ id: 10, type: 'round_robin' }];
      if (table === 'participant') {
        return [
          { id: 1, tournament_id: 'cat-1', name: 'reg-1' },
          { id: 2, tournament_id: 'cat-1', name: 'reg-2' },
        ];
      }
      if (table === 'match' && stageId === 10) {
        return [
          {
            id: 101,
            stage_id: 10,
            group_id: 201,
            round_id: 301,
            status: 2,
            opponent1: { id: 1 },
            opponent2: { id: 2 },
          },
        ];
      }
      if (table === 'round' && stageId === 10) return [{ id: 301, stage_id: 10, group_id: 201 }];
      if (table === 'group' && stageId === 10) return [{ id: 201, stage_id: 10, number: 1 }];
      if (table === 'match' && stageId === 77) return [{ id: 500, stage_id: 77, status: 0 }];
      if (table === 'round' && stageId === 77) return [{ id: 700, stage_id: 77 }];
      if (table === 'group' && stageId === 77) return [{ id: 600, stage_id: 77 }];
      return [];
    });

    const generator = useBracketGenerator();

    await expect(
      generator.generateEliminationFromPool('t-1', 'cat-1')
    ).rejects.toThrow(/still pending/i);
    expect(mockDeps.managerCreateStage).not.toHaveBeenCalled();

    state.matchScoreStatus = 'completed';
    const result = await generator.generateEliminationFromPool('t-1', 'cat-1');

    expect(result).toMatchObject({
      success: true,
      stageId: 77,
      participantCount: 2,
    });
    expect(mockDeps.managerCreateStage).toHaveBeenCalledTimes(1);
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'doc:tournaments/t-1/categories/cat-1',
      expect.objectContaining({
        stageId: 77,
        eliminationStageId: 77,
        poolPhase: 'elimination',
      }),
      { merge: true }
    );
  });
});
