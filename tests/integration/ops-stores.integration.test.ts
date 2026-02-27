import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const runtime = {
  authUser: {
    email: 'admin@courtmaster.local',
    displayName: 'Admin User',
  },
  firebaseUser: {
    uid: 'uid-1',
  },
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
  const updateDoc = vi.fn();
  const deleteDoc = vi.fn();
  const doc = vi.fn((_db: unknown, path: string, id: string) => `${path}/${id}`);
  const serverTimestamp = vi.fn(() => 'SERVER_TS');
  const snapshotHandlers: Record<string, { next?: (snapshot: any) => void; error?: (error: unknown) => void }> = {};

  onSnapshot.mockImplementation((queryRef: unknown, next: (snapshot: any) => void, error?: (error: unknown) => void) => {
    const path =
      typeof queryRef === 'string'
        ? queryRef
        : String((queryRef as { source?: unknown })?.source ?? 'unknown');
    snapshotHandlers[path] = { next, error };
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

describe('ops stores integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.keys(mockDeps.snapshotHandlers).forEach((key) => {
      delete mockDeps.snapshotHandlers[key];
    });
  });

  it('routes realtime snapshots into notification, activity, alert, and audit store state', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    const { useActivityStore } = await import('@/stores/activities');
    const { useAlertsStore } = await import('@/stores/alerts');
    const { useAuditStore } = await import('@/stores/audit');

    const notificationStore = useNotificationStore();
    const activityStore = useActivityStore();
    const alertsStore = useAlertsStore();
    const auditStore = useAuditStore();

    notificationStore.subscribeNotifications('user-1');
    activityStore.subscribeActivities('t1', 40);
    alertsStore.subscribeAlerts('t1', 20);
    auditStore.subscribeAuditLogs('t1', 20);

    mockDeps.snapshotHandlers['notifications']?.next?.({
      docs: [
        {
          id: 'n1',
          data: () => ({
            userId: 'user-1',
            type: 'announcement',
            title: 'Heads up',
            message: 'Court 1 is ready',
            read: false,
            createdAt: new Date('2026-02-27T10:00:00.000Z'),
          }),
        },
      ],
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'n1',
            data: () => ({
              userId: 'user-1',
              type: 'announcement',
              title: 'Heads up',
              message: 'Court 1 is ready',
              read: false,
              createdAt: new Date('2026-02-27T10:00:00.000Z'),
            }),
          },
        },
      ],
    });

    mockDeps.snapshotHandlers['tournaments/t1/activities']?.next?.({
      docs: [
        {
          id: 'a1',
          data: () => ({
            tournamentId: 't1',
            type: 'match_started',
            message: 'Match started',
            createdAt: new Date('2026-02-27T10:01:00.000Z'),
          }),
        },
      ],
    });

    mockDeps.snapshotHandlers['tournaments/t1/alerts']?.next?.({
      docs: [
        {
          id: 'al1',
          data: () => ({
            tournamentId: 't1',
            severity: 'critical',
            category: 'system',
            title: 'System error',
            message: 'Feed lag detected',
            status: 'active',
            createdAt: new Date('2026-02-27T10:02:00.000Z'),
          }),
        },
      ],
    });

    mockDeps.snapshotHandlers['tournaments/t1/audit_logs']?.next?.({
      docs: [
        {
          id: 'au1',
          data: () => ({
            tournamentId: 't1',
            action: 'match_completed',
            actorId: 'uid-1',
            actorEmail: 'admin@courtmaster.local',
            actorName: 'Admin User',
            details: {},
            createdAt: new Date('2026-02-27T10:03:00.000Z'),
          }),
        },
      ],
    });

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.unreadCount).toBe(1);
    expect(notificationStore.toastNotifications).toHaveLength(1);
    expect(notificationStore.toastNotifications[0]).toEqual(
      expect.objectContaining({
        type: 'info',
        message: 'Court 1 is ready',
      })
    );

    expect(activityStore.recentActivities).toHaveLength(1);
    expect(alertsStore.alertCount).toBe(1);
    expect(auditStore.recentLogs).toHaveLength(1);
  });
});
