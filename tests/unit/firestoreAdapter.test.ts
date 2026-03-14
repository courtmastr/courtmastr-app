import { describe, expect, it, vi } from 'vitest';
import { FirestoreStorage } from '../../functions/src/storage/firestore-adapter';

interface FakeSnapshot<T> {
  empty: boolean;
  docs: Array<{ data: () => T }>;
}

interface FakeCollection<T> {
  where: (field: string, operator: string, value: unknown) => {
    get: () => Promise<FakeSnapshot<T>>;
  };
}

const createDb = <T>(onWhere: (field: string, operator: string, value: unknown) => Promise<FakeSnapshot<T>>) => ({
  doc: vi.fn(() => ({
    collection: vi.fn((): FakeCollection<T> => ({
      where: (field: string, operator: string, value: unknown) => ({
        get: () => onWhere(field, operator, value),
      }),
    })),
  })),
  batch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
});

describe('FirestoreStorage', () => {
  it('selects numeric primary ids using number queries when passed a string id', async () => {
    const whereCalls: Array<{ field: string; operator: string; value: unknown }> = [];
    const db = createDb(async (field, operator, value) => {
      whereCalls.push({ field, operator, value });

      if (field === 'id' && value === 1) {
        return {
          empty: false,
          docs: [{ data: () => ({ id: 1, status: 2 }) }],
        };
      }

      return { empty: true, docs: [] };
    });

    const storage = new FirestoreStorage(db as never, 'tournaments/t1/categories/c1');
    const result = await storage.select('match', '1');

    expect(result).toEqual({ id: 1, status: 2 });
    expect(whereCalls).toEqual([
      { field: 'id', operator: '==', value: 1 },
    ]);
  });

  it('updates numeric primary ids when partial filters include a string id', async () => {
    type StoredMatch = { id: number | string; status: number };
    const matchingDocRef = { path: 'match/1' };
    const updateSpy = vi.fn();
    const commitSpy = vi.fn().mockResolvedValue(undefined);
    const whereCalls: Array<{ field: string; operator: string; value: unknown }> = [];
    const db = createDb(async (field, operator, value) => {
      whereCalls.push({ field, operator, value });

      if (field === 'id' && value === 1) {
        return {
          empty: false,
          docs: [{ ref: matchingDocRef, data: () => ({ id: 1, status: 2 }) }],
        } as FakeSnapshot<StoredMatch> & { docs: Array<{ ref: typeof matchingDocRef; data: () => StoredMatch }> };
      }

      return { empty: true, docs: [] };
    });

    (db as { batch: () => { update: typeof updateSpy; delete: () => void; commit: typeof commitSpy } }).batch = () => ({
      update: updateSpy,
      delete: vi.fn(),
      commit: commitSpy,
    });

    const storage = new FirestoreStorage(db as never, 'tournaments/t1/categories/c1');
    const updated = await storage.update<StoredMatch>('match', { id: '1' }, { id: 1, status: 4 });

    expect(updated).toBe(true);
    expect(whereCalls).toEqual([
      { field: 'id', operator: '==', value: 1 },
    ]);
    expect(updateSpy).toHaveBeenCalledWith(matchingDocRef, { id: 1, status: 4 });
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves numeric foreign key filters for bracket round lookups', async () => {
    type StoredRound = { id: number; stage_id: number; group_id: number; number: number };
    const whereCalls: Array<{ field: string; operator: string; value: unknown }> = [];

    const query = {
      where(field: string, operator: string, value: unknown) {
        whereCalls.push({ field, operator, value });
        return query;
      },
      async get() {
        const stageFilter = whereCalls.find((call) => call.field === 'stage_id')?.value;
        const groupFilter = whereCalls.find((call) => call.field === 'group_id')?.value;

        if (stageFilter === 0 && groupFilter === 0) {
          return {
            empty: false,
            docs: [{ data: () => ({ id: 0, stage_id: 0, group_id: 0, number: 1 }) }],
          } as FakeSnapshot<StoredRound>;
        }

        return { empty: true, docs: [] } as FakeSnapshot<StoredRound>;
      },
    };

    const db = {
      doc: vi.fn(() => ({
        collection: vi.fn(() => query),
      })),
    };

    const storage = new FirestoreStorage(db as never, 'tournaments/t1/categories/c1');
    const result = await storage.select<StoredRound>('round', {
      stage_id: 0,
      group_id: 0,
    });

    expect(result).toEqual([{ id: 0, stage_id: 0, group_id: 0, number: 1 }]);
    expect(whereCalls).toEqual([
      { field: 'stage_id', operator: '==', value: 0 },
      { field: 'group_id', operator: '==', value: 0 },
    ]);
  });
});
