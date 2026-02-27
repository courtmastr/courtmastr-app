<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
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
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Category, Court } from '@/types';

type SchedulingMode = 'sequential' | 'parallel_partitioned';
type ScheduleDialogContext = 'reflow' | 'schedule';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categories: Category[];
  courts: Court[];
  dialogContext?: ScheduleDialogContext;
  initialCategoryIds?: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'scheduled': [result: ScheduleResult];
}>();

const scheduler = useMatchScheduler();
const authStore = useAuthStore();
const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const tournamentStore = useTournamentStore();

const loading = ref(false);
const publishing = ref(false);
const selectedCategoryIds = ref<string[]>([]);
const startTime = ref('');
const matchDuration = ref(20);
const breakTime = ref(5);
const mode = ref<SchedulingMode>('sequential');
const concurrency = ref(0); // 0 = use all active courts
const allowPublishedChanges = ref(false);
const categoryCourtBudgets = ref<Record<string, number>>({});

const isReflowContext = computed(() => props.dialogContext !== 'schedule');
const selectedIntent = computed<'schedule' | 'reschedule' | 'mixed' | 'reflow'>(() => {
  if (isReflowContext.value) return 'reflow';
  if (selectedCategoryIds.value.length === 0) return 'schedule';

  let withPlannedTimes = 0;
  let withoutPlannedTimes = 0;
  for (const categoryId of selectedCategoryIds.value) {
    const hasPlanned = matchStore.matches.some(
      (match) =>
        match.categoryId === categoryId
        && (Boolean(match.plannedStartAt) || Boolean(match.scheduledTime))
    );
    if (hasPlanned) {
      withPlannedTimes++;
    } else {
      withoutPlannedTimes++;
    }
  }

  if (withPlannedTimes > 0 && withoutPlannedTimes > 0) return 'mixed';
  if (withPlannedTimes > 0) return 'reschedule';
  return 'schedule';
});
const dialogTitle = computed(() => {
  switch (selectedIntent.value) {
    case 'reflow':
      return 'Re-Schedule Matches';
    case 'schedule':
      return 'Schedule Times';
    case 'reschedule':
      return 'Re-Schedule Times';
    default:
      return 'Schedule / Re-Schedule Times';
  }
});
const categoryFieldLabel = computed(() =>
  isReflowContext.value ? 'Categories to Re-Schedule' : 'Categories to Schedule'
);
const startTimeFieldLabel = computed(() =>
  isReflowContext.value ? 'Reflow Start Time' : 'Schedule Start Time'
);
const topInfoText = computed(() =>
  selectedIntent.value === 'reflow'
    ? 'Safe defaults: this reflow only updates draft/unscheduled matches. In-progress, completed, and assigned matches stay untouched.'
    : selectedIntent.value === 'reschedule'
      ? 'Re-schedule existing planned times and publish separately when ready. Public schedule shows times only (courts hidden).'
      : selectedIntent.value === 'mixed'
        ? 'This selection includes both new and already planned categories. Schedule/Re-schedule times, then publish separately.'
        : 'Schedule match times and publish separately when ready. Public schedule shows times only (courts hidden).'
);
const draftInfoText = computed(() =>
  selectedIntent.value === 'reflow'
    ? 'Re-schedule never auto-publishes. Publish is a separate explicit action.'
    : 'Schedule never auto-publishes. Publish is a separate explicit action.'
);
const multiCategoryHint = computed(() =>
  selectedCategoryIds.value.length > 1
    ? 'Tip: Use Parallel (Partitioned) to split courts across categories in the same window.'
    : 'Select more categories to enable parallel partitioned court allocation.'
);
const runDraftLabel = computed(() => {
  if (lastResult.value) return 'Re-Run Draft';
  if (selectedIntent.value === 'reflow') return 'Generate Reflow Draft';
  if (selectedIntent.value === 'schedule') return 'Generate Schedule Draft';
  if (selectedIntent.value === 'reschedule') return 'Generate Re-Schedule Draft';
  return 'Generate Draft';
});

