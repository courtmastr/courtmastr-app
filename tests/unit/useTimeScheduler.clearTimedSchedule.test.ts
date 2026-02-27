import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeps = vi.hoisted(() => {
  const getDocs = vi.fn();
  const collection = vi.fn();
  const writeBatch = vi.fn();
  const update = vi.fn();
  const commit = vi.fn();
  const serverTimestamp = vi.fn();

  return {
    getDocs,
    collection,
    writeBatch,
    update,
    commit,
    serverTimestamp,
  };
});

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  collection: mockDeps.collection,
  doc: vi.fn(),
  getDocs: mockDeps.getDocs,
  writeBatch: mockDeps.writeBatch,
  Timestamp: {
    fromDate: vi.fn(),
  },
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('clearTimedScheduleScopes', () => {
  beforeEach(() => {
    mockDeps.collection.mockReset().mockImplementation((dbRef: unknown, path: string) => ({ dbRef, path }));
    mockDeps.getDocs.mockReset();
    mockDeps.writeBatch.mockReset().mockReturnValue({
      update: mockDeps.update,
      commit: mockDeps.commit,
    });
    mockDeps.update.mockReset();
    mockDeps.commit.mockReset().mockResolvedValue(undefined);
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
  });

  it('clears schedule metadata only for targeted level scopes', async () => {
    mockDeps.getDocs.mockImplementation(async (collectionRef: { path: string }) => {
      if (collectionRef.path.endsWith('/levels/level-1/match_scores')) {
        return {
          docs: [
            {
              id: 'm-1',
              ref: 'ref-level-1-m1',
              data: () => ({
                plannedStartAt: 'ts-1',
                plannedEndAt: 'ts-2',
                scheduledTime: 'ts-3',
                scheduleStatus: 'published',
              }),
            },
            {
              id: 'm-2',
              ref: 'ref-level-1-m2',
              data: () => ({
                scheduleStatus: 'draft',
              }),
            },
            {
              id: 'm-3',
              ref: 'ref-level-1-m3',
              data: () => ({
                status: 'ready',
              }),
            },
          ],
        };
      }

      throw new Error(`unexpected collection path: ${collectionRef.path}`);
    });

    const { clearTimedScheduleScopes } = await import('@/composables/useTimeScheduler');
    const result = await clearTimedScheduleScopes('t-1', [
      { categoryId: 'cat-1', levelId: 'level-1' },
    ]);

    expect(result).toEqual({ clearedCount: 2 });
    expect(mockDeps.collection).toHaveBeenCalledWith(
      { __name: 'mock-db' },
      'tournaments/t-1/categories/cat-1/levels/level-1/match_scores'
    );
    expect(mockDeps.update).toHaveBeenCalledTimes(2);
    expect(mockDeps.update).toHaveBeenCalledWith(
      'ref-level-1-m1',
      expect.objectContaining({
        plannedStartAt: null,
        plannedEndAt: null,
        scheduledTime: null,
        scheduleStatus: null,
        scheduleVersion: null,
        publishedAt: null,
        publishedBy: null,
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.update).toHaveBeenCalledWith(
      'ref-level-1-m2',
      expect.objectContaining({
        plannedStartAt: null,
        plannedEndAt: null,
        scheduledTime: null,
        scheduleStatus: null,
        scheduleVersion: null,
        publishedAt: null,
        publishedBy: null,
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.update).not.toHaveBeenCalledWith(
      'ref-level-1-m3',
      expect.anything()
    );
    expect(mockDeps.commit).toHaveBeenCalledTimes(1);
  });

  it('returns zero and skips writes when there is nothing to clear', async () => {
    mockDeps.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'm-1',
          ref: 'ref-base-m1',
          data: () => ({
            status: 'ready',
          }),
        },
      ],
    });

    const { clearTimedScheduleScopes } = await import('@/composables/useTimeScheduler');
    const result = await clearTimedScheduleScopes('t-1', [{ categoryId: 'cat-1' }]);

    expect(result).toEqual({ clearedCount: 0 });
    expect(mockDeps.update).not.toHaveBeenCalled();
    expect(mockDeps.commit).not.toHaveBeenCalled();
  });
});
