import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { shallowMount, type VueWrapper } from '@vue/test-utils';
import type { Match } from '@/types';
import MatchControlView from '@/features/tournaments/views/MatchControlView.vue';

const runtimeState = reactive({
  matches: [] as Match[],
  registrations: [] as Array<{ id: string; status?: string; isCheckedIn?: boolean }>,
  courts: [] as Array<{ id: string; name: string; status: string }>,
  routeQuery: {} as Record<string, unknown>,
});

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
  logActivity: vi.fn(),
  assignCourt: vi.fn(),
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
        autoAssignEnabled: true,
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
    courts: runtimeState.courts,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeAll,
    updateTournament: vi.fn(),
    releaseCourtManual: vi.fn(),
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtimeState.matches,
    fetchMatches: vi.fn().mockResolvedValue(undefined),
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
    checkAndFixConsistency: mockDeps.checkAndFixConsistency,
    saveManualPlannedTime: vi.fn(),
    publishMatchSchedule: vi.fn(),
    assignCourt: mockDeps.assignCourt,
    assignMatchToCourt: mockDeps.assignCourt,
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
    logActivity: mockDeps.logActivity,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: true,
    currentUser: {
      id: 'admin-1',
      role: 'admin',
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
  status: 'scheduled',
  plannedStartAt: new Date(Date.now() + 5 * 60_000),
  scheduleStatus: 'draft',
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

let activeWrapper: VueWrapper | null = null;

interface MatchControlAutoAssignVm {
  recentAutoAssignDecision: {
    title: string;
    message: string;
    severity: 'info' | 'warning';
  } | null;
}

describe('MatchControlView auto-assign reactivity', () => {
  afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = null;
  });

  beforeEach(() => {
    runtimeState.matches.splice(0, runtimeState.matches.length, makeMatch());
    runtimeState.registrations.splice(
      0,
      runtimeState.registrations.length,
      { id: 'reg-1', status: 'approved' },
      { id: 'reg-2', status: 'approved' },
    );
    runtimeState.courts.splice(
      0,
      runtimeState.courts.length,
      { id: 'court-1', name: 'Court 1', status: 'available' },
    );
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
    mockDeps.logActivity.mockReset();
    mockDeps.assignCourt.mockReset().mockResolvedValue(undefined);
    mockDeps.openDialog.mockReset();
    mockDeps.closeDialog.mockReset();
    mockDeps.isDialogOpen.mockReset().mockReturnValue(false);
    mockDeps.routerPush.mockReset();
    mockDeps.routerReplace.mockReset();
  });

  it('auto-assigns once a scheduled match becomes published and both players check in', async () => {
    activeWrapper = mountView();

    await nextTick();
    expect(mockDeps.assignCourt).not.toHaveBeenCalled();

    runtimeState.matches[0].scheduleStatus = 'published';
    runtimeState.matches[0].publishedAt = new Date();
    await nextTick();
    expect(mockDeps.assignCourt).not.toHaveBeenCalled();

    runtimeState.registrations[0].status = 'checked_in';
    runtimeState.registrations[1].status = 'checked_in';
    await nextTick();
    await nextTick();

    expect(mockDeps.assignCourt).toHaveBeenCalledTimes(1);
    expect(mockDeps.assignCourt).toHaveBeenCalledWith(
      't1',
      'match-1',
      'court-1',
      'cat-1',
      undefined
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Auto-assigned to Court 1');
  });

  it('skips blocked due matches and auto-assigns the next eligible due match with a warning', async () => {
    runtimeState.matches.splice(
      0,
      runtimeState.matches.length,
      makeMatch({
        id: 'match-blocked',
        scheduleStatus: 'draft',
        publishedAt: undefined,
        plannedStartAt: new Date(Date.now() + 1 * 60_000),
      }),
      makeMatch({
        id: 'match-eligible',
        participant1Id: 'reg-3',
        participant2Id: 'reg-4',
        scheduleStatus: 'draft',
        publishedAt: undefined,
        plannedStartAt: new Date(Date.now() + 2 * 60_000),
      }),
    );
    runtimeState.registrations.splice(
      0,
      runtimeState.registrations.length,
      { id: 'reg-1', status: 'checked_in' },
      { id: 'reg-2', status: 'checked_in' },
      { id: 'reg-3', status: 'checked_in' },
      { id: 'reg-4', status: 'checked_in' },
    );

    activeWrapper = mountView();
    const vm = activeWrapper.vm as unknown as MatchControlAutoAssignVm;

    await nextTick();
    runtimeState.matches[1].scheduleStatus = 'published';
    runtimeState.matches[1].publishedAt = new Date();
    await nextTick();
    await nextTick();

    expect(mockDeps.assignCourt).toHaveBeenCalledWith(
      't1',
      'match-eligible',
      'court-1',
      'cat-1',
      undefined
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('Skipped')
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('Publish schedule first')
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('Auto-assigned')
    );
    expect(mockDeps.logActivity).toHaveBeenCalledWith(
      't1',
      'court_assigned',
      expect.stringContaining('Auto-assigned Match → Court 1')
    );
    expect(vm.recentAutoAssignDecision).toEqual({
      title: 'Auto-assign skipped blocked match',
      message: expect.stringContaining('Skipped'),
      severity: 'warning',
    });
  });

  it('skips partially checked-in and absent doubles teams until a fully checked-in match is due', async () => {
    runtimeState.matches.splice(
      0,
      runtimeState.matches.length,
      makeMatch({
        id: 'match-partial',
        participant1Id: 'reg-partial',
        participant2Id: 'reg-ready-1',
        scheduleStatus: 'published',
        publishedAt: new Date(),
        plannedStartAt: new Date(Date.now() + 1 * 60_000),
      }),
      makeMatch({
        id: 'match-absent',
        participant1Id: 'reg-absent',
        participant2Id: 'reg-ready-2',
        scheduleStatus: 'published',
        publishedAt: new Date(),
        plannedStartAt: new Date(Date.now() + 2 * 60_000),
      }),
      makeMatch({
        id: 'match-eligible',
        participant1Id: 'reg-ready-3',
        participant2Id: 'reg-ready-4',
        scheduleStatus: 'published',
        publishedAt: new Date(),
        plannedStartAt: new Date(Date.now() + 3 * 60_000),
      }),
    );
    runtimeState.registrations.splice(
      0,
      runtimeState.registrations.length,
      { id: 'reg-partial', status: 'approved' },
      { id: 'reg-ready-1', status: 'checked_in' },
      { id: 'reg-absent', status: 'approved' },
      { id: 'reg-ready-2', status: 'checked_in' },
      { id: 'reg-ready-3', status: 'checked_in' },
      { id: 'reg-ready-4', status: 'checked_in' },
    );

    activeWrapper = mountView();

    await nextTick();
    await nextTick();

    expect(mockDeps.assignCourt).toHaveBeenCalledTimes(1);
    expect(mockDeps.assignCourt).toHaveBeenCalledWith(
      't1',
      'match-eligible',
      'court-1',
      'cat-1',
      undefined
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('Waiting for check-in')
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Auto-assigned to Court 1');
  });
});
