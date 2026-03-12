/**
 * useScheduleOrchestrator
 *
 * Encapsulates the full auto-schedule orchestration flow extracted from
 * AutoScheduleDialog.vue.  The dialog remains UI-only and delegates all
 * Firestore / algorithm work here.
 *
 * Parameters
 * ──────────
 *   tournamentId  – active tournament
 *   courts        – Court[] (reactive ref/computed acceptable via toRef from caller)
 *   categories    – Category[] (reactive ref/computed acceptable via toRef from caller)
 *   matches       – Match[]  (typically from useMatchStore().matches)
 *
 * Exposed API
 * ───────────
 *   scheduleTargets      – computed ScheduleTarget[] for the currently selected categories
 *   isRunning            – true while run() is in-flight
 *   isPublishing         – true while publish() is in-flight
 *   lastResult           – DraftSummary | null after a successful run()
 *   hasDraft             – boolean derived from lastResult
 *   run(params)          – execute the full schedule flow (sequential or parallel)
 *   publish(categoryIds) – publish the draft
 *
 * All toast notifications are emitted through useNotificationStore so the
 * dialog does not need to re-implement them.
 */

import { ref, computed } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useAuthStore } from '@/stores/auth';
import { useMatchScheduler, type ScheduleResult } from '@/composables/useMatchScheduler';
import { clearTimedScheduleScopes, publishSchedule } from '@/composables/useTimeScheduler';
import {
  resolveScheduleTargetsForCategory,
  type ScheduleTarget,
} from './autoScheduleTargets';
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
  type OccupiedScheduleWindow,
} from './scheduleCapacityGuard';
import type { Category, Court, Match } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type SchedulingMode = 'sequential' | 'parallel_partitioned';

export interface RunScheduleParams {
  selectedCategoryIds: string[];
  startTime: Date;
  matchDurationMinutes: number;
  bufferMinutes: number;
  concurrency: number;
  mode: SchedulingMode;
  /** Per-category court budgets — used only in parallel_partitioned mode. */
  categoryCourtBudgets: Record<string, number>;
  isReflowContext: boolean;
  allowPublishedChanges: boolean;
}

export interface DraftSummary {
  totalScheduled: number;
  totalUnscheduled: number;
  estimatedEndTime: Date | null;
  unscheduledList: ScheduleResult['unscheduled'];
  scheduledCategoryIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CAPACITY_GUARD_ITERATIONS = 24;

export function useScheduleOrchestrator(
  tournamentId: string,
  courts: Court[],
  categories: Category[]
) {
  // ── internal deps ──────────────────────────────────────────────────────────
  const scheduler = useMatchScheduler();
  const matchStore = useMatchStore();
  const notificationStore = useNotificationStore();
  const authStore = useAuthStore();

  // ── reactive state ─────────────────────────────────────────────────────────
  const isRunning = ref(false);
  const isPublishing = ref(false);
  const lastResult = ref<DraftSummary | null>(null);

  // ── derived ────────────────────────────────────────────────────────────────

  /**
   * All schedule targets across every provided category, resolved from the
   * current match list.  When a category has generated leveling, each level
   * produces its own target scope; otherwise the category itself is the scope.
   */
  const scheduleTargets = computed<ScheduleTarget[]>(() =>
    categories.flatMap((category) =>
      resolveScheduleTargetsForCategory(category, matchStore.matches as Match[])
    )
  );

  const hasDraft = computed(
    () => Boolean(lastResult.value && lastResult.value.totalScheduled > 0)
  );

  // ── private helpers ────────────────────────────────────────────────────────

  function getActiveCourts(): Court[] {
    return [...courts]
      .filter((court) => court.status !== 'maintenance')
      .sort((a, b) => a.number - b.number);
  }

  function getActiveCourtIds(): string[] {
    return getActiveCourts().map((court) => court.id);
  }

  function getCategoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? categoryId;
  }

  function getTargetScopeLabel(target: ScheduleTarget): string {
    if (!target.levelId) return getCategoryName(target.categoryId);
    return `${getCategoryName(target.categoryId)} (${target.levelId})`;
  }

