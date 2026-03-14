import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import FrontDeskCheckInView from '@/features/checkin/views/FrontDeskCheckInView.vue';

const mockDeps = vi.hoisted(() => ({
  processScan: vi.fn(),
  checkInOne: vi.fn(),
  bulkCheckIn: vi.fn(),
  undoItem: vi.fn(),
  undoLatest: vi.fn(),
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
    currentTournament: {
      id: 't1',
      name: 'Spring Open',
      startDate: new Date('2026-03-15T00:00:00.000Z'),
    },
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
    throughput: ref({
      checkInsLastFiveMinutes: 0,
      avgSecondsPerCheckIn: 0,
    }),
    bulkUndoToken: ref(null),
    processScan: mockDeps.processScan,
    checkInOne: mockDeps.checkInOne,
    bulkCheckIn: mockDeps.bulkCheckIn,
    undoItem: mockDeps.undoItem,
    undoLatest: mockDeps.undoLatest,
    undoBulk: mockDeps.undoBulk,
  }),
}));

const mountView = () => shallowMount(FrontDeskCheckInView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: {
      'v-container': true,
      'v-toolbar': {
        template: '<div class=\"v-toolbar-stub\"><slot /></div>',
      },
      'v-btn': true,
      'v-toolbar-title': true,
      'v-spacer': true,
      'v-btn-toggle': true,
      'v-card': true,
      'v-card-text': true,
      'v-chip': true,
      'v-text-field': true,
      'v-progress-circular': true,
      'v-alert': true,
      'rapid-check-in-panel': true,
      'bulk-check-in-panel': true,
    },
  },
});

interface FrontDeskVm {
  selectedIds: string[];
  handleBulkCheckIn: () => Promise<void>;
  handleScanSubmit: (raw: string) => Promise<void>;
  handleUndoLatestShortcut: () => Promise<void>;
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
    mockDeps.undoLatest.mockReset().mockResolvedValue(undefined);
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

  it('uses workflow undoLatest for keyboard shortcut path', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as FrontDeskVm;

    await vm.handleUndoLatestShortcut();

    expect(mockDeps.undoLatest).toHaveBeenCalledTimes(1);
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Last check-in undone');
  });

  it('renders app logo and tournament date in the branded header', () => {
    const wrapper = mountView();
    const expectedDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
      new Date('2026-03-15T00:00:00.000Z')
    );

    expect(wrapper.find('.frontdesk-checkin__app-logo').exists()).toBe(true);
    expect(wrapper.text()).toContain(expectedDate);
  });
});
