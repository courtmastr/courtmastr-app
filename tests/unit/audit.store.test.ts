import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const runtime = {
  authUser: null as null | { email?: string; displayName?: string },
  firebaseUser: null as null | { uid: string },
};

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const where = vi.fn((...args: unknown[]) => ({ type: 'where', args }));
  const orderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
  const limit = vi.fn((value: number) => ({ type: 'limit', value }));
  const onSnapshot = vi.fn();
  const getDocs = vi.fn();
  const addDoc = vi.fn();
  const serverTimestamp = vi.fn(() => 'SERVER_TS');

  return {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    addDoc,
    serverTimestamp,
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: runtime.authUser,
    firebaseUser: runtime.firebaseUser,
  }),
}));

vi.mock('@/utils/firestore', () => ({
  convertTimestamps: <T>(value: T): T => value,
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
  collection: mockDeps.collection,
  getDocs: mockDeps.getDocs,
  addDoc: mockDeps.addDoc,
  query: mockDeps.query,
  where: mockDeps.where,
  orderBy: mockDeps.orderBy,
  limit: mockDeps.limit,
  onSnapshot: mockDeps.onSnapshot,
  serverTimestamp: mockDeps.serverTimestamp,
}));

describe('audit store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runtime.authUser = null;
    runtime.firebaseUser = null;
    mockDeps.addDoc.mockReset();
    mockDeps.getDocs.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty id and skips write when actor context is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useAuditStore } = await import('@/stores/audit');
    const store = useAuditStore();

    const result = await store.logAudit('t1', 'schedule_generated', { matches: 12 });

    expect(result).toBe('');
    expect(mockDeps.addDoc).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Cannot log audit: no authenticated user');
  });

  it('writes actor metadata and returns audit id when user is authenticated', async () => {
    runtime.authUser = {
      email: 'admin@courtmaster.local',
      displayName: 'Admin User',
    };
    runtime.firebaseUser = { uid: 'uid-1' };
    mockDeps.addDoc.mockResolvedValueOnce({ id: 'audit-1' });

    const { useAuditStore } = await import('@/stores/audit');
    const store = useAuditStore();

    const result = await store.logAudit(
      't1',
      'match_completed',
      { score: '21-18' },
      { targetId: 'm1', targetType: 'match' }
    );

    expect(result).toBe('audit-1');
    expect(mockDeps.addDoc).toHaveBeenCalledWith(
      'tournaments/t1/audit_logs',
      expect.objectContaining({
        action: 'match_completed',
        actorId: 'uid-1',
        actorEmail: 'admin@courtmaster.local',
        actorName: 'Admin User',
        targetId: 'm1',
        targetType: 'match',
      })
    );
  });

  it('builds query constraints when action and actor filters are provided', async () => {
    const { useAuditStore } = await import('@/stores/audit');
    const store = useAuditStore();
    mockDeps.getDocs.mockResolvedValue({ docs: [] });

    await store.fetchAuditLogs('t1', {
      maxResults: 25,
      action: 'match_completed',
      actorId: 'uid-1',
    });

    const queryArgs = mockDeps.query.mock.calls.at(-1) ?? [];
    const constraints = queryArgs.slice(1) as Array<{ type?: string; args?: unknown[]; value?: number }>;

    expect(constraints.some((constraint) =>
      constraint.type === 'where'
      && constraint.args?.[0] === 'action'
      && constraint.args?.[2] === 'match_completed'
    )).toBe(true);
    expect(constraints.some((constraint) =>
      constraint.type === 'where'
      && constraint.args?.[0] === 'actorId'
      && constraint.args?.[2] === 'uid-1'
    )).toBe(true);
    expect(constraints.some((constraint) =>
      constraint.type === 'limit'
      && constraint.value === 25
    )).toBe(true);
  });
});
