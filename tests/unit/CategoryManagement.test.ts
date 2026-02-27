import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Category } from '@/types';

const mockDeps = vi.hoisted(() => {
  const updateDoc = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();

  return {
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
  collection: vi.fn(),
  doc: mockDeps.doc,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: mockDeps.updateDoc,
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

describe('Category management rules (store)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.doc.mockReset().mockReturnValue('category-doc-ref');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
  });

  it('stamps checkInClosedAt when check-in is closed', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();
    store.categories = [getCategory()];

    await store.toggleCategoryCheckin('t1', 'cat1', false);

    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'category-doc-ref',
      expect.objectContaining({
        checkInOpen: false,
        checkInClosedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(store.categories[0].checkInOpen).toBe(false);
    expect(store.categories[0].checkInClosedAt).toBeInstanceOf(Date);
  });

  it('does not stamp checkInClosedAt when check-in is opened', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();
    store.categories = [getCategory()];

    await store.toggleCategoryCheckin('t1', 'cat1', true);

    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'category-doc-ref',
      expect.objectContaining({
        checkInOpen: true,
        updatedAt: 'SERVER_TS',
      })
    );
    const updatePayload = mockDeps.updateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload.checkInClosedAt).toBeUndefined();
  });
});
