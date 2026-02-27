import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Category, Court } from '@/types';

const mockDeps = vi.hoisted(() => {
  const query = vi.fn();
  const collection = vi.fn();
  const where = vi.fn();
  const getDocs = vi.fn();
  const updateDoc = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();

  return {
    query,
    collection,
    where,
    getDocs,
    updateDoc,
    doc,
    serverTimestamp,
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
    logTournamentCreated: vi.fn(),
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
  doc: mockDeps.doc,
  getDoc: vi.fn(),
  getDocs: mockDeps.getDocs,
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: mockDeps.updateDoc,
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: mockDeps.query,
  where: mockDeps.where,
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: mockDeps.serverTimestamp,
  increment: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  Timestamp: {
    fromDate: vi.fn(),
  },
  httpsCallable: vi.fn(),
}));

const getCategory = (): Category => ({
  id: 'cat1',
  tournamentId: 't1',
  name: "Men's Singles",
  type: 'singles',
  gender: 'men',
  ageGroup: 'open',
  format: 'single_elimination',
  status: 'setup',
  seedingEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const getCourt = (id: string, status: Court['status']): Court => ({
  id,
  tournamentId: 't1',
  name: `Court ${id}`,
  number: id === 'court-1' ? 1 : 2,
  status,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('court management rules (store)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockReturnValue('match-scores-collection');
    mockDeps.where.mockReset().mockReturnValue('where-court');
    mockDeps.query.mockReset().mockReturnValue('matches-query');
    mockDeps.getDocs.mockReset().mockResolvedValue({
      docs: [{ id: 'match-1', ref: 'match-ref-1' }],
    });
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.doc.mockReset().mockImplementation(
      (_db, path: string, id: string) => `doc:${path}/${id}`
    );
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
  });

  it('unassigns court-bound matches when no replacement court exists', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();
    store.categories = [getCategory()];
    store.courts = [getCourt('court-1', 'available')];

    const result = await store.setCourtMaintenance('t1', 'court-1');

    expect(result.reassignedMatches[0].newCourtId).toBe('');
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'match-ref-1',
      expect.objectContaining({ courtId: null, updatedAt: 'SERVER_TS' })
    );
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'doc:tournaments/t1/courts/court-1',
      expect.objectContaining({
        status: 'maintenance',
        currentMatchId: null,
        updatedAt: 'SERVER_TS',
      })
    );
  });
});
