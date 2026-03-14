import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import RegisterView from '@/features/auth/views/RegisterView.vue';

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  clearError: vi.fn(),
  register: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    error: null,
    clearError: mockDeps.clearError,
    register: mockDeps.register,
    signInWithGoogle: mockDeps.signInWithGoogle,
  }),
}));

const VAlertStub = {
  name: 'VAlert',
  template: '<div class="v-alert-stub"><slot /></div>',
};

const mountView = () => shallowMount(RegisterView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: {
      'v-container': true,
      'v-row': true,
      'v-col': true,
      'v-card': true,
      'v-card-title': true,
      'v-card-text': true,
      'v-alert': VAlertStub,
      'v-form': true,
      'v-text-field': true,
      'v-progress-linear': true,
      'v-list-item': true,
      'v-checkbox': true,
      'v-btn': true,
      'v-divider': true,
      'v-card-actions': true,
      'v-icon': true,
      'v-spacer': true,
      'router-link': true,
    },
  },
});

interface RegisterViewVm {
  selectedRole: string;
}

describe('RegisterView', () => {
  beforeEach(() => {
    mockDeps.routerPush.mockReset();
    mockDeps.clearError.mockReset();
    mockDeps.register.mockReset().mockResolvedValue(undefined);
    mockDeps.signInWithGoogle.mockReset().mockResolvedValue(undefined);
  });

  it('does not expose organizer or scorekeeper roles in public signup', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as RegisterViewVm;
    const content = wrapper.text();

    expect(vm.selectedRole).toBe('player');
    expect(content).toContain('Player accounts are created here.');
    expect(content).not.toContain('Tournament Organizer');
    expect(content).not.toContain('Scorekeeper');
  });
});
