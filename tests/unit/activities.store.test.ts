import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const orderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
  const limit = vi.fn((value: number) => ({ type: 'limit', value }));
  const onSnapshot = vi.fn();
  const getDocs = vi.fn();
  const addDoc = vi.fn();
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
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    addDoc,
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
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  query: mockDeps.query,
  orderBy: mockDeps.orderBy,
  limit: mockDeps.limit,
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('activities store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.addDoc.mockReset().mockResolvedValue({ id: 'activity-1' });
    mockDeps.getDocs.mockReset();
    mockDeps.snapshotHandlers.next = undefined;
    mockDeps.snapshotHandlers.error = undefined;
  });

  it('categorizes subscribed activities into match and court buckets', async () => {
    const { useActivityStore } = await import('@/stores/activities');
    const store = useActivityStore();

    store.subscribeActivities('t1', 40);

    const docs = [
      {
        id: 'a1',
        data: () => ({
          tournamentId: 't1',
          type: 'match_started',
          message: 'Match started',
          createdAt: new Date('2026-02-27T10:00:00.000Z'),
        }),
      },
      {
        id: 'a2',
        data: () => ({
          tournamentId: 't1',
          type: 'court_assigned',
          message: 'Court assigned',
          createdAt: new Date('2026-02-27T10:01:00.000Z'),
        }),
      },
      {
        id: 'a3',
        data: () => ({
          tournamentId: 't1',
          type: 'announcement',
          message: 'Doors open',
          createdAt: new Date('2026-02-27T10:02:00.000Z'),
        }),
      },
    ];

    mockDeps.snapshotHandlers.next?.({ docs });

    expect(store.activities).toHaveLength(3);
    expect(store.matchActivities).toHaveLength(1);
    expect(store.courtActivities).toHaveLength(1);
    expect(store.recentActivities).toHaveLength(3);
  });

  it('logs reassignment messages with reason context', async () => {
    const { useActivityStore } = await import('@/stores/activities');
    const store = useActivityStore();

    await store.logMatchReassigned(
      't1',
      'm1',
      'Alice',
      'Bob',
      'Court 1',
      'Court 2',
      'lighting issue'
    );

    expect(mockDeps.addDoc).toHaveBeenCalledWith(
      'tournaments/t1/activities',
      expect.objectContaining({
        type: 'match_reassigned',
        message: 'Alice vs Bob moved from Court 1 to Court 2 (lighting issue)',
      })
    );
  });
});
