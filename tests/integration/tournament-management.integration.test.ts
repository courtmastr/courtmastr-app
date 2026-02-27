import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Category, Court, Tournament } from '@/types';

const mockDeps = vi.hoisted(() => {
  const addDoc = vi.fn();
  const collection = vi.fn();
  const serverTimestamp = vi.fn();
  const timestampFromDate = vi.fn((date: Date) => ({ __timestamp: date.toISOString() }));
  const logTournamentCreated = vi.fn();
  const logCategoryCreated = vi.fn();
  const logCourtCreated = vi.fn();

  return {
    addDoc,
    collection,
    serverTimestamp,
    timestampFromDate,
    logTournamentCreated,
    logCategoryCreated,
    logCourtCreated,
  };
});

vi.mock('@/composables/useMatchScheduler', () => ({
  useMatchScheduler: () => ({}),
}));

vi.mock('@/composables/useBracketGenerator', () => ({
  useBracketGenerator: () => ({}),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'user-1', role: 'admin' },
  }),
}));

vi.mock('@/stores/audit', () => ({
  useAuditStore: () => ({
    logTournamentCreated: mockDeps.logTournamentCreated,
    logCategoryCreated: mockDeps.logCategoryCreated,
    logCourtCreated: mockDeps.logCourtCreated,
    logTournamentDeleted: vi.fn(),
    logTournamentStatusChanged: vi.fn(),
    logCategoryDeleted: vi.fn(),
    logCategoryUpdated: vi.fn(),
    logCourtUpdated: vi.fn(),
    logCourtDeleted: vi.fn(),
    logMatchUpdated: vi.fn(),
  }),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  functions: {},
  collection: mockDeps.collection,
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: mockDeps.addDoc,
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: mockDeps.serverTimestamp,
  increment: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  Timestamp: {
    fromDate: mockDeps.timestampFromDate,
  },
  httpsCallable: vi.fn(),
}));

const getBasePayload = (): Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Spring Open',
  sport: 'badminton',
  format: 'single_elimination',
  status: 'draft',
  startDate: new Date('2026-03-15T09:00:00.000Z'),
  endDate: new Date('2026-03-16T17:00:00.000Z'),
  settings: {
    minRestTimeMinutes: 15,
    matchDurationMinutes: 30,
    allowSelfRegistration: true,
    requireApproval: true,
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  createdBy: 'user-1',
});

describe('tournament management integration (store writes)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => `collection:${path}`);
    mockDeps.addDoc.mockReset();
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.timestampFromDate.mockClear();
    mockDeps.logTournamentCreated.mockReset().mockResolvedValue(undefined);
    mockDeps.logCategoryCreated.mockReset().mockResolvedValue(undefined);
    mockDeps.logCourtCreated.mockReset().mockResolvedValue(undefined);
  });

  it('creates tournament and persists category/court writes with tournament-scoped paths', async () => {
    mockDeps.addDoc
      .mockResolvedValueOnce({ id: 't-1' })
      .mockResolvedValueOnce({ id: 'cat-1' })
      .mockResolvedValueOnce({ id: 'court-1' });

    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();

    const tournamentId = await store.createTournament(getBasePayload());
    expect(tournamentId).toBe('t-1');

    const categoryInput: Omit<Category, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt'> = {
      name: "Men's Singles",
      type: 'singles',
      gender: 'men',
      ageGroup: 'open',
      format: 'single_elimination',
      seedingEnabled: true,
      status: 'setup',
    };
    const categoryId = await store.addCategory(tournamentId, categoryInput);
    expect(categoryId).toBe('cat-1');

    const courtInput: Omit<Court, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt'> = {
      name: 'Court 1',
      number: 1,
      status: 'available',
    };
    const courtId = await store.addCourt(tournamentId, courtInput);
    expect(courtId).toBe('court-1');

    expect(mockDeps.collection).toHaveBeenCalledWith({ __name: 'mock-db' }, 'tournaments');
    expect(mockDeps.collection).toHaveBeenCalledWith({ __name: 'mock-db' }, 'tournaments/t-1/categories');
    expect(mockDeps.collection).toHaveBeenCalledWith({ __name: 'mock-db' }, 'tournaments/t-1/courts');

    expect(mockDeps.addDoc).toHaveBeenNthCalledWith(
      2,
      'collection:tournaments/t-1/categories',
      expect.objectContaining({
        tournamentId: 't-1',
        name: "Men's Singles",
        status: 'setup',
      })
    );
    expect(mockDeps.addDoc).toHaveBeenNthCalledWith(
      3,
      'collection:tournaments/t-1/courts',
      expect.objectContaining({
        tournamentId: 't-1',
        name: 'Court 1',
        status: 'available',
      })
    );
  });
});
