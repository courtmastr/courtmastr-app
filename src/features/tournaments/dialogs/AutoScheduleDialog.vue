<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMatchScheduler, type ScheduleResult } from '@/composables/useMatchScheduler';
import { publishSchedule } from '@/composables/useTimeScheduler';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Category, Court } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categories: Category[];
  courts: Court[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'scheduled': [result: ScheduleResult];
}>();

const scheduler = useMatchScheduler();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const loading = ref(false);
const publishing = ref(false);
const selectedCategoryIds = ref<string[]>([]);
const startTime = ref('');
const matchDuration = ref(20);
const breakTime = ref(5);
const sequential = ref(true); // sequential vs parallel multi-category scheduling

// Concurrency defaults to active non-maintenance court count
const activeCourts = computed(() =>
  props.courts.filter(c => c.status !== 'maintenance')
);
const concurrency = ref(0); // 0 = auto-compute from courts (used in sequential / single-category mode)
const effectiveConcurrency = computed(() =>
  concurrency.value > 0 ? concurrency.value : activeCourts.value.length || 1
);

// Per-category courts (used in Parallel + multiple categories mode)
const categoryConcurrency = ref<Record<string, number>>({});

// Keep categoryConcurrency in sync with selected categories
watch(selectedCategoryIds, (ids) => {
  for (const id of ids) {
    if (!(id in categoryConcurrency.value)) categoryConcurrency.value[id] = 0;
  }
  for (const id of Object.keys(categoryConcurrency.value)) {
    if (!ids.includes(id)) delete categoryConcurrency.value[id];
  }
}, { immediate: true });

// Per-category effective concurrency: falls back to global effectiveConcurrency when 0
function categoryEffectiveConcurrency(categoryId: string): number {
  const v = categoryConcurrency.value[categoryId] ?? 0;
  return v > 0 ? v : effectiveConcurrency.value;
}

// Total simultaneous courts across all selected categories (parallel mode summary row)
const totalParallelConcurrency = computed(() =>
  selectedCategoryIds.value.reduce((sum, id) => sum + categoryEffectiveConcurrency(id), 0)
);

// Show per-category courts table only when Parallel + multiple categories
const showPerCategoryConcurrency = computed(() =>
  !sequential.value && selectedCategoryIds.value.length > 1
);

// Schedule result state
const lastResult = ref<{
  totalScheduled: number;
  totalUnscheduled: number;
  estimatedEndTime: Date | null;
  unscheduledList: ScheduleResult['unscheduled'];
  scheduledCategoryIds: string[];
} | null>(null);

const hasDraft = computed(() => lastResult.value !== null && lastResult.value.totalScheduled > 0);

// Pre-select all categories when dialog opens; reset result and per-category state
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedCategoryIds.value = props.categories.map(c => c.id);
    lastResult.value = null;
    categoryConcurrency.value = {};
  }
});

