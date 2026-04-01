import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Tournament } from '@/types';

const mockDeps = vi.hoisted(() => {
  const addDoc = vi.fn();
  const collection = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();
  const timestampFromDate = vi.fn((date: Date) => ({ __timestamp: date.toISOString() }));
  const updateDoc = vi.fn();
  const logTournamentCreated = vi.fn();

  return {
    addDoc,
    collection,
    doc,
    serverTimestamp,
    timestampFromDate,
    updateDoc,
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
  doc: mockDeps.doc,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: mockDeps.addDoc,
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
    rankingPresetDefault: 'courtmaster_default',
    progressionModeDefault: 'carry_forward',
  },
  createdBy: 'user-1',
});

describe('tournaments store - createTournament', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockReturnValue('tournaments-collection-ref');
    mockDeps.doc.mockReset().mockReturnValue('tournament-doc-ref');
    mockDeps.addDoc.mockReset().mockResolvedValue({ id: 't-1' });
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.timestampFromDate.mockClear();
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
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
        settings: expect.objectContaining({
          rankingPresetDefault: 'courtmaster_default',
          progressionModeDefault: 'carry_forward',
        }),
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

describe('tournaments store - updateTournament', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.doc.mockReset().mockReturnValue('tournament-doc-ref');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.timestampFromDate.mockClear();
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
  });

  it('updates local tournament state after a successful save', async () => {
    const { useTournamentStore } = await import('@/stores/tournaments');
    const store = useTournamentStore();
    const existingTournament: Tournament = {
      id: 't-1',
      ...getBasePayload(),
      location: 'Original Location',
      description: 'Original description',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    };

    store.currentTournament = existingTournament;
    store.tournaments = [existingTournament];

    const nextStartDate = new Date('2026-04-01T09:00:00.000Z');
    const nextEndDate = new Date('2026-04-02T17:00:00.000Z');

    await store.updateTournament('t-1', {
      name: 'Updated Tournament Name',
      description: 'Updated description',
      location: 'Updated Location',
      startDate: nextStartDate,
      endDate: nextEndDate,
    });

    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'tournament-doc-ref',
      expect.objectContaining({
        name: 'Updated Tournament Name',
        description: 'Updated description',
        location: 'Updated Location',
        startDate: { __timestamp: nextStartDate.toISOString() },
        endDate: { __timestamp: nextEndDate.toISOString() },
        updatedAt: 'SERVER_TS',
      })
    );
    expect(store.currentTournament).toEqual(
      expect.objectContaining({
        name: 'Updated Tournament Name',
        description: 'Updated description',
        location: 'Updated Location',
        startDate: nextStartDate,
        endDate: nextEndDate,
      })
    );
    expect(store.tournaments[0]).toEqual(
      expect.objectContaining({
        name: 'Updated Tournament Name',
        location: 'Updated Location',
      })
    );
  });
});
