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
  storageDelete: vi.fn(),
  storageInsert: vi.fn(),
  storageUpdate: vi.fn(),
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
    delete = mockDeps.storageDelete;
    insert = mockDeps.storageInsert;
    update = mockDeps.storageUpdate;
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

describe('useBracketGenerator.generateEliminationFromPool', () => {
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
    mockDeps.getDoc.mockReset();
    mockDeps.getDocs.mockReset();
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.storageSelect.mockReset();
    mockDeps.storageDelete.mockReset().mockResolvedValue(true);
    mockDeps.storageInsert.mockReset().mockResolvedValue(true);
    mockDeps.storageUpdate.mockReset().mockResolvedValue(true);
    mockDeps.managerCreateStage.mockReset().mockResolvedValue({ id: 77 });
  });

  it('blocks elimination generation when pool matches are still pending', async () => {
    mockDeps.getDoc.mockResolvedValue(
      makeCategorySnapshot({
        name: 'Pool Category',
        format: 'pool_to_elimination',
        poolStageId: 10,
      })
    );
    mockDeps.getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: '101',
          data: {
            status: 'ready',
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
            round_id: 301,
            group_id: 201,
            status: 2,
            opponent1: { id: 1 },
            opponent2: { id: 2 },
          },
        ];
      }
      if (table === 'round' && stageId === 10) return [{ id: 301, stage_id: 10, group_id: 201 }];
      if (table === 'group' && stageId === 10) return [{ id: 201, stage_id: 10, number: 1 }];
      return [];
    });

    const generator = useBracketGenerator();

    await expect(
      generator.generateEliminationFromPool('t-1', 'cat-1')
    ).rejects.toThrow(/still pending/i);
    expect(mockDeps.managerCreateStage).not.toHaveBeenCalled();
    expect(mockDeps.setDoc).not.toHaveBeenCalled();
    expect(generator.error.value).toMatch(/still pending/i);
  });

  it('generates elimination stage after pool completion and persists category pointers', async () => {
    mockDeps.getDoc.mockResolvedValue(
      makeCategorySnapshot({
        name: 'Open',
        format: 'pool_to_elimination',
        poolStageId: 10,
        poolQualifiersPerGroup: 2,
      })
    );
    mockDeps.getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: '101',
          data: {
            status: 'completed',
            winnerId: 'reg-1',
            scores: [{ score1: 21, score2: 18 }],
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
            round_id: 301,
            group_id: 201,
            status: 2,
            opponent1: { id: 1 },
            opponent2: { id: 2 },
          },
        ];
      }
      if (table === 'round' && stageId === 10) return [{ id: 301, stage_id: 10, group_id: 201 }];
      if (table === 'group' && stageId === 10) return [{ id: 201, stage_id: 10, number: 1 }];
      if (table === 'match' && stageId === 77) return [{ id: 501, stage_id: 77, status: 0 }];
      if (table === 'group' && stageId === 77) return [{ id: 601, stage_id: 77 }];
      if (table === 'round' && stageId === 77) return [{ id: 701, stage_id: 77 }];
      return [];
    });

    const generator = useBracketGenerator();
    const result = await generator.generateEliminationFromPool('t-1', 'cat-1');

    expect(mockDeps.managerCreateStage).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'cat-1',
        name: 'Open - Elimination',
        type: 'single_elimination',
        seedingIds: [1, 2],
      })
    );
    expect(result).toEqual({
      success: true,
      stageId: 77,
      matchCount: 1,
      groupCount: 1,
      roundCount: 1,
      participantCount: 2,
    });
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'doc:tournaments/t-1/categories/cat-1',
      expect.objectContaining({
        stageId: 77,
        eliminationStageId: 77,
        poolPhase: 'elimination',
        poolQualifiedRegistrationIds: ['reg-1', 'reg-2'],
        updatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );
  });
});
