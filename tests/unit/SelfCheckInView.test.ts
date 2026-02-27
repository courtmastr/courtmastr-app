import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import SelfCheckInView from '@/features/checkin/views/SelfCheckInView.vue';
import type { SelfCheckInCandidate } from '@/features/checkin/composables/useSelfCheckIn';

const mockDeps = vi.hoisted(() => ({
  search: vi.fn(),
  submit: vi.fn(),
}));

const candidatesRef = ref<SelfCheckInCandidate[]>([]);
const loadingRef = ref(false);
const submittingRef = ref(false);
const errorRef = ref<string | null>(null);

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
}));

vi.mock('@/features/checkin/composables/useSelfCheckIn', () => ({
  useSelfCheckIn: () => ({
    candidates: candidatesRef,
    loading: loadingRef,
    submitting: submittingRef,
    error: errorRef,
    search: mockDeps.search,
    submit: mockDeps.submit,
  }),
}));

const baseCandidate: SelfCheckInCandidate = {
  registrationId: 'reg-1',
  categoryId: 'cat-1',
  categoryName: 'Mixed Doubles',
  displayName: 'Aanya Karthik / Tejas Mayavanshi',
  partnerName: 'Tejas Mayavanshi',
  playerId: 'p1',
  partnerPlayerId: 'p2',
  status: 'approved',
};

const mountView = () => shallowMount(SelfCheckInView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-title',
      'v-card-subtitle',
      'v-card-text',
      'v-text-field',
      'v-progress-linear',
      'v-alert',
      'v-list',
      'v-list-item',
      'v-list-item-title',
      'v-list-item-subtitle',
      'v-chip',
      'v-btn',
    ],
  },
});

interface SelfCheckInVm {
  feedback: string;
  feedbackType: 'success' | 'info' | 'error';
  selectCandidate: (candidate: SelfCheckInCandidate) => void;
  checkInMe: () => Promise<void>;
  checkInMeAndPartner: () => Promise<void>;
}

describe('SelfCheckInView', () => {
  beforeEach(() => {
    candidatesRef.value = [baseCandidate];
    loadingRef.value = false;
    submittingRef.value = false;
    errorRef.value = null;
    mockDeps.search.mockReset().mockResolvedValue(undefined);
    mockDeps.submit.mockReset();
  });

  it('shows waiting-for-partner message when single participant checks in first', async () => {
    mockDeps.submit.mockResolvedValueOnce({
      registrationId: 'reg-1',
      status: 'approved',
      waitingForPartner: true,
      requiredParticipantIds: ['p1', 'p2'],
      presentParticipantIds: ['p1'],
    });

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as SelfCheckInVm;
    vm.selectCandidate(baseCandidate);

    await vm.checkInMe();

    expect(mockDeps.submit).toHaveBeenCalledWith({
      registrationId: 'reg-1',
      participantIds: ['p1'],
    });
    expect(vm.feedbackType).toBe('info');
    expect(vm.feedback).toContain('Waiting for partner');
  });

  it('submits both participant ids for partner check-in path', async () => {
    mockDeps.submit.mockResolvedValueOnce({
      registrationId: 'reg-1',
      status: 'checked_in',
      waitingForPartner: false,
      requiredParticipantIds: ['p1', 'p2'],
      presentParticipantIds: ['p1', 'p2'],
    });

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as SelfCheckInVm;
    vm.selectCandidate(baseCandidate);

    await vm.checkInMeAndPartner();

    expect(mockDeps.submit).toHaveBeenCalledWith({
      registrationId: 'reg-1',
      participantIds: ['p1', 'p2'],
    });
    expect(vm.feedbackType).toBe('success');
    expect(vm.feedback).toContain('check-in complete');
  });
});
