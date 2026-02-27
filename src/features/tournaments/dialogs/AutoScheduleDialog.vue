<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
import { type ScheduleResult } from '@/composables/useMatchScheduler';
import { resolveScheduleTargetsForCategory } from '@/scheduling/autoScheduleTargets';
import {
  useScheduleOrchestrator,
  type SchedulingMode,
} from '@/scheduling/useScheduleOrchestrator';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Category, Court } from '@/types';

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

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const tournamentStore = useTournamentStore();

// ── orchestrator ──────────────────────────────────────────────────────────────
// The orchestrator receives the static tournament/courts/categories.  Because
// props may change when the dialog is reused, we pass them lazily via closures
// inside the run/publish calls rather than binding them once at setup time.
// For scheduleTargets (the computed exposed by the orchestrator) we create a
// local orchestrator bound to the current props at render time.
const orchestrator = computed(() =>
  useScheduleOrchestrator(props.tournamentId, props.courts, props.categories)
);

// Aliases – the template uses these names directly.
const isRunning = computed(() => orchestrator.value.isRunning.value);
const isPublishing = computed(() => orchestrator.value.isPublishing.value);
const lastResult = computed(() => orchestrator.value.lastResult.value);
const hasDraft = computed(() => orchestrator.value.hasDraft.value);

// loading / publishing aliases kept for template backward-compat
const loading = computed(() => isRunning.value);
const publishing = computed(() => isPublishing.value);

// ── local form state ──────────────────────────────────────────────────────────
const selectedCategoryIds = ref<string[]>([]);
const startTime = ref('');
const matchDuration = ref(20);
const breakTime = ref(5);
const mode = ref<SchedulingMode>('sequential');
const concurrency = ref(0); // 0 = use all active courts
const allowPublishedChanges = ref(false);
const categoryCourtBudgets = ref<Record<string, number>>({});

// ── derived UI state ──────────────────────────────────────────────────────────
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

// ── budget helpers ────────────────────────────────────────────────────────────

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

// ── dialog lifecycle ──────────────────────────────────────────────────────────

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

function resetDialogState(): void {
  selectedCategoryIds.value = getInitialCategorySelection();
  orchestrator.value.lastResult.value = null;
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

// ── actions ───────────────────────────────────────────────────────────────────

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

  try {
    const result = await orchestrator.value.run({
      selectedCategoryIds: selectedCategoryIds.value,
      startTime: new Date(startTime.value),
      matchDurationMinutes: matchDuration.value,
      bufferMinutes: breakTime.value,
      concurrency: concurrency.value,
      mode: mode.value,
      categoryCourtBudgets: categoryCourtBudgets.value,
      isReflowContext: isReflowContext.value,
      allowPublishedChanges: allowPublishedChanges.value,
    });
    emit('scheduled', result);
  } catch {
    // orchestrator already showed a toast; nothing more to do here
  }
}

async function publishDraftSchedule() {
  if (!lastResult.value) return;

  try {
    await orchestrator.value.publish(lastResult.value.scheduledCategoryIds);
    emit('update:modelValue', false);
  } catch {
    // orchestrator already showed a toast
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
