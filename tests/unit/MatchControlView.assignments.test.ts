import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { Match } from '@/types';
import MatchControlView from '@/features/tournaments/views/MatchControlView.vue';
import { useMatchSlotState } from '@/composables/useMatchSlotState';

const runtimeState = {
  isAdmin: false,
  matches: [] as Match[],
  registrations: [] as Array<{ id: string; status?: string; isCheckedIn?: boolean }>,
  routeQuery: {} as Record<string, unknown>,
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
    query: runtimeState.routeQuery,
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
  getMatchParticipantLabel: (match: Match, slot: 'participant1' | 'participant2') => string;
  getMatchParticipantsTooltip: (match: Match) => string;
  viewMode: 'queue' | 'schedule' | 'command';
  selectedCategory: string;
  scheduleViewMode: 'compact' | 'full';
  scheduleFilters: {
    publicState: 'all' | 'published' | 'draft' | 'not_scheduled';
  };
}

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
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
  ...overrides,
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
    runtimeState.routeQuery = {};

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

  it('hydrates schedule view + draft filters from query params', () => {
    runtimeState.routeQuery = {
      view: 'schedule',
      category: 'cat-1',
      publicState: 'draft',
      scheduleLayout: 'full',
    };

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;

    expect(vm.viewMode).toBe('schedule');
    expect(vm.selectedCategory).toBe('cat-1');
    expect(vm.scheduleFilters.publicState).toBe('draft');
    expect(vm.scheduleViewMode).toBe('full');
  });

  it('maps missing slots to BYE/TBD labels via shared slot-state rules', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;
    const slotState = useMatchSlotState();

    const byeMatch = makeMatch({
      participant1Id: 'reg-1',
      winnerId: 'reg-1',
      status: 'completed',
    });
    byeMatch.participant2Id = undefined;
    const tbdMatch = makeMatch({
      participant1Id: 'reg-1',
      winnerId: undefined,
      status: 'ready',
    });
    tbdMatch.participant2Id = undefined;

    expect(byeMatch.participant2Id).toBeUndefined();
    expect(tbdMatch.participant2Id).toBeUndefined();
    expect(slotState.getSlotLabel(byeMatch, 'participant2', (registrationId) => registrationId || 'Unknown')).toBe('BYE');
    expect(slotState.getSlotLabel(tbdMatch, 'participant2', (registrationId) => registrationId || 'Unknown')).toBe('TBD');

    expect(vm.getMatchParticipantLabel(byeMatch, 'participant2')).toBe('BYE');
    expect(vm.getMatchParticipantLabel(tbdMatch, 'participant2')).toBe('TBD');
    expect(vm.getMatchParticipantsTooltip(byeMatch)).toContain('BYE');
    expect(vm.getMatchParticipantsTooltip(tbdMatch)).toContain('TBD');
  });
});
