<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Match, Court } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
  tournamentId: string;
  courts: Court[];
  matchDurationMinutes?: number; // from tournament settings; used for plannedEndAt
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'saved': [];
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const { getMatchDisplayName } = useMatchDisplay();

const selectedCourtId = ref<string | null>(null);
const scheduledTime = ref<string>('');
const lockTime = ref(false);
const loading = ref(false);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.match) {
    // Prefer plannedStartAt for display; fall back to legacy scheduledTime
    const displayTime = props.match.plannedStartAt ?? props.match.scheduledTime;
    scheduledTime.value = displayTime
      ? new Date(displayTime).toISOString().slice(0, 16)
      : '';
    selectedCourtId.value = props.match.courtId || null;
    lockTime.value = props.match.lockedTime ?? false;
  }
});

async function saveSchedule() {
  if (!props.match) return;

  loading.value = true;
  try {
    // Save planned time (Bug E fix: actually persist the time)
    if (scheduledTime.value) {
      const plannedStart = new Date(scheduledTime.value);
      const duration = props.matchDurationMinutes ?? 30;
      await matchStore.saveManualPlannedTime(
        props.tournamentId,
        props.match.id,
        plannedStart,
        duration,
        lockTime.value,
        props.match.categoryId,
        props.match.levelId
      );
    }

    // If court changed, update assignment separately
    if (selectedCourtId.value && selectedCourtId.value !== props.match.courtId) {
      await matchStore.assignCourt(
        props.tournamentId,
        props.match.id,
        selectedCourtId.value,
        props.match.categoryId,
        props.match.levelId
      );
    }

    notificationStore.showToast('success', 'Schedule updated');
    emit('saved');
    emit('update:modelValue', false);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update schedule');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Schedule Match"
    max-width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div
      v-if="match"
      class="mb-4"
    >
      <div class="text-subtitle-1 font-weight-bold mb-1">
        {{ getMatchDisplayName(match) }}
      </div>
    </div>

    <v-text-field
      v-model="scheduledTime"
      type="datetime-local"
      label="Planned Start Time"
      variant="outlined"
      class="mb-3"
    />

    <v-checkbox
      v-model="lockTime"
      label="Lock this time (will not be changed when schedule is re-run)"
      density="compact"
      class="mb-3"
    />

    <v-select
      v-model="selectedCourtId"
      :items="courts"
      item-title="name"
      item-value="id"
      label="Assigned Court (Optional)"
      variant="outlined"
      clearable
      class="mb-4"
    />

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
        @click="saveSchedule"
      >
        Save
      </v-btn>
    </template>
  </BaseDialog>
</template>
