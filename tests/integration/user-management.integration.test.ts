import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { User } from '@/types';
import UserManagementView from '@/features/admin/views/UserManagementView.vue';

const runtime = {
  authUser: { id: 'admin-1', role: 'admin' },
};

const mockDeps = vi.hoisted(() => {
  const collection = vi.fn((_db: unknown, path: string) => path);
  const query = vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints }));
  const orderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
  const getDocs = vi.fn();
  const onSnapshot = vi.fn();
  const doc = vi.fn((_db: unknown, path: string, id: string) => `${path}/${id}`);
  const setDoc = vi.fn();
  const serverTimestamp = vi.fn(() => 'SERVER_TS');
  const routerPush = vi.fn();
  const showToast = vi.fn();
  let usersNext: ((snapshot: any) => void) | null = null;

  class MockTimestamp {
    private readonly date: Date;

    constructor(date = new Date('2026-02-27T09:00:00.000Z')) {
      this.date = date;
    }

    toDate(): Date {
      return this.date;
    }
  }

  onSnapshot.mockImplementation((_queryRef: unknown, next: (snapshot: any) => void) => {
    usersNext = next;
    return vi.fn();
  });

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
    routerPush,
    showToast,
    getUsersNext: () => usersNext,
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: runtime.authUser,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

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

const makeUser = (id: string, role: User['role'], isActive = true): User => ({
  id,
  displayName: id === 'admin-1' ? 'Admin User' : 'Operator User',
  email: `${id}@courtmaster.local`,
  role,
  isActive,
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const mountView = () =>
  shallowMount(UserManagementView, {
    global: {
      stubs: [
        'v-container',
        'v-btn',
        'v-card',
        'v-data-table',
        'v-select',
        'v-dialog',
        'v-card-title',
        'v-card-text',
        'v-card-actions',
        'v-spacer',
        'v-text-field',
        'FilterBar',
      ],
    },
  });

describe('user management integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runtime.authUser = { id: 'admin-1', role: 'admin' };

    mockDeps.setDoc.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.routerPush.mockReset();
  });

  it('enforces self-protection and writes activation metadata through the users store', async () => {
    const wrapper = mountView();
    await flushPromises();

    mockDeps.getUsersNext()?.({
      docs: [
        {
          id: 'admin-1',
          data: () => ({
            email: 'admin-1@courtmaster.local',
            displayName: 'Admin User',
            role: 'admin',
            createdAt: new mockDeps.Timestamp(),
            updatedAt: new mockDeps.Timestamp(),
          }),
        },
        {
          id: 'user-2',
          data: () => ({
            email: 'user-2@courtmaster.local',
            displayName: 'Operator User',
            role: 'viewer',
            isActive: true,
            createdAt: new mockDeps.Timestamp(),
            updatedAt: new mockDeps.Timestamp(),
          }),
        },
      ],
    });

    const vm = wrapper.vm as unknown as {
      handleRoleChange: (user: User, role: User['role']) => Promise<void>;
      requestStatusChange: (user: User) => void;
      confirmStatusChange: () => Promise<void>;
    };

    await vm.handleRoleChange(makeUser('admin-1', 'admin'), 'viewer');
    expect(mockDeps.setDoc).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith('error', 'You cannot remove your own admin role');

    await vm.handleRoleChange(makeUser('user-2', 'viewer'), 'organizer');
    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'users/user-2',
      expect.objectContaining({
        role: 'organizer',
        updatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );

    mockDeps.setDoc.mockClear();
    vm.requestStatusChange(makeUser('user-2', 'viewer', true));
    await vm.confirmStatusChange();

    expect(mockDeps.setDoc).toHaveBeenCalledWith(
      'users/user-2',
      expect.objectContaining({
        isActive: false,
        deactivatedBy: 'admin-1',
        deactivatedAt: 'SERVER_TS',
      }),
      { merge: true }
    );
  });
});
