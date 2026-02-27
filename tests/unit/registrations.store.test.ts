import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Player } from '@/types';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn();
  const getDocs = vi.fn();
  const addDoc = vi.fn();
  const updateDoc = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();

  return {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
  };
});

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

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  updateDoc: mockDeps.updateDoc,
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: mockDeps.serverTimestamp,
  writeBatch: vi.fn(),
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
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.doc.mockReset().mockReturnValue('registration-doc-ref');
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
  });

  it('rejects duplicate email against local cache and remote snapshot', async () => {
    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    store.players = [{
      id: 'existing-1',
      firstName: 'Existing',
      lastName: 'Player',
      email: 'aanya@example.com',
      phone: '555-9999',
      skillLevel: 4,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    await expect(
      store.addPlayer('t1', {
        ...getBasePlayer(),
        email: 'AANYA@example.com',
      })
    ).rejects.toThrow(/already exists/i);

    expect(mockDeps.getDocs).not.toHaveBeenCalled();
    expect(mockDeps.addDoc).not.toHaveBeenCalled();

    store.players = [];
    mockDeps.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ email: 'aanya@example.com' }),
        },
      ],
    });

    await expect(store.addPlayer('t1', getBasePlayer())).rejects.toThrow(/already exists/i);
    expect(mockDeps.getDocs).toHaveBeenCalledTimes(1);
    expect(mockDeps.addDoc).not.toHaveBeenCalled();
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
});
