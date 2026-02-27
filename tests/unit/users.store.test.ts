import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const orderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
  const getDocs = vi.fn();
  const onSnapshot = vi.fn();
  const doc = vi.fn((_db: unknown, path: string, id: string) => `${path}/${id}`);
  const setDoc = vi.fn();
  const serverTimestamp = vi.fn(() => 'SERVER_TS');

  class MockTimestamp {
    private readonly date: Date;

    constructor(date = new Date('2026-02-27T09:00:00.000Z')) {
      this.date = date;
    }

    toDate(): Date {
      return this.date;
    }
  }

  return {
    collection,
    query,
    orderBy,
    getDocs,
    onSnapshot,
    doc,
    setDoc,
    serverTimestamp,
    Timestamp: MockTimestamp,
  };
});

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  onSnapshot: mockDeps.onSnapshot,
  orderBy: mockDeps.orderBy,
  query: mockDeps.query,
  setDoc: mockDeps.setDoc,
  serverTimestamp: mockDeps.serverTimestamp,
  Timestamp: mockDeps.Timestamp,
}));

describe('users store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
  });

  it('persists activation metadata when deactivating a user', async () => {
    const { useUserStore } = await import('@/stores/users');
    const store = useUserStore();

    await store.setUserActive('user-2', false, 'admin-1');

    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'users/user-2',
      expect.objectContaining({
        isActive: false,
        updatedAt: 'SERVER_TS',
        deactivatedAt: 'SERVER_TS',
        deactivatedBy: 'admin-1',
      }),
      { merge: true }
    );
  });

  it('clears deactivation metadata when reactivating a user', async () => {
    const { useUserStore } = await import('@/stores/users');
    const store = useUserStore();

    await store.setUserActive('user-3', true, 'admin-1');

    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'users/user-3',
      expect.objectContaining({
        isActive: true,
        updatedAt: 'SERVER_TS',
        deactivatedAt: null,
        deactivatedBy: null,
      }),
      { merge: true }
    );
  });
});
