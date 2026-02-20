<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMatchScheduler, type ScheduleResult } from '@/composables/useMatchScheduler';
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
const notificationStore = useNotificationStore();

const loading = ref(false);
const selectedCategoryIds = ref<string[]>([]);
const startTime = ref('');
const matchDuration = ref(20);
const breakTime = ref(5);

// Pre-select all categories when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedCategoryIds.value = props.categories.map(c => c.id);
  }
});

async function runAutoSchedule() {
  if (selectedCategoryIds.value.length === 0) {
    notificationStore.showToast('error', 'Please select at least one category');
    return;
  }

  if (!startTime.value) {
    notificationStore.showToast('error', 'Please set a start time');
    return;
  }

  const allCourts = props.courts
    .filter(c => c.status !== 'maintenance')
    .sort((a, b) => a.number - b.number);

  if (allCourts.length === 0) {
    notificationStore.showToast('error', 'No courts available');
    return;
  }

  loading.value = true;
  try {
    let totalScheduled = 0;
    let totalUnscheduled: ScheduleResult['unscheduled'] = [];
    const startDate = new Date(startTime.value);

    // Schedule each category separately
    for (const categoryId of selectedCategoryIds.value) {
      const result = await scheduler.scheduleMatches(props.tournamentId, {
        categoryId,
        courtIds: allCourts.map(c => c.id),
        startTime: startDate,
        respectDependencies: true,
      });

      totalScheduled += result.scheduled.length;
      totalUnscheduled = [...totalUnscheduled, ...result.unscheduled];
    }

    const combinedResult: ScheduleResult = {
      scheduled: [], // Not needed for display
      unscheduled: totalUnscheduled,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled.length,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled.length,
        courtUtilization: 0,
        estimatedDuration: 0,
      },
    };

    if (totalUnscheduled.length > 0) {
      notificationStore.showToast(
        'warning',
        `Scheduled ${totalScheduled} matches, ${totalUnscheduled.length} failed`
      );
    } else {
      notificationStore.showToast('success', `Scheduled ${totalScheduled} matches`);
      emit('update:modelValue', false);
    }
    
    emit('scheduled', combinedResult);
  } catch (error) {
    console.error('Auto-schedule error:', error);
    notificationStore.showToast('error', 'Failed to auto-schedule');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Auto-Schedule Matches"
    max-width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
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

    <v-text-field
      v-model="startTime"
      type="datetime-local"
      label="Start Time"
      variant="outlined"
      class="mb-4"
    />

    <v-row>
      <v-col cols="6">
        <v-text-field
          v-model.number="matchDuration"
          type="number"
          label="Match Duration (min)"
          variant="outlined"
        />
      </v-col>
      <v-col cols="6">
        <v-text-field
          v-model.number="breakTime"
          type="number"
          label="Break Time (min)"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="loading"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        @click="runAutoSchedule"
      >
        Run Auto-Schedule
      </v-btn>
    </template>
  </BaseDialog>
</template>
