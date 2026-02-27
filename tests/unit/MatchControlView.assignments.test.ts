import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { Match } from '@/types';
import MatchControlView from '@/features/tournaments/views/MatchControlView.vue';

const runtimeState = {
  isAdmin: false,
  matches: [] as Match[],
  registrations: [] as Array<{ id: string; status?: string; isCheckedIn?: boolean }>,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeAll: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  checkAndFixConsistency: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  subscribeActivities: vi.fn(),
  unsubscribeActivities: vi.fn(),
  showToast: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  openDialog: vi.fn(),
  closeDialog: vi.fn(),
  isDialogOpen: vi.fn(() => false),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    query: {},
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
    replace: mockDeps.routerReplace,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: {
      id: 't1',
      name: 'Spring Open',
      settings: {
        matchDurationMinutes: 25,
        emergencyScheduleBufferMinutes: 10,
        autoAssignDueWindowMinutes: 10,
      },
    },
    categories: [
      {
        id: 'cat-1',
        tournamentId: 't1',
        name: "Men's Singles",
      },
    ],
    courts: [],
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeAll,
    releaseCourtManual: vi.fn(),
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtimeState.matches,
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
    checkAndFixConsistency: mockDeps.checkAndFixConsistency,
    saveManualPlannedTime: vi.fn(),
    publishMatchSchedule: vi.fn(),
    assignMatchToCourt: vi.fn(),
    unscheduleMatch: vi.fn(),
    completeMatch: vi.fn(),
    resetMatch: vi.fn(),
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtimeState.registrations,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/activities', () => ({
  useActivityStore: () => ({
    activities: [],
    subscribeActivities: mockDeps.subscribeActivities,
    unsubscribe: mockDeps.unsubscribeActivities,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: runtimeState.isAdmin,
    currentUser: {
      id: runtimeState.isAdmin ? 'admin-1' : 'scorekeeper-1',
      role: runtimeState.isAdmin ? 'admin' : 'scorekeeper',
    },
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => registrationId ?? 'Unknown',
  }),
}));

vi.mock('@/composables/useMatchDisplay', () => ({
  useMatchDisplay: () => ({
    getMatchDisplayName: () => 'Match',
  }),
}));

vi.mock('@/composables/useCategoryStageStatus', () => ({
  useCategoryStageStatus: () => ({
    categoryStageStatuses: { value: [] },
  }),
}));

vi.mock('@/composables/useDialogManager', () => ({
  useDialogManager: () => ({
    open: mockDeps.openDialog,
    close: mockDeps.closeDialog,
    isOpen: mockDeps.isDialogOpen,
  }),
}));

vi.mock('@/composables/useTournamentStateAdvance', () => ({
  useTournamentStateAdvance: () => ({
    advanceState: vi.fn(),
    transitionTo: vi.fn(),
    getNextState: vi.fn(() => null),
  }),
}));

interface MatchControlAssignmentsVm {
  canAdminAssignAnyway: (match: Match) => boolean;
  openAssignCourtDialog: (match: Match, options?: { ignoreCheckInGate?: boolean }) => void;
}

const makeMatch = (): Match => ({
  id: 'match-1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'ready',
  plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
  scheduleStatus: 'published',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const mountView = () =>
  shallowMount(MatchControlView, {
    global: {
      stubs: [
        'v-container',
        'v-row',
        'v-col',
        'v-btn',
        'v-card',
        'v-card-title',
        'v-card-text',
        'v-card-actions',
        'v-chip',
        'v-icon',
        'v-list',
        'v-list-item',
        'v-menu',
        'v-dialog',
        'v-select',
        'v-text-field',
        'v-data-table',
        'v-tooltip',
        'v-toolbar',
        'v-toolbar-title',
        'v-spacer',
        'v-btn-toggle',
        'v-progress-linear',
        'v-radio-group',
        'v-radio',
        'v-tabs',
        'v-tab',
        'v-window',
        'v-window-item',
        'v-switch',
        'v-alert',
        'BaseDialog',
        'FilterBar',
        'AssignCourtDialog',
        'SelectMatchForCourtDialog',
        'ScheduleMatchDialog',
        'ManualScoreDialog',
        'AutoScheduleDialog',
        'MatchQueueList',
        'CourtGrid',
        'ReadyQueue',
        'AlertsPanel',
        'StateBanner',
      ],
    },
  });

describe('MatchControlView assignment actions', () => {
  beforeEach(() => {
    runtimeState.isAdmin = false;
    runtimeState.matches = [makeMatch()];
    runtimeState.registrations = [
      { id: 'reg-1', status: 'approved' },
      { id: 'reg-2', status: 'approved' },
    ];

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeAll.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.subscribeActivities.mockReset();
    mockDeps.unsubscribeActivities.mockReset();
    mockDeps.checkAndFixConsistency.mockReset();
    mockDeps.showToast.mockReset();
    mockDeps.openDialog.mockReset();
    mockDeps.closeDialog.mockReset();
    mockDeps.isDialogOpen.mockReset().mockReturnValue(false);
    mockDeps.routerPush.mockReset();
    mockDeps.routerReplace.mockReset();
  });

  it('does not allow non-admin assign-anyway path and shows blocker warning', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;
    const match = makeMatch();

    expect(vm.canAdminAssignAnyway(match)).toBe(false);

    vm.openAssignCourtDialog(match, { ignoreCheckInGate: true });

    expect(mockDeps.openDialog).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith('warning', 'Blocked: Players not checked-in');
  });

  it('allows admins to open assign-anyway dialog when check-in is the only blocker', () => {
    runtimeState.isAdmin = true;

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;
    const match = makeMatch();

    expect(vm.canAdminAssignAnyway(match)).toBe(true);

    vm.openAssignCourtDialog(match, { ignoreCheckInGate: true });

    expect(mockDeps.openDialog).toHaveBeenCalledWith('assignCourt');
    expect(mockDeps.showToast).not.toHaveBeenCalled();
  });
});
