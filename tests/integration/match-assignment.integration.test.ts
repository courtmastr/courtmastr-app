import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const runtimeState = {
  role: 'admin' as 'admin' | 'scorekeeper',
};

const mockDeps = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: runtimeState.role === 'admin',
    currentUser: {
      id: 'user-1',
      role: runtimeState.role,
    },
  }),
}));

vi.mock('@/stores/audit', () => ({
  useAuditStore: () => ({
    logScoreCorrection: vi.fn(),
    logMatchCompleted: vi.fn(),
    logMatchAssigned: vi.fn(),
  }),
}));

vi.mock('@/composables/useAdvanceWinner', () => ({
  useAdvanceWinner: () => ({
    advanceWinner: vi.fn(),
  }),
}));

class MockTimestamp {
  private readonly value: Date;

  constructor(value: Date) {
    this.value = value;
  }

  toDate(): Date {
    return this.value;
  }
}

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  functions: {},
  doc: mockDeps.doc,
  getDoc: mockDeps.getDoc,
  getDocs: mockDeps.getDocs,
  setDoc: mockDeps.setDoc,
  updateDoc: mockDeps.updateDoc,
  writeBatch: mockDeps.writeBatch,
  collection: mockDeps.collection,
  query: mockDeps.query,
  where: mockDeps.where,
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
  Timestamp: MockTimestamp,
  httpsCallable: vi.fn(),
  increment: vi.fn(),
}));

const makeDocSnapshot = (
  exists: boolean,
  data: Record<string, unknown> = {}
): { exists: () => boolean; data: () => Record<string, unknown> } => ({
  exists: () => exists,
  data: () => data,
});

const configureGetDoc = (
  docs: Record<string, { exists: boolean; data: Record<string, unknown> }>
): void => {
  mockDeps.getDoc.mockImplementation(async (path: string) => {
    const doc = docs[path];
    if (!doc) {
      return makeDocSnapshot(false, {});
    }
    return makeDocSnapshot(doc.exists, doc.data);
  });
};

describe('match assignment integration (store)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    runtimeState.role = 'admin';

    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => segments.join('/'));
    mockDeps.getDoc.mockReset();
    mockDeps.getDocs.mockReset().mockResolvedValue({ empty: true, docs: [] });
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => path);
    mockDeps.query.mockReset().mockImplementation((base: unknown) => base);
    mockDeps.where.mockReset().mockReturnValue('where');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.onSnapshot.mockReset().mockImplementation(() => () => {});
  });

  it('rejects assign-anyway for non-admin users before any firestore reads', async () => {
    runtimeState.role = 'scorekeeper';

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await expect(
      store.assignMatchToCourt('t1', 'm1', 'court-1', 'cat-1', undefined, {
        ignoreCheckInGate: true,
      })
    ).rejects.toThrow(/Only admins/i);
    expect(mockDeps.getDoc).not.toHaveBeenCalled();
  });

  it('blocks assignment when target court is under maintenance', async () => {
    const batchSet = vi.fn();
    const batchUpdate = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset().mockReturnValue({
      set: batchSet,
      update: batchUpdate,
      delete: vi.fn(),
      commit: batchCommit,
    });

    configureGetDoc({
      'tournaments/t1/categories/cat-1/match_scores/m1': {
        exists: true,
        data: {
          plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
          scheduleStatus: 'published',
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
        },
      },
      'tournaments/t1/categories/cat-1/match/m1': {
        exists: true,
        data: {
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
        },
      },
      'tournaments/t1/registrations/reg-1': {
        exists: true,
        data: { status: 'checked_in' },
      },
      'tournaments/t1/registrations/reg-2': {
        exists: true,
        data: { status: 'checked_in' },
      },
      'tournaments/t1/courts/court-1': {
        exists: true,
        data: {
          status: 'maintenance',
          name: 'Court 1',
        },
      },
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await expect(
      store.assignMatchToCourt('t1', 'm1', 'court-1', 'cat-1')
    ).rejects.toThrow(/maintenance/i);
    expect(batchSet).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('writes match and court updates atomically when assignment succeeds', async () => {
    const batchSet = vi.fn();
    const batchUpdate = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset().mockReturnValue({
      set: batchSet,
      update: batchUpdate,
      delete: vi.fn(),
      commit: batchCommit,
    });

    configureGetDoc({
      'tournaments/t1/categories/cat-1/match_scores/m1': {
        exists: true,
        data: {
          plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
          scheduleStatus: 'published',
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
        },
      },
      'tournaments/t1/categories/cat-1/match/m1': {
        exists: true,
        data: {
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
        },
      },
      'tournaments/t1/registrations/reg-1': {
        exists: true,
        data: { status: 'checked_in' },
      },
      'tournaments/t1/registrations/reg-2': {
        exists: true,
        data: { status: 'checked_in' },
      },
      'tournaments/t1/courts/court-1': {
        exists: true,
        data: {
          status: 'available',
          name: 'Court 1',
        },
      },
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await store.assignMatchToCourt('t1', 'm1', 'court-1', 'cat-1');

    expect(batchSet).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        courtId: 'court-1',
        status: 'in_progress',
        assignedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );
    expect(batchUpdate).toHaveBeenCalledWith(
      'tournaments/t1/courts/court-1',
      expect.objectContaining({
        currentMatchId: 'm1',
        assignedMatchId: 'm1',
        status: 'in_use',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('blocks assignment when a doubles team is only partially checked in', async () => {
    const batchSet = vi.fn();
    const batchUpdate = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset().mockReturnValue({
      set: batchSet,
      update: batchUpdate,
      delete: vi.fn(),
      commit: batchCommit,
    });

    configureGetDoc({
      'tournaments/t1/categories/cat-1/match_scores/m1': {
        exists: true,
        data: {
          plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
          scheduleStatus: 'published',
          participant1Id: 'reg-partial',
          participant2Id: 'reg-ready',
        },
      },
      'tournaments/t1/categories/cat-1/match/m1': {
        exists: true,
        data: {
          participant1Id: 'reg-partial',
          participant2Id: 'reg-ready',
        },
      },
      'tournaments/t1/registrations/reg-partial': {
        exists: true,
        data: {
          status: 'approved',
          participantPresence: {
            p1: true,
            p2: false,
          },
        },
      },
      'tournaments/t1/registrations/reg-ready': {
        exists: true,
        data: {
          status: 'checked_in',
        },
      },
      'tournaments/t1/courts/court-1': {
        exists: true,
        data: {
          status: 'available',
          name: 'Court 1',
        },
      },
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await expect(
      store.assignMatchToCourt('t1', 'm1', 'court-1', 'cat-1')
    ).rejects.toThrow(/checked-in/i);

    expect(batchSet).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
