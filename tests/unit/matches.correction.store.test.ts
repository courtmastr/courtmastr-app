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
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
  increment: vi.fn(),
  advanceWinner: vi.fn(),
  handleWinnerChange: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: true,
    currentUser: {
      id: 'admin-1',
      role: 'admin',
      displayName: 'Admin User',
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

vi.mock('@/composables/useBracketReversal', () => ({
  useBracketReversal: () => ({
    handleWinnerChange: mockDeps.handleWinnerChange,
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
  orderBy: mockDeps.orderBy,
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
): { id: string; exists: () => boolean; data: () => Record<string, unknown> } => ({
  id: 'doc-id',
  exists: () => exists,
  data: () => data,
});

const makeCorrectionScores = (): { originalScores: GameScore[]; newScores: GameScore[] } => ({
  originalScores: [
    {
      gameNumber: 1,
      score1: 21,
      score2: 17,
      winnerId: 'reg-1',
      isComplete: true,
    },
  ],
  newScores: [
    {
      gameNumber: 1,
      score1: 19,
      score2: 21,
      winnerId: 'reg-2',
      isComplete: true,
    },
  ],
});

describe('matches store score correction', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    mockDeps.doc.mockReset().mockImplementation((...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === 'string') {
        return `${args[0]}/auto-id`;
      }
      if (args.length >= 3) {
        const segments = args.slice(1).map((part) => String(part));
        return segments.join('/');
      }
      if (args.length === 2) {
        return `${String(args[0])}/${String(args[1])}`;
      }
      return 'doc';
    });
    mockDeps.getDoc.mockReset().mockResolvedValue(makeDocSnapshot(false, {}));
    mockDeps.getDocs.mockReset().mockResolvedValue({ docs: [] });
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => path);
    mockDeps.query.mockReset().mockImplementation((base: unknown) => base);
    mockDeps.where.mockReset().mockReturnValue('where');
    mockDeps.orderBy.mockReset().mockReturnValue('orderBy');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.onSnapshot.mockReset().mockImplementation(() => () => {});
    mockDeps.increment.mockReset().mockImplementation((amount: number) => ({ amount }));
    mockDeps.advanceWinner.mockReset().mockResolvedValue(undefined);
    mockDeps.handleWinnerChange.mockReset().mockResolvedValue(undefined);
  });

  it('records correction history and triggers bracket reversal when winner changes', async () => {
    const batchUpdate = vi.fn();
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset().mockReturnValue({
      update: batchUpdate,
      set: batchSet,
      delete: vi.fn(),
      commit: batchCommit,
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();
    const { originalScores, newScores } = makeCorrectionScores();

    await store.correctMatchScore(
      't1',
      'm1',
      {
        originalScores,
        newScores,
        originalWinnerId: 'reg-1',
        newWinnerId: 'reg-2',
        reason: 'Score entry was swapped',
      },
      'cat-1'
    );

    expect(batchUpdate).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        winnerId: 'reg-2',
        status: 'completed',
        corrected: true,
        correctionCount: { amount: 1 },
        lastCorrectedBy: 'admin-1',
      })
    );
    expect(batchSet).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1/corrections/auto-id',
      expect.objectContaining({
        originalWinnerId: 'reg-1',
        newWinnerId: 'reg-2',
        reason: 'Score entry was swapped',
        correctedByName: 'Admin User',
      })
    );
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(mockDeps.handleWinnerChange).toHaveBeenCalledWith(
      't1',
      'm1',
      'reg-1',
      'reg-2',
      'cat-1'
    );
  });

  it('loads correction history into store state', async () => {
    mockDeps.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'corr-1',
          data: () => ({
            originalScores: [],
            newScores: [],
            originalWinnerId: 'reg-1',
            newWinnerId: 'reg-2',
            reason: 'line call correction',
            correctedBy: 'admin-1',
            correctedByName: 'Admin User',
            correctedAt: {
              toDate: () => new Date('2026-02-27T11:00:00.000Z'),
            },
          }),
        },
      ],
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await store.fetchCorrectionHistory('t1', 'm1', 'cat-1');

    expect(store.correctionHistory).toHaveLength(1);
    expect(store.correctionHistory[0]).toMatchObject({
      id: 'corr-1',
      matchId: 'm1',
      originalWinnerId: 'reg-1',
      newWinnerId: 'reg-2',
      reason: 'line call correction',
      correctedByName: 'Admin User',
    });
  });
});