  function formatDateTime(date: Date): string {
    return date.toLocaleString([], {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  }

  function buildCapacityOccupiedWindows(
    targets: ScheduleTarget[],
    fallbackDurationMinutes: number
  ): OccupiedScheduleWindow[] {
    return buildOccupiedWindows(matchStore.matches as Match[], {
      fallbackDurationMinutes: Math.max(1, fallbackDurationMinutes),
      excludeScopes: targets,
    });
  }

  function notifyAdjustedStart(target: ScheduleTarget, from: Date, to: Date): void {
    if (from.getTime() === to.getTime()) return;
    notificationStore.showToast(
      'warning',
      `Start adjusted for ${getTargetScopeLabel(target)} from ${formatDateTime(from)} to ${formatDateTime(to)} to avoid overlap with existing draft/published schedule.`
    );
  }

  async function scheduleCategoryWithConfig(
    target: ScheduleTarget,
    scheduleStart: Date,
    courtIds: string[],
    categoryConcurrency: number,
    params: RunScheduleParams,
    dryRun = false
  ): Promise<ScheduleResult> {
    return scheduler.scheduleMatches(tournamentId, {
      categoryId: target.categoryId,
      levelId: target.levelId,
      courtIds,
      startTime: scheduleStart,
      matchDurationMinutes: params.matchDurationMinutes,
      bufferMinutes: params.bufferMinutes,
      concurrency: categoryConcurrency,
      respectDependencies: false,
      reflowMode: params.isReflowContext,
      allowPublishedChanges: params.isReflowContext ? params.allowPublishedChanges : false,
      includeAssignedMatches: params.isReflowContext ? false : undefined,
      dryRun,
    });
  }

  interface CapacityGuardRunResult {
    result: ScheduleResult;
    resolvedStart: Date;
    shiftedFrom: Date | null;
  }

  async function runWithCapacityGuard(
    target: ScheduleTarget,
    requestedStart: Date,
    courtIds: string[],
    categoryConcurrency: number,
    availableCapacity: number,
    occupiedWindows: OccupiedScheduleWindow[],
    params: RunScheduleParams
  ): Promise<CapacityGuardRunResult> {
    const originalStart = new Date(requestedStart);
    const scopedCapacity = Math.max(1, Math.floor(availableCapacity));

    if (occupiedWindows.length === 0) {
      const directResult = await scheduleCategoryWithConfig(
        target,
        originalStart,
        courtIds,
        categoryConcurrency,
        params
      );
      return { result: directResult, resolvedStart: originalStart, shiftedFrom: null };
    }

    let candidateStart = new Date(originalStart);
    for (let attempt = 0; attempt < MAX_CAPACITY_GUARD_ITERATIONS; attempt += 1) {
      const dryRunResult = await scheduleCategoryWithConfig(
        target,
        candidateStart,
        courtIds,
        categoryConcurrency,
        params,
        true
      );

      const candidateWindows = extractScheduledWindows(dryRunResult.scheduled);
      if (candidateWindows.length === 0) {
        const commitResult = await scheduleCategoryWithConfig(
          target,
          candidateStart,
          courtIds,
          categoryConcurrency,
          params
        );
        return {
          result: commitResult,
          resolvedStart: candidateStart,
          shiftedFrom:
            candidateStart.getTime() === originalStart.getTime() ? null : originalStart,
        };
      }

      const conflict = findCapacityConflict(occupiedWindows, candidateWindows, scopedCapacity);
      if (!conflict) {
        const commitResult = await scheduleCategoryWithConfig(
          target,
          candidateStart,
          courtIds,
          categoryConcurrency,
          params
        );
        return {
          result: commitResult,
          resolvedStart: candidateStart,
          shiftedFrom:
            candidateStart.getTime() === originalStart.getTime() ? null : originalStart,
        };
      }

      if (conflict.nextBoundaryMs <= candidateStart.getTime()) break;
      candidateStart = new Date(conflict.nextBoundaryMs);
    }

    throw new Error(
      'Unable to find non-conflicting schedule window with current court capacity'
    );
  }

  // ── sequential scheduler ───────────────────────────────────────────────────

  async function runSequentialSchedule(
    targets: ScheduleTarget[],
    start: Date,
    params: RunScheduleParams
  ): Promise<ScheduleResult> {
    const activeCourtIds = getActiveCourtIds();
    const effectiveConcurrency = Math.max(
      1,
      params.concurrency > 0
        ? Math.min(params.concurrency, activeCourtIds.length)
        : activeCourtIds.length
    );

    let totalScheduled = 0;
    let totalUnscheduled = 0;
    const allScheduled: ScheduleResult['scheduled'] = [];
    const allUnscheduled: ScheduleResult['unscheduled'] = [];
    let estimatedEndTime: Date | null = null;
    let nextStart = new Date(start);
    const occupiedWindows = buildCapacityOccupiedWindows(targets, params.matchDurationMinutes);

    for (const target of targets) {
      const capacityResult = await runWithCapacityGuard(
        target,
        nextStart,
        activeCourtIds,
        effectiveConcurrency,
        activeCourtIds.length,
        occupiedWindows,
        params
      );
      notifyAdjustedStart(target, nextStart, capacityResult.resolvedStart);
      const result = capacityResult.result;

      totalScheduled += result.stats.scheduledCount;
      totalUnscheduled += result.stats.unscheduledCount;
      allScheduled.push(
        ...result.scheduled.map((item) => ({
          ...item,
          matchId: `${getTargetScopeLabel(target)} • ${item.matchId}`,
        }))
      );
      allUnscheduled.push(
        ...result.unscheduled.map((item) => ({
          ...item,
          matchId: `${getTargetScopeLabel(target)} • ${item.matchId}`,
        }))
      );

      const targetEnd = result.scheduled.reduce<Date | null>((latest, item) => {
        if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
        return latest;
      }, null);

      if (targetEnd && (!estimatedEndTime || targetEnd > estimatedEndTime)) {
        estimatedEndTime = targetEnd;
      }

      if (targetEnd) {
        nextStart = new Date(targetEnd.getTime() + params.bufferMinutes * 60_000);
      }
    }

    return {
      scheduled: allScheduled,
      unscheduled: allUnscheduled,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled,
        courtUtilization: 0,
        estimatedDuration: estimatedEndTime
          ? Math.ceil((estimatedEndTime.getTime() - start.getTime()) / 60_000)
          : 0,
      },
    };
  }

  // ── parallel-partitioned scheduler ────────────────────────────────────────

  async function runParallelPartitionedSchedule(
    targets: ScheduleTarget[],
    start: Date,
    params: RunScheduleParams,
    categoryTargets: Map<string, ScheduleTarget[]>
  ): Promise<ScheduleResult> {
    const activeCourtIds = getActiveCourtIds();
    const allScheduled: ScheduleResult['scheduled'] = [];
    const allUnscheduled: ScheduleResult['unscheduled'] = [];
    let totalScheduled = 0;
    let totalUnscheduled = 0;
    let estimatedEndTime: Date | null = null;
    let courtCursor = 0;
    const occupiedWindows = buildCapacityOccupiedWindows(targets, params.matchDurationMinutes);

    for (const categoryId of params.selectedCategoryIds) {
      const courtBudget = Math.max(
        0,
        Math.floor(Number(params.categoryCourtBudgets[categoryId] ?? 0))
      );
      const partitionCourtIds = activeCourtIds.slice(courtCursor, courtCursor + courtBudget);
      courtCursor += courtBudget;

      if (partitionCourtIds.length === 0) {
        throw new Error(
          `No courts allocated for ${getCategoryName(categoryId)}`
        );
      }

      const scopedTargets = categoryTargets.get(categoryId) ?? [{ categoryId }];
      let categoryStart = new Date(start);
      let categoryLatestEnd: Date | null = null;

      for (const target of scopedTargets) {
        const capacityResult = await runWithCapacityGuard(
          target,
          categoryStart,
          partitionCourtIds,
          partitionCourtIds.length,
          partitionCourtIds.length,
          occupiedWindows,
          params
        );
        notifyAdjustedStart(target, categoryStart, capacityResult.resolvedStart);
        const result = capacityResult.result;

        totalScheduled += result.stats.scheduledCount;
        totalUnscheduled += result.stats.unscheduledCount;
        allScheduled.push(
          ...result.scheduled.map((item) => ({
            ...item,
            matchId: `${getTargetScopeLabel(target)} • ${item.matchId}`,
          }))
        );
        allUnscheduled.push(
          ...result.unscheduled.map((item) => ({
            ...item,
            matchId: `${getTargetScopeLabel(target)} • ${item.matchId}`,
          }))
        );

        const targetEnd = result.scheduled.reduce<Date | null>((latest, item) => {
          if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
          return latest;
        }, null);

        if (targetEnd) {
          categoryStart = new Date(targetEnd.getTime() + params.bufferMinutes * 60_000);
          if (!categoryLatestEnd || targetEnd > categoryLatestEnd) {
            categoryLatestEnd = targetEnd;
          }
        }
      }

      if (categoryLatestEnd && (!estimatedEndTime || categoryLatestEnd > estimatedEndTime)) {
        estimatedEndTime = categoryLatestEnd;
      }
    }

    return {
      scheduled: allScheduled,
      unscheduled: allUnscheduled,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled,
        courtUtilization: 0,
        estimatedDuration: estimatedEndTime
          ? Math.ceil((estimatedEndTime.getTime() - start.getTime()) / 60_000)
          : 0,
      },
    };
  }

