import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Registration } from '@/types';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn();
  const addDoc = vi.fn();
  const updateDoc = vi.fn();
  const doc = vi.fn();
  const serverTimestamp = vi.fn();
  const logRegistrationCheckedIn = vi.fn();
  const logRegistrationCheckedInUndo = vi.fn();
  const logRegistrationNoShow = vi.fn();

  return {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    logRegistrationCheckedIn,
    logRegistrationCheckedInUndo,
    logRegistrationNoShow,
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-1', role: 'admin' },
  }),
}));

vi.mock('@/stores/audit', () => ({
  useAuditStore: () => ({
    logRegistrationCheckedIn: mockDeps.logRegistrationCheckedIn,
    logRegistrationCheckedInUndo: mockDeps.logRegistrationCheckedInUndo,
    logRegistrationNoShow: mockDeps.logRegistrationNoShow,
  }),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: vi.fn(),
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

const getRegistration = (id: string, status: Registration['status']): Registration => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: 'player-1',
  status,
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('registration management integration (store transitions)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.collection.mockReset().mockImplementation((_db, path: string) => `collection:${path}`);
    mockDeps.addDoc.mockReset().mockResolvedValue({ id: 'reg-created' });
    mockDeps.updateDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.doc.mockReset().mockImplementation(
      (_db, path: string, id: string) => `doc:${path}/${id}`
    );
    mockDeps.serverTimestamp.mockReset().mockReturnValue('SERVER_TS');
    mockDeps.logRegistrationCheckedIn.mockReset().mockResolvedValue(undefined);
    mockDeps.logRegistrationCheckedInUndo.mockReset().mockResolvedValue(undefined);
    mockDeps.logRegistrationNoShow.mockReset().mockResolvedValue(undefined);
  });

  it('applies registration status transitions and related audit hooks', async () => {
    const { useRegistrationStore } = await import('@/stores/registrations');
    const store = useRegistrationStore();

    store.registrations = [
      getRegistration('reg-1', 'approved'),
      getRegistration('reg-2', 'approved'),
      getRegistration('reg-3', 'approved'),
    ];

    await store.approveRegistration('t1', 'reg-1', 'admin-1');
    await store.rejectRegistration('t1', 'reg-2');
    await store.checkInRegistration('t1', 'reg-3');
    await store.undoCheckInRegistration('t1', 'reg-3', 'admin-1');
    await store.markNoShowRegistration('t1', 'reg-3', 'admin-1');

    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'doc:tournaments/t1/registrations/reg-1',
      expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin-1',
        approvedAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'doc:tournaments/t1/registrations/reg-2',
      expect.objectContaining({
        status: 'rejected',
        updatedAt: 'SERVER_TS',
      })
    );
    expect(mockDeps.updateDoc).toHaveBeenCalledWith(
      'doc:tournaments/t1/registrations/reg-3',
      expect.objectContaining({
        status: 'checked_in',
        updatedAt: 'SERVER_TS',
      })
    );

    expect(mockDeps.logRegistrationCheckedIn).toHaveBeenCalledWith(
      't1',
      'reg-3',
      'player-1'
    );
    expect(mockDeps.logRegistrationCheckedInUndo).toHaveBeenCalledWith(
      't1',
      'reg-3',
      'player-1'
    );
    expect(mockDeps.logRegistrationNoShow).toHaveBeenCalled();
  });
});
