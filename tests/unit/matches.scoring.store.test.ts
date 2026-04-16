import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { GameScore, Match, VolunteerSession } from '@/types';

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
  callableFactory: vi.fn(),
  updateMatchCallable: vi.fn(),
}));

const runtime = vi.hoisted(() => ({
  volunteerSession: null as VolunteerSession | null,
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

vi.mock('@/stores/volunteerAccess', () => ({
  useVolunteerAccessStore: () => ({
    currentSession: runtime.volunteerSession,
    hasValidSession: (tournamentId: string, role: 'checkin' | 'scorekeeper') =>
      runtime.volunteerSession?.tournamentId === tournamentId &&
      runtime.volunteerSession?.role === role,
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
  httpsCallable: mockDeps.callableFactory,
  increment: mockDeps.increment,
}));

const makeDocSnapshot = (
  exists: boolean,
  data: Record<string, unknown> = {}
): { exists: () => boolean; data: () => Record<string, unknown> } => ({
  exists: () => exists,
  data: () => data,
});

const makeQuerySnapshot = (
  docs: Array<{ id: string; data: Record<string, unknown> }>
): { empty: boolean; docs: Array<{ id: string; data: () => Record<string, unknown> }> } => ({
  empty: docs.length === 0,
  docs: docs.map((entry) => ({
    id: entry.id,
    data: () => entry.data,
  })),
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
    mockDeps.callableFactory.mockReset().mockImplementation((_functions: unknown, name: string) => {
      if (name === 'updateMatch') {
        return mockDeps.updateMatchCallable;
      }

      return vi.fn();
    });
    mockDeps.updateMatchCallable.mockReset().mockResolvedValue({ data: { success: true } });
    runtime.volunteerSession = null;
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

  it('unscheduleMatch creates a minimal match_scores doc when operational state is missing', async () => {
    const batchUpdate = vi.fn();
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReturnValue({
      update: batchUpdate,
      set: batchSet,
      delete: vi.fn(),
      commit: batchCommit,
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await store.unscheduleMatch('t1', 'm1', 'cat-1', 'court-7', undefined, {
      returnStatus: 'ready',
    });

    expect(batchSet).toHaveBeenCalledWith(
      'tournaments/t1/categories/cat-1/match_scores/m1',
      expect.objectContaining({
        tournamentId: 't1',
        courtId: null,
        plannedCourtId: null,
        lockedTime: false,
        status: 'ready',
        updatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );
    expect(batchUpdate).toHaveBeenCalledWith(
      'tournaments/t1/courts/court-7',
      expect.objectContaining({
        status: 'available',
        currentMatchId: null,
        assignedMatchId: null,
        lastFreedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('writes to pending_score_events queue for volunteer scorekeeper start-match updates', async () => {
    runtime.volunteerSession = {
      tournamentId: 't1',
      role: 'scorekeeper',
      sessionToken: 'score-token',
      pinRevision: 4,
      expiresAtMs: Date.now() + 60_000,
    };

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await store.startMatch('t1', 'm1', 'cat-1', 'level-1');

    // Volunteer path now writes to Firestore queue (offline-safe) instead of calling httpsCallable
    expect(mockDeps.updateMatchCallable).not.toHaveBeenCalled();
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tournamentId: 't1',
        categoryId: 'cat-1',
        levelId: 'level-1',
        matchId: 'm1',
        status: 'in_progress',
        sessionToken: 'score-token',
        scores: [{
          gameNumber: 1,
          score1: 0,
          score2: 0,
          isComplete: false,
        }],
      }),
    );
  });

  it('writes to pending_score_events queue for volunteer scorekeeper match completion', async () => {
    runtime.volunteerSession = {
      tournamentId: 't1',
      role: 'scorekeeper',
      sessionToken: 'score-token',
      pinRevision: 4,
      expiresAtMs: Date.now() + 60_000,
    };

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    const scores: GameScore[] = [
      {
        gameNumber: 1,
        score1: 21,
        score2: 14,
        winnerId: 'reg-1',
        isComplete: true,
      },
    ];

    await store.completeMatch('t1', 'm1', scores, 'reg-1', 'cat-1');

    // Volunteer path now writes to Firestore queue (offline-safe) instead of calling httpsCallable
    expect(mockDeps.updateMatchCallable).not.toHaveBeenCalled();
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tournamentId: 't1',
        categoryId: 'cat-1',
        matchId: 'm1',
        status: 'completed',
        winnerId: 'reg-1',
        scores,
        sessionToken: 'score-token',
      }),
    );
    // Bracket advancement and direct Firestore writes are deferred to the Cloud Function
    expect(mockDeps.advanceWinner).not.toHaveBeenCalled();
  });

  it('does not auto-complete a game when score reaches a legal finish until confirmed', async () => {
    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    store.currentMatch = {
      id: 'm1',
      tournamentId: 't1',
      categoryId: 'cat-1',
      round: 1,
      matchNumber: 1,
      bracketPosition: { bracket: 'winners', round: 1, position: 1 },
      participant1Id: 'reg-1',
      participant2Id: 'reg-2',
      status: 'in_progress',
      scores: [{
        gameNumber: 1,
        score1: 20,
        score2: 12,
        isComplete: false,
      }],
      scoringConfig: {
        gamesPerMatch: 3,
        pointsToWin: 21,
        mustWinBy: 2,
        maxPoints: 30,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Match;

    await store.updateScore('t1', 'm1', 'participant1', 'cat-1');

    const firstUpdatePayload = mockDeps.setDoc.mock.calls[0]?.[1] as { scores: GameScore[] };
    expect(firstUpdatePayload.scores[0]).toMatchObject({
      score1: 21,
      score2: 12,
      isComplete: false,
    });

    await store.updateScore('t1', 'm1', 'participant1', 'cat-1');

    expect(mockDeps.setDoc).toHaveBeenCalledTimes(1);
  });

  it('completes the current game only when completeCurrentGame is called', async () => {
    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    store.currentMatch = {
      id: 'm1',
      tournamentId: 't1',
      categoryId: 'cat-1',
      round: 1,
      matchNumber: 1,
      bracketPosition: { bracket: 'winners', round: 1, position: 1 },
      participant1Id: 'reg-1',
      participant2Id: 'reg-2',
      status: 'in_progress',
      scores: [{
        gameNumber: 1,
        score1: 21,
        score2: 19,
        isComplete: false,
      }],
      scoringConfig: {
        gamesPerMatch: 3,
        pointsToWin: 21,
        mustWinBy: 2,
        maxPoints: 30,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Match;

    await store.completeCurrentGame('t1', 'm1', 'cat-1');

    const updatePayload = mockDeps.setDoc.mock.calls[0]?.[1] as { scores: GameScore[] };
    expect(updatePayload.scores[0]).toMatchObject({
      score1: 21,
      score2: 19,
      isComplete: true,
      winnerId: 'reg-1',
    });
    expect(updatePayload.scores[1]).toMatchObject({
      gameNumber: 2,
      score1: 0,
      score2: 0,
      isComplete: false,
    });
    expect(mockDeps.advanceWinner).not.toHaveBeenCalled();
  });

  it('fetchMatch applies match_scores overlay status so started matches render as in-progress', async () => {
    configureGetDoc({
      'tournaments/t1/categories/cat-1/match/m2': {
        exists: true,
        data: {
          id: 'm2',
          stage_id: 1,
          number: 3,
          status: 2,
          opponent1: { id: 1, position: 1 },
          opponent2: { id: 2, position: 2 },
        },
      },
      'tournaments/t1/categories/cat-1/stage/1': {
        exists: false,
        data: {},
      },
      'tournaments/t1': {
        exists: false,
        data: {},
      },
      'tournaments/t1/categories/cat-1/match_scores/m2': {
        exists: true,
        data: {
          status: 'in_progress',
          scores: [{
            gameNumber: 1,
            score1: 6,
            score2: 4,
            isComplete: false,
          }],
        },
      },
    });

    mockDeps.getDocs.mockImplementation(async (path: string) => {
      if (path === 'tournaments/t1/registrations') {
        return makeQuerySnapshot([
          { id: 'reg-1', data: {} },
          { id: 'reg-2', data: {} },
        ]);
      }

      if (path === 'tournaments/t1/categories/cat-1/participant') {
        return makeQuerySnapshot([
          { id: '1', data: { name: 'reg-1', tournament_id: 't1' } },
          { id: '2', data: { name: 'reg-2', tournament_id: 't1' } },
        ]);
      }

      return makeQuerySnapshot([]);
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    await store.fetchMatch('t1', 'm2', 'cat-1');

    expect(store.currentMatch?.status).toBe('in_progress');
    expect(store.currentMatch?.scores[0]).toMatchObject({
      gameNumber: 1,
      score1: 6,
      score2: 4,
      isComplete: false,
    });
  });
});
