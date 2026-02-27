import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const where = vi.fn((...args: unknown[]) => ({ type: 'where', args }));
  const orderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
  const limit = vi.fn((value: number) => ({ type: 'limit', value }));
  const onSnapshot = vi.fn();
  const getDocs = vi.fn();
  const addDoc = vi.fn();
  const updateDoc = vi.fn();
  const deleteDoc = vi.fn();
  const doc = vi.fn((_db: unknown, path: string, id: string) => `${path}/${id}`);
  const serverTimestamp = vi.fn(() => 'SERVER_TS');
  const snapshotHandlers: {
    next?: (snapshot: any) => void;
    error?: (error: unknown) => void;
  } = {};

  onSnapshot.mockImplementation((_queryRef: unknown, next: (snapshot: any) => void, error?: (error: unknown) => void) => {
    snapshotHandlers.next = next;
    snapshotHandlers.error = error;
    return vi.fn();
  });

  return {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    snapshotHandlers,
  };
});

vi.mock('@/utils/firestore', () => ({
  convertTimestamps: <T>(value: T): T => value,
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  updateDoc: mockDeps.updateDoc,
  deleteDoc: mockDeps.deleteDoc,
  query: mockDeps.query,
  where: mockDeps.where,
  orderBy: mockDeps.orderBy,
  limit: mockDeps.limit,
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.getDocs.mockReset();
    mockDeps.addDoc.mockReset();
    mockDeps.updateDoc.mockReset();
    mockDeps.deleteDoc.mockReset();
    mockDeps.snapshotHandlers.next = undefined;
    mockDeps.snapshotHandlers.error = undefined;
  });

  it('shows toast when unread notification arrives in subscription', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    const store = useNotificationStore();

    store.subscribeNotifications('user-1');

    const unreadDoc = {
      id: 'n1',
      data: () => ({
        userId: 'user-1',
        type: 'match_ready',
        title: 'Match ready',
        message: 'Court 2 ready',
        read: false,
        createdAt: new Date('2026-02-27T10:00:00.000Z'),
      }),
    };

    mockDeps.snapshotHandlers.next?.({
      docs: [unreadDoc],
      docChanges: () => [{ type: 'added', doc: unreadDoc }],
    });

    expect(store.notifications).toHaveLength(1);
    expect(store.unreadCount).toBe(1);
    expect(store.toastNotifications).toHaveLength(1);
    expect(store.toastNotifications[0]).toEqual(
      expect.objectContaining({
        type: 'info',
        message: 'Court 2 ready',
      })
    );
  });

  it('captures subscription errors as connection-loss state', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    const store = useNotificationStore();

    store.subscribeNotifications('user-1');
    mockDeps.snapshotHandlers.error?.(new Error('network down'));

    expect(store.error).toBe('Lost connection to notifications');
  });
});
