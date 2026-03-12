import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import VolunteerAccessView from '@/features/volunteer/views/VolunteerAccessView.vue';

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  requestSession: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    meta: { volunteerRole: 'checkin' },
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/volunteerAccess', () => ({
  useVolunteerAccessStore: () => ({
    requestSession: mockDeps.requestSession,
  }),
}));

interface VolunteerAccessVm {
  pin: string;
  submitPin: () => Promise<void>;
}

const mountView = () => shallowMount(VolunteerAccessView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-title',
      'v-card-subtitle',
      'v-card-text',
      'v-alert',
      'v-text-field',
      'v-btn',
      'v-icon',
    ],
  },
});

describe('VolunteerAccessView', () => {
  beforeEach(() => {
    mockDeps.routerPush.mockReset();
    mockDeps.requestSession.mockReset().mockResolvedValue(undefined);
  });

  it('submits the PIN and routes into check-in kiosk mode', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as VolunteerAccessVm;

    vm.pin = '4829';
    await vm.submitPin();

    expect(mockDeps.requestSession).toHaveBeenCalledWith({
      tournamentId: 't1',
      role: 'checkin',
      pin: '4829',
    });
    expect(mockDeps.routerPush).toHaveBeenCalledWith({
      name: 'volunteer-checkin-kiosk',
      params: { tournamentId: 't1' },
    });
  });
});
