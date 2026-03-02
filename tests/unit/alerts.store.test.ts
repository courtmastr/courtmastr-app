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
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  updateDoc: mockDeps.updateDoc,
  deleteDoc: mockDeps.deleteDoc,
  doc: mockDeps.doc,
  query: mockDeps.query,
  where: mockDeps.where,
  orderBy: mockDeps.orderBy,
  limit: mockDeps.limit,
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('alerts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.addDoc.mockReset();
    mockDeps.getDocs.mockReset();
    mockDeps.updateDoc.mockReset();
    mockDeps.deleteDoc.mockReset();
    mockDeps.snapshotHandlers.next = undefined;
    mockDeps.snapshotHandlers.error = undefined;
  });

  it('escalates long-match alerts to critical when duration exceeds 90 minutes', async () => {
    const { useAlertsStore } = await import('@/stores/alerts');
    const store = useAlertsStore();
    mockDeps.addDoc
      .mockResolvedValueOnce({ id: 'a-critical' })
      .mockResolvedValueOnce({ id: 'a-warning' });

    await store.alertLongMatch('t1', 'm1', 'Alice', 'Bob', 'Court 1', 91);
    await store.alertLongMatch('t1', 'm2', 'Carol', 'Dina', 'Court 2', 90);

    expect(mockDeps.addDoc).toHaveBeenNthCalledWith(
      1,
      'tournaments/t1/alerts',
      expect.objectContaining({
        severity: 'critical',
        category: 'match',
      })
    );
    expect(mockDeps.addDoc).toHaveBeenNthCalledWith(
      2,
      'tournaments/t1/alerts',
      expect.objectContaining({
        severity: 'warning',
        category: 'match',
      })
    );
  });

  it('marks subscription as disconnected when realtime listener errors', async () => {
    const { useAlertsStore } = await import('@/stores/alerts');
    const store = useAlertsStore();

    store.subscribeAlerts('t1', 20);
    expect(store.isSubscribed).toBe(true);

    mockDeps.snapshotHandlers.error?.(new Error('stream closed'));

    expect(store.error).toBe('Lost connection to alerts');
    expect(store.isSubscribed).toBe(false);
  });

  it('builds query constraints when filters are provided', async () => {
    const { useAlertsStore } = await import('@/stores/alerts');
    const store = useAlertsStore();
    mockDeps.getDocs.mockResolvedValue({ docs: [] });

    await store.fetchAlerts('t1', {
      maxResults: 10,
      severity: 'warning',
      category: 'match',
      status: 'active',
    });

    const queryArgs = mockDeps.query.mock.calls.at(-1) ?? [];
    const constraints = queryArgs.slice(1) as Array<{ type?: string; args?: unknown[]; value?: number }>;

    expect(constraints.some((constraint) =>
      constraint.type === 'where'
      && constraint.args?.[0] === 'severity'
      && constraint.args?.[2] === 'warning'
    )).toBe(true);
    expect(constraints.some((constraint) =>
      constraint.type === 'where'
      && constraint.args?.[0] === 'category'
      && constraint.args?.[2] === 'match'
    )).toBe(true);
    expect(constraints.some((constraint) =>
      constraint.type === 'where'
      && constraint.args?.[0] === 'status'
      && constraint.args?.[2] === 'active'
    )).toBe(true);
    expect(constraints.some((constraint) =>
      constraint.type === 'limit'
      && constraint.value === 10
    )).toBe(true);
  });
});
