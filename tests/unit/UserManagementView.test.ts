import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { User } from '@/types';
import UserManagementView from '@/features/admin/views/UserManagementView.vue';

const runtime = {
  currentUser: { id: 'admin-1', role: 'admin' },
  users: [] as User[],
};

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  subscribeUsers: vi.fn(),
  unsubscribeAll: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserProfile: vi.fn(),
  setUserActive: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: runtime.currentUser,
  }),
}));

vi.mock('@/stores/users', () => ({
  useUserStore: () => ({
    users: runtime.users,
    loading: false,
    subscribeUsers: mockDeps.subscribeUsers,
    unsubscribeAll: mockDeps.unsubscribeAll,
    updateUserRole: mockDeps.updateUserRole,
    updateUserProfile: mockDeps.updateUserProfile,
    setUserActive: mockDeps.setUserActive,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
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

describe('UserManagementView', () => {
  beforeEach(() => {
    runtime.currentUser = { id: 'admin-1', role: 'admin' };
    runtime.users = [makeUser('admin-1', 'admin'), makeUser('user-2', 'viewer')];

    mockDeps.routerPush.mockReset();
    mockDeps.subscribeUsers.mockReset();
    mockDeps.unsubscribeAll.mockReset();
    mockDeps.updateUserRole.mockReset().mockResolvedValue(undefined);
    mockDeps.updateUserProfile.mockReset().mockResolvedValue(undefined);
    mockDeps.setUserActive.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
  });

  it('blocks self-admin demotion and shows guardrail toast', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      handleRoleChange: (user: User, role: User['role']) => Promise<void>;
    };

    await vm.handleRoleChange(makeUser('admin-1', 'admin'), 'viewer');

    expect(mockDeps.updateUserRole).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith('error', 'You cannot remove your own admin role');
  });

  it('passes actor metadata when confirming status change', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      requestStatusChange: (user: User) => void;
      confirmStatusChange: () => Promise<void>;
    };
    const target = makeUser('user-2', 'viewer', true);

    vm.requestStatusChange(target);
    await vm.confirmStatusChange();

    expect(mockDeps.setUserActive).toHaveBeenCalledWith('user-2', false, 'admin-1');
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'User deactivated');
  });
});
