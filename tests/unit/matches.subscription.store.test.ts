import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  increment: vi.fn(),
  callableFactory: vi.fn(),
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
    advanceWinner: vi.fn(),
  }),
}));

vi.mock('@/composables/useBracketReversal', () => ({
  useBracketReversal: () => ({
    handleWinnerChange: vi.fn(),
  }),
}));

vi.mock('@/stores/volunteerAccess', () => ({
  useVolunteerAccessStore: () => ({
    currentSession: null,
    hasValidSession: () => false,
  }),
}));

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
  limit: mockDeps.limit,
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
  Timestamp: class MockTimestamp {},
  httpsCallable: mockDeps.callableFactory,
  increment: mockDeps.increment,
}));

describe('matches store subscriptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => segments.join('/'));
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => path);
    mockDeps.getDoc.mockReset().mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    mockDeps.getDocs.mockReset().mockResolvedValue({ docs: [] });
    mockDeps.onSnapshot.mockReset().mockImplementation((_target, onNext) => {
      onNext({ docChanges: () => [] });
      return () => {};
    });
    mockDeps.query.mockReset().mockImplementation((base: unknown) => base);
    mockDeps.where.mockReset().mockReturnValue('where');
    mockDeps.orderBy.mockReset().mockReturnValue('orderBy');
    mockDeps.limit.mockReset().mockReturnValue('limit');
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.writeBatch.mockReset();
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.increment.mockReset().mockImplementation((amount: number) => ({ amount }));
    mockDeps.callableFactory.mockReset().mockReturnValue(vi.fn());
  });

  it('primes subscribeMatches with an immediate fetch instead of waiting for later snapshot changes', async () => {
    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    store.subscribeMatches('t1');
    await Promise.resolve();

    expect(mockDeps.getDocs).toHaveBeenCalledWith('tournaments/t1/categories');
  });

  it('primes subscribeMatch with an immediate fetch of the scoped match', async () => {
    mockDeps.getDoc.mockImplementation(async (path: string) => ({
      exists: () => path.endsWith('/match/m1'),
      data: () => ({
        id: 'm1',
        stage_id: 'cat-1',
        number: 1,
        status: 2,
        opponent1: { id: 1 },
        opponent2: { id: 2 },
      }),
    }));
    mockDeps.getDocs.mockImplementation(async (path: string) => {
      if (path.endsWith('/registrations')) {
        return {
          docs: [
            { id: 'reg-1', data: () => ({ teamName: 'Player One', participantType: 'team' }) },
            { id: 'reg-2', data: () => ({ teamName: 'Player Two', participantType: 'team' }) },
          ],
        };
      }
      if (path.endsWith('/participant')) {
        return {
          docs: [
            { id: '1', data: () => ({ name: 'reg-1' }) },
            { id: '2', data: () => ({ name: 'reg-2' }) },
          ],
        };
      }
      return { docs: [] };
    });

    const { useMatchStore } = await import('@/stores/matches');
    const store = useMatchStore();

    store.subscribeMatch('t1', 'm1', 'cat-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDeps.getDoc).toHaveBeenCalledWith('tournaments/t1/categories/cat-1/match/m1');
    expect(mockDeps.getDoc).toHaveBeenCalledWith('tournaments/t1/categories/cat-1/match_scores/m1');
  });
});
