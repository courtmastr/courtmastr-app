import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Court, Match } from '@/types';

const baseDate = new Date('2026-02-27T10:00:00.000Z');

const runtime = vi.hoisted(() => ({
  matches: [] as Match[],
  currentUserId: 'admin-1',
}));

const mockDeps = vi.hoisted(() => ({
  scheduleMatches: vi.fn(),
  clearTimedScheduleScopes: vi.fn(),
  publishSchedule: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: runtime.currentUserId },
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
  clearTimedScheduleScopes: mockDeps.clearTimedScheduleScopes,
  publishSchedule: mockDeps.publishSchedule,
}));

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

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: overrides.id ?? 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'r-1',
  participant2Id: 'r-2',
  status: 'ready',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

describe('useScheduleOrchestrator', () => {
  beforeEach(() => {
    mockDeps.scheduleMatches.mockReset().mockImplementation(async (_tournamentId: string, options: { levelId?: string }) => ({
      scheduled: [
        {
          matchId: options.levelId ? `${options.levelId}-m1` : 'base-m1',
          scheduledTime: new Date('2026-03-01T09:00:00.000Z'),
          estimatedEndTime: new Date('2026-03-01T09:30:00.000Z'),
          courtId: 'court-1',
          courtNumber: 1,
          sequence: 1,
        },
      ],
      unscheduled: [],
      stats: {
        totalMatches: 1,
        scheduledCount: 1,
        unscheduledCount: 0,
        courtUtilization: 0,
        estimatedDuration: 30,
      },
    }));
    mockDeps.clearTimedScheduleScopes.mockReset().mockResolvedValue({ clearedCount: 2 });
    mockDeps.publishSchedule.mockReset().mockResolvedValue({ publishedCount: 1 });
    mockDeps.showToast.mockReset();
    runtime.matches = [];
  });

  it('clears level scopes before scheduling leveled targets', async () => {
    runtime.matches = [
      makeMatch({ id: 'level-1-a', levelId: 'level-1' }),
      makeMatch({ id: 'level-2-a', levelId: 'level-2' }),
    ];

    const { useScheduleOrchestrator } = await import('@/scheduling/useScheduleOrchestrator');

    const orchestrator = useScheduleOrchestrator(
      't-1',
      [makeCourt('court-1', 1), makeCourt('court-2', 2)],
      [makeCategory()]
    );

    await orchestrator.run({
      selectedCategoryIds: ['cat-1'],
      startTime: new Date('2026-03-01T09:00:00.000Z'),
      matchDurationMinutes: 30,
      bufferMinutes: 5,
      concurrency: 2,
      mode: 'sequential',
      categoryCourtBudgets: {},
      isReflowContext: false,
      allowPublishedChanges: false,
    });

    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledTimes(1);
    expect(mockDeps.clearTimedScheduleScopes).toHaveBeenCalledWith('t-1', [
      { categoryId: 'cat-1', levelId: 'level-1' },
      { categoryId: 'cat-1', levelId: 'level-2' },
    ]);

    expect(mockDeps.scheduleMatches).toHaveBeenCalledTimes(2);
    expect(mockDeps.scheduleMatches).toHaveBeenNthCalledWith(
      1,
      't-1',
      expect.objectContaining({ categoryId: 'cat-1', levelId: 'level-1' })
    );
    expect(mockDeps.scheduleMatches).toHaveBeenNthCalledWith(
      2,
      't-1',
      expect.objectContaining({ categoryId: 'cat-1', levelId: 'level-2' })
    );
  });

  it('does not clear scopes for non-leveled categories', async () => {
    runtime.matches = [
      makeMatch({ id: 'base-1', categoryId: 'cat-singles', levelId: undefined }),
    ];

    const { useScheduleOrchestrator } = await import('@/scheduling/useScheduleOrchestrator');

    const orchestrator = useScheduleOrchestrator(
      't-1',
      [makeCourt('court-1', 1)],
      [
        makeCategory({
          id: 'cat-singles',
          name: "Men's Singles",
          format: 'single_elimination',
          levelingStatus: null,
          poolStageId: null,
        }),
      ]
    );

    await orchestrator.run({
      selectedCategoryIds: ['cat-singles'],
      startTime: new Date('2026-03-01T09:00:00.000Z'),
      matchDurationMinutes: 30,
      bufferMinutes: 5,
      concurrency: 1,
      mode: 'sequential',
      categoryCourtBudgets: {},
      isReflowContext: false,
      allowPublishedChanges: false,
    });

    expect(mockDeps.clearTimedScheduleScopes).not.toHaveBeenCalled();
    expect(mockDeps.scheduleMatches).toHaveBeenCalledTimes(1);
    expect(mockDeps.scheduleMatches).toHaveBeenCalledWith(
      't-1',
      expect.objectContaining({ categoryId: 'cat-singles', levelId: undefined })
    );
  });
});
