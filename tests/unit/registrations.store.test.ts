import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Player, VolunteerSession } from '@/types';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn();
  const getDocs = vi.fn();
  const addDoc = vi.fn();
  const setDoc = vi.fn();
  const updateDoc = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();
  const callableFactory = vi.fn();
  const volunteerCheckInCallable = vi.fn();
  const runTransaction = vi.fn();
  const findOrCreateByEmail = vi.fn();

  return {
    collection,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    doc,
    serverTimestamp,
    callableFactory,
    volunteerCheckInCallable,
    runTransaction,
    findOrCreateByEmail,
  };
});

const runtime = vi.hoisted(() => ({
  volunteerSession: null as VolunteerSession | null,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'user-1', role: 'admin' },
  }),
}));

vi.mock('@/stores/audit', () => ({
  useAuditStore: () => ({
    logRegistrationCheckedIn: vi.fn(),
    logRegistrationCheckedInUndo: vi.fn(),
    logRegistrationNoShow: vi.fn(),
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

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  functions: { __mock: true },
  httpsCallable: mockDeps.callableFactory,
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  setDoc: mockDeps.setDoc,
  updateDoc: mockDeps.updateDoc,
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: mockDeps.serverTimestamp,
  writeBatch: vi.fn(),
  runTransaction: mockDeps.runTransaction,
}));

vi.mock('@/stores/players', () => ({
  usePlayersStore: () => ({
    findOrCreateByEmail: mockDeps.findOrCreateByEmail,
  }),
}));

const getBasePlayer = (): Omit<Player, 'id' | 'createdAt' | 'updatedAt'> => ({
  firstName: 'Aanya',
  lastName: 'Khan',
  email: 'aanya@example.com',
  phone: '555-1000',
  skillLevel: 6,
});

describe('registration store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockReturnValue('players-collection-ref');
    mockDeps.getDocs.mockReset().mockResolvedValue({ docs: [] });
    mockDeps.addDoc.mockReset().mockResolvedValue({ id: 'player-1' });
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.doc.mockReset().mockReturnValue('registration-doc-ref');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.runTransaction.mockReset().mockResolvedValue('global-player-1');
    mockDeps.findOrCreateByEmail.mockReset().mockResolvedValue('global-player-1');
    mockDeps.callableFactory.mockReset().mockImplementation((_functions: unknown, name: string) => {
      if (name === 'applyVolunteerCheckInAction') {
        return mockDeps.volunteerCheckInCallable;
      }

      return vi.fn();
    });
    mockDeps.volunteerCheckInCallable.mockReset().mockResolvedValue({ data: { success: true } });
    runtime.volunteerSession = null;
  });

  it('delegates to findOrCreateByEmail and writes tournament mirror via setDoc', async () => {
    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    const id = await store.addPlayer('t1', getBasePlayer());

    expect(id).toBe('global-player-1');
    expect(mockDeps.findOrCreateByEmail).toHaveBeenCalledWith(
      'aanya@example.com',
      expect.objectContaining({
        firstName: 'Aanya',
        lastName: 'Khan',
      })
    );
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'registration-doc-ref',
      expect.objectContaining({
        id: 'global-player-1',
        globalPlayerId: 'global-player-1',
        emailNormalized: 'aanya@example.com',
        createdAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.addDoc).not.toHaveBeenCalled();
  });

  it('throws when email is missing', async () => {
    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    await expect(
      store.addPlayer('t1', { ...getBasePlayer(), email: '' })
    ).rejects.toThrow(/email is required/i);

    expect(mockDeps.findOrCreateByEmail).not.toHaveBeenCalled();
    expect(mockDeps.setDoc).not.toHaveBeenCalled();
  });

  it('stamps approved metadata when status transitions to approved', async () => {
    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    await store.updateRegistrationStatus('t1', 'reg-1', 'approved', 'admin-1');

    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'registration-doc-ref',
      expect.objectContaining({
        status: 'approved',
        updatedAt: 'SERVER_TS',
        approvedAt: 'SERVER_TS',
        approvedBy: 'admin-1',
      })
    );
  });

  it('routes check-in mutations through the volunteer callable when a kiosk session is active', async () => {
    runtime.volunteerSession = {
      tournamentId: 't1',
      role: 'checkin',
      sessionToken: 'checkin-token',
      pinRevision: 2,
      expiresAtMs: Date.now() + 60_000,
    };

    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    await store.checkInRegistration('t1', 'reg-9');

    expect(mockDeps.volunteerCheckInCallable).toHaveBeenCalledWith({
      tournamentId: 't1',
      registrationId: 'reg-9',
      action: 'check_in',
      sessionToken: 'checkin-token',
    });
    expect(mockDeps.updateDoc).not.toHaveBeenCalled();
  });

  it('routes volunteer bib assignment through the callable instead of direct writes', async () => {
    runtime.volunteerSession = {
      tournamentId: 't1',
      role: 'checkin',
      sessionToken: 'checkin-token',
      pinRevision: 2,
      expiresAtMs: Date.now() + 60_000,
    };

    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    await store.assignBibNumber('t1', 'reg-9', 41);

    expect(mockDeps.volunteerCheckInCallable).toHaveBeenCalledWith({
      tournamentId: 't1',
      registrationId: 'reg-9',
      action: 'assign_bib',
      bibNumber: 41,
      sessionToken: 'checkin-token',
    });
    expect(mockDeps.updateDoc).not.toHaveBeenCalled();
  });
});
