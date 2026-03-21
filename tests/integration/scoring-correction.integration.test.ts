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
    logScoreCorrected: vi.fn(),
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

describe('scoring + correction integration flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    mockDeps.doc.mockReset().mockImplementation((...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === 'string') return `${args[0]}/auto-id`;
      if (args.length >= 3) {
        const segments = args.slice(1).map((part) => String(part));
        return segments.join('/');
      }
      if (args.length === 2) return `${String(args[0])}/${String(args[1])}`;
      return 'doc';
    });
    mockDeps.getDoc.mockReset().mockImplementation(async (path: string) => {
      if (path === 'tournaments/t1/categories/cat-1/match_scores/m1') {
        return makeDocSnapshot(true, {
          courtId: 'court-3',
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
          plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
          scheduleStatus: 'published',
        });
      }
      return makeDocSnapshot(false, {});
    });
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

  it('completes match, releases court, and records winner-change correction', async () => {
    const correctionBatchUpdate = vi.fn();
    const correctionBatchSet = vi.fn();
    const correctionBatchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset().mockReturnValue({
      update: correctionBatchUpdate,
      set: correctionBatchSet,
      delete: vi.fn(),
      commit: correctionBatchCommit,
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    const completedScores: GameScore[] = [
      {
        gameNumber: 1,
        score1: 21,
        score2: 17,
        winnerId: 'reg-1',
        isComplete: true,
      },
    ];

    await store.completeMatch('t1', 'm1', completedScores, 'reg-1', 'cat-1');
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        status: 'completed',
        winnerId: 'reg-1',
      }),
      { merge: true }
    );
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'tournaments/t1/courts/court-3',
      expect.objectContaining({
        status: 'available',
        currentMatchId: null,
      })
    );

    const correctedScores: GameScore[] = [
      {
        gameNumber: 1,
        score1: 19,
        score2: 21,
        winnerId: 'reg-2',
        isComplete: true,
      },
    ];

    await store.correctMatchScore(
      't1',
      'm1',
      {
        originalScores: completedScores,
        newScores: correctedScores,
        originalWinnerId: 'reg-1',
        newWinnerId: 'reg-2',
        reason: 'line judge correction',
        correctionType: 'correction',
      },
      'cat-1'
    );

    expect(correctionBatchUpdate).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        winnerId: 'reg-2',
        corrected: true,
      })
    );
    expect(correctionBatchSet).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1/corrections/auto-id',
      expect.objectContaining({
        originalWinnerId: 'reg-1',
        newWinnerId: 'reg-2',
        reason: 'line judge correction',
        correctionType: 'correction',
      })
    );
    expect(mockDeps.handleWinnerChange).toHaveBeenCalledWith(
      't1',
      'm1',
      'reg-1',
      'reg-2',
      'cat-1'
    );
  });
});
