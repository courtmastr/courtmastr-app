import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Tournament } from '@/types';

const mockDeps = vi.hoisted(() => {
  const addDoc = vi.fn();
  const collection = vi.fn();
  const serverTimestamp = vi.fn();
  const timestampFromDate = vi.fn((date: Date) => ({ __timestamp: date.toISOString() }));
  const logTournamentCreated = vi.fn();

  return {
    addDoc,
    collection,
    serverTimestamp,
    timestampFromDate,
    logTournamentCreated,
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
    logTournamentDeleted: vi.fn(),
    logTournamentStatusChanged: vi.fn(),
    logCategoryCreated: vi.fn(),
    logCategoryDeleted: vi.fn(),
    logCategoryUpdated: vi.fn(),
    logCourtCreated: vi.fn(),
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

describe('tournaments store - createTournament', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockReturnValue('tournaments-collection-ref');
    mockDeps.addDoc.mockReset().mockResolvedValue({ id: 't-1' });
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.timestampFromDate.mockClear();
    mockDeps.logTournamentCreated.mockReset().mockResolvedValue(undefined);
  });

  it('defaults organizerIds to current user when creating tournament', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();

    await store.createTournament(getBasePayload());

    expect(mockDeps.addDoc).toHaveBeenCalledWith(
      'tournaments-collection-ref',
      expect.objectContaining({
        organizerIds: ['user-1'],
      })
    );
    expect(mockDeps.logTournamentCreated).toHaveBeenCalledWith(
      't-1',
      'Spring Open',
      expect.objectContaining({
        sport: 'badminton',
      })
    );
  });

  it('preserves explicit organizerIds when provided', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();
    const payload = {
      ...getBasePayload(),
      organizerIds: ['org-2'],
    };

    await store.createTournament(payload);

    expect(mockDeps.addDoc).toHaveBeenCalledWith(
      'tournaments-collection-ref',
      expect.objectContaining({
        organizerIds: ['org-2'],
      })
    );
  });
});
