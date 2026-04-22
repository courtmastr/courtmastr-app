/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { Category, Court, Match } from '@/types';
import AutoScheduleDialog from '@/features/tournaments/dialogs/AutoScheduleDialog.vue';

const baseDate = new Date('2026-02-27T12:00:00.000Z');

const runtime = vi.hoisted(() => ({
  currentUserId: 'admin-1',
  currentTournament: {
    settings: {
      matchDurationMinutes: 20,
      bufferMinutes: 5,
    },
  },
  matches: [] as Match[],
}));

const mockDeps = vi.hoisted(() => ({
  scheduleMatches: vi.fn(),
  showToast: vi.fn(),
  publishSchedule: vi.fn(),
  clearTimedScheduleScopes: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: runtime.currentUserId },
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: runtime.currentTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/composables/useMatchScheduler', () => ({
  useMatchScheduler: () => ({
    scheduleMatches: mockDeps.scheduleMatches,
  }),
}));

vi.mock('@/composables/useTimeScheduler', () => ({
  publishSchedule: mockDeps.publishSchedule,
  clearTimedScheduleScopes: mockDeps.clearTimedScheduleScopes,
}));

const BaseDialogStub = defineComponent({
  template: '<div><slot /><slot name="actions" /></div>',
});

const VBtnStub = defineComponent({
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
});

const PassThroughStub = defineComponent({
  template: '<div><slot /><slot name="prepend-item" /></div>',
});

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tournamentId: 't-1',
  name: "Men's Doubles",
  type: 'doubles',
  gender: 'men',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  seedingEnabled: true,
  status: 'active',
  poolStageId: 0,
  levelingStatus: 'generated',
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const makeCourt = (id: string, number: number): Court => ({
  id,
  tournamentId: 't-1',
  name: `Court ${number}`,
  number,
  status: 'available',
  createdAt: baseDate,
  updatedAt: baseDate,
});

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: overrides.id || 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'r1',
  participant2Id: 'r2',
  status: 'ready',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const flush = async (cycles = 6): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await nextTick();
    await Promise.resolve();
  }
};

const mountDialog = (category: Category = makeCategory()) =>
  mount(AutoScheduleDialog, {
    props: {
      modelValue: false,
      tournamentId: 't-1',
      categories: [category],
      courts: [makeCourt('court-1', 1), makeCourt('court-2', 2)],
      dialogContext: 'schedule',
      initialCategoryIds: [category.id],
    },
    global: {
      stubs: {
        BaseDialog: BaseDialogStub,
        'v-alert': true,
        'v-select': PassThroughStub,
        'v-text-field': true,
        'v-row': PassThroughStub,
        'v-col': PassThroughStub,
        'v-btn-toggle': PassThroughStub,
        'v-tooltip': PassThroughStub,
        'v-icon': true,
        'v-switch': true,
        'v-card': PassThroughStub,
        'v-card-title': PassThroughStub,
        'v-card-text': PassThroughStub,
        'v-spacer': true,
        'v-chip': true,
        'v-expansion-panels': PassThroughStub,
        'v-expansion-panel': PassThroughStub,
        'v-expansion-panel-title': PassThroughStub,
        'v-expansion-panel-text': PassThroughStub,
        'v-divider': true,
        'v-list-item': PassThroughStub,
        'v-btn': VBtnStub,
      },
    },
  });

