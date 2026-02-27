import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { GameScore } from '@/types';

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
  increment: vi.fn(),
  advanceWinner: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: true,
    currentUser: {
      id: 'admin-1',
      role: 'admin',
      displayName: 'Admin',
    },
  }),
}));

vi.mock('@/stores/audit', () => ({
  useAuditStore: () => ({
    logMatchCompleted: vi.fn(),
    logScoreCorrection: vi.fn(),
    logMatchAssigned: vi.fn(),
  }),
}));

vi.mock('@/composables/useAdvanceWinner', () => ({
  useAdvanceWinner: () => ({
    advanceWinner: mockDeps.advanceWinner,
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
  increment: mockDeps.increment,
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
    const entry = docs[path];
    if (!entry) return makeDocSnapshot(false, {});
    return makeDocSnapshot(entry.exists, entry.data);
  });
};

describe('matches store scoring completion', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => segments.join('/'));
    mockDeps.getDoc.mockReset();
    mockDeps.getDocs.mockReset().mockResolvedValue({ empty: true, docs: [] });
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset();
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => path);
    mockDeps.query.mockReset().mockImplementation((base: unknown) => base);
    mockDeps.where.mockReset().mockReturnValue('where');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.onSnapshot.mockReset().mockImplementation(() => () => {});
    mockDeps.increment.mockReset().mockImplementation((amount: number) => ({ amount }));
    mockDeps.advanceWinner.mockReset().mockResolvedValue(undefined);
  });

  it('releases assigned court and advances bracket when completeMatch succeeds', async () => {
    configureGetDoc({
      'tournaments/t1/categories/cat-1/match_scores/m1': {
        exists: true,
        data: { courtId: 'court-7' },
      },
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    const scores: GameScore[] = [
      {
        gameNumber: 1,
        score1: 21,
        score2: 16,
        winnerId: 'reg-1',
        isComplete: true,
      },
    ];

    await store.completeMatch('t1', 'm1', scores, 'reg-1', 'cat-1');

    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        winnerId: 'reg-1',
        status: 'completed',
        completedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'tournaments/t1/courts/court-7',
      expect.objectContaining({
        status: 'available',
        currentMatchId: null,
        assignedMatchId: null,
        lastFreedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.advanceWinner).toHaveBeenCalledWith('t1', 'cat-1', 'm1', 'reg-1', undefined);
  });
});
