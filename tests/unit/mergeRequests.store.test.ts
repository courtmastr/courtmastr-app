import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const doc = vi.fn((_db: unknown, path: string, id: string) => `${path}/${id}`);
  const addDoc = vi.fn();
  const updateDoc = vi.fn();
  const getDocs = vi.fn();
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const where = vi.fn((...args: unknown[]) => ({ type: 'where', args }));
  const serverTimestamp = vi.fn(() => 'SERVER_TS');

  return {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
  };
});

vi.mock('@/utils/firestore', () => ({
  convertTimestamps: <T>(value: T): T => value,
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  addDoc: mockDeps.addDoc,
  updateDoc: mockDeps.updateDoc,
  getDocs: mockDeps.getDocs,
  query: mockDeps.query,
  where: mockDeps.where,
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('useMergeRequestsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockDeps.addDoc.mockReset();
    mockDeps.updateDoc.mockReset();
    mockDeps.getDocs.mockReset();
    mockDeps.collection.mockClear();
    mockDeps.doc.mockClear();
    mockDeps.query.mockClear();
    mockDeps.where.mockClear();
    mockDeps.serverTimestamp.mockClear();
  });

  it('initializes with empty requests', async () => {
    const { useMergeRequestsStore } = await import('@/stores/mergeRequests');
    const store = useMergeRequestsStore();

    expect(store.requests).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('requestMerge writes a pending merge request with audit fields', async () => {
    mockDeps.addDoc.mockResolvedValueOnce({ id: 'mr-1' });

    const { useMergeRequestsStore } = await import('@/stores/mergeRequests');
    const store = useMergeRequestsStore();
    const requestId = await store.requestMerge({
      sourcePlayerId: 'player-source',
      targetPlayerId: 'player-target',
      requestedBy: 'user-1',
      requestedByRole: 'admin',
      reason: 'Duplicate signup',
      conflictingUserIds: true,
      conflictOverrideConfirmed: true,
    });

    expect(requestId).toBe('mr-1');
    expect(mockDeps.addDoc).toHaveBeenCalledOnce();
    expect(mockDeps.addDoc.mock.calls[0][0]).toBe('mergeRequests');
    expect(mockDeps.addDoc.mock.calls[0][1]).toEqual({
      sourcePlayerId: 'player-source',
      targetPlayerId: 'player-target',
      requestedBy: 'user-1',
      requestedByRole: 'admin',
      status: 'pending',
      reason: 'Duplicate signup',
      reviewedBy: null,
      reviewedAt: null,
      completedAt: null,
      conflictingUserIds: true,
      conflictOverrideConfirmed: true,
      createdAt: 'SERVER_TS',
      updatedAt: 'SERVER_TS',
    });
  });

  it('reviewRequest updates the merge request decision and audit fields', async () => {
    const { useMergeRequestsStore } = await import('@/stores/mergeRequests');
    const store = useMergeRequestsStore();

    await store.reviewRequest('mr-2', 'approved', 'admin-2');

    expect(mockDeps.updateDoc).toHaveBeenCalledOnce();
    expect(mockDeps.updateDoc).toHaveBeenCalledWith('mergeRequests/mr-2', {
      status: 'approved',
      reviewedBy: 'admin-2',
      reviewedAt: 'SERVER_TS',
      updatedAt: 'SERVER_TS',
    });
  });

  it('fetchPendingRequests loads pending requests and clears loading', async () => {
    mockDeps.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'mr-3',
          data: () => ({
            sourcePlayerId: 'player-a',
            targetPlayerId: 'player-b',
            requestedBy: 'user-3',
            requestedByRole: 'player',
            status: 'pending',
            reason: null,
            createdAt: new Date('2026-04-02T18:00:00.000Z'),
            updatedAt: new Date('2026-04-02T18:00:00.000Z'),
          }),
        },
      ],
    });

    const { useMergeRequestsStore } = await import('@/stores/mergeRequests');
    const store = useMergeRequestsStore();

    await store.fetchPendingRequests();

    expect(mockDeps.where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(store.requests).toEqual([
      expect.objectContaining({
        id: 'mr-3',
        sourcePlayerId: 'player-a',
        targetPlayerId: 'player-b',
        status: 'pending',
      }),
    ]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });
});
