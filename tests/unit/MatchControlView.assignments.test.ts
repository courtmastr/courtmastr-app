/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
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
    fetchMatches: vi.fn().mockResolvedValue(undefined),
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    subscribeCategoryMatches: vi.fn(),
    unsubscribeCategoryMatches: vi.fn(),
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
  canScoreMatch: (match: Match) => boolean;
  canAdminAssignAnyway: (match: Match) => boolean;
  openAssignCourtDialog: (match: Match, options?: { ignoreCheckInGate?: boolean }) => void;
  openScoreDialog: (match: Match) => void;
  getQueueBlockedReason: (match: Match) => string;
  getMatchParticipantLabel: (match: Match, slot: 'participant1' | 'participant2') => string;
  getMatchParticipantsTooltip: (match: Match) => string;
  selectedMatch: Match | null;
  viewMode: 'schedule' | 'command';
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

const DataTableStub = defineComponent({
  props: {
    items: {
      type: Array,
      default: () => [],
    },
  },
  template: `
    <div class="v-data-table-stub">
      <div
        v-for="item in items"
        :key="item.id"
        class="compact-actions-row"
      >
        <slot name="item.actions" :item="item" />
      </div>
    </div>
  `,
});

const TooltipStub = defineComponent({
  template: `
    <div class="v-tooltip-stub">
      <slot name="activator" :props="{}" />
      <slot />
    </div>
  `,
});

const ButtonStub = defineComponent({
  template: `
    <button type="button">
      <slot />
    </button>
  `,
});

const MenuStub = defineComponent({
  template: `
    <div class="v-menu-stub">
      <slot name="activator" :props="{}" />
      <slot />
    </div>
  `,
});

const mountCompactScheduleView = () =>
  shallowMount(MatchControlView, {
    global: {
      stubs: {
        'v-container': true,
        'v-row': true,
        'v-col': true,
        'v-btn': ButtonStub,
        'v-card': true,
        'v-card-title': true,
        'v-card-text': true,
        'v-card-actions': true,
        'v-chip': true,
        'v-icon': true,
        'v-list': true,
        'v-list-item': true,
        'v-menu': MenuStub,
        'v-dialog': true,
        'v-select': true,
        'v-text-field': true,
        'v-data-table': DataTableStub,
        'v-tooltip': TooltipStub,
        'v-toolbar': true,
        'v-toolbar-title': true,
        'v-spacer': true,
        'v-btn-toggle': true,
        'v-progress-linear': true,
        'v-radio-group': true,
        'v-radio': true,
        'v-tabs': true,
        'v-tab': true,
        'v-window': true,
        'v-window-item': true,
        'v-switch': true,
        'v-alert': true,
        BaseDialog: true,
        FilterBar: true,
        AssignCourtDialog: true,
        SelectMatchForCourtDialog: true,
        ScheduleMatchDialog: true,
        ManualScoreDialog: true,
        AutoScheduleDialog: true,
        MatchQueueList: true,
        CourtGrid: true,
        ReadyQueue: true,
        AlertsPanel: true,
        StateBanner: true,
      },
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

  it('opens scoring with the exact selected match when ids collide across categories', () => {
    const mixedMatch = makeMatch({
      id: 'm-dup',
      categoryId: 'cat-mixed',
      participant1Id: 'reg-mixed-1',
      participant2Id: 'reg-mixed-2',
    });
    const womensMatch = makeMatch({
      id: 'm-dup',
      categoryId: 'cat-womens',
      participant1Id: 'reg-womens-1',
      participant2Id: 'reg-womens-2',
      courtId: 'court-1',
      status: 'in_progress',
    });
    runtimeState.matches = [mixedMatch, womensMatch];

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;

    vm.openScoreDialog(womensMatch);

    expect(vm.selectedMatch).toMatchObject({
      id: 'm-dup',
      categoryId: 'cat-womens',
      participant1Id: 'reg-womens-1',
      participant2Id: 'reg-womens-2',
      courtId: 'court-1',
      status: 'in_progress',
    });
    expect(mockDeps.openDialog).toHaveBeenCalledWith('score');
    expect(mockDeps.showToast).not.toHaveBeenCalledWith('error', 'Match not found');
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

  it('surfaces mixed blocker reasons with check-in first for organizer queue messaging', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;
    const match = makeMatch({
      scheduleStatus: 'draft',
      publishedAt: undefined,
    });

    expect(vm.getQueueBlockedReason(match)).toBe('Waiting for check-in • Publish schedule first');
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

  it('falls back to command view when query requests removed queue mode', () => {
    runtimeState.routeQuery = { view: 'queue' };

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;

    expect(vm.viewMode).toBe('command');
  });

  it('allows manual scoring for scheduled, ready, and in-progress matches', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchControlAssignmentsVm;

    expect(vm.canScoreMatch(makeMatch({ status: 'scheduled' }))).toBe(true);
    expect(vm.canScoreMatch(makeMatch({ status: 'ready' }))).toBe(true);
    expect(vm.canScoreMatch(makeMatch({ status: 'in_progress' }))).toBe(true);
    expect(vm.canScoreMatch(makeMatch({ status: 'completed' }))).toBe(false);
  });

  it('shows Score and blocked Assign for a scheduled match in compact schedule view', () => {
    runtimeState.routeQuery = { view: 'schedule' };
    runtimeState.matches = [
      makeMatch({
        status: 'scheduled',
        plannedStartAt: undefined,
      }),
    ];

    const wrapper = mountCompactScheduleView();
    const row = wrapper.get('.compact-actions-row');

    expect(row.text()).toContain('Score');
    expect(row.text()).toContain('Assign');
  });

  it('shows Score and blocked Assign for a ready match in compact schedule view', () => {
    runtimeState.routeQuery = { view: 'schedule' };
    runtimeState.matches = [makeMatch()];

    const wrapper = mountCompactScheduleView();
    const row = wrapper.get('.compact-actions-row');

    expect(row.text()).toContain('Score');
    expect(row.text()).toContain('Assign');
  });

  it('shows Score and Assign for an assignable ready match in compact schedule view', () => {
    runtimeState.routeQuery = { view: 'schedule' };
    runtimeState.registrations = [
      { id: 'reg-1', status: 'checked_in' },
      { id: 'reg-2', status: 'checked_in' },
    ];
    runtimeState.matches = [makeMatch()];

    const wrapper = mountCompactScheduleView();
    const row = wrapper.get('.compact-actions-row');

    expect(row.text()).toContain('Score');
    expect(row.text()).toContain('Assign');
  });

  it('shows only Score for an in-progress match in compact schedule view', () => {
    runtimeState.routeQuery = { view: 'schedule' };
    runtimeState.matches = [
      makeMatch({
        status: 'in_progress',
        courtId: 'court-1',
      }),
    ];

    const wrapper = mountCompactScheduleView();
    const row = wrapper.get('.compact-actions-row');

    expect(row.text()).toContain('Score');
    expect(row.text()).not.toContain('Assign');
  });

  it('does not show Score for completed matches in compact schedule view', () => {
    runtimeState.routeQuery = { view: 'schedule' };
    runtimeState.matches = [
      makeMatch({
        status: 'completed',
        winnerId: 'reg-1',
      }),
    ];

    const wrapper = mountCompactScheduleView();
    const row = wrapper.get('.compact-actions-row');

    expect(row.text()).not.toContain('Score');
  });
});
