import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import FrontDeskCheckInView from '@/features/checkin/views/FrontDeskCheckInView.vue';

const mockDeps = vi.hoisted(() => ({
  processScan: vi.fn(),
  checkInOne: vi.fn(),
  bulkCheckIn: vi.fn(),
  undoItem: vi.fn(),
  undoBulk: vi.fn(),
  showToast: vi.fn(),
  routerPush: vi.fn(),
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  tournamentUnsub: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  registrationUnsub: vi.fn(),
  subscribeAllMatches: vi.fn(),
  matchUnsub: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-1', role: 'admin' },
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: [],
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.matchUnsub,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: [],
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    unsubscribeAll: mockDeps.registrationUnsub,
    checkInRegistration: vi.fn(),
    undoCheckInRegistration: vi.fn(),
    assignBibNumber: vi.fn(),
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: { id: 't1', name: 'Spring Open' },
    categories: [],
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.tournamentUnsub,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: () => 'Aanya Karthik',
  }),
}));

vi.mock('@/features/checkin/composables/useFrontDeskCheckInWorkflow', () => ({
  useFrontDeskCheckInWorkflow: () => ({
    urgentItems: ref([]),
    recentItems: ref([]),
    bulkRows: ref([]),
    stats: ref({
      approvedTotal: 0,
      checkedIn: 0,
      noShow: 0,
      ratePercent: 0,
    }),
    bulkUndoToken: ref(null),
    processScan: mockDeps.processScan,
    checkInOne: mockDeps.checkInOne,
    bulkCheckIn: mockDeps.bulkCheckIn,
    undoItem: mockDeps.undoItem,
    undoBulk: mockDeps.undoBulk,
  }),
}));

const mountView = () => shallowMount(FrontDeskCheckInView, {
  global: {
    stubs: [
      'v-container',
      'v-toolbar',
      'v-btn',
      'v-toolbar-title',
      'v-spacer',
      'v-btn-toggle',
      'v-card',
      'v-card-text',
      'v-chip',
      'v-text-field',
      'v-progress-circular',
      'v-alert',
      'rapid-check-in-panel',
      'bulk-check-in-panel',
    ],
  },
});

interface FrontDeskVm {
  selectedIds: string[];
  handleBulkCheckIn: () => Promise<void>;
  handleScanSubmit: (raw: string) => Promise<void>;
}

describe('FrontDeskCheckInView', () => {
  beforeEach(() => {
    mockDeps.processScan.mockReset().mockResolvedValue({
      registrationId: 'reg-1',
      name: 'Aanya Karthik',
      bibNumber: 101,
    });
    mockDeps.checkInOne.mockReset().mockResolvedValue(undefined);
    mockDeps.bulkCheckIn.mockReset().mockResolvedValue({
      successIds: ['reg-1'],
      failed: [],
      bulkUndoToken: null,
    });
    mockDeps.undoItem.mockReset().mockResolvedValue(undefined);
    mockDeps.undoBulk.mockReset().mockResolvedValue({ successIds: ['reg-1'], failed: [] });
    mockDeps.showToast.mockReset();
    mockDeps.routerPush.mockReset();
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.tournamentUnsub.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.registrationUnsub.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.matchUnsub.mockReset();
  });

  it('shows warning when bulk check-in is triggered without selection', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as FrontDeskVm;

    vm.selectedIds = [];
    await vm.handleBulkCheckIn();

    expect(mockDeps.bulkCheckIn).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith('warning', 'No participants selected');
  });

  it('surfaces scan ambiguity errors from workflow', async () => {
    mockDeps.processScan.mockRejectedValueOnce(
      new Error('Multiple participants match this name. Type more of the name or use bib number.')
    );

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as FrontDeskVm;

    await vm.handleScanSubmit('a');

    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'error',
      'Multiple participants match this name. Type more of the name or use bib number.'
    );
  });
});