async function runSchedule() {
  if (selectedCategoryIds.value.length === 0) {
    notificationStore.showToast('error', 'Please select at least one category');
    return;
  }
  if (!startTime.value) {
    notificationStore.showToast('error', 'Please set a start time');
    return;
  }

  loading.value = true;
  lastResult.value = null;

  try {
    let totalScheduled = 0;
    let totalUnscheduled = 0;
    let estimatedEndTime: Date | null = null;
    const allUnscheduled: ScheduleResult['unscheduled'] = [];

    let categoryStartDate = new Date(startTime.value);

    for (const categoryId of selectedCategoryIds.value) {
      const catConcurrency = showPerCategoryConcurrency.value
        ? categoryEffectiveConcurrency(categoryId)
        : effectiveConcurrency.value;

      const result = await scheduler.scheduleMatches(props.tournamentId, {
        categoryId,
        courtIds: activeCourts.value.map(c => c.id),
        startTime: categoryStartDate,
        matchDurationMinutes: matchDuration.value,
        bufferMinutes: breakTime.value,
        concurrency: catConcurrency,
        respectDependencies: false, // time-first uses round ordering, not dep graph
      });

      totalScheduled += result.stats.scheduledCount;
      totalUnscheduled += result.stats.unscheduledCount;
      allUnscheduled.push(...result.unscheduled);

      const catEndTime = result.scheduled.length > 0
        ? result.scheduled.reduce<Date | null>((latest, s) =>
            latest === null || s.estimatedEndTime > latest ? s.estimatedEndTime : latest, null)
        : null;

      if (catEndTime && (estimatedEndTime === null || catEndTime > estimatedEndTime)) {
        estimatedEndTime = catEndTime;
      }

      // Sequential mode: next category starts after this one ends
      // Parallel mode: all categories share the same startTime — do not advance
      if (sequential.value && catEndTime) {
        categoryStartDate = new Date(catEndTime.getTime() + breakTime.value * 60_000);
      }
    }

    lastResult.value = {
      totalScheduled,
      totalUnscheduled,
      estimatedEndTime,
      unscheduledList: allUnscheduled,
      scheduledCategoryIds: [...selectedCategoryIds.value],
    };

    const combinedResult: ScheduleResult = {
      scheduled: [],
      unscheduled: allUnscheduled,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled,
        courtUtilization: 0,
        estimatedDuration: 0,
      },
    };

    if (totalUnscheduled > 0) {
      notificationStore.showToast(
        'warning',
        `Scheduled ${totalScheduled} matches, ${totalUnscheduled} could not be scheduled`
      );
    } else {
      notificationStore.showToast('success', `Draft schedule created: ${totalScheduled} matches`);
    }

    emit('scheduled', combinedResult);
  } catch (error) {
    console.error('Auto-schedule error:', error);
    notificationStore.showToast('error', 'Failed to create schedule');
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
    title="Schedule Matches"
    max-width="560"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- Category selector -->
    <v-select
      v-model="selectedCategoryIds"
      :items="categories"
      item-title="name"
      item-value="id"
      label="Categories to Schedule"
      multiple
      chips
      closable-chips
      variant="outlined"
      class="mb-4"
    >
      <template #prepend-item>
        <v-list-item
          title="Select All"
          @click="selectedCategoryIds = categories.map(c => c.id)"
        />
        <v-divider class="mt-2" />
      </template>
    </v-select>

    <!-- Start time -->
    <v-text-field
      v-model="startTime"
      type="datetime-local"
      label="Start Time"
      variant="outlined"
      class="mb-4"
    />

    <!-- Duration & buffer row -->
    <v-row class="mb-2">
      <v-col cols="4">
        <v-text-field
          v-model.number="matchDuration"
          type="number"
          min="5"
          label="Match Duration (min)"
          variant="outlined"
        />
      </v-col>
      <v-col cols="4">
        <v-text-field
          v-model.number="breakTime"
          type="number"
          min="0"
          label="Buffer Between (min)"
          variant="outlined"
        />
      </v-col>
      <!-- Global concurrency: hidden when per-category table is shown -->
      <v-col
        v-if="!showPerCategoryConcurrency"
        cols="4"
      >
        <v-text-field
          v-model.number="concurrency"
          type="number"
          min="1"
          :placeholder="`${effectiveConcurrency} (courts)`"
          label="Simultaneous Matches"
          variant="outlined"
          hint="0 = use court count"
          persistent-hint
        />
      </v-col>
    </v-row>

    <!-- Per-category courts table (Parallel + multiple categories only) -->
    <v-card
      v-if="showPerCategoryConcurrency"
      variant="outlined"
      class="mb-4"
    >
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-left">
              Category
            </th>
            <th
              class="text-right"
              style="width: 120px"
            >
              Courts
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="cat in categories.filter(c => selectedCategoryIds.includes(c.id))"
            :key="cat.id"
          >
            <td>{{ cat.name }}</td>
            <td class="text-right pr-3">
              <input
                v-model.number="categoryConcurrency[cat.id]"
                type="number"
                min="1"
                :placeholder="`${effectiveConcurrency}`"
                style="width: 64px; text-align: right; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 4px; padding: 2px 6px; background: transparent; color: inherit;"
              >
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="text-medium-emphasis">
            <td class="text-caption">
              Total simultaneous
            </td>
            <td class="text-right text-caption pr-3 font-weight-medium">
              {{ totalParallelConcurrency }}
            </td>
          </tr>
        </tfoot>
      </v-table>
      <div class="text-caption text-medium-emphasis px-3 pb-2">
        Leave blank to use the court count ({{ effectiveConcurrency }}) for that category.
      </div>
    </v-card>

    <!-- Sequential vs Parallel (only shown for multiple categories) -->
    <v-row
      v-if="selectedCategoryIds.length > 1"
      class="mb-4"
    >
      <v-col cols="12">
        <v-btn-toggle
          v-model="sequential"
          mandatory
          variant="outlined"
          density="compact"
        >
          <v-btn :value="true">
            Sequential (recommended)
          </v-btn>
          <v-btn :value="false">
            Parallel
          </v-btn>
        </v-btn-toggle>
        <div class="text-caption text-medium-emphasis mt-1">
          <template v-if="sequential">
            Categories are scheduled one after another. Best for leagues with shared courts.
          </template>
          <template v-else>
            All categories share the same time window. Best for tournaments with dedicated courts per category.
          </template>
        </div>
      </v-col>
    </v-row>

    <!-- Schedule preview / results -->
    <v-card
      v-if="lastResult"
      variant="tonal"
      class="mb-4"
    >
      <v-card-text>
        <div class="d-flex justify-space-between mb-2">
          <span class="font-weight-medium">Draft Schedule Created</span>
          <v-chip
            size="small"
            color="primary"
            variant="tonal"
          >
            draft
          </v-chip>
        </div>
        <div class="text-body-2">
          <div>Scheduled: <strong>{{ lastResult.totalScheduled }}</strong> matches</div>
          <div v-if="lastResult.totalUnscheduled > 0" class="text-warning">
            Could not schedule: <strong>{{ lastResult.totalUnscheduled }}</strong> matches
          </div>
          <div>Estimated end: <strong>{{ formatTime(lastResult.estimatedEndTime) }}</strong></div>
        </div>

        <!-- Unscheduled list -->
        <v-expansion-panels
          v-if="lastResult.unscheduledList.length > 0"
          class="mt-3"
        >
          <v-expansion-panel>
            <v-expansion-panel-title class="text-caption text-warning">
              {{ lastResult.unscheduledList.length }} unscheduled — click for details
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div
                v-for="u in lastResult.unscheduledList"
                :key="u.matchId"
                class="text-caption mb-1"
              >
                <span class="font-weight-medium">{{ u.matchId }}</span>: {{ u.reason }}
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>

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
        {{ lastResult ? 'Re-run Schedule' : 'Generate Draft' }}
      </v-btn>
      <v-btn
        v-if="hasDraft"
        color="primary"
        variant="flat"
        :loading="publishing"
        :disabled="loading"
        @click="publishDraftSchedule"
      >
        Publish Schedule
      </v-btn>
    </template>
  </BaseDialog>
</template>