const activeCourts = computed(() =>
  [...props.courts]
    .filter((court) => court.status !== 'maintenance')
    .sort((a, b) => a.number - b.number)
);
const activeCourtIds = computed(() => activeCourts.value.map((court) => court.id));
const availableCourtCount = computed(() => activeCourtIds.value.length);
const selectedCategories = computed(() =>
  props.categories.filter((category) => selectedCategoryIds.value.includes(category.id))
);
const categoryTargets = computed(() =>
  selectedCategories.value.map((category) => ({
    categoryId: category.id,
    targets: resolveScheduleTargetsForCategory(category, matchStore.matches),
  }))
);
const scheduleTargets = computed(() =>
  categoryTargets.value.flatMap((entry) => entry.targets)
);
const replacesLevelSchedules = computed(() =>
  scheduleTargets.value.some((target) => Boolean(target.levelId))
);
const isParallelPartitioned = computed(
  () => mode.value === 'parallel_partitioned' && selectedCategoryIds.value.length > 1
);

const effectiveConcurrency = computed(() =>
  availableCourtCount.value === 0
    ? 0
    : Math.min(
        concurrency.value > 0 ? concurrency.value : availableCourtCount.value,
        availableCourtCount.value
      )
);

const allocatedCourtTotal = computed(() =>
  selectedCategoryIds.value.reduce(
    (sum, categoryId) => sum + Math.max(0, Number(categoryCourtBudgets.value[categoryId] ?? 0)),
    0
  )
);

const allocationInvalidReason = computed<string | null>(() => {
  if (!isParallelPartitioned.value) return null;
  if (selectedCategoryIds.value.length === 0) return 'Select at least one category';
  if (availableCourtCount.value === 0) return 'No available courts to schedule';
  if (selectedCategoryIds.value.length > availableCourtCount.value) {
    return 'Parallel partitioned mode needs at least one court per selected category';
  }
  if (allocatedCourtTotal.value > availableCourtCount.value) {
    return 'Allocated courts exceed available courts';
  }
  const hasMissingCourt = selectedCategoryIds.value.some(
    (categoryId) => Math.max(0, Number(categoryCourtBudgets.value[categoryId] ?? 0)) < 1
  );
  if (hasMissingCourt) {
    return 'Each selected category needs at least one court in parallel partitioned mode';
  }
  return null;
});

interface DraftSummary {
  totalScheduled: number;
  totalUnscheduled: number;
  estimatedEndTime: Date | null;
  unscheduledList: ScheduleResult['unscheduled'];
  scheduledCategoryIds: string[];
}

const lastResult = ref<DraftSummary | null>(null);
const hasDraft = computed(() => Boolean(lastResult.value && lastResult.value.totalScheduled > 0));
const MAX_CAPACITY_GUARD_ITERATIONS = 24;

function getCategoryName(categoryId: string): string {
  return props.categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

function getTargetScopeLabel(target: ScheduleTarget): string {
  if (!target.levelId) {
    return getCategoryName(target.categoryId);
  }
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

function buildCapacityOccupiedWindows(): OccupiedScheduleWindow[] {
  return buildOccupiedWindows(matchStore.matches, {
    fallbackDurationMinutes: Math.max(1, matchDuration.value),
    excludeScopes: scheduleTargets.value,
  });
}

function notifyAdjustedStart(target: ScheduleTarget, from: Date, to: Date): void {
  if (from.getTime() === to.getTime()) return;
  notificationStore.showToast(
    'warning',
    `Start adjusted for ${getTargetScopeLabel(target)} from ${formatDateTime(from)} to ${formatDateTime(to)} to avoid overlap with existing draft/published schedule.`
  );
}

function getDefaultStartTimeValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getInitialCategorySelection(): string[] {
  const available = new Set(props.categories.map((category) => category.id));
  const requested = (props.initialCategoryIds ?? []).filter((categoryId) => available.has(categoryId));
  if (requested.length > 0) {
    return [...new Set(requested)];
  }
  return props.categories.map((category) => category.id);
}

function normalizeBudget(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function getCategoryBudget(categoryId: string): number {
  return normalizeBudget(categoryCourtBudgets.value[categoryId]);
}

function setCategoryBudget(categoryId: string, value: unknown): void {
  const normalized = Math.min(
    availableCourtCount.value,
    Math.max(0, normalizeBudget(value))
  );
  categoryCourtBudgets.value = {
    ...categoryCourtBudgets.value,
    [categoryId]: normalized,
  };
}

function setDefaultBudgets(): void {
  if (selectedCategoryIds.value.length === 0) {
    categoryCourtBudgets.value = {};
    return;
  }

  const sortedCategoryIds = [...selectedCategoryIds.value];
  const maxCourts = availableCourtCount.value;
  const nextBudgets: Record<string, number> = {};

  if (maxCourts <= 0) {
    for (const categoryId of sortedCategoryIds) {
      nextBudgets[categoryId] = 0;
    }
    categoryCourtBudgets.value = nextBudgets;
    return;
  }

  if (maxCourts < sortedCategoryIds.length) {
    for (const [index, categoryId] of sortedCategoryIds.entries()) {
      nextBudgets[categoryId] = index < maxCourts ? 1 : 0;
    }
    categoryCourtBudgets.value = nextBudgets;
    return;
  }

  const base = Math.floor(maxCourts / sortedCategoryIds.length);
  let remainder = maxCourts % sortedCategoryIds.length;
  for (const categoryId of sortedCategoryIds) {
    nextBudgets[categoryId] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder--;
    }
  }

  categoryCourtBudgets.value = nextBudgets;
}

function resetDialogState(): void {
  selectedCategoryIds.value = getInitialCategorySelection();
  lastResult.value = null;
  matchDuration.value = tournamentStore.currentTournament?.settings?.matchDurationMinutes ?? 20;
  breakTime.value = Number(
    (tournamentStore.currentTournament?.settings as { bufferMinutes?: number } | undefined)
      ?.bufferMinutes ?? 5
  );
  mode.value = 'sequential';
  concurrency.value = 0;
  allowPublishedChanges.value = false;
  startTime.value = getDefaultStartTimeValue();
  setDefaultBudgets();
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      resetDialogState();
    }
  }
);