describe('AutoScheduleDialog level scope routing', () => {
  beforeEach(() => {
    runtime.matches = [
      makeMatch({ id: 'pool-complete-1', levelId: undefined, groupId: 'pool-a', status: 'completed' }),
      makeMatch({ id: 'pool-complete-2', levelId: undefined, groupId: 'pool-a', status: 'completed' }),
      makeMatch({ id: 'level-1-ready', levelId: 'level-1', status: 'ready' }),
      makeMatch({ id: 'level-2-ready', levelId: 'level-2', status: 'ready' }),
      makeMatch({ id: 'level-3-ready', levelId: 'level-3', status: 'ready' }),
    ];
    mockDeps.scheduleMatches.mockReset().mockResolvedValue({
      scheduled: [],
      unscheduled: [],
      stats: {
        totalMatches: 1,
        scheduledCount: 1,
        unscheduledCount: 0,
        courtUtilization: 0,
        estimatedDuration: 20,
      },
    });
    mockDeps.showToast.mockReset();
    mockDeps.publishSchedule.mockReset();
    mockDeps.clearTimedScheduleScopes.mockReset().mockResolvedValue({ clearedCount: 0 });
  });

  it('schedules all level scopes and avoids base scope when levels exist', async () => {
    const wrapper = mountDialog();

    await wrapper.setProps({ modelValue: true });
    await flush();

    const runButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Generate Schedule Draft')
    );

    expect(runButton).toBeDefined();
    await runButton!.trigger('click');
    await flush();

    const scheduledLevelIds = mockDeps.scheduleMatches.mock.calls.map((call) => call[1]?.levelId);

    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledTimes(1);
    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledWith('t-1', [
      { categoryId: 'cat-1', levelId: 'level-1' },
      { categoryId: 'cat-1', levelId: 'level-2' },
      { categoryId: 'cat-1', levelId: 'level-3' },
    ]);
    expect(scheduledLevelIds).toEqual(['level-1', 'level-2', 'level-3']);
    expect(scheduledLevelIds).not.toContain(undefined);
  });

  it('keeps base scope scheduling for non-leveled categories', async () => {
    runtime.matches = [
      makeMatch({ id: 'base-ready-1', categoryId: 'cat-singles', levelId: undefined, status: 'ready' }),
    ];

    const wrapper = mountDialog(
      makeCategory({
        id: 'cat-singles',
        name: "Men's Singles",
        format: 'single_elimination',
        levelingStatus: null,
        poolStageId: null,
      })
    );

    await wrapper.setProps({ modelValue: true });
    await flush();

    const runButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Generate Schedule Draft')
    );

    expect(runButton).toBeDefined();
    await runButton!.trigger('click');
    await flush();

    expect(mockDeps.clearTimedScheduleScopes).not.toHaveBeenCalled();
    expect(mockDeps.scheduleMatches).toHaveBeenCalledTimes(1);
    expect(mockDeps.scheduleMatches.mock.calls[0][1]?.categoryId).toBe('cat-singles');
    expect(mockDeps.scheduleMatches.mock.calls[0][1]?.levelId).toBeUndefined();
  });

  it('handles mixed selection by clearing only leveled targets and preserving base targets', async () => {
    runtime.matches = [
      makeMatch({ id: 'level-1-ready', categoryId: 'cat-levels', levelId: 'level-1', status: 'ready' }),
      makeMatch({ id: 'level-2-ready', categoryId: 'cat-levels', levelId: 'level-2', status: 'ready' }),
      makeMatch({ id: 'base-ready', categoryId: 'cat-base', levelId: undefined, status: 'ready' }),
    ];

    const leveledCategory = makeCategory({
      id: 'cat-levels',
      name: "Men's Doubles",
      format: 'pool_to_elimination',
      levelingStatus: 'generated',
      poolStageId: 0,
    });
    const baseCategory = makeCategory({
      id: 'cat-base',
      name: "Men's Singles",
      format: 'single_elimination',
      levelingStatus: null,
      poolStageId: null,
    });

    const wrapper = mount(AutoScheduleDialog, {
      props: {
        modelValue: false,
        tournamentId: 't-1',
        categories: [leveledCategory, baseCategory],
        courts: [makeCourt('court-1', 1), makeCourt('court-2', 2)],
        dialogContext: 'schedule',
        initialCategoryIds: ['cat-levels', 'cat-base'],
      },
      global: {
        stubs: {
          BaseDialog: BaseDialogStub,
          'v-alert': true,
          'v-select': PassThroughStub,
          'v-text-field': true,
          'v-row': PassThroughStub,
          'v-col': PassThroughStub,
          'v-btn-toggle': PassThroughStub,
          'v-tooltip': PassThroughStub,
          'v-icon': true,
          'v-switch': true,
          'v-card': PassThroughStub,
          'v-card-title': PassThroughStub,
          'v-card-text': PassThroughStub,
          'v-spacer': true,
          'v-chip': true,
          'v-expansion-panels': PassThroughStub,
          'v-expansion-panel': PassThroughStub,
          'v-expansion-panel-title': PassThroughStub,
          'v-expansion-panel-text': PassThroughStub,
          'v-divider': true,
          'v-list-item': PassThroughStub,
          'v-btn': VBtnStub,
        },
      },
    });

    await wrapper.setProps({ modelValue: true });
    await flush();

    const runButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Generate Schedule Draft')
    );
    expect(runButton).toBeDefined();
    await runButton!.trigger('click');
    await flush();

    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledTimes(1);
    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledWith('t-1', [
      { categoryId: 'cat-levels', levelId: 'level-1' },
      { categoryId: 'cat-levels', levelId: 'level-2' },
    ]);

    expect(mockDeps.scheduleMatches).toHaveBeenCalledTimes(3);
    expect(mockDeps.scheduleMatches.mock.calls[0][1]).toEqual(
      expect.objectContaining({ categoryId: 'cat-levels', levelId: 'level-1' })
    );
    expect(mockDeps.scheduleMatches.mock.calls[1][1]).toEqual(
      expect.objectContaining({ categoryId: 'cat-levels', levelId: 'level-2' })
    );
    expect(mockDeps.scheduleMatches.mock.calls[2][1]).toEqual(
      expect.objectContaining({ categoryId: 'cat-base', levelId: undefined })
    );
  });

  it('shifts schedule start when other categories already consume court capacity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T09:00:00.000Z'));
    try {
      runtime.matches = [
        makeMatch({ id: 'target-ready-1', categoryId: 'cat-1', levelId: undefined, status: 'ready' }),
        makeMatch({ id: 'target-ready-2', categoryId: 'cat-1', levelId: undefined, status: 'ready' }),
        makeMatch({
          id: 'other-category-slot',
          categoryId: 'cat-2',
          levelId: undefined,
          status: 'scheduled',
          plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
          plannedEndAt: new Date('2026-02-27T09:20:00.000Z'),
          scheduleStatus: 'published',
        }),
      ];

      mockDeps.scheduleMatches.mockReset().mockImplementation(async (_tournamentId: string, options: Record<string, unknown>) => {
        const start = options.startTime as Date;
        const end = new Date(start.getTime() + 20 * 60_000);
        return {
          scheduled: [
            { matchId: 'target-ready-1', courtId: '', courtNumber: 0, scheduledTime: start, estimatedEndTime: end, sequence: 1 },
            { matchId: 'target-ready-2', courtId: '', courtNumber: 0, scheduledTime: start, estimatedEndTime: end, sequence: 2 },
          ],
          unscheduled: [],
          stats: {
            totalMatches: 2,
            scheduledCount: 2,
            unscheduledCount: 0,
            courtUtilization: 0,
            estimatedDuration: 20,
          },
        };
      });

      const wrapper = mountDialog(
        makeCategory({
          id: 'cat-1',
          name: "Men's Doubles",
          format: 'single_elimination',
          levelingStatus: null,
          poolStageId: null,
        })
      );

      await wrapper.setProps({ modelValue: true });
      await flush();

      const runButton = wrapper.findAll('button').find((button) =>
        button.text().includes('Generate Schedule Draft')
      );
      expect(runButton).toBeDefined();
      await runButton!.trigger('click');
      await flush();

      const dryRunCalls = mockDeps.scheduleMatches.mock.calls.filter((call) => call[1]?.dryRun === true);
      const commitCalls = mockDeps.scheduleMatches.mock.calls.filter((call) => call[1]?.dryRun !== true);

      expect(dryRunCalls.length).toBeGreaterThan(0);
      expect(commitCalls.length).toBeGreaterThan(0);
      expect((commitCalls[0][1].startTime as Date).getTime()).toBeGreaterThan((dryRunCalls[0][1].startTime as Date).getTime());
      expect(mockDeps.showToast).toHaveBeenCalledWith('warning', expect.stringContaining('Start adjusted'));
    } finally {
      vi.useRealTimers();
    }
  });
});