  // ── public API ─────────────────────────────────────────────────────────────

  /**
   * Execute the full schedule flow.
   *
   * 1. Optionally clear existing level-scoped draft times (schedule mode only)
   * 2. Run sequential or parallel-partitioned scheduling
   * 3. Persist the DraftSummary to lastResult
   * 4. Emit toast notifications
   * 5. Return the raw ScheduleResult so the dialog can emit('scheduled', …)
   */
  async function run(params: RunScheduleParams): Promise<ScheduleResult> {
    const resolvedTargets = params.selectedCategoryIds.flatMap((categoryId) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return [];
      return resolveScheduleTargetsForCategory(category, matchStore.matches as Match[]);
    });

    const isParallelPartitioned =
      params.mode === 'parallel_partitioned' && params.selectedCategoryIds.length > 1;

    isRunning.value = true;
    lastResult.value = null;

    try {
      // Step 1: clear existing level-scoped draft times (schedule mode only)
      const levelTargets = resolvedTargets.filter(
        (target): target is ScheduleTarget & { levelId: string } => Boolean(target.levelId)
      );

      if (!params.isReflowContext && levelTargets.length > 0) {
        await clearTimedScheduleScopes(tournamentId, levelTargets);
      }

      // Step 2: run the chosen scheduling strategy
      const start = params.startTime;

      let result: ScheduleResult;

      if (isParallelPartitioned) {
        const categoryTargetsMap = new Map<string, ScheduleTarget[]>(
          params.selectedCategoryIds.map((categoryId) => {
            const category = categories.find((c) => c.id === categoryId);
            const targets = category
              ? resolveScheduleTargetsForCategory(category, matchStore.matches as Match[])
              : [{ categoryId }];
            return [categoryId, targets];
          })
        );
        result = await runParallelPartitionedSchedule(
          resolvedTargets,
          start,
          params,
          categoryTargetsMap
        );
      } else {
        result = await runSequentialSchedule(resolvedTargets, start, params);
      }

      // Step 3: compute aggregate end time and store summary
      const estimatedEndTime = result.scheduled.reduce<Date | null>((latest, item) => {
        if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
        return latest;
      }, null);

      lastResult.value = {
        totalScheduled: result.stats.scheduledCount,
        totalUnscheduled: result.stats.unscheduledCount,
        estimatedEndTime,
        unscheduledList: result.unscheduled,
        scheduledCategoryIds: [...params.selectedCategoryIds],
      };

      // Step 4: toast
      if (result.stats.unscheduledCount > 0) {
        notificationStore.showToast(
          'warning',
          `Draft updated: ${result.stats.scheduledCount} matches scheduled, ${result.stats.unscheduledCount} unscheduled`
        );
      } else {
        notificationStore.showToast(
          'success',
          `Draft updated: ${result.stats.scheduledCount} matches scheduled`
        );
      }

      return result;
    } catch (error) {
      notificationStore.showToast(
        'error',
        error instanceof Error
          ? error.message
          : params.isReflowContext
            ? 'Failed to re-schedule matches'
            : 'Failed to schedule matches'
      );
      throw error;
    } finally {
      isRunning.value = false;
    }
  }

  /**
   * Publish the last draft by flipping scheduleStatus → 'published'.
   * Returns the published count.
   */
  async function publish(categoryIds: string[]): Promise<{ publishedCount: number }> {
    const uid = authStore.currentUser?.id ?? 'unknown';
    isPublishing.value = true;
    try {
      const result = await publishSchedule(tournamentId, categoryIds, uid);
      notificationStore.showToast('success', `Published schedule (${result.publishedCount} matches)`);
      return result;
    } catch (error) {
      notificationStore.showToast('error', 'Failed to publish schedule');
      throw error;
    } finally {
      isPublishing.value = false;
    }
  }

  // ── exposed API ────────────────────────────────────────────────────────────

  return {
    /** Computed schedule targets for ALL provided categories. */
    scheduleTargets,
    /** True while run() is executing. */
    isRunning,
    /** True while publish() is executing. */
    isPublishing,
    /** Result of the last successful run(). */
    lastResult,
    /** True when lastResult contains at least one scheduled match. */
    hasDraft,
    /** Execute the full schedule flow. */
    run,
    /** Publish the draft schedule. */
    publish,
  };
}