watch(
  [selectedCategoryIds, availableCourtCount],
  () => {
    if (isParallelPartitioned.value) {
      const activeIds = new Set(selectedCategoryIds.value);
      const nextBudgets: Record<string, number> = {};
      for (const categoryId of selectedCategoryIds.value) {
        const existing = getCategoryBudget(categoryId);
        nextBudgets[categoryId] = Math.min(existing || 1, availableCourtCount.value);
      }
      categoryCourtBudgets.value = nextBudgets;
      if (Object.keys(nextBudgets).length === 0 && activeIds.size > 0) {
        setDefaultBudgets();
      }
    }
  },
  { deep: true }
);

watch(mode, (nextMode) => {
  if (nextMode === 'parallel_partitioned') {
    setDefaultBudgets();
  }
});

async function scheduleCategoryWithConfig(
  target: ScheduleTarget,
  scheduleStart: Date,
  courtIds: string[],
  categoryConcurrency: number,
  dryRun = false
): Promise<ScheduleResult> {
  return scheduler.scheduleMatches(props.tournamentId, {
    categoryId: target.categoryId,
    levelId: target.levelId,
    courtIds,
    startTime: scheduleStart,
    matchDurationMinutes: matchDuration.value,
    bufferMinutes: breakTime.value,
    concurrency: categoryConcurrency,
    respectDependencies: false,
    reflowMode: isReflowContext.value,
    allowPublishedChanges: isReflowContext.value ? allowPublishedChanges.value : false,
    includeAssignedMatches: isReflowContext.value ? false : undefined,
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
  occupiedWindows: OccupiedScheduleWindow[]
): Promise<CapacityGuardRunResult> {
  const originalStart = new Date(requestedStart);
  const scopedCapacity = Math.max(1, Math.floor(availableCapacity));

  if (occupiedWindows.length === 0) {
    const directResult = await scheduleCategoryWithConfig(
      target,
      originalStart,
      courtIds,
      categoryConcurrency
    );
    return {
      result: directResult,
      resolvedStart: originalStart,
      shiftedFrom: null,
    };
  }

  let candidateStart = new Date(originalStart);
  for (let attempt = 0; attempt < MAX_CAPACITY_GUARD_ITERATIONS; attempt += 1) {
    const dryRunResult = await scheduleCategoryWithConfig(
      target,
      candidateStart,
      courtIds,
      categoryConcurrency,
      true
    );

    const candidateWindows = extractScheduledWindows(dryRunResult.scheduled);
    if (candidateWindows.length === 0) {
      const commitResult = await scheduleCategoryWithConfig(
        target,
        candidateStart,
        courtIds,
        categoryConcurrency
      );
      return {
        result: commitResult,
        resolvedStart: candidateStart,
        shiftedFrom: candidateStart.getTime() === originalStart.getTime() ? null : originalStart,
      };
    }

    const conflict = findCapacityConflict(occupiedWindows, candidateWindows, scopedCapacity);
    if (!conflict) {
      const commitResult = await scheduleCategoryWithConfig(
        target,
        candidateStart,
        courtIds,
        categoryConcurrency
      );
      return {
        result: commitResult,
        resolvedStart: candidateStart,
        shiftedFrom: candidateStart.getTime() === originalStart.getTime() ? null : originalStart,
      };
    }

    if (conflict.nextBoundaryMs <= candidateStart.getTime()) {
      break;
    }
    candidateStart = new Date(conflict.nextBoundaryMs);
  }

  throw new Error('Unable to find non-conflicting schedule window with current court capacity');
}

async function runSequentialSchedule(start: Date): Promise<ScheduleResult> {
  let totalScheduled = 0;
  let totalUnscheduled = 0;
  const allScheduled: ScheduleResult['scheduled'] = [];
  const allUnscheduled: ScheduleResult['unscheduled'] = [];
  let estimatedEndTime: Date | null = null;
  let nextStart = new Date(start);
  const occupiedWindows = buildCapacityOccupiedWindows();

  for (const target of scheduleTargets.value) {
    const capacityResult = await runWithCapacityGuard(
      target,
      nextStart,
      activeCourtIds.value,
      Math.max(1, effectiveConcurrency.value),
      activeCourtIds.value.length,
      occupiedWindows
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
      nextStart = new Date(targetEnd.getTime() + breakTime.value * 60_000);
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

async function runParallelPartitionedSchedule(start: Date): Promise<ScheduleResult> {
  if (allocationInvalidReason.value) {
    throw new Error(allocationInvalidReason.value);
  }

  const allScheduled: ScheduleResult['scheduled'] = [];
  const allUnscheduled: ScheduleResult['unscheduled'] = [];
  let totalScheduled = 0;
  let totalUnscheduled = 0;
  let estimatedEndTime: Date | null = null;
  let courtCursor = 0;
  const occupiedWindows = buildCapacityOccupiedWindows();
  const targetsByCategoryId = new Map(
    categoryTargets.value.map((entry) => [entry.categoryId, entry.targets])
  );

  for (const categoryId of selectedCategoryIds.value) {
    const courtBudget = getCategoryBudget(categoryId);
    const partitionCourtIds = activeCourtIds.value.slice(courtCursor, courtCursor + courtBudget);
    courtCursor += courtBudget;

    if (partitionCourtIds.length === 0) {
      throw new Error(`No courts allocated for ${getCategoryName(categoryId)}`);
    }

    const targets = targetsByCategoryId.get(categoryId) || [{ categoryId }];
    let categoryStart = new Date(start);
    let categoryLatestEnd: Date | null = null;

    for (const target of targets) {
      const capacityResult = await runWithCapacityGuard(
        target,
        categoryStart,
        partitionCourtIds,
        partitionCourtIds.length,
        partitionCourtIds.length,
        occupiedWindows
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
        categoryStart = new Date(targetEnd.getTime() + breakTime.value * 60_000);
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

async function runSchedule() {
  if (selectedCategoryIds.value.length === 0) {
    notificationStore.showToast('error', 'Please select at least one category');
    return;
  }
  if (!startTime.value) {
    notificationStore.showToast('error', 'Please set a start time');
    return;
  }
  if (availableCourtCount.value === 0) {
    notificationStore.showToast('error', 'No available courts to schedule');
    return;
  }
  if (isParallelPartitioned.value && allocationInvalidReason.value) {
    notificationStore.showToast('error', allocationInvalidReason.value);
    return;
  }

  const poolCategoriesWithNoStage = selectedCategories.value.filter(
    (category) => category.format === 'pool_to_elimination' && category.poolStageId == null
  );
  if (poolCategoriesWithNoStage.length > 0) {
    const names = poolCategoriesWithNoStage.map((category) => category.name).join(', ');
    notificationStore.showToast(
      'warning',
      `Pool brackets not generated for: ${names}. Generate pool brackets first, then schedule.`
    );
    return;
  }

  loading.value = true;
  lastResult.value = null;

  try {
    const levelTargets = scheduleTargets.value.filter(
      (target): target is ScheduleTarget & { levelId: string } => Boolean(target.levelId)
    );

    if (!isReflowContext.value && levelTargets.length > 0) {
      await clearTimedScheduleScopes(props.tournamentId, levelTargets);
    }

    const start = new Date(startTime.value);
    const result = isParallelPartitioned.value
      ? await runParallelPartitionedSchedule(start)
      : await runSequentialSchedule(start);

    const estimatedEndTime = result.scheduled.reduce<Date | null>((latest, item) => {
      if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
      return latest;
    }, null);

    lastResult.value = {
      totalScheduled: result.stats.scheduledCount,
      totalUnscheduled: result.stats.unscheduledCount,
      estimatedEndTime,
      unscheduledList: result.unscheduled,
      scheduledCategoryIds: [...selectedCategoryIds.value],
    };

    if (result.stats.unscheduledCount > 0) {
      notificationStore.showToast(
        'warning',
        `Draft updated: ${result.stats.scheduledCount} matches scheduled, ${result.stats.unscheduledCount} unscheduled`
      );
    } else {
      notificationStore.showToast('success', `Draft updated: ${result.stats.scheduledCount} matches scheduled`);
    }

    emit('scheduled', result);
  } catch (error) {
    console.error('Schedule dialog error:', error);
    notificationStore.showToast(
      'error',
      error instanceof Error
        ? error.message
        : isReflowContext.value
          ? 'Failed to re-schedule matches'
          : 'Failed to schedule matches'
    );
  } finally {
    loading.value = false;
  }
}

async function publishDraftSchedule() {
  if (!lastResult.value) return;

  publishing.value = true;
  try {
    const uid = authStore.currentUser?.id ?? 'unknown';
    const { publishedCount } = await publishSchedule(
      props.tournamentId,
      lastResult.value.scheduledCategoryIds,
      uid
    );
    notificationStore.showToast('success', `Published schedule (${publishedCount} matches)`);
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Publish error:', error);
    notificationStore.showToast('error', 'Failed to publish schedule');
  } finally {
    publishing.value = false;
  }
}

function formatTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="dialogTitle"
    max-width="680"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      {{ topInfoText }}
    </v-alert>

    <v-alert
      v-if="replacesLevelSchedules && !isReflowContext"
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      Existing level schedule for selected categories will be replaced. Pool/base schedule remains unchanged.
    </v-alert>

    <v-select
      v-model="selectedCategoryIds"
      :items="categories"
      item-title="name"
      item-value="id"
      :label="categoryFieldLabel"
      multiple
      chips
      closable-chips
      variant="outlined"
      class="mb-4"
    >
      <template #prepend-item>
        <v-list-item
          title="Select All"
          @click="selectedCategoryIds = categories.map((category) => category.id)"
        />
        <v-divider class="mt-2" />
      </template>
    </v-select>

    <v-text-field
      v-model="startTime"
      type="datetime-local"
      :label="startTimeFieldLabel"
      variant="outlined"
      class="mb-4"
    />

    <v-row class="mb-2">
      <v-col
        cols="12"
        md="4"
      >
        <v-text-field
          v-model.number="matchDuration"
          type="number"
          min="5"
          label="Match Duration (min)"
          variant="outlined"
        />
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-text-field
          v-model.number="breakTime"
          type="number"
          min="0"
          label="Buffer Between (min)"
          variant="outlined"
        />
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-text-field
          v-model.number="concurrency"
          type="number"
          min="0"
          :max="availableCourtCount"
          :disabled="isParallelPartitioned"
          :placeholder="`${availableCourtCount}`"
          label="Simultaneous Matches"
          variant="outlined"
          :hint="`0 = use all available courts (${availableCourtCount})`"
          persistent-hint
        />
      </v-col>
    </v-row>

    <v-row
      v-if="selectedCategoryIds.length > 1"
      class="mb-2"
    >
      <v-col cols="12">
        <v-btn-toggle
          v-model="mode"
          mandatory
          variant="outlined"
          density="compact"
        >
          <v-btn value="sequential">
            Sequential
          </v-btn>
          <v-btn value="parallel_partitioned">
            Parallel (Partitioned)
          </v-btn>
        </v-btn-toggle>
        <v-tooltip
          location="top"
          text="Sequential runs categories one after another. Parallel (Partitioned) runs them at the same time with fixed court allocation per category."
        >
          <template #activator="{ props: tooltipProps }">
            <v-icon
              v-bind="tooltipProps"
              size="16"
              class="ml-2 text-medium-emphasis"
            >
              mdi-help-circle-outline
            </v-icon>
          </template>
        </v-tooltip>
        <div class="text-caption text-medium-emphasis mt-1">
          <template v-if="mode === 'sequential'">
            Categories run one after another using the same court pool.
          </template>
          <template v-else>
            Categories run in the same time window with explicit per-category court budgets.
          </template>
        </div>
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis mb-2">
      {{ multiCategoryHint }}
    </div>

    <v-switch
      v-if="isReflowContext"
      v-model="allowPublishedChanges"
      density="compact"
      color="warning"
      inset
      hide-details
      class="mb-2"
      label="Allow published time changes during reflow"
    />

    <v-card
      v-if="isParallelPartitioned"
      variant="tonal"
      class="mb-4"
    >
      <v-card-title class="text-subtitle-2 d-flex align-center">
        Court Partition
        <v-tooltip
          location="top"
          text="Set how many courts each selected category can use in parallel mode."
        >
          <template #activator="{ props: tooltipProps }">
            <v-icon
              v-bind="tooltipProps"
              size="16"
              class="ml-1 text-medium-emphasis"
            >
              mdi-help-circle-outline
            </v-icon>
          </template>
        </v-tooltip>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="text"
          color="primary"
          prepend-icon="mdi-refresh"
          @click="setDefaultBudgets"
        >
          Auto Split
        </v-btn>
      </v-card-title>
      <v-card-text class="pt-2">
        <v-alert
          v-if="allocationInvalidReason"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ allocationInvalidReason }}
        </v-alert>

        <v-row
          v-for="category in selectedCategories"
          :key="category.id"
          dense
          class="mb-1"
        >
          <v-col
            cols="8"
            class="d-flex align-center text-body-2"
          >
            {{ category.name }}
          </v-col>
          <v-col cols="4">
            <v-text-field
              :model-value="getCategoryBudget(category.id)"
              type="number"
              min="0"
              :max="availableCourtCount"
              density="compact"
              variant="outlined"
              hide-details
              label="Courts"
              @update:model-value="setCategoryBudget(category.id, $event)"
            />
          </v-col>
        </v-row>

        <div class="text-caption text-medium-emphasis mt-2">
          Allocated {{ allocatedCourtTotal }} / {{ availableCourtCount }} courts
        </div>
      </v-card-text>
    </v-card>

    <v-alert
      v-if="lastResult"
      type="success"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex justify-space-between mb-1">
        <span class="font-weight-medium">Draft Ready</span>
        <v-chip
          size="small"
          variant="tonal"
          color="primary"
        >
          draft
        </v-chip>
      </div>
      <div class="text-body-2">
        <div>Scheduled: <strong>{{ lastResult.totalScheduled }}</strong> matches</div>
        <div v-if="lastResult.totalUnscheduled > 0">
          Unscheduled: <strong>{{ lastResult.totalUnscheduled }}</strong> matches
        </div>
        <div>Estimated end: <strong>{{ formatTime(lastResult.estimatedEndTime) }}</strong></div>
      </div>
    </v-alert>

    <v-expansion-panels
      v-if="lastResult && lastResult.unscheduledList.length > 0"
      class="mb-4"
    >
      <v-expansion-panel>
        <v-expansion-panel-title class="text-caption text-warning">
          {{ lastResult.unscheduledList.length }} unscheduled — click for details
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div
            v-for="item in lastResult.unscheduledList"
            :key="item.matchId"
            class="text-caption mb-1"
          >
            <span class="font-weight-medium">{{ item.matchId }}</span>: {{ item.reason }}
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ draftInfoText }}
    </v-alert>

    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="loading || publishing"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </v-btn>
      <v-btn
        variant="outlined"
        :loading="loading"
        :disabled="publishing"
        @click="runSchedule"
      >
        {{ runDraftLabel }}
      </v-btn>
      <v-btn
        v-if="hasDraft"
        color="primary"
        variant="flat"
        :loading="publishing"
        :disabled="loading"
        @click="publishDraftSchedule"
      >
        Publish Draft
      </v-btn>
    </template>
  </BaseDialog>
</template>
